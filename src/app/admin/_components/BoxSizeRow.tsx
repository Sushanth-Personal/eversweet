"use client";
import { useState } from "react";
import type { BoxSize } from "@/lib/types";
import { G } from "../_lib/theme";
import { GlassInput, GlassBtn } from "./Shared";

export function BoxSizeRow({
  box,
  onSave,
  onToggle,
}: {
  box: BoxSize;
  onSave: (updates: {
    label: string;
    count: number;
    price: number;
    price_trivandrum: number | null;
  }) => Promise<void>;
  onToggle: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(box.label);
  const [count, setCount] = useState(String(box.count));
  const [priceKochi, setPriceKochi] = useState(String(box.price));
  const [priceTvm, setPriceTvm] = useState(box.price_trivandrum != null ? String(box.price_trivandrum) : "");
  const [saving, setSaving] = useState(false);

  return (
    <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
      {editing ? (
        <div>
          <GlassInput placeholder="Label" value={label} onChange={setLabel} />
          <GlassInput placeholder="Pieces" type="number" value={count} onChange={setCount} />
          <GlassInput placeholder="Kochi Price ₹" type="number" value={priceKochi} onChange={setPriceKochi} />
          <GlassInput placeholder="Trivandrum Price ₹ (optional)" type="number" value={priceTvm} onChange={setPriceTvm} />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={saving || !label || !count || !priceKochi}
              onClick={async () => {
                setSaving(true);
                await onSave({
                  label,
                  count: Number(count),
                  price: Number(priceKochi),
                  price_trivandrum: priceTvm ? Number(priceTvm) : null,
                });
                setSaving(false);
                setEditing(false);
              }}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: G.blueGlass, color: G.blue, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <GlassBtn onClick={() => setEditing(false)}>Cancel</GlassBtn>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "0.9rem", fontWeight: 700, color: G.text }}>{box.label}</p>
            <p style={{ fontSize: "0.75rem", color: G.muted }}>
              {box.count} pieces · 🍡 ₹{box.price}
              {box.price_trivandrum != null && ` · 🚂 ₹${box.price_trivandrum}`}
              {" · "}
              <span style={{ color: box.is_active ? G.green : G.red, fontWeight: 600 }}>{box.is_active ? "Active" : "Hidden"}</span>
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <GlassBtn variant="primary" onClick={() => setEditing(true)}>Edit</GlassBtn>
            <GlassBtn onClick={onToggle}>{box.is_active ? "Hide" : "Show"}</GlassBtn>
          </div>
        </div>
      )}
    </div>
  );
}
