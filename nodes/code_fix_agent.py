import os
import re

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.graph import START, END, StateGraph

from state.agent_state import AgentState

load_dotenv()


def build_fix_input(state: AgentState) -> str:
    # Pehli baar original, baad ke rounds mein latest fixed code
    base_code = state.get("fixed_code") or state.get("original_code", "")
    history = state.get("feedback_history", [])

    parts = [
        f"CURRENT CODE:\n{base_code}",
        f"REVIEW FINDINGS:\n{state.get('review_findings', '')}",
    ]
    if history:
        parts.append(
            "USER FEEDBACK (must apply):\n"
            + "\n".join(f"- {f}" for f in history)
        )
    return "\n\n".join(parts)


def fix_code(state: AgentState) -> dict:
    base_code = state.get("fixed_code") or state.get("original_code", "")
    findings = state.get("review_findings", "")
    history = state.get("feedback_history", [])

    if not base_code.strip():
        return {"error_message": "No code provided to fixer."}

    # Findings khaali ho lekin user feedback ho to bhi fix chalna chahiye
    if not findings.strip() and not history:
        return {"error_message": "No review findings or feedback provided to fixer."}

    try:
        llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            temperature=0,
        )

        prompt = f"""
You are a careful software repair agent.

Fix the issues in the code using the review report and any user feedback.

Rules:
- Preserve the original purpose and behavior where possible.
- Do not add unrelated features.
- Apply every item in USER FEEDBACK; it has the highest priority.
- Keep fixes from earlier rounds (work on CURRENT CODE).
- Do not claim that you ran tests.
- Return the complete corrected source code inside one ```python code fence.
- After the code fence, explain the important changes briefly.
- Do not omit unchanged parts of the source code.

{build_fix_input(state)}
"""

        response = llm.invoke(prompt, config={"timeout": 60})
        answer = str(response.content).strip()

        match = re.search(r"```[^\n]*\n(.*?)```", answer, flags=re.DOTALL)

        if not match:
            return {
                "error_message": (
                    "Fixer did not return code in a code fence. "
                    "Original file has not been changed."
                )
            }

        fixed_code = match.group(1).strip("\n")
        explanation = answer[match.end():].strip()

        if not fixed_code.strip():
            return {"error_message": "Fixer returned empty code."}

        return {
            "fixed_code": fixed_code + "\n",
            "fix_explanation": explanation,
            "agents_run": state.get("agents_run", []) + ["Code Fixer"],
            "error_message": "",
        }

    except Exception as exc:
        return {"error_message": f"Code fixing failed: {exc}"}


builder = StateGraph(AgentState)
builder.add_node("fix_code", fix_code)

builder.add_edge(START, "fix_code")
builder.add_edge("fix_code", END)

code_fixer_subgraph = builder.compile()