"use client";
import { useState } from "react";
import { G } from "../_lib/theme";

export function StartDateEditor({
  trackingStart,
  setTrackingStart,
}: {
  trackingStart: string;
  setTrackingStart: (d: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(trackingStart);
  return (
    <div
      style={{
        background: G.goldGlass,
        border: `1px solid ${G.goldBorder}`,
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      {editing ? (
        <>
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${G.goldBorder}`,
              color: G.text,
              padding: "7px 10px",
              borderRadius: 7,
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              outline: "none",
              colorScheme: "dark" as const,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                if (draft) {
                  setTrackingStart(draft);
                  localStorage.setItem("es_tracking_start", draft);
                }
                setEditing(false);
              }}
              style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: G.goldGlass, color: G.gold, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              Save
            </button>
            <button
              onClick={() => { setDraft(trackingStart); setEditing(false); }}
              style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${G.glassBorder}`, background: G.glass, color: G.muted, fontSize: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              ✕
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <p style={{ fontSize: 10, color: G.gold, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 3 }}>
              Tracking from
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: G.text }}>
              {new Date(trackingStart + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => { setDraft(trackingStart); setEditing(true); }}
            style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${G.goldBorder}`, background: "transparent", color: G.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
          >
            Edit
          </button>
        </>
      )}
    </div>
  );
}
