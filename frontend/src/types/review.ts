import type { WorkflowState } from "./workflow";

export type ReviewStatus =
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "revision_requested";

export interface ReviewRecord {
  id: string;
  filename: string;
  filePath: string;
  sourceType: "local_path" | "upload";
  createdAt: string;
  status: ReviewStatus;
  threadId: string;
  originalCode: string;
  reviewFindings: string;
  fixedCode: string;
  fixExplanation: string;
  streamedReview: string;
  streamedFix: string;
  testResults: string;
  testsPassed: boolean | null;
  fileUpdated: boolean;
  backupPath: string;
  errorMessage: string;
  workflow: WorkflowState;
}

export interface ReviewHistoryItem {
  id: string;
  filename: string;
  filePath: string;
  createdAt: string;
  status: ReviewStatus;
  issuesDetected: number | null;
  testsPassed: boolean | null;
}
