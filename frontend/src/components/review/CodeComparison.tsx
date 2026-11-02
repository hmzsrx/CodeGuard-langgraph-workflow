import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { ArrowLeftRight, Code2, FileCode2 } from "lucide-react";

export function CodeComparison({
  originalCode,
  fixedCode,
}: {
  originalCode: string;
  fixedCode: string;
}) {
  const [sideBySide, setSideBySide] = useState(true);
  return (
    <section className="panel comparison-panel">
      <div className="panel-heading comparison-heading">
        <div>
          <span className="eyebrow">PROPOSED PATCH</span>
          <h2>Review the changes</h2>
        </div>
        <button className="button button-quiet button-sm" onClick={() => setSideBySide((value) => !value)}>
          <ArrowLeftRight size={14} /> {sideBySide ? "Inline diff" : "Side by side"}
        </button>
      </div>
      <div className="diff-toolbar">
        <div className="diff-file"><FileCode2 size={14} /><span>Original code</span></div>
        <div className="diff-file diff-file-new"><Code2 size={14} /><span>AI fixed code</span></div>
        <span className="diff-legend"><i className="legend-added" /> Added <i className="legend-removed" /> Removed</span>
      </div>
      <div className="diff-editor editor-frame">
        <DiffEditor
          height="440px"
          language="python"
          original={originalCode}
          modified={fixedCode}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: sideBySide,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            lineNumbers: "on",
            padding: { top: 14, bottom: 14 },
            wordWrap: "on",
            automaticLayout: true,
            renderOverviewRuler: false,
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
    </section>
  );
}
