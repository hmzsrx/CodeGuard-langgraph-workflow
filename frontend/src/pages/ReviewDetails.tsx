import { AlertCircle, ArrowLeft, FileCode2 } from "lucide-react";
import type { ReviewHistoryItem, ReviewRecord } from "../types/review";
import { formatDate } from "../lib/utils";
import { StatusBadge } from "../components/ui/StatusBadge";
import { NewReview } from "./NewReview";

export function ReviewDetails({
  item,
  activeReview,
  busy,
  error,
  onBack,
  onDecide,
  onNew,
}: {
  item: ReviewHistoryItem | null;
  activeReview: ReviewRecord | null;
  busy: boolean;
  error: string;
  onBack: () => void;
  onDecide: (approved: boolean, feedback?: string) => void;
  onNew: () => void;
}) {
  if (!item) {
    return <div className="page-content"><button className="button button-quiet" onClick={onBack}><ArrowLeft size={14} /> Back</button><div className="empty-activity"><strong>Review not found</strong><p>This review is not available in local history.</p></div></div>;
  }
  if (activeReview?.id === item.id) {
    return <NewReview review={activeReview} busy={busy} error={error} onStart={() => undefined} onDecide={onDecide} onNew={onNew} />;
  }
  return (
    <div className="page-content">
      <button className="button button-quiet details-back" onClick={onBack}><ArrowLeft size={14} /> Back to history</button>
      <section className="panel unavailable-detail">
        <div className="unavailable-icon"><FileCode2 size={20} /></div>
        <span className="eyebrow">HISTORICAL REVIEW</span>
        <h1>{item.filename}</h1>
        <p className="unavailable-path">{item.filePath}</p>
        <div className="history-detail-facts"><span>Reviewed {formatDate(item.createdAt)}</span><StatusBadge status={item.status} /></div>
        <div className="info-banner"><AlertCircle size={16} /><span>The backend has no review retrieval endpoint, and graph state is held in server memory. Full findings and code are available only for the active review in this browser session.</span></div>
      </section>
    </div>
  );
}
