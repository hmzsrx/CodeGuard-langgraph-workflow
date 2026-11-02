import { useEffect, useRef } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { ReviewRecord } from "../../types/review";

function StreamBlock({
  title,
  text,
  active,
  emptyText,
}: {
  title: string;
  text: string;
  active: boolean;
  emptyText: string;
}) {
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const output = outputRef.current;
    if (output && active) {
      output.scrollTop = output.scrollHeight;
      output.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [text, active]);

  return (
    <section className="live-stream-block" aria-live="polite">
      <div className="live-stream-heading">
        <span className="live-stream-sparkle"><Sparkles size={14} /></span>
        <span>{title}</span>
        {active && <><LoaderCircle size={12} className="spin live-spinner" /><span className="live-stream-label">STREAMING</span></>}
      </div>
      <pre className="live-stream-text" ref={outputRef}>
        {text || emptyText}
        {active && text && <span className="stream-cursor" aria-hidden="true" />}
      </pre>
    </section>
  );
}

export function LiveStreamOutput({
  review,
  busy,
}: {
  review: ReviewRecord;
  busy: boolean;
}) {
  const isReviewing = review.workflow.issues === "running";
  const isFixing = review.workflow.fixes === "running";
  const hasLiveOutput = busy && (isReviewing || isFixing);
  if (!hasLiveOutput) return null;

  return (
    <section className="panel live-response-panel" aria-label="Live AI response">
      <div className="live-response-title">
        <span className="eyebrow">LIVE AI RESPONSE</span>
        <span className="live-connection"><i /> Connected to LangGraph stream</span>
      </div>
      {isReviewing && (
        <StreamBlock
          title="Code review"
          text={review.streamedReview}
          active
          emptyText="Analyzing the source and preparing review findings…"
        />
      )}
      {(isFixing || review.streamedFix) && (
        <StreamBlock
          title="Proposed fix"
          text={review.streamedFix}
          active={isFixing}
          emptyText="Generating a corrected version from the review findings…"
        />
      )}
    </section>
  );
}
