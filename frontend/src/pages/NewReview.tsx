import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileCode2,
  FileUp,
  FolderOpen,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { ReviewRecord } from "../types/review";
import { formatBytes } from "../lib/utils";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ReviewResults } from "../components/review/ReviewResults";
import { LiveStreamOutput } from "../components/review/LiveStreamOutput";
import { CodeComparison } from "../components/review/CodeComparison";
import { TestResults } from "../components/review/TestResults";
import { ApprovalPanel } from "../components/approval/ApprovalPanel";

function isAbsolutePath(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(value.trim());
}

export function NewReview({
  review,
  busy,
  error,
  onStart,
  onDecide,
  onNew,
}: {
  review: ReviewRecord | null;
  busy: boolean;
  error: string;
  onStart: (file: File | null, path: string) => void;
  onDecide: (approved: boolean, feedback?: string) => void;
  onNew: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewHeaderRef = useRef<HTMLDivElement>(null);
  const approvalPanelRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState("");
  const [formError, setFormError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!file && !path.trim()) {
      setFormError("Choose a Python file or enter its local file path.");
      return;
    }
    if (file && !file.name.toLowerCase().endsWith(".py")) {
      setFormError("The current backend supports Python files only.");
      return;
    }
    if (file && file.size === 0) {
      setFormError("The selected file is empty; the backend requires code content.");
      return;
    }
    if (path.trim() && !isAbsolutePath(path)) {
      setFormError("Enter a full absolute path as seen by the backend computer.");
      return;
    }
    if (!file && !path.trim().toLowerCase().endsWith(".py")) {
      setFormError("The current backend supports Python files only.");
      return;
    }
    const pathName = path.trim().split(/[\\/]/).pop()?.toLowerCase();
    if (file && path.trim() && pathName !== file.name.toLowerCase()) {
      setFormError("The selected file name must match the name at the end of the target path.");
      return;
    }
    onStart(file, path);
  }

  const showResults = Boolean(review && (review.reviewFindings || review.fixedCode));

  useEffect(() => {
    if (review) {
      reviewHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [review?.id]);

  useEffect(() => {
    if (review?.status === "awaiting_approval") {
      approvalPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [review?.status]);

  return (
    <motion.div className="page-content review-page" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="page-title-row" ref={reviewHeaderRef}>
        <div><span className="eyebrow">CODE REVIEW</span><h1>{review ? review.filename : "Start a new review"}</h1>
          <p>{review ? review.filePath || "Uploaded file · no original path selected" : "Choose a Python file, enter a local path, or provide both."}</p></div>
        {review && <StatusBadge status={review.status} />}
      </div>

      {!review && (
        <div className="new-review-layout">
          <section className="panel submit-panel">
            <div className="panel-heading">
              <div className="heading-icon"><FileUp size={17} /></div>
              <div className="heading-copy"><span className="eyebrow">SOURCE FILE</span><h2>Choose what to review</h2></div>
            </div>
            <form onSubmit={submit}>
              <div className={`drop-zone ${file ? "drop-zone-selected" : ""}`} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".py,text/x-python"
                  hidden
                  onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    setFile(selected);
                    setFormError("");
                  }}
                />
                <span className="drop-icon">{file ? <CheckCircle2 size={20} /> : <FolderOpen size={20} />}</span>
                <strong>{file ? file.name : "Select a Python file (optional)"}</strong>
                <span>{file ? `${formatBytes(file.size)} · Click to choose another` : "Or enter a local path below · .py files only"}</span>
                {file && <span className="selected-file-label"><FileCode2 size={13} /> Ready to read in this browser</span>}
              </div>

              <div className="path-field">
                <label className="field-label" htmlFor="local-path">{file ? "Original file path" : "Local file path"} <span>{file ? "Optional · enables writing the approved fix back" : "Use this instead of selecting a file"}</span></label>
                <div className="input-with-icon"><FolderOpen size={15} /><input id="local-path" value={path} onChange={(event) => { setPath(event.target.value); setFormError(""); }} placeholder="C:\Users\you\project\example.py" /></div>
                <p className="field-hint">{file ? "Optional: provide the matching absolute path on the backend computer to write the fix back after approval. Without it, you can download the fixed code." : "The backend computer reads this path directly. The browser cannot browse or verify files on that computer."}</p>
              </div>

              {(formError || error) && <div className="form-alert"><AlertCircle size={15} /><span>{formError || error}</span></div>}
              <div className="submit-footer">
                <span><LockKeyhole size={14} /> {file && !path.trim() ? "No original file will be changed" : "Original file changes only after approval"}</span>
                <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Starting..." : "Start AI review"} <ArrowRight size={15} /></button>
              </div>
            </form>
          </section>
          <aside className="review-guide">
            <div className="guide-shield"><ShieldCheck size={19} /></div>
            <h3>Your code, your call.</h3>
            <p>A selected file is reviewed from its content. A path is read directly by the backend. If you provide both, the path becomes the write-back target after approval.</p>
            <div className="guide-note"><AlertCircle size={14} /><span>Backend currently checks Python syntax only. Runtime tests are not executed.</span></div>
            <div className="guide-flow"><span>Review</span><i /><span>Inspect</span><i /><span>Approve</span></div>
          </aside>
        </div>
      )}

      {review && (
        <>
          <LiveStreamOutput review={review} busy={busy} />
          {review.errorMessage && <div className="form-alert review-error"><AlertCircle size={15} /><span>{review.errorMessage}</span></div>}
          {review.status === "completed" && review.fileUpdated && (
            <div className="success-banner">
              <CheckCircle2 size={17} />
              <div>
                <strong>{review.sourceType === "local_path" || review.filePath ? "Approved changes applied" : "Review approved"}</strong>
                <span>{review.backupPath ? `Backup created at ${review.backupPath}` : review.filePath ? "The original file was updated after approval." : "Download the fixed code below; no original path was provided."}</span>
              </div>
            </div>
          )}
          {review.status === "revision_requested" && !busy && (
            <div className="info-banner"><RotateCcw size={16} /><span>Revision requested. The backend is re-running review with your feedback.</span></div>
          )}
          {showResults && <ReviewResults findings={review.reviewFindings} originalCode={review.originalCode} explanation={review.fixExplanation} />}
          {review.fixedCode && <CodeComparison originalCode={review.originalCode} fixedCode={review.fixedCode} />}
          {review.status === "completed" && review.sourceType === "upload" && !review.filePath && review.fixedCode && (
            <button
              className="button button-secondary download-fixed-code"
              onClick={() => {
                const blob = new Blob([review.fixedCode], { type: "text/x-python;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `fixed-${review.filename}`;
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <FileCode2 size={15} /> Download fixed code
            </button>
          )}
          <TestResults passed={review.testsPassed} result={review.testResults} />
          {review.status === "awaiting_approval" && (
            <div ref={approvalPanelRef}>
              <ApprovalPanel review={review} disabled={busy} onApprove={() => onDecide(true)} onReject={(feedback) => onDecide(false, feedback)} />
            </div>
          )}
          {!busy && (review.status === "failed" || review.status === "completed") && (
            <div className="review-end-actions">
              <button className="button button-secondary" onClick={onNew}><RotateCcw size={14} /> Start another review</button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
