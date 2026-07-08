"use client";
import { useState } from "react";
import type { BoxSize } from "@/lib/types";
import { G } from "../_lib/theme";
import type { ExtOrder } from "../_lib/constants";
import { CopyBtn } from "./Shared";
import { FlavourPill } from "./FlavourPill";

export function CookOrderCard({
  order,
  productMap,
  boxes,
  isExpanded,
  onTogglePorter,
  onPorterEmail,
  onDispatch,
  onEdit,
  onCancel,
}: {
  order: ExtOrder;
  productMap: Record<string, string>;
  boxes: BoxSize[];
  isExpanded: boolean;
  onTogglePorter: () => void;
  onPorterEmail: (order: ExtOrder) => Promise<void>;
  onDispatch: (id: string) => Promise<void>;
  onEdit: (order: ExtOrder) => void;
  onCancel: (id: string) => Promise<void>;
}) {
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const flavours = order.flavours ? Object.entries(order.flavours as Record<string, number>).filter(([, q]) => q > 0) : [];
  const boxLabel = boxes.find((b) => b.id === order.box_size_id)?.label || null;
  const totalPieces = flavours.reduce((s, [, q]) => s + q, 0);
  return (
    <div style={{ background: G.glassStrong, border: `0.5px solid ${G.glassBorder}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <div style={{ padding: "13px 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <span style={{ color: G.text, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{order.customer_name}</span>
          {boxLabel && (
            <span style={{ fontSize: 12, fontWeight: 600, color: G.gold, background: G.goldGlass, border: `1px solid ${G.goldBorder}`, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
              {boxLabel}
            </span>
          )}
        </div>
        {totalPieces > 0 && <p style={{ fontSize: 13, color: G.muted, fontWeight: 500 }}>{totalPieces} piece{totalPieces !== 1 ? "s" : ""}</p>}
      </div>
      {flavours.length > 0 && (
        <div style={{ padding: "0 14px 12px", display: "flex", flexWrap: "wrap" as const }}>
          {flavours.map(([id, qty]) => <FlavourPill key={id} name={productMap[id] || "Unknown"} qty={qty} large />)}
        </div>
      )}
      {isExpanded && (
        <div style={{ background: "rgba(167,139,250,0.06)", borderTop: `0.5px solid rgba(167,139,250,0.18)`, padding: "12px 14px" }}>
          {order.phone && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
              <span style={{ color: G.sub, fontSize: 13 }}>📞 {order.phone}</span>
              <CopyBtn value={order.phone} label="Phone" />
            </div>
          )}
          {order.address && (
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <span style={{ color: G.sub, fontSize: 13, flex: 1 }}>📍 {order.address}</span>
              <CopyBtn value={order.address} label="Addr" />
            </div>
          )}
          {order.remarks && <p style={{ fontSize: 12, color: "#86efac", fontStyle: "italic" as const, marginBottom: 8 }}>💬 {order.remarks}</p>}
          <button
            disabled={sendingEmail || emailSent}
            onClick={async () => { setSendingEmail(true); await onPorterEmail(order); setSendingEmail(false); setEmailSent(true); }}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 9, border: "none",
              background: emailSent ? G.greenGlass : "rgba(167,139,250,0.18)",
              color: emailSent ? G.green : G.purple, fontSize: 13, fontWeight: 700,
              cursor: sendingEmail || emailSent ? "not-allowed" : "pointer", opacity: sendingEmail ? 0.6 : 1,
              fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s",
            }}
          >
            {emailSent ? "✓ Alert Sent" : sendingEmail ? "Sending…" : "📧 Send Porter Alert"}
          </button>
        </div>
      )}
      <div style={{ display: "flex", borderTop: `0.5px solid ${G.glassBorder}` }}>
        <button onClick={onTogglePorter} style={{ flex: 1, padding: "12px 10px", border: "none", background: isExpanded ? "rgba(167,139,250,0.18)" : G.purpleGlass, color: G.purple, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📦 {isExpanded ? "Hide Info" : "Book Porter"}
        </button>
        <div style={{ width: "0.5px", background: G.glassBorder, flexShrink: 0 }} />
        <button
          disabled={dispatching}
          onClick={async () => { setDispatching(true); await onDispatch(order.id); setDispatching(false); }}
          style={{ flex: 1, padding: "12px 10px", background: G.greenGlass, border: "none", color: G.green, fontSize: 14, fontWeight: 600, cursor: dispatching ? "not-allowed" : "pointer", opacity: dispatching ? 0.5 : 1, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          ✓ {dispatching ? "Saving..." : "Dispatched"}
        </button>
        <div style={{ width: "0.5px", background: G.glassBorder, flexShrink: 0 }} />
        <button onClick={() => onEdit(order)} style={{ flex: 1, padding: "12px 10px", background: G.blueGlass, border: "none", color: G.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          ✏️ Edit
        </button>
        <div style={{ width: "0.5px", background: G.glassBorder, flexShrink: 0 }} />
        <button
          onClick={async () => { if (!confirm(`Cancel order for ${order.customer_name}? This cannot be undone.`)) return; await onCancel(order.id); }}
          style={{ flex: 1, padding: "12px 10px", background: G.redGlass, border: "none", color: G.red, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
