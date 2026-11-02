from langgraph.types import interrupt
from state.agent_state import AgentState


def final_code_approval(state: AgentState):
    decision = interrupt({
        "review_findings": state.get("review_findings"),
        "fixed_code": state.get("fixed_code"),
        "fix_explanation": state.get("fix_explanation"),
        "test_results": state.get("test_results"),
        "tests_passed": state.get("tests_passed"),
    })

    if decision.get("approved"):
        return {"approval_status": "approved"}

    feedback = decision.get("feedback", "").strip()
    return {
        "approval_status": "rejected",
        "user_feedback": feedback,
        "feedback_history": state.get("feedback_history", []) + ([feedback] if feedback else []),
        "retry_count": state.get("retry_count", 0) + 1,
        "tests_passed": None,
        "error_message": "",
    }
