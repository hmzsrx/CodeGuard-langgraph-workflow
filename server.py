"""
CodeGuard AI - FastAPI Backend Server
Connects frontend to LangGraph supervisor graph
"""
import os
import sys
import uuid
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from langgraph.types import Command, Interrupt

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from nodes.main_node import supervisor_graph
from tools.file_write import write_fixed_code
from state.agent_state import AgentState

# In-memory thread storage
threads: Dict[str, dict] = {}

app = FastAPI(title="CodeGuard AI API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "CodeGuard AI"}


@app.post("/api/run")
async def run_review(payload: dict):
    """Start a new code review session."""
    file_content = payload.get("file_content", "")
    file_name = payload.get("file_name", "script.py")

    if not file_content.strip():
        raise HTTPException(status_code=400, detail="File content is empty")

    # Save file content to temp file for the graph to read
    tmp_dir = Path(tempfile.gettempdir()) / "codeguard"
    tmp_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    tmp_path = tmp_dir / f"{file_name.replace('.py','')}_{timestamp}.py"
    
    try:
        tmp_path.write_text(file_content, encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save temp file: {e}")

    thread_id = str(uuid.uuid4())
    
    initial_state: AgentState = {
        "file_path": str(tmp_path),
        "agents_run": [],
        "error_message": "",
        "file_updated": False,
        "retry_count": 0,
        "feedback_history": [],
        "original_code": file_content,
    }

    config = {"configurable": {"thread_id": thread_id}}

    # Store thread info
    threads[thread_id] = {
        "config": config,
        "tmp_path": str(tmp_path),
        "original_file": payload.get("original_file_path", ""),
        "status": "running",
    }

    # Run graph - it will hit interrupt at final_approval
    try:
        result = supervisor_graph.invoke(initial_state, config=config)
        # If we get here, graph completed without interrupt (error case)
        threads[thread_id]["status"] = "completed"
        return {
            "thread_id": thread_id,
            "status": "completed",
            "final_state": dict(result),
            "interrupt": None,
        }
    except Interrupt as e:
        # Graph is paused waiting for human input
        threads[thread_id]["status"] = "interrupted"
        return {
            "thread_id": thread_id,
            "status": "interrupted",
            "final_state": dict(result) if 'result' in locals() else {},
            "interrupt": {
                "value": e.value if hasattr(e, 'value') else None,
                "path": e.path if hasattr(e, 'path') else None,
            },
        }
    except Exception as e:
        threads[thread_id]["status"] = "error"
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/resume")
async def resume_review(payload: dict):
    """Resume a paused graph with approval decision."""
    thread_id = payload.get("thread_id")
    decision = payload.get("decision", {})

    if not thread_id or thread_id not in threads:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread_info = threads[thread_id]
    config = thread_info["config"]

    resume_command = Command(resume=decision)

    try:
        result = supervisor_graph.invoke(resume_command, config=config)
        thread_info["status"] = "completed"

        return {
            "thread_id": thread_id,
            "status": "completed",
            "final_state": dict(result),
            "interrupt": None,
        }
    except Interrupt as e:
        # Another interrupt (e.g. rejection with feedback, re-ran and hit approval again)
        thread_info["status"] = "interrupted"
        interrupt_data = e.value if hasattr(e, 'value') else None
        return {
            "thread_id": thread_id,
            "status": "interrupted",
            "final_state": dict(result) if 'result' in locals() else {},
            "interrupt": {
                "value": interrupt_data,
                "path": e.path if hasattr(e, 'path') else None,
            },
        }
    except Exception as e:
        thread_info["status"] = "error"
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/state/{thread_id}")
async def get_state(thread_id: str):
    """Get current state of a thread."""
    if thread_id not in threads:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread_info = threads[thread_id]
    config = thread_info["config"]

    try:
        state = supervisor_graph.get_state(config)
        return {
            "thread_id": thread_id,
            "status": thread_info["status"],
            "values": dict(state.values),
            "next": state.next,
            "interrupts": state.interrupts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/write")
async def write_file(payload: dict):
    """Manually trigger write_fixed_code tool after approval."""
    thread_id = payload.get("thread_id")
    if not thread_id or thread_id not in threads:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread_info = threads[thread_id]
    config = thread_info["config"]

    try:
        state = supervisor_graph.get_state(config)
        values = dict(state.values)

        if values.get("approval_status") != "approved":
            return {"success": False, "detail": "Approval not yet given for this thread."}

        # Build state ready for write_fixed_code
        write_state: AgentState = {
            "file_path": values.get("file_path", ""),
            "fixed_code": values.get("fixed_code", ""),
            "backup_path": values.get("backup_path", ""),
            "approval_status": "approved",
            "tests_passed": True,
            "error_message": "",
        }

        result = write_fixed_code(write_state)
        threads[thread_id]["status"] = "completed"
        return {"success": result.get("file_updated", False), "detail": result.get("error_message", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/thread/{thread_id}")
async def delete_thread(thread_id: str):
    """Clean up a thread."""
    if thread_id in threads:
        thread_info = threads[thread_id]
        # Clean up temp file
        tmp_path = thread_info.get("tmp_path")
        if tmp_path and Path(tmp_path).exists():
            try:
                Path(tmp_path).unlink()
            except:
                pass
        del threads[thread_id]
    return {"status": "deleted"}


if __name__ == "__main__":
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
