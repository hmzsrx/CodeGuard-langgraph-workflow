import {
  Activity,
  ChevronDown,
  Code2,
  FolderClock,
  LayoutDashboard,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { ReviewRecord } from "../../types/review";
import { WorkflowTimeline } from "../workflow/WorkflowTimeline";

export type PageName = "dashboard" | "new-review" | "history" | "settings" | "details";

interface SidebarProps {
  page: PageName;
  onNavigate: (page: PageName) => void;
  activeReview: ReviewRecord | null;
}

export function Sidebar({ page, onNavigate, activeReview }: SidebarProps) {
  const items = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "new-review" as const, label: "New code review", icon: Plus },
    { id: "history" as const, label: "Review history", icon: FolderClock },
  ];

  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate("dashboard")} aria-label="CodeGuard AI home">
        <span className="brand-mark"><ShieldCheck size={19} strokeWidth={2.2} /></span>
        <span className="brand-name">codeguard<span>AI</span></span>
        <ChevronDown className="brand-chevron" size={14} />
      </button>

      <div className="workspace-pill">
        <span className="workspace-avatar"><Code2 size={14} /></span>
        <span><strong>Personal workspace</strong><small>Free plan</small></span>
        <ChevronDown size={14} className="muted" />
      </div>

      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${page === id ? "active" : ""}`}
            onClick={() => onNavigate(id)}
            aria-label={label}
            title={label}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
            {id === "new-review" && <span className="nav-shortcut">⌘ N</span>}
          </button>
        ))}
      </nav>

      <div className="nav-caption nav-caption-lower">PREFERENCES</div>
      <nav className="side-nav">
        <button
          className={`nav-item ${page === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={17} strokeWidth={1.8} />
          <span>Settings</span>
        </button>
      </nav>

      {activeReview && (
        <section className="sidebar-workflow" aria-label="Active review workflow">
          <div className="sidebar-workflow-heading">
            <span className="online-dot" />
            <span>REVIEW WORKFLOW</span>
          </div>
          <div className="sidebar-workflow-file" title={activeReview.filename}>
            {activeReview.filename}
          </div>
          <WorkflowTimeline workflow={activeReview.workflow} compact />
        </section>
      )}

      <div className="sidebar-spacer" />
      <div className="sidebar-status"><span className="online-dot" /><Activity size={14} /> AI workflow ready</div>
      <div className="profile-button">
        <span className="profile-avatar">CG</span>
        <span className="profile-copy"><strong>CodeGuard user</strong><small>Local workspace</small></span>
        <ChevronDown size={15} className="muted" />
      </div>
    </aside>
  );
}
