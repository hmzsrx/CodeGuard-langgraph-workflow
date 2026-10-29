
from pathlib import Path

from state.agent_state import AgentState


MAX_FILE_SIZE = 1024 * 1024 * 1024  # 1 GB


def read_local_file(state: AgentState) -> dict:
    file_path = state.get("file_path", "").strip()

    if not file_path:
        return {
            "error_message": "Please provide a local file path."
        }

    path = Path(file_path).expanduser().resolve()

    if not path.exists():
        return {
            "error_message": f"File does not exist: {path}"
        }

    if not path.is_file():
        return {
            "error_message": "The provided path is not a file."
        }

    try:
        file_size = path.stat().st_size

        if file_size > MAX_FILE_SIZE:
            return {
                "error_message": "File exceeds the 1 GB size limit."
            }

        code = path.read_text(encoding="utf-8")

    except (OSError, UnicodeError) as exc:
        return {
            "error_message": f"Could not read file: {exc}"
        }

    return {
        "file_path": str(path),
        "original_code": code,
        "language": "",  # Model will infer the language
        "error_message": "",
    }
