import Editor from "@monaco-editor/react";

export function CodeViewer({
  code,
  language = "python",
  height = "420px",
}: {
  code: string;
  language?: string;
  height?: string;
}) {
  return (
    <div className="editor-frame">
      <Editor
        height={height}
        language={language}
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbers: "on",
          padding: { top: 16, bottom: 16 },
          wordWrap: "on",
          automaticLayout: true,
          renderLineHighlight: "none",
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
      />
    </div>
  );
}
