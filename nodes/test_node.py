
from pathlib import Path

from state.agent_state import AgentState
from langgraph.graph import START , END , StateGraph


def test_code(state: AgentState) -> dict:
    code = state.get("fixed_code", "")
    file_path = state.get("file_path", "")

    if not code.strip():
        return {
            "test_results": "No fixed code was provided.",
            "tests_passed": False,
            "error_message": "Test Agent received empty fixed code.",
        }

    extension = Path(file_path).suffix.lower()

    # Filhal Python syntax check support karte hain.
    if extension != ".py":
        return {
            "test_results": (
                f"Syntax checking for {extension or 'unknown'} "
                "files is not supported yet."
            ),
            "tests_passed": False,
            "error_message": "",
            "agents_run": (
                state.get("agents_run", []) + ["Test Agent"]
            ),
        }

    try:
        # Code compile hoga, execute nahi hoga.
        compile(code, file_path or "<candidate_code>", "exec")

        return {
            "test_results": (
                "Python syntax check passed. "
                "The code was not executed; runtime behavior "
                "has not been verified."
            ),
            "tests_passed": True,
            "error_message": "",
            "agents_run": (
                state.get("agents_run", []) + ["Test Agent"]
            ),
        }

    except SyntaxError as exc:
        return {
            "test_results": (
                f"Syntax error on line {exc.lineno}: {exc.msg}"
            ),
            "tests_passed": False,
            "error_message": "",
            "agents_run": (
                state.get("agents_run", []) + ["Test Agent"]
            ),
        }
builder = StateGraph(AgentState)

builder.add_node("test_code", test_code)

builder.add_edge(START, "test_code")
builder.add_edge("test_code", END)

test_agent_subgraph = builder.compile()
