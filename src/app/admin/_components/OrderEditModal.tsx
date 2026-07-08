"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize } from "@/lib/types";
import { G, getFlavourColor } from "../_lib/theme";
import { ALL_SLOTS, STATUS_LABELS, type ExtOrder } from "../_lib/constants";
import { GlassInput } from "./Shared";

export function OrderEditModal({
  order,
  products,
  boxes,
  onSave,
  onClose,
  onCancel,
}: {
  order: ExtOrder;
  products: Product[];
  boxes: BoxSize[];
  onSave: () => Promise<void>;
  onClose: () => void;
  onCancel: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    customer_name: order.customer_name || "",
    phone: order.phone || "",
    insta_id: order.insta_id || "",
    address: order.address || "",
    remarks: order.remarks || "",
    notes: order.notes || "",
    delivery_date: order.delivery_date || "",
    delivery_slot: order.delivery_slot || ALL_SLOTS[2],
    total_price: String(order.total_price || ""),
    status: order.status || "pending",
    fulfillment_type: (order.fulfillment_type as "delivery" | "pickup") || "delivery",
    box_size_id: order.box_size_id || "",
    custom_box_label: "",
    location: (order.source === "trivandrum" ? "trivandrum" : "kochi") as "kochi" | "trivandrum",
  });
  const [flavours, setFlavours] = useState<Record<string, number>>((order.flavours as Record<string, number>) || {});
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const f = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function priceForLocation(box: BoxSize, location: "kochi" | "trivandrum"): number {
    if (location === "trivandrum") return box.price_trivandrum ?? box.price;
    return box.price;
  }

  const selectStyle: React.CSSProperties = {
    width: "100%", background: G.glass, border: `1px solid ${G.glassBorder}`, color: G.text,
    padding: "11px 14px", borderRadius: 10, fontSize: "0.88rem", marginBottom: 8,
    fontFamily: "system-ui, sans-serif", outline: "none",
  };
  return (
    <div
      style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: G.pageBg, border: `1px solid ${G.glassBorderStrong}`, borderRadius: "18px 18px 0 0", padding: 20, width: "100%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto" as const }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: G.blue }}>✏️ Edit Order — {order.customer_name}</p>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: G.muted, cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        </div>
        <GlassInput placeholder="Customer Name *" value={form.customer_name} onChange={f("customer_name")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px" }}>
          <GlassInput placeholder="Phone" value={form.phone} onChange={f("phone")} />
          <GlassInput placeholder="Instagram (without @)" value={form.insta_id} onChange={f("insta_id")} />
        </div>
        <GlassInput placeholder="Address" value={form.address} onChange={f("address")} />

        {/* Location toggle — sets box pricing */}
        <p style={{ fontSize: "0.65rem", color: G.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6, fontWeight: 600 }}>
          📍 Order Location <span style={{ color: G.gold, fontWeight: 400 }}>(sets box pricing)</span>
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["kochi", "trivandrum"] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => {
                setForm((p) => ({ ...p, location: loc }));
                if (form.box_size_id && form.box_size_id !== "custom") {
                  const box = boxes.find((b) => b.id === form.box_size_id);
                  if (box) setForm((p) => ({ ...p, total_price: String(priceForLocation(box, loc)) }));
                }
              }}
              style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontFamily: "system-ui, sans-serif", border: `1px solid ${form.location === loc ? G.goldBorder : G.glassBorder}`, background: form.location === loc ? G.goldGlass : G.glass, color: form.location === loc ? G.gold : G.sub, fontSize: "0.82rem", fontWeight: form.location === loc ? 700 : 400, cursor: "pointer" }}
            >
              {loc === "kochi" ? "🍡 Kochi" : "🚂 Trivandrum"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["delivery", "pickup"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setForm((p) => ({ ...p, fulfillment_type: type }))}
              style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontFamily: "system-ui, sans-serif", border: `1px solid ${form.fulfillment_type === type ? "rgba(96,165,250,0.5)" : G.glassBorder}`, background: form.fulfillment_type === type ? G.blueGlass : G.glass, color: form.fulfillment_type === type ? G.blue : G.sub, fontSize: "0.8rem", fontWeight: form.fulfillment_type === type ? 700 : 400, cursor: "pointer" }}
            >
              {type === "delivery" ? "🚚 Delivery" : "🏠 Pickup"}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px" }}>
          <GlassInput type="date" placeholder="Delivery Date" value={form.delivery_date} onChange={f("delivery_date")} />
          <select value={form.delivery_slot} onChange={(e) => setForm((p) => ({ ...p, delivery_slot: e.target.value }))} style={selectStyle}>
            {ALL_SLOTS.map((s) => <option key={s} value={s} style={{ background: "#1a2535" }}>{s}</option>)}
          </select>
        </div>
        <select
          value={form.box_size_id}
          onChange={(e) => {
            const val = e.target.value;
            const box = val !== "custom" ? boxes.find((b) => b.id === val) : null;
            setForm((p) => ({
              ...p,
              box_size_id: val,
              custom_box_label: val !== "custom" ? "" : p.custom_box_label,
              total_price: box ? String(priceForLocation(box, p.location)) : p.total_price,
            }));
          }}
          style={selectStyle}
        >
          <option value="" style={{ background: "#1a2535" }}>Select box size</option>
          {boxes.map((b) => (
            <option key={b.id} value={b.id} style={{ background: "#1a2535" }}>
              {b.label} — ₹{priceForLocation(b, form.location)}
              {form.location === "trivandrum" && b.price_trivandrum == null ? " (Kochi rate)" : ""}
            </option>
          ))}
          <option value="custom" style={{ background: "#1a2535" }}>✏️ Custom size</option>
        </select>
        {form.box_size_id === "custom" && (
          <input
            type="text" placeholder="Describe box (e.g. Box of 18)" value={form.custom_box_label || ""}
            onChange={(e) => setForm((p) => ({ ...p, custom_box_label: e.target.value }))}
            style={{ width: "100%", background: G.glass, border: `1px solid ${G.goldBorder}`, color: G.text, padding: "9px 12px", borderRadius: 9, fontSize: "0.82rem", fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box" as const, marginBottom: 8 }}
          />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px" }}>
          <GlassInput type="number" placeholder="Total Price ₹ *" value={form.total_price} onChange={f("total_price")} />
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={selectStyle}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k} style={{ background: "#1a2535" }}>{v}</option>)}
          </select>
        </div>
        <GlassInput placeholder="Remarks" value={form.remarks} onChange={f("remarks")} />
        <GlassInput placeholder="Internal notes" value={form.notes} onChange={f("notes")} />
        {products.filter((p) => p.is_available).length > 0 && (
          <>
            <p style={{ fontSize: "0.72rem", color: G.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8, fontWeight: 700 }}>🍡 Flavours</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 14 }}>
              {products.filter((p) => p.is_available).map((prod) => {
                const qty = flavours[prod.id] || 0;
                const c = getFlavourColor(prod.name);
                return (
                  <div
                    key={prod.id}
                    onClick={() => { const n = { ...flavours }; if ((n[prod.id] || 0) === 0) n[prod.id] = 1; else delete n[prod.id]; setFlavours(n); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, border: `1px solid ${qty > 0 ? c.border : G.glassBorder}`, background: qty > 0 ? c.bg : G.glass, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {qty > 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot }} />}
                      <span style={{ fontSize: "0.8rem", fontWeight: qty > 0 ? 600 : 400, color: qty > 0 ? c.text : G.sub }}>{prod.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { const n = { ...flavours }; const cur = n[prod.id] || 0; if (cur > 0) { if (cur === 1) delete n[prod.id]; else n[prod.id] = cur - 1; setFlavours(n); } }}
                        disabled={qty === 0}
                        style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${G.glassBorder}`, background: G.glass, color: G.sub, cursor: qty === 0 ? "not-allowed" : "pointer", opacity: qty === 0 ? 0.3 : 1, fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, minWidth: 14, textAlign: "center" as const, color: G.text }}>{qty}</span>
                      <button
                        onClick={() => setFlavours((n) => ({ ...n, [prod.id]: (n[prod.id] || 0) + 1 }))}
                        style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid rgba(96,165,250,0.4)`, background: G.blueGlass, color: G.blue, cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <button
          disabled={saving || !form.customer_name || !form.total_price}
          onClick={async () => {
            setSaving(true);
            const isCustomBox = form.box_size_id === "custom";
            await supabase
              .from("orders")
              .update({
                customer_name: form.customer_name.trim(),
                phone: form.phone.trim(),
                insta_id: form.insta_id.trim(),
                address: form.address.trim() || null,
                remarks: form.remarks.trim(),
                notes: isCustomBox ? `Custom box: ${form.custom_box_label || ""}${form.notes.trim() ? ` | ${form.notes.trim()}` : ""}` : form.notes.trim() || null,
                delivery_date: form.delivery_date || null,
                delivery_slot: form.delivery_slot,
                total_price: Number(form.total_price),
                status: form.status,
                fulfillment_type: form.fulfillment_type,
                box_size_id: isCustomBox ? null : form.box_size_id || null,
                source: form.location === "trivandrum" ? "trivandrum" : "dm",
                flavours,
              })
              .eq("id", order.id);
            setSaving(false);
            await onSave();
          }}
          style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: saving || !form.customer_name || !form.total_price ? G.glass : G.blueGlass, color: saving || !form.customer_name || !form.total_price ? G.muted : G.blue, fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", fontFamily: "system-ui, sans-serif", marginBottom: 10 }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          disabled={cancelling}
          onClick={async () => { if (!confirm(`Cancel order for ${order.customer_name}? This cannot be undone.`)) return; setCancelling(true); await onCancel(order.id); setCancelling(false); onClose(); }}
          style={{ width: "100%", padding: "13px", borderRadius: 10, border: `1px solid rgba(255,92,108,0.3)`, background: G.redGlass, color: G.red, fontSize: "0.92rem", fontWeight: 700, cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.5 : 1, fontFamily: "system-ui, sans-serif" }}
        >
          {cancelling ? "Cancelling..." : "✕ Cancel Order"}
        </button>
      </div>
    </div>
  );
}
