"use client";
import { useState } from "react";
import { G } from "../_lib/theme";

export function BulkOrderImport({ onImport }: { onImport: (text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${G.glassBorder}`, background: G.glass, color: G.muted, fontSize: "0.78rem", cursor: "pointer", fontFamily: "system-ui, sans-serif", marginBottom: 10 }}
      >
        📂 Bulk Import (JSON)
      </button>
    );
  return (
    <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: G.sub }}>Paste order JSON</p>
        <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: G.muted, cursor: "pointer" }}>✕</button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='[{ "customer_name":"Name", "phone":"", "delivery_slot":"1–3 PM", "total_price":499, "status":"confirmed" }]'
        style={{ width: "100%", minHeight: 80, background: "rgba(0,0,0,0.3)", border: `1px solid ${G.glassBorder}`, borderRadius: 8, padding: "8px 10px", fontSize: "0.75rem", color: G.text, fontFamily: "monospace", resize: "vertical" as const, outline: "none", boxSizing: "border-box" as const, marginBottom: 8 }}
      />
      <button
        disabled={importing || !text.trim()}
        onClick={async () => { setImporting(true); await onImport(text); setImporting(false); setText(""); setOpen(false); }}
        style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid rgba(96,165,250,0.4)`, background: G.blueGlass, color: G.blue, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
      >
        {importing ? "Importing..." : "Import"}
      </button>
    </div>
  );
}
