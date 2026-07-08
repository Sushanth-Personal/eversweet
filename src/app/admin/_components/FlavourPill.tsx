"use client";
import { getFlavourColor } from "../_lib/theme";

export function FlavourPill({ name, qty, large = false }: { name: string; qty: number; large?: boolean }) {
  const c = getFlavourColor(name);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: large ? "7px 14px 7px 10px" : "5px 11px 5px 8px",
        borderRadius: 20,
        background: c.bg,
        border: `1px solid ${c.border}`,
        marginRight: 5,
        marginBottom: 5,
      }}
    >
      <div style={{ width: large ? 11 : 9, height: large ? 11 : 9, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      <span style={{ fontSize: large ? "0.95rem" : "0.82rem", fontWeight: 700, color: c.text }}>{name}</span>
      <span style={{ fontSize: large ? "0.9rem" : "0.78rem", fontWeight: 700, color: c.dot, background: `${c.dot}20`, padding: "0 5px", borderRadius: 6 }}>
        ×{qty}
      </span>
    </div>
  );
}

export function FlavourBigCard({ name, qty }: { name: string; qty: number }) {
  const c = getFlavourColor(name);
  return (
    <div style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "16px 8px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: "#fff" }}>{qty}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: c.text, textAlign: "center" as const }}>{name}</div>
    </div>
  );
}
