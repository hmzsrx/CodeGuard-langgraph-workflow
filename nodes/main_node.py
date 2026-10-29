from state.agent_state import AgentState
from tools.file_reader import read_local_file
from tools.backup_tool import create_backup
from tools.file_write import write_fixed_code
from langgraph.graph import START , END , StateGraph
from langgraph.checkpoint.memory import MemorySaver

from nodes.code_reviewer import code_reviewer_subgraph
from nodes.code_fix_agent import code_fixer_subgraph
from nodes.test_node import test_agent_subgraph

from nodes.human_in_loop import final_code_approval

def check_after_approval(state: AgentState) -> str:
    if state.get("approval_status") == "rejected":
        return "again"
    if state.get("approval_status") == "approved":
        return "backup"
    return "stop"

def check_error(state: AgentState) -> str:
    if state.get("error_message"):
        return "stop"

    return "continue"


# def check_review(state: AgentState) -> str:
#     if state.get("error_message"):
#         return "stop"

#     if state.get("review_approval") == "approved":
#         return "fix"

#     return "stop"

def build_review_input(state: AgentState) -> str:
    # pehli baar original, baad mein latest fixed code
    code_to_review = state.get("fixed_code") or state.get("original_code", "")
    history = state.get("feedback_history", [])

    feedback_block = ""
    if history:
        feedback_block = "\n\nUSER FEEDBACK (is ko requirement samjho):\n" + "\n".join(
            f"{i}. {f}" for i, f in enumerate(history, 1)
        )

    return f"CODE TO REVIEW:\n{code_to_review}{feedback_block}"

def check_test_result(state: AgentState) -> str:
    if state.get("error_message"):
        return "stop"

    if state.get("tests_passed") is True:
        return "final_approval"

    return "stop"

MAX_RETRIES = 3

supervisor_bulider = StateGraph(AgentState)


supervisor_bulider.add_node("file_reader", read_local_file)
supervisor_bulider.add_node("code_reviewer", code_reviewer_subgraph)

supervisor_bulider.add_node("code_fixer", code_fixer_subgraph)
supervisor_bulider.add_node("test_agent", test_agent_subgraph)
supervisor_bulider.add_node("final_approval", final_code_approval)
supervisor_bulider.add_node("backup", create_backup)
supervisor_bulider.add_node("file_writer", write_fixed_code)


supervisor_bulider.add_edge(START, "file_reader")

supervisor_bulider.add_conditional_edges(
    "file_reader",
    check_error,
    {
        "continue": "code_reviewer",
        "stop": END,
    },
)

# Reviewer -> fixer (only if no error)
supervisor_bulider.add_conditional_edges(
    "code_reviewer",
    check_error,
    {
        "continue": "code_fixer",
        "stop": END,
    },
)
    
# Fixer -> tester
supervisor_bulider.add_conditional_edges(
    "code_fixer",
    check_error,
    {
        "continue": "test_agent",
        "stop": END,
    },
)

# Only passing tests go to final approval
supervisor_bulider.add_conditional_edges(
    "test_agent",
    check_test_result,
    {
        "final_approval": "final_approval",
        "stop": END,
    },
)

# Only final approval goes to backup
supervisor_bulider.add_conditional_edges(
    "final_approval",
    check_after_approval,
    {
        "backup": "backup",
        "again": "code_reviewer",
        "stop": END,
    },
)

supervisor_bulider.add_conditional_edges(
    'backup' ,
    check_error,{
        'continue' : 'file_writer',
        'stop' : END,
    },
)

supervisor_bulider.add_edge('file_writer', END)


supervisor_graph = supervisor_bulider.compile(checkpointer=MemorySaver())