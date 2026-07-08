"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize } from "@/lib/types";
import { G } from "../_lib/theme";
import { getFlavourColor } from "../_lib/theme";
import { ALL_SLOTS } from "../_lib/constants";
import { GlassInput } from "./Shared";

export function ManualOrderForm({
  boxes,
  customers,
  products,
  onSave,
  onClose,
}: {
  boxes: BoxSize[];
  customers: { name: string; phone: string; insta_id: string; remarks: string }[];
  products: Product[];
  onSave: (orderId: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    insta_id: "",
    address: "",
    remarks: "",
    notes: "",
    order_date: new Date().toISOString().split("T")[0],
    delivery_date: new Date().toISOString().split("T")[0],
    delivery_slot: ALL_SLOTS[2],
    payment_method: "upi",
    status: "pending",
    fulfillment_type: "delivery" as "delivery" | "pickup",
    location: "kochi" as "kochi" | "trivandrum",
    custom_box_label: "",
  });
  const [boxRows, setBoxRows] = useState<{ box_size_label: string; price: string; custom_label?: string }[]>([{ box_size_label: "", price: "" }]);
  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [payLinkCopied, setPayLinkCopied] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<typeof customers>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const f = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const totalPrice = boxRows.reduce((s, r) => s + (Number(r.price) || 0), 0);

  function priceForLocation(box: BoxSize, location: "kochi" | "trivandrum"): number {
    if (location === "trivandrum") return box.price_trivandrum ?? box.price;
    return box.price;
  }

  function handleNameChange(v: string) {
    setForm((p) => ({ ...p, customer_name: v }));
    if (v.trim().length >= 1) {
      const matches = customers.filter((c) => c.name.toLowerCase().startsWith(v.toLowerCase()));
      setNameSuggestions(matches.slice(0, 6));
      setShowSuggestions(matches.length > 0);
    } else setShowSuggestions(false);
  }

  function updateBoxRow(i: number, field: "box_size_label" | "price", value: string) {
    setBoxRows((rows) => {
      const updated = [...rows];
      if (field === "box_size_label") {
        const box = boxes.find((b) => b.label === value);
        updated[i] = {
          ...updated[i],
          box_size_label: value,
          price: box ? String(priceForLocation(box, form.location)) : value === "custom" ? "" : updated[i].price,
          custom_label: value === "custom" ? "" : undefined,
        };
      } else {
        updated[i] = { ...updated[i], price: value };
      }
      return updated;
    });
  }

  function changeLocation(location: "kochi" | "trivandrum") {
    setForm((p) => ({ ...p, location }));
    setBoxRows((rows) =>
      rows.map((row) => {
        if (row.box_size_label === "custom" || !row.box_size_label) return row;
        const box = boxes.find((b) => b.label === row.box_size_label);
        if (!box) return row;
        return { ...row, price: String(priceForLocation(box, location)) };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    let firstOrderId = "";
    let isFirst = true;
    for (const row of boxRows) {
      if (!row.price) continue;
      const isCustom = row.box_size_label === "custom";
      const box = isCustom ? null : boxes.find((b) => b.label === row.box_size_label);
      const { data } = await supabase
        .from("orders")
        .insert({
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          insta_id: form.insta_id.trim(),
          address: form.address.trim() || null,
          remarks: form.location === "trivandrum" ? `[TVM] ${form.remarks}`.trim() : form.remarks.trim(),
          notes: isCustom ? `Custom box: ${row.custom_label || ""}${form.notes.trim() ? ` | ${form.notes.trim()}` : ""}` : form.notes.trim() || null,
          box_size_id: box?.id || null,
          flavours: isFirst && Object.keys(flavours).length > 0 ? flavours : {},
          delivery_date: form.delivery_date,
          delivery_slot: form.delivery_slot,
          payment_method: form.payment_method,
          total_price: Number(row.price),
          status: form.status,
          source: form.location === "trivandrum" ? "trivandrum" : "dm",
          order_date: form.order_date,
          fulfillment_type: form.fulfillment_type,
        })
        .select("id")
        .single();
      if (isFirst && data?.id) firstOrderId = data.id;
      isFirst = false;
    }
    setSaving(false);
    if (firstOrderId) setSavedOrderId(firstOrderId);
    onSave(firstOrderId);
  }

  const paymentLink = savedOrderId && typeof window !== "undefined" ? `${window.location.origin}/pay/${savedOrderId}` : "";
  const selectStyle: React.CSSProperties = {
    width: "100%", background: G.glass, border: `1px solid ${G.glassBorder}`, color: G.text,
    padding: "11px 14px", borderRadius: 10, fontSize: "0.88rem", marginBottom: 8,
    fontFamily: "system-ui, sans-serif", outline: "none",
  };

  return (
    <div style={{ background: G.glassStrong, border: `1px solid ${G.glassBorderStrong}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: "0.88rem", fontWeight: 700, color: G.blue }}>+ Manual Order</p>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: G.muted, cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
      </div>

      <p style={{ fontSize: "0.65rem", color: G.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6, fontWeight: 600 }}>📍 Order Location</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["kochi", "trivandrum"] as const).map((loc) => (
          <button
            key={loc}
            onClick={() => changeLocation(loc)}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontFamily: "system-ui, sans-serif", border: `1px solid ${form.location === loc ? G.goldBorder : G.glassBorder}`, background: form.location === loc ? G.goldGlass : G.glass, color: form.location === loc ? G.gold : G.sub, fontSize: "0.82rem", fontWeight: form.location === loc ? 700 : 400, cursor: "pointer" }}
          >
            {loc === "kochi" ? "🍡 Kochi" : "🚂 Trivandrum"}
          </button>
        ))}
      </div>
      {form.location === "trivandrum" && (
        <div style={{ background: "rgba(240,176,64,0.06)", border: `1px solid ${G.goldBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: "0.72rem", color: G.gold }}>
          🚂 This order will appear in the Trivandrum tab
        </div>
      )}

      <div style={{ position: "relative" }}>
        <GlassInput placeholder="Customer Name *" value={form.customer_name} onChange={handleNameChange} />
        {showSuggestions && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(10,16,26,0.97)", border: `1px solid ${G.glassBorderStrong}`, borderRadius: 10, zIndex: 200, marginTop: -6, overflow: "hidden" }}>
            {nameSuggestions.map((c, i) => (
              <div
                key={i}
                onMouseDown={() => { setForm((p) => ({ ...p, customer_name: c.name, phone: c.phone || p.phone, insta_id: c.insta_id || p.insta_id, remarks: c.remarks || p.remarks })); setShowSuggestions(false); }}
                style={{ padding: "9px 12px", cursor: "pointer", borderBottom: i < nameSuggestions.length - 1 ? `1px solid ${G.glassBorder}` : "none" }}
              >
                <p style={{ fontSize: "0.88rem", fontWeight: 600, color: G.text }}>{c.name}</p>
                {c.phone && <p style={{ fontSize: "0.72rem", color: G.muted }}>📞 {c.phone}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px" }}>
        <GlassInput placeholder="Phone" value={form.phone} onChange={f("phone")} />
        <GlassInput placeholder="Instagram (without @)" value={form.insta_id} onChange={f("insta_id")} />
      </div>
      <GlassInput placeholder="Address" value={form.address} onChange={f("address")} />

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

      <p style={{ fontSize: "0.72rem", color: G.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>📦 Boxes</p>
      {boxRows.map((row, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 32px", gap: 6, alignItems: "center", marginBottom: row.box_size_label === "custom" ? 6 : 0 }}>
            <select
              value={row.box_size_label}
              onChange={(e) => updateBoxRow(i, "box_size_label", e.target.value)}
              style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, color: row.box_size_label ? G.text : G.muted, padding: "10px 12px", borderRadius: 9, fontSize: "0.85rem", fontFamily: "system-ui, sans-serif", outline: "none" }}
            >
              <option value="" style={{ background: "#1a2535" }}>Select box</option>
              {boxes.map((b) => <option key={b.id} value={b.label} style={{ background: "#1a2535" }}>{b.label} — ₹{priceForLocation(b, form.location)}</option>)}
              <option value="custom" style={{ background: "#1a2535" }}>✏️ Custom size</option>
            </select>
            <input
              type="number" placeholder="₹" value={row.price} onChange={(e) => updateBoxRow(i, "price", e.target.value)}
              style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, color: G.text, padding: "10px", borderRadius: 9, fontSize: "0.88rem", fontFamily: "system-ui, sans-serif", outline: "none", width: "100%", boxSizing: "border-box" as const }}
            />
            <button
              onClick={() => setBoxRows((rows) => (rows.length === 1 ? rows : rows.filter((_, j) => j !== i)))}
              style={{ background: G.redGlass, border: `1px solid rgba(255,92,108,0.3)`, color: G.red, borderRadius: 8, cursor: "pointer", fontSize: "0.9rem", width: 32, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>
          </div>
          {row.box_size_label === "custom" && (
            <input
              type="text" placeholder="Describe box (e.g. Box of 18)" value={row.custom_label || ""}
              onChange={(e) => setBoxRows((rows) => { const updated = [...rows]; updated[i] = { ...updated[i], custom_label: e.target.value }; return updated; })}
              style={{ width: "100%", background: G.glass, border: `1px solid ${G.goldBorder}`, color: G.text, padding: "9px 12px", borderRadius: 9, fontSize: "0.82rem", fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box" as const }}
            />
          )}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button
          onClick={() => setBoxRows((rows) => [...rows, { box_size_label: "", price: "" }])}
          style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid rgba(96,165,250,0.4)`, background: G.blueGlass, color: G.blue, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
        >
          + Add Box
        </button>
        {totalPrice > 0 && <p style={{ fontSize: "0.88rem", fontWeight: 700, color: G.gold }}>₹{totalPrice}</p>}
      </div>

      {products.filter((p) => p.is_available).length > 0 && (
        <>
          <p style={{ fontSize: "0.72rem", color: G.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>🍡 Flavours</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 12 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px" }}>
        <GlassInput type="date" placeholder="Order Date" value={form.order_date} onChange={f("order_date")} />
        <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={selectStyle}>
          <option value="pending" style={{ background: "#1a2535" }}>Pending</option>
          <option value="confirmed" style={{ background: "#1a2535" }}>Confirmed</option>
          <option value="dispatched" style={{ background: "#1a2535" }}>Dispatched</option>
        </select>
      </div>
      <GlassInput placeholder="Remarks" value={form.remarks} onChange={f("remarks")} />
      <GlassInput placeholder="Internal notes" value={form.notes} onChange={f("notes")} />

      <button
        disabled={saving || !form.customer_name || totalPrice === 0}
        onClick={handleSave}
        style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: saving || !form.customer_name || totalPrice === 0 ? G.glass : G.blueGlass, color: saving || !form.customer_name || totalPrice === 0 ? G.muted : G.blue, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
      >
        {saving ? "Saving..." : `Save Order · ₹${totalPrice}`}
      </button>

      {savedOrderId && form.status === "pending" && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: G.blueGlass, border: `1px solid rgba(96,165,250,0.3)`, borderRadius: 10 }}>
          <p style={{ fontSize: "0.82rem", fontWeight: 700, color: G.blue, marginBottom: 6 }}>🔗 Payment Link</p>
          <p style={{ fontSize: "0.68rem", color: G.sub, marginBottom: 10, wordBreak: "break-all" as const }}>{paymentLink}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { navigator.clipboard.writeText(paymentLink).then(() => { setPayLinkCopied(true); setTimeout(() => setPayLinkCopied(false), 2500); }); }}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: payLinkCopied ? G.greenGlass : G.blueGlass, color: payLinkCopied ? G.green : G.blue, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              {payLinkCopied ? "✓ Copied!" : "📋 Copy Link"}
            </button>
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Hi! Here's your Eversweet payment link 🍡\n\n${paymentLink}`)}`, "_blank")}
              style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "rgba(37,211,102,0.18)", color: "#25d366", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              📲 WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
