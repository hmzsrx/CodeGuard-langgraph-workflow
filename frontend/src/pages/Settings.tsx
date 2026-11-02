import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Server, ShieldCheck } from "lucide-react";
import { API_BASE_URL, checkApiHealth } from "../services/api";

export function Settings() {
  const [health, setHealth] = useState<"checking" | "connected" | "disconnected">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    checkApiHealth().then((connected) => {
      if (active) setHealth(connected ? "connected" : "disconnected");
    }).catch((error: unknown) => {
      if (active) {
        setHealth("disconnected");
        setMessage(error instanceof Error ? error.message : "Could not reach the backend.");
      }
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="page-content settings-page">
      <div className="page-title-row"><div><span className="eyebrow">PREFERENCES</span><h1>Settings</h1><p>Review your CodeGuard backend connection.</p></div></div>
      <section className="panel settings-panel">
        <div className="settings-section-head"><div className="heading-icon"><Server size={17} /></div><div><h2>Backend connection</h2><p>Connected to the LangGraph API that handles review and approval.</p></div></div>
        <div className="setting-row"><div><strong>API base URL</strong><span>Set with VITE_API_URL or use the local default.</span></div><code>{API_BASE_URL}</code></div>
        <div className="setting-row"><div><strong>Connection status</strong><span>{message || "Health check via /api/health"}</span></div>
          <span className={`connection-state health-${health}`}>
            {health === "checking" ? <LoaderCircle size={14} className="spin" /> : health === "connected" ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
            {health === "checking" ? "Checking" : health === "connected" ? "Connected" : "Unavailable"}
          </span>
        </div>
      </section>
      <section className="panel settings-panel safe-settings">
        <div className="settings-section-head"><div className="heading-icon green-icon"><ShieldCheck size={17} /></div><div><h2>File safety</h2><p>How original files are protected.</p></div></div>
        <div className="safety-points"><span><CheckCircle2 size={15} /> Selected content is reviewed on a temporary backend file.</span><span><CheckCircle2 size={15} /> Original file writes require a LangGraph approval and a second API call.</span><span><CheckCircle2 size={15} /> The backend creates a backup before writing.</span></div>
      </section>
    </div>
  );
}
