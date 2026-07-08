"use client";
import { useState } from "react";
import { G } from "../_lib/theme";

export function ExpenseImporter({ onImport }: { onImport: (text: string) => Promise<void> }) {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setError("");
    if (!text.trim()) { setError("Paste JSON first"); return; }
    try { JSON.parse(text.trim()); } catch { setError("Invalid JSON"); return; }
    setImporting(true);
    await onImport(text.trim());
    setImporting(false);
    setText("");
  }
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${G.glassBorder}` }}>
      <p style={{ fontSize: "0.72rem", color: G.muted, fontWeight: 600, marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
        Bulk import expenses
      </p>
      <div style={{ display: "flex", gap: 0, marginBottom: 12, border: `1px solid ${G.glassBorder}`, borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
        {(["paste", "upload"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{ padding: "6px 16px", border: "none", fontFamily: "system-ui, sans-serif", background: mode === m ? "rgba(96,165,250,0.2)" : G.glass, color: mode === m ? G.blue : G.muted, fontSize: "0.78rem", fontWeight: mode === m ? 600 : 400, cursor: "pointer" }}
          >
            {m === "paste" ? "Paste" : "Upload"}
          </button>
        ))}
      </div>
      {mode === "paste" ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            placeholder="Paste JSON..."
            style={{ width: "100%", minHeight: 100, background: "rgba(0,0,0,0.3)", border: `1px solid ${error ? "rgba(255,92,108,0.5)" : G.glassBorder}`, borderRadius: 8, padding: "10px 12px", fontSize: "0.75rem", color: G.text, fontFamily: "monospace", resize: "vertical" as const, outline: "none", marginBottom: 6, boxSizing: "border-box" as const }}
          />
          {error && <p style={{ fontSize: "0.72rem", color: G.red, marginBottom: 8 }}>⚠ {error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={importing || !text.trim()}
              onClick={run}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid rgba(96,165,250,0.4)`, background: G.blueGlass, color: G.blue, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              {importing ? "Importing..." : "Import"}
            </button>
            {text && (
              <button onClick={() => { setText(""); setError(""); }} style={{ background: "transparent", border: "none", color: G.muted, fontSize: "0.78rem", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <label style={{ display: "inline-block", padding: "9px 18px", borderRadius: 8, border: `1px solid rgba(96,165,250,0.4)`, background: G.blueGlass, color: G.blue, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
          📂 Choose JSON File
          <input
            type="file" accept=".json" style={{ display: "none" }}
            onChange={async (e) => { const fi = e.target.files?.[0]; if (!fi) return; setImporting(true); await onImport(await fi.text()); setImporting(false); (e.target as HTMLInputElement).value = ""; }}
          />
        </label>
      )}
    </div>
  );
}
