import { AlertCircle, CheckCircle2, FlaskConical } from "lucide-react";

export function TestResults({
  passed,
  result,
}: {
  passed: boolean | null;
  result: string;
}) {
  if (passed === null && !result) return null;
  const isFailure = passed === false;
  return (
    <section className={`panel test-results-panel ${isFailure ? "test-results-failure" : "test-results-success"}`}>
      <div className="test-result-icon">
        {isFailure ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      </div>
      <div className="test-result-copy">
        <span className="eyebrow">BACKEND VALIDATION</span>
        <h2>{isFailure ? "Syntax check failed" : "Syntax check passed"}</h2>
        <p>{result || "No validation details were returned."}</p>
        <span className="test-scope"><FlaskConical size={13} /> Python syntax only · Runtime behavior not verified</span>
      </div>
      <span className={`test-result-state ${isFailure ? "failed" : "passed"}`}>{isFailure ? "FAILED" : "PASSED"}</span>
    </section>
  );
}
