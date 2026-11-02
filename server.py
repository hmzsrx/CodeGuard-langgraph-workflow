"""
CodeGuard AI - FastAPI Backend Server
Connects frontend to LangGraph supervisor graph
"""
import json
import shutil
import sys
import uuid
import tempfile
from pathlib import Path
from typing import Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
from langgraph.types import Command

sys.path.insert(0, str(Path(__file__).parent))

from nodes.main_node import supervisor_graph
from state.agent_state import AgentState

threads: Dict[str, dict] = {}

app = FastAPI(title="CodeGuard AI API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sse_line(event: str, data: Any) -> str:
    payload = json.dumps({"event": event, "data": data}, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


def _final_state_values(config):
    try:
        state = supervisor_graph.get_state(config)
        vals = dict(state.values)
        return {
            "error_message": vals.get("error_message", ""),
            "file_updated": vals.get("file_updated", False),
            "approval_status": vals.get("approval_status", ""),
            "tests_passed": vals.get("tests_passed"),
            "test_results": vals.get("test_results", ""),
            "review_findings": vals.get("review_findings", ""),
            "fixed_code": vals.get("fixed_code", ""),
            "fix_explanation": vals.get("fix_explanation", ""),
            "original_code": vals.get("original_code", ""),
            "file_path": vals.get("file_path", ""),
            "backup_path": vals.get("backup_path", ""),
        }
    except Exception:
        return {"error_message": "Failed to get final state"}


def _iter_stream(graph_input, config):
    """Yield SSE lines from LangGraph stream with real-time node tracking."""
    thread_id = config["configurable"]["thread_id"]
    yield _sse_line("config", {"thread_id": thread_id})

    for namespace, mode, chunk in supervisor_graph.stream(
        graph_input,
        config=config,
        stream_mode=["updates", "custom"],
        subgraphs=True,
    ):
        if mode == "custom":
            if isinstance(chunk, dict) and chunk.get("type") == "llm_token":
                yield _sse_line("token", {
                    "content": chunk.get("content", ""),
                    "node": chunk.get("node", ""),
                })
            elif isinstance(chunk, dict) and chunk.get("type") == "node_start":
                yield _sse_line("node_start", {"node": chunk.get("node", "")})

        elif mode == "updates":
            if "__interrupt__" in chunk:
                interrupt_val = chunk["__interrupt__"][0].value if chunk["__interrupt__"] else {}
                yield _sse_line("interrupt", interrupt_val)
                break

            for node_name, update in chunk.items():
                if node_name == "__interrupt__":
                    continue
                yield _sse_line("node_complete", {"node": node_name})
                yield _sse_line("update", {"node": node_name, "update": update})

    yield _sse_line("end", _final_state_values(config))


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "CodeGuard AI"}


@app.post("/api/run")
async def run_review(payload: dict):
    file_content = payload.get("file_content")
    file_path = payload.get("file_path", "")
    file_name = payload.get("file_name", "script.py")
    original_file_path = payload.get("original_file_path", "")

    if file_content is not None and not isinstance(file_content, str):
        raise HTTPException(status_code=400, detail="File content must be text")
    if not isinstance(file_path, str):
        raise HTTPException(status_code=400, detail="File path must be text")
    if not isinstance(original_file_path, str):
        raise HTTPException(status_code=400, detail="Original file path must be text")

    file_content = file_content or ""
    file_path = file_path.strip()
    original_file_path = original_file_path.strip()
    path_source = not file_content.strip() and bool(file_path)

    if not file_content.strip() and not file_path:
        raise HTTPException(
            status_code=400,
            detail="Provide either file content or a local file path.",
        )
    if path_source:
        source_path = Path(file_path).expanduser()
        if not source_path.is_absolute():
            raise HTTPException(status_code=400, detail="File path must be absolute")
        try:
            source_path = source_path.resolve(strict=True)
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Could not access file path: {exc}")
        if not source_path.is_file():
            raise HTTPException(status_code=400, detail="The provided path is not a file")
        graph_file_path = str(source_path)
        file_name = source_path.name
        tmp_path = None
    else:
        if not isinstance(file_name, str) or not file_name.strip():
            file_name = "script.py"
        tmp_dir = Path(tempfile.gettempdir()) / "codeguard"
        tmp_dir.mkdir(exist_ok=True)

        safe_name = Path(file_name).name
        unique_id = uuid.uuid4().hex[:6]
        tmp_path = tmp_dir / f"{Path(safe_name).stem}_{unique_id}{Path(safe_name).suffix or '.py'}"

        try:
            tmp_path.write_text(file_content, encoding="utf-8")
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Failed to save temp file: {exc}")
        graph_file_path = str(tmp_path)

    thread_id = str(uuid.uuid4())
    initial_state: AgentState = {
        "file_path": graph_file_path,
        "agents_run": [],
        "error_message": "",
        "file_updated": False,
        "retry_count": 0,
        "feedback_history": [],
    }
    if file_content:
        initial_state["original_code"] = file_content
    config = {"configurable": {"thread_id": thread_id}}

    threads[thread_id] = {
        "config": config,
        "tmp_path": str(tmp_path) if tmp_path else "",
        "original_file": original_file_path if not path_source else "",
        "status": "running",
        "file_name": file_name,
    }

    return StreamingResponse(
        _iter_stream(initial_state, config),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/resume")
async def resume_review(payload: dict):
    thread_id = payload.get("thread_id")
    decision = payload.get("decision", {})

    if not thread_id or thread_id not in threads:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread_info = threads[thread_id]
    config = thread_info["config"]
    resume_command = Command(resume=decision)

    try:
        def _stream_resume():
            yield _sse_line("config", {"thread_id": thread_id})
            for namespace, mode, chunk in supervisor_graph.stream(
                resume_command,
                config=config,
                stream_mode=["updates", "custom"],
                subgraphs=True,
            ):
                if mode == "custom":
                    if isinstance(chunk, dict) and chunk.get("type") == "llm_token":
                        yield _sse_line("token", {
                            "content": chunk.get("content", ""),
                            "node": chunk.get("node", ""),
                        })
                    elif isinstance(chunk, dict) and chunk.get("type") == "node_start":
                        yield _sse_line("node_start", {"node": chunk.get("node", "")})
                elif mode == "updates":
                    if "__interrupt__" in chunk:
                        interrupt_val = chunk["__interrupt__"][0].value if chunk["__interrupt__"] else {}
                        yield _sse_line("interrupt", interrupt_val)
                        break
                    for node_name, update in chunk.items():
                        if node_name == "__interrupt__":
                            continue
                        yield _sse_line("node_complete", {"node": node_name})
                        yield _sse_line("update", {"node": node_name, "update": update})
            yield _sse_line("end", _final_state_values(config))

        thread_info["status"] = "running"
        return StreamingResponse(
            _stream_resume(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except Exception as e:
        thread_info["status"] = "error"
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/write-original")
async def write_to_original(payload: dict):
    """After approval, write the fixed code to the user's original file path."""
    thread_id = payload.get("thread_id", "")
    if not thread_id or thread_id not in threads:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread_info = threads[thread_id]
    original_path = thread_info.get("original_file", "")
    config = thread_info["config"]

    if not original_path:
        return {"success": False, "detail": "No original file path provided when starting review."}

    try:
        state = supervisor_graph.get_state(config)
        vals = dict(state.values)

        if vals.get("approval_status") != "approved":
            return {"success": False, "detail": "Approval not yet given for this thread."}

        fixed_code = vals.get("fixed_code", "")
        if not fixed_code:
            return {"success": False, "detail": "No fixed code available."}

        target = Path(original_path)
        if not target.is_file():
            return {"success": False, "detail": f"Original file not found: {original_path}"}

        # Create backup before overwriting
        backup_path = target.with_name(f"{target.stem}.codeguard-backup-{uuid.uuid4().hex[:6]}{target.suffix}")
        shutil.copy2(target, backup_path)

        # Write fixed code to original file
        target.write_text(fixed_code, encoding="utf-8")

        thread_info["status"] = "completed"
        return {
            "success": True,
            "original_path": str(target),
            "backup_path": str(backup_path),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write original file: {e}")


@app.delete("/api/thread/{thread_id}")
async def delete_thread(thread_id: str):
    if thread_id in threads:
        thread_info = threads[thread_id]
        tmp_path = thread_info.get("tmp_path")
        if tmp_path and Path(tmp_path).exists():
            try:
                Path(tmp_path).unlink()
            except Exception:
                pass
        del threads[thread_id]
    return {"status": "deleted"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
