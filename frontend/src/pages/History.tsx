import { motion } from "framer-motion";
import { ArrowUpRight, FileCode2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReviewHistoryItem } from "../types/review";
import { formatDate } from "../lib/utils";
import { StatusBadge } from "../components/ui/StatusBadge";

export function History({
  history,
  onOpen,
}: {
  history: ReviewHistoryItem[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => history.filter((item) => `${item.filename} ${item.filePath}`.toLowerCase().includes(query.toLowerCase())),
    [history, query],
  );
  return (
    <motion.div className="page-content" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="page-title-row"><div><span className="eyebrow">WORKSPACE</span><h1>Review history</h1><p>Runs started from this browser. Detailed past graph state is not exposed by the backend.</p></div><span className="count-pill">{history.length} reviews</span></div>
      <section className="panel history-panel">
        <div className="history-toolbar"><div className="history-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by file name or path..." /></div><span className="history-local-note">Metadata stored in this browser</span></div>
        {filtered.length ? (
          <div className="table-scroll">
            <table className="history-table">
              <thead><tr><th>FILE</th><th>REVIEWED</th><th>ISSUES</th><th>TESTS</th><th>STATUS</th><th /></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} onClick={() => onOpen(item.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(item.id); }}>
                    <td><span className="table-file"><span className="file-icon"><FileCode2 size={15} /></span><span><strong>{item.filename}</strong><small>{item.filePath}</small></span></span></td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.issuesDetected === null ? "—" : item.issuesDetected}</td>
                    <td><span className={item.testsPassed === true ? "test-passed" : item.testsPassed === false ? "test-failed" : "test-unknown"}>{item.testsPassed === true ? "Passed" : item.testsPassed === false ? "Failed" : "—"}</span></td>
                    <td><StatusBadge status={item.status} /></td>
                    <td><button className="table-open" aria-label={`Open ${item.filename}`} onClick={(event) => { event.stopPropagation(); onOpen(item.id); }}><ArrowUpRight size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-activity">
            <span className="empty-icon"><FileCode2 size={20} /></span>
            <strong>{query ? "No matching reviews" : "Nothing here yet"}</strong>
            <p>{query ? "Try a different file name or path." : "Your real backend review runs will appear here."}</p>
          </div>
        )}
      </section>
    </motion.div>
  );
}
