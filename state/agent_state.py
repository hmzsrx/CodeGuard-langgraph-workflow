from typing import TypedDict
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    file_path: str
    language: str

    original_code: str
    review_findings: str
    review_summary: str

    fixed_code: str
    fix_explanation: str

    test_results: str
    tests_passed: bool

    # Human approval
    approval_status: str

    # Backup and file writing
    backup_path: str
    file_updated: bool

    # Workflow tracking
    agents_run: list[str]
    error_message: str

    retry_count: int
    user_feedback: str
    feedback_history: list[str]