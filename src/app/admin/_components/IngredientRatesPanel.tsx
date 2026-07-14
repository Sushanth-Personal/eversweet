"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { G } from "../_lib/theme";
import { GlassInput, GlassBtn } from "./Shared";
import {
  pricePerBaseUnit,
  type IngredientRate,
  type Unit,
} from "../_lib/costing";

const UNITS: Unit[] = ["g", "kg", "ml", "l", "piece"];

export function IngredientRatesPanel({
  rates = [],
  onChange,
}: {
  rates?: IngredientRate[];
  onChange: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    item_key: "",
    pack_qty: "1",
    pack_unit: "kg" as Unit,
    price: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setForm({
      item_key: "",
      pack_qty: "1",
      pack_unit: "kg",
      price: "",
      notes: "",
    });
  }

  async function save() {
    if (!form.item_key.trim() || !form.pack_qty || !form.price) return;
    setSaving(true);
    const payload = {
      item_key: form.item_key.trim().toLowerCase(),
      pack_qty: Number(form.pack_qty),
      pack_unit: form.pack_unit,
      price: Number(form.price),
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      await supabase
        .from("ingredient_rates")
        .update(payload)
        .eq("id", editingId);
    } else {
      await supabase
        .from("ingredient_rates")
        .upsert(payload, { onConflict: "item_key" });
    }
    setSaving(false);
    setAdding(false);
    setEditingId(null);
    resetForm();
    await onChange();
  }

  function startEdit(r: IngredientRate) {
    setEditingId(r.id);
    setForm({
      item_key: r.item_key,
      pack_qty: String(r.pack_qty),
      pack_unit: r.pack_unit,
      price: String(r.price),
      notes: r.notes || "",
    });
    setAdding(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete this ingredient rate?")) return;
    await supabase.from("ingredient_rates").delete().eq("id", id);
    await onChange();
  }

  return (
    <div
      style={{
        background: G.glass,
        border: `1px solid ${G.glassBorder}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              color: G.muted,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              fontWeight: 700,
            }}
          >
            Ingredient Rates
          </p>
          <p style={{ fontSize: "0.7rem", color: G.muted, marginTop: 4 }}>
            One rate per ingredient. Purchases containing this name (e.g. "Mango
            Alphonso", "Mango Mallika") all match "mango" — no double counting.
          </p>
        </div>
        <button
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
            resetForm();
          }}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid rgba(96,165,250,0.4)`,
            background: G.blueGlass,
            color: G.blue,
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap" as const,
          }}
        >
          {adding ? "✕ Cancel" : "+ Add rate"}
        </button>
      </div>

      {adding && (
        <div
          style={{
            background: G.glassStrong,
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <GlassInput
            placeholder="Ingredient name (e.g. mango, rice flour)"
            value={form.item_key}
            onChange={(v) => setForm((f) => ({ ...f, item_key: v }))}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <GlassInput
              type="number"
              placeholder="Pack qty (e.g. 1)"
              value={form.pack_qty}
              onChange={(v) => setForm((f) => ({ ...f, pack_qty: v }))}
            />
            <select
              value={form.pack_unit}
              onChange={(e) =>
                setForm((f) => ({ ...f, pack_unit: e.target.value as Unit }))
              }
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
                color: G.text,
                padding: "11px 14px",
                borderRadius: 10,
                fontSize: "0.88rem",
                marginBottom: 8,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {UNITS.map((u) => (
                <option key={u} value={u} style={{ background: "#1a2535" }}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <GlassInput
            type="number"
            placeholder="Price for that pack (₹)"
            value={form.price}
            onChange={(v) => setForm((f) => ({ ...f, price: v }))}
          />
          <GlassInput
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
          />
          {form.pack_qty && form.price && (
            <p style={{ fontSize: "0.72rem", color: G.gold, marginBottom: 8 }}>
              → ₹
              {pricePerBaseUnit({
                pack_qty: Number(form.pack_qty) || 0,
                pack_unit: form.pack_unit,
                price: Number(form.price) || 0,
              }).pricePerBase.toFixed(4)}{" "}
              per{" "}
              {form.pack_unit === "kg"
                ? "g"
                : form.pack_unit === "l"
                  ? "ml"
                  : form.pack_unit}
            </p>
          )}
          <button
            disabled={saving}
            onClick={save}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "none",
              background: G.blueGlass,
              color: G.blue,
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add rate"}
          </button>
        </div>
      )}

      {rates.length === 0 ? (
        <p
          style={{
            fontSize: "0.8rem",
            color: G.muted,
            textAlign: "center" as const,
            padding: "12px 0",
          }}
        >
          No ingredient rates yet.
        </p>
      ) : (
        rates.map((r) => {
          const { pricePerBase, base } = pricePerBaseUnit(r);
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: `1px solid ${G.glassBorder}`,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: G.text,
                    textTransform: "capitalize" as const,
                  }}
                >
                  {r.item_key}
                </p>
                <p style={{ fontSize: "0.7rem", color: G.muted }}>
                  ₹{r.price} / {r.pack_qty}
                  {r.pack_unit} · ₹{pricePerBase.toFixed(4)}/{base}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <GlassBtn variant="primary" onClick={() => startEdit(r)}>
                  Edit
                </GlassBtn>
                <GlassBtn variant="danger" onClick={() => remove(r.id)}>
                  ✕
                </GlassBtn>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
