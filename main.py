from langgraph.types import Command
from nodes.main_node import supervisor_graph

STREAM_TOKENS = True   # True karo to LLM ka text live type hota dikhega


def stream_graph(graph_input, config):
    """Graph stream karta hai. Interrupt aaye to uska payload return karta hai, warna None."""
    interrupt_payload = None

    for namespace, mode, chunk in supervisor_graph.stream(
        graph_input,
        config=config,
        stream_mode=["updates", "messages"],
        subgraphs=True,          # code_reviewer/fixer/test subgraphs ke andar ke events bhi
    ):
        if mode == "updates":
            if "__interrupt__" in chunk:
                interrupt_payload = chunk["__interrupt__"][0].value
                continue

            for node_name, update in chunk.items():
                print(f"\n[ok] {node_name} complete")
                if update and update.get("error_message"):
                    print(f"     error: {update['error_message']}")

        elif mode == "messages" and STREAM_TOKENS:
            message, metadata = chunk
            if message.content:
                print(message.content, end="", flush=True)

    return interrupt_payload


def show_payload(payload: dict) -> None:
    print("\n" + "=" * 55)
    print("             CODE REVIEW REPORT")
    print("=" * 55)
    print(payload.get("review_findings") or "No review report.")

    print("\n" + "=" * 55)
    print("              PROPOSED FIX")
    print("=" * 55)
    print(payload.get("fixed_code") or "No fixed code available.")

    print("\nFix explanation:")
    print(payload.get("fix_explanation") or "No explanation.")

    print("\nTest results:")
    print(payload.get("test_results") or "No test results.")

    print("\n" + "=" * 55)
    print("Human approval required.")
    print("Original file has NOT been modified yet.")
    print("=" * 55)


def main():
    print("=" * 55)
    print("                  CodeGuard AI")
    print("=" * 55)

    file_path = input(
        "\nEnter the full path of your Python file: "
    ).strip().strip('"')

    initial_state = {
        "file_path": file_path,
        "agents_run": [],
        "error_message": "",
        "file_updated": False,
        "retry_count": 0,
        "feedback_history": [],
    }

    config = {"configurable": {"thread_id": "codeguard-session-001"}}

    try:
        payload = stream_graph(initial_state, config)

        while payload:
            show_payload(payload)

            decision = input(
                "\nDo you approve these changes? (yes/no): "
            ).strip().lower()

            if decision in {"yes", "y"}:
                resume = {"approved": True}
            else:
                feedback = input(
                    "Kya change/add karna hai? (khaali chhor sakte ho): "
                ).strip()
                resume = {"approved": False, "feedback": feedback}

            payload = stream_graph(Command(resume=resume), config)

        # Stream ke baad final state yahan se milti hai
        result = supervisor_graph.get_state(config).values

        if result.get("error_message"):
            print("\nERROR:", result["error_message"])

        elif result.get("file_updated"):
            print("\nSUCCESS: Approved code has been written.")
            print("Backup:", result.get("backup_path"))

        elif result.get("approval_status") == "rejected":
            print("\nChanges rejected (retry limit reached).")
            print("Original file remains unchanged.")

        elif result.get("tests_passed") is False:
            print("\nSyntax check failed or is unsupported.")
            print("Original file remains unchanged.")
            print(result.get("test_results", ""))

        else:
            print("\nWorkflow ended without writing changes.")

        print("\nAgents executed:", result.get("agents_run", []))

    except Exception as exc:
        print(f"\nWorkflow failed: {exc}")


if __name__ == "__main__":
    main()