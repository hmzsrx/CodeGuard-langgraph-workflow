import type { PageName } from "./Sidebar";

const titles: Record<PageName, string> = {
  dashboard: "Overview",
  "new-review": "New code review",
  history: "Review history",
  settings: "Settings",
  details: "Review details",
};

export function Topbar({ page }: { page: PageName }) {
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{titles[page]}</strong></div>
      <div className="topbar-actions">
        <span className="topbar-avatar">CG</span>
      </div>
    </header>
  );
}
