
import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END


from state.agent_state import AgentState

load_dotenv()


def analyze_code(state: AgentState) -> dict:
    """Analyze the code and identify its programming language."""

    code = state.get("original_code", "")

    if not code.strip():
        return {
            "error_message": "No code was provided for review."
        }

    llm = ChatGroq(
        model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        temperature=0,
    )

    prompt = f"""
You are a senior software code reviewer.

Identify the programming language from the code itself.

Review the code for:
1. Bugs and runtime errors.
2. Edge cases and input validation.
3. Security vulnerabilities.
4. Code quality and maintainability.

Do not rewrite the code.
Do not claim you executed the code or tests.
Do not invent issues.
Keep your report under 400 words.

“Agar user feedback diya gaya hai to usko review ki sabse upar priority do, chahe code mein aur koi bug na ho.”


Return this format:

# CODE REVIEW REPORT


## Quick Summary
[Brief summary]

## Issues Found
For each issue, explain the issue, impact, and suggested fix.

## Overall Assessment
[Brief assessment]

CODE:
```text
{code}
```
"""

    response = llm.invoke(prompt, config={"timeout": 60})
    findings = str(response.content)


    return {
        
        "review_findings": findings,
        "review_summary": findings,
        "agents_run": state.get("agents_run", []) + ["Code Reviewer"],
        "error_message": "",
    }


# Build the reviewer subgraph.
builder = StateGraph(AgentState)

builder.add_node("analyze_code", analyze_code)


builder.add_edge(START, "analyze_code")

builder.add_edge("analyze_code", END)

# Compile the graph into a runnable subgraph.
code_reviewer_subgraph = builder.compile()
