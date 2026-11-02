export const workflowStages = [
  { id: "reading", label: "Read source file", description: "Load the selected Python file for this review.", node: "file_reader" },
  { id: "analysis", label: "Analyze the code", description: "Inspect the source for bugs, edge cases, and security concerns.", node: "code_reviewer" },
  { id: "issues", label: "Prepare review findings", description: "Summarize the issues found before proposing a correction.", node: "code_reviewer" },
  { id: "fixes", label: "Generate a proposed fix", description: "Update the code using the review findings and any revision feedback.", node: "code_fixer" },
  { id: "tests", label: "Check the proposed code", description: "Run the configured Python syntax check on the proposed fix.", node: "test_agent" },
  { id: "approval", label: "Wait for your approval", description: "Review the proposed changes; the original file is not changed yet.", node: "final_approval" },
  { id: "applying", label: "Save approved changes", description: "Create a backup and write the approved fix to its target.", node: "file_writer" },
  { id: "completed", label: "Finish the review", description: "Confirm the review result and any saved file details.", node: "end" },
] as const;

export type WorkflowStageId = (typeof workflowStages)[number]["id"];
export type StageStatus = "pending" | "running" | "completed" | "failed";
export type WorkflowState = Record<WorkflowStageId, StageStatus>;

export type StreamEvent =
  | { event: "config"; data: { thread_id?: string } }
  | { event: "token"; data: { content?: string; node?: string } }
  | { event: "node_start"; data: { node?: string } }
  | { event: "node_complete"; data: { node?: string } }
  | { event: "update"; data: { node?: string; update?: Record<string, unknown> } }
  | { event: "interrupt"; data: InterruptPayload }
  | { event: "end"; data: FinalState }
  | { event: string; data: unknown };

export interface InterruptPayload {
  review_findings?: string;
  fixed_code?: string;
  fix_explanation?: string;
  test_results?: string;
  tests_passed?: boolean;
}

export interface FinalState {
  error_message?: string;
  file_updated?: boolean;
  approval_status?: string;
  tests_passed?: boolean | null;
  test_results?: string;
  review_findings?: string;
  fixed_code?: string;
  fix_explanation?: string;
  original_code?: string;
  file_path?: string;
  backup_path?: string;
}
