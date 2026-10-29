from pathlib import Path

from state.agent_state import AgentState


def write_fixed_code(state: AgentState) -> dict:
    file_path = state.get("file_path", "")
    fixed_code = state.get("fixed_code")
    backup_path = state.get("backup_path", "")

    if state.get("approval_status") != "approved":
        return {
            "file_updated": False,
            "error_message": "Write denied: changes were not approved.",
        }

    if not state.get("tests_passed", False):
        return {
            "file_updated": False,
            "error_message": "Write denied: syntax check did not pass.",
        }

    if not file_path or fixed_code is None:
        return {
            "file_updated": False,
            "error_message": "File path or fixed code is missing.",
        }

    target = Path(file_path)
    backup = Path(backup_path) if backup_path else None

    if not target.is_file():
        return {
            "file_updated": False,
            "error_message": "Original file no longer exists.",
        }

    if backup is None or not backup.is_file():
        return {
            "file_updated": False,
            "error_message": "Verified backup is missing. File not changed.",
        }

    try:
        target.write_text(fixed_code, encoding="utf-8")

        return {
            "file_updated": True,
            "error_message": "",
        }

    except OSError as exc:
        return {
            "file_updated": False,
            "error_message": f"Writing file failed: {exc}",
        }