import type { ReviewRecord, ReviewHistoryItem } from "../types/review";
import type { WorkflowState } from "../types/workflow";

const HISTORY_KEY = "codeguard-review-history";

export function emptyWorkflow(): WorkflowState {
  return {
    reading: "pending",
    analysis: "pending",
    issues: "pending",
    fixes: "pending",
    tests: "pending",
    approval: "pending",
    applying: "pending",
    completed: "pending",
  };
}

export function countIssues(report: string): number | null {
  const section = report.match(
    /##\s*Issues Found\s*([\s\S]*?)(?=##\s*Overall Assessment|$)/i,
  )?.[1];
  if (!section?.trim()) return null;
  const entries = section.match(/^\s*(?:[-*]\s+|\d+[.)]\s+)/gm);
  return entries?.length ?? 0;
}

export function loadHistory(): ReviewHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReviewHistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: ReviewHistoryItem[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}

export function toHistoryItem(review: ReviewRecord): ReviewHistoryItem {
  return {
    id: review.id,
    filename: review.filename,
    filePath: review.filePath,
    createdAt: review.createdAt,
    status: review.status,
    issuesDetected: countIssues(review.reviewFindings),
    testsPassed: review.testsPassed,
  };
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
