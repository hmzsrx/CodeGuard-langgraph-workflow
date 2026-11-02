import type { ReviewStatus } from "../../types/review";

const labels: Record<ReviewStatus, string> = {
  running: "In progress",
  awaiting_approval: "Needs approval",
  completed: "Completed",
  failed: "Failed",
  revision_requested: "Revision requested",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {labels[status]}
    </span>
  );
}
