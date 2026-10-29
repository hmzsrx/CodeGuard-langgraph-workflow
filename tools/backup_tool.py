import shutil
from datetime import datetime
from pathlib import Path

from state.agent_state import AgentState


def create_backup(state: AgentState) -> dict:
    file_path = state.get("file_path", "")
    approval_status = state.get("approval_status")

    if approval_status != "approved":
        return {
            "error_message": "Backup denied: human approval is required.",
            "backup_path": "",
        }

    if not file_path:
        return {
            "error_message": "No file path provided for backup.",
            "backup_path": "",
        }

    source = Path(file_path)

    if not source.is_file():
        return {
            "error_message": f"File not found: {source}",
            "backup_path": "",
        }

    # Har run ka unique naam: test.codeguard-backup-20261029-125900.py
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = source.with_name(
        f"{source.stem}.codeguard-backup-{stamp}{source.suffix}"
    )

    # Same second mein dobara ban raha ho to counter lagao
    counter = 1
    while backup.exists():
        backup = source.with_name(
            f"{source.stem}.codeguard-backup-{stamp}-{counter}{source.suffix}"
        )
        counter += 1

    try:
        shutil.copy2(source, backup)

        return {
            "backup_path": str(backup),
            "error_message": "",
        }

    except OSError as exc:
        return {
            "error_message": f"Backup failed: {exc}",
            "backup_path": "",
        }