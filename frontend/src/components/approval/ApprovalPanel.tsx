import { useState } from "react";
import { Check, FileKey2, GitPullRequest, ShieldAlert, X } from "lucide-react";
import type { ReviewRecord } from "../../types/review";
import { codeChangeSummary } from "../../lib/diff";

export function ApprovalPanel({
  review,
  disabled,
  onApprove,
  onReject,
}: {
  review: ReviewRecord;
  disabled: boolean;
  onApprove: () => void;
  onReject: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const changes = codeChangeSummary(review.originalCode, review.fixedCode);
  return (
    <section className="approval-card">
      <div className="approval-title-row">
        <div className="approval-icon"><GitPullRequest size={18} /></div>
        <div><span className="eyebrow">HUMAN REVIEW REQUIRED</span><h2>Approve this patch?</h2></div>
        <span className="approval-required"><ShieldAlert size={13} /> Original file unchanged</span>
      </div>
      <div className="approval-facts">
        <div className="approval-fact"><span>{review.filePath ? "Target file" : "Original file"}</span><strong title={review.filePath}>{review.filePath || "No path selected — you can download the fixed code after approval."}</strong></div>
        <div className="approval-fact"><span>Proposed changes</span><strong><span className="change-added">+{changes.added}</span> / <span className="change-removed">−{changes.removed}</span> lines</strong></div>
        <div className="approval-fact"><span>Test result</span><strong className={review.testsPassed ? "text-success" : "text-danger"}>{review.testResults || "No test result"}</strong></div>
        <div className="approval-fact"><span>AI summary</span><strong>{review.fixExplanation || "Inspect the proposed code changes below."}</strong></div>
      </div>
      <label className="field-label" htmlFor="revision-feedback">Feedback for a revision <span>Optional</span></label>
      <textarea
        id="revision-feedback"
        className="feedback-input"
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder="Tell the AI what should change if you reject this patch..."
        rows={2}
        disabled={disabled}
      />
      <div className="approval-actions">
        <button className="button button-danger-quiet" onClick={() => onReject(feedback)} disabled={disabled}>
          <X size={15} /> Reject &amp; request revision
        </button>
        <button className="button button-primary" onClick={onApprove} disabled={disabled || review.testsPassed !== true}>
          <Check size={16} /> {review.filePath ? "Approve & apply changes" : "Approve & finish review"}
        </button>
      </div>
      <div className="approval-footnote"><FileKey2 size={13} /> {review.filePath ? "The backend will write to this path only after you approve." : "Approval finishes the review; download the fix to save it locally."}</div>
    </section>
  );
}
