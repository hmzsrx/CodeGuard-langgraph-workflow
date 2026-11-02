import { AlertTriangle, Code2, FileSearch, Sparkles } from "lucide-react";
import { countIssues } from "../../lib/utils";
import { CodeViewer } from "../code-editor/CodeViewer";

export function ReviewResults({
  findings,
  originalCode,
  explanation,
}: {
  findings: string;
  originalCode: string;
  explanation: string;
}) {
  const count = countIssues(findings);
  return (
    <div className="results-stack">
      <section className="panel findings-panel">
        <div className="panel-heading">
          <div className="heading-icon"><FileSearch size={17} /></div>
          <div className="heading-copy"><span className="eyebrow">AI REVIEW REPORT</span><h2>Review findings</h2></div>
          <span className="count-pill">{count === null ? "Report" : `${count} ${count === 1 ? "issue" : "issues"}`}</span>
        </div>
        <div className="report-text">
          {(findings || "The backend has not returned review findings yet.").split("\n").map((line, index) => {
            const parts = line.split(/(critical|high|medium|low|suggestion)/gi);
            return (
              <div className={line.startsWith("#") ? "report-line report-heading" : "report-line"} key={`${index}-${line.slice(0, 20)}`}>
                {parts.map((part, partIndex) => {
                  const severity = part.toLowerCase();
                  return ["critical", "high", "medium", "low", "suggestion"].includes(severity)
                    ? <span className={`severity severity-${severity}`} key={partIndex}>{part}</span>
                    : <span key={partIndex}>{part}</span>;
                })}
              </div>
            );
          })}
        </div>
        {explanation && (
          <div className="fix-explanation">
            <div className="explanation-title"><Sparkles size={15} /> Fix summary</div>
            <p>{explanation}</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div className="heading-icon subdued"><Code2 size={16} /></div>
          <div className="heading-copy"><span className="eyebrow">SOURCE</span><h2>Original code</h2></div>
          <span className="readonly-label">Read only</span>
        </div>
        <CodeViewer code={originalCode} />
      </section>
      {!findings && <p className="inline-note"><AlertTriangle size={14} /> Waiting for the review report from the backend.</p>}
    </div>
  );
}
