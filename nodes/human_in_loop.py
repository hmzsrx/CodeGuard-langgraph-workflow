from langgraph.types import interrupt
from state.agent_state import AgentState


# def review_approval(state: AgentState):
#     decision = interrupt({
#         "message": "Do you approve the code review findings?"
#     })

#     if isinstance(decision, dict):
#         decision = decision.get("approved", False)

#     if decision is True or str(decision).lower() in ("yes", "y", "approved"):
#         return {"review_approval": "approved"}

#     return {"review_approval": "rejected"}

def final_code_approval(state: AgentState):
    decision = interrupt({
        "review_findings": state.get("review_findings"),
        "fixed_code": state.get("fixed_code"),
        "fix_explanation": state.get("fix_explanation"),
        "test_results": state.get("test_results"),
    })

    if decision.get("approved"):
        return {"approval_status": "approved"}

    feedback = decision.get("feedback", "").strip()
    return {
        "approval_status": "rejected",
        "user_feedback": feedback,
        "feedback_history": [feedback] if feedback else [],
        "retry_count": state.get("retry_count", 0) + 1,
        "tests_passed": None,
        "error_message": "",
    }

# def final_code_approval(state: AgentState) -> dict:
#     decision = interrupt({
#         "stage": "final_code",
#         "message": "Do you approve writing this fixed code to the original file?",
#         "fixed_code": state.get("fixed_code", ""),
#         "fix_explanation": state.get("fix_explanation", ""),
#         "test_results": state.get("test_results", ""),
#     })

#     approved = (
#         isinstance(decision, dict)
#         and decision.get("approved") is True
#     )

#     return {
#         "approval_status": "approved" if approved else "rejected",
#         "error_message": "",
#     }