"use client";
import { useState } from "react";
import { G } from "../_lib/theme";
import type { ExtOrder } from "../_lib/constants";
import { CopyBtn } from "./Shared";
import { FlavourPill } from "./FlavourPill";

export function PendingOrderCard({
  order,
  productMap,
  onConfirm,
  onCancel,
}: {
  order: ExtOrder;
  productMap: Record<string, string>;
  onConfirm: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const flavours = order.flavours ? Object.entries(order.flavours as Record<string, number>).filter(([, q]) => q > 0) : [];
  return (
    <div style={{ background: G.glassStrong, border: `1px solid ${G.goldBorder}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: "1.05rem", fontWeight: 700, color: G.text, marginBottom: 3 }}>{order.customer_name}</p>
          <p style={{ fontSize: "0.8rem", color: G.muted }}>
            🕐 {order.delivery_slot || order.batch_label || "—"} · <span style={{ color: G.gold, fontWeight: 700 }}>₹{order.total_price}</span>
            {order.fulfillment_type === "pickup" ? " · 🏠 Pickup" : " · 🚚 Delivery"}
          </p>
        </div>
        <span style={{ padding: "4px 10px", borderRadius: 8, background: G.goldGlass, border: `1px solid ${G.goldBorder}`, fontSize: "0.68rem", fontWeight: 700, color: G.gold }}>
          Payment Pending
        </span>
      </div>
      {flavours.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap" as const }}>
          {flavours.map(([id, qty]) => <FlavourPill key={id} name={productMap[id] || "Unknown"} qty={qty} />)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: "0.84rem", color: G.sub }}>📞 {order.phone || "—"}</span>
        {order.phone && <CopyBtn value={order.phone} label="Phone" />}
      </div>
      {order.address && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: "0.8rem", color: G.sub, flex: 1 }}>📍 {order.address}</span>
          <CopyBtn value={order.address} label="Addr" />
        </div>
      )}
      {order.insta_id && <p style={{ fontSize: "0.78rem", color: "#f472b6", marginBottom: 4 }}>📸 @{order.insta_id}</p>}
      {order.remarks && <p style={{ fontSize: "0.78rem", color: "#86efac", fontStyle: "italic" as const, marginBottom: 4 }}>💬 {order.remarks}</p>}
      <div style={{ marginBottom: 10 }}>
        <CopyBtn value={`${typeof window !== "undefined" ? window.location.origin : ""}/pay/${order.id}`} label="Payment Link" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={updating}
          onClick={async () => { setUpdating(true); await onConfirm(order.id); setUpdating(false); }}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 9, fontSize: "0.85rem", fontWeight: 700, cursor: updating ? "not-allowed" : "pointer", opacity: updating ? 0.5 : 1, border: "1px solid rgba(52,211,153,0.5)", background: "rgba(52,211,153,0.14)", color: G.green, fontFamily: "system-ui, sans-serif" }}
        >
          {updating ? "..." : "→ Confirm (Payment Received)"}
        </button>
        <button
          disabled={updating}
          onClick={async () => { if (!confirm(`Cancel order for ${order.customer_name}?`)) return; setUpdating(true); await onCancel(order.id); setUpdating(false); }}
          style={{ padding: "10px 14px", borderRadius: 9, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", border: `1px solid rgba(255,92,108,0.3)`, background: G.redGlass, color: G.red, fontFamily: "system-ui, sans-serif" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
