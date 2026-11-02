import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  FileCode2,
  Plus,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { ReviewHistoryItem } from "../types/review";
import type { PageName } from "../components/layout/Sidebar";
import { formatDate } from "../lib/utils";
import { StatusBadge } from "../components/ui/StatusBadge";

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof CircleDot;
  accent: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${accent}`}><Icon size={17} /></div>
      <span className="metric-label">{label}</span>
      <div className="metric-value">{value}</div>
      <span className="metric-note">{note}</span>
    </div>
  );
}

export function Dashboard({
  history,
  onNavigate,
  onOpenReview,
}: {
  history: ReviewHistoryItem[];
  onNavigate: (page: PageName) => void;
  onOpenReview: (id: string) => void;
}) {
  const successful = history.filter((review) => review.status === "completed").length;
  const pending = history.filter((review) => review.status === "awaiting_approval").length;
  const knownIssues = history.reduce((total, review) => total + (review.issuesDetected ?? 0), 0);

  return (
    <motion.div className="page-content dashboard-page" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="welcome-row">
        <div>
          <div className="welcome-kicker"><span className="sparkle-dot" /> YOUR AI-POWERED REVIEW WORKSPACE</div>
          <h1>Your AI Code Reviewer</h1>
          <p>Catch issues early. Ship cleaner code with a second pair of eyes.</p>
        </div>
        <button className="button button-primary new-review-cta" onClick={() => onNavigate("new-review")}>
          <Plus size={16} /> New code review
        </button>
      </div>

      <div className="metric-grid">
        <MetricCard label="Total reviews" value={history.length} note="Across this browser" icon={FileCode2} accent="metric-violet" />
        <MetricCard label="Successful fixes" value={successful} note="Approved and applied" icon={CheckCircle2} accent="metric-green" />
        <MetricCard label="Issues detected" value={history.length ? knownIssues : "—"} note={history.length ? "Parsed from review reports" : "From your review reports"} icon={ShieldAlert} accent="metric-amber" />
        <MetricCard label="Pending approvals" value={pending} note="Waiting for your review" icon={CircleDot} accent="metric-blue" />
      </div>

      <div className="dashboard-lower">
        <section className="panel activity-panel">
          <div className="panel-heading activity-heading">
            <div><span className="eyebrow">YOUR WORKSPACE</span><h2>Recent reviews</h2></div>
            <button className="text-button" onClick={() => onNavigate("history")}>View history <ArrowUpRight size={14} /></button>
          </div>
          {history.length ? (
            <div className="activity-list">
              {history.slice(0, 5).map((review) => (
                <button className="activity-row" key={review.id} onClick={() => onOpenReview(review.id)}>
                  <span className="file-icon"><FileCode2 size={16} /></span>
                  <span className="activity-file"><strong>{review.filename}</strong><small>{review.filePath}</small></span>
                  <span className="activity-issues">{review.issuesDetected === null ? "—" : `${review.issuesDetected} issues`}</span>
                  <StatusBadge status={review.status} />
                  <span className="activity-date">{formatDate(review.createdAt)}</span>
                  <ArrowUpRight className="row-arrow" size={14} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-activity">
              <span className="empty-icon"><FileCode2 size={20} /></span>
              <strong>No reviews yet</strong>
              <p>Start with a Python file and see what CodeGuard finds.</p>
              <button className="button button-secondary button-sm" onClick={() => onNavigate("new-review")}><Plus size={14} /> Start your first review</button>
            </div>
          )}
        </section>

        <aside className="panel side-promo">
          <div className="promo-icon"><Sparkles size={18} /></div>
          <span className="eyebrow">SAFE BY DESIGN</span>
          <h3>You stay in control.</h3>
          <p>CodeGuard prepares a fix and checks Python syntax. Your original file is untouched until you approve.</p>
          <div className="promo-divider" />
          <div className="promo-step"><span>01</span><span>Review the proposed diff</span></div>
          <div className="promo-step"><span>02</span><span>Approve only when ready</span></div>
          <div className="promo-step"><span>03</span><span>Keep a backup of your file</span></div>
        </aside>
      </div>
    </motion.div>
  );
}
