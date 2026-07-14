"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import { G } from "../_lib/theme";
import { GlassInput, GlassBtn } from "./Shared";
import {
  computeProductCost,
  type IngredientRate,
  type ProductRecipeRow,
  type Unit,
} from "../_lib/costing";

const UNITS: Unit[] = ["g", "ml", "piece"];

export function ProductRecipePanel({
  products = [],
  recipe = [],
  rates = [],
  onChange,
}: {
  products?: Product[];
  recipe?: ProductRecipeRow[];
  rates?: IngredientRate[];
  onChange: () => Promise<void>;
}) {
  const [activeProductId, setActiveProductId] = useState<string>(
    products[0]?.id || "",
  );
  const [form, setForm] = useState({
    item_key: "",
    qty_per_piece: "",
    unit: "g" as Unit,
  });
  const [saving, setSaving] = useState(false);

  const rows = recipe.filter((r) => r.product_id === activeProductId);
  const cost = activeProductId
    ? computeProductCost(activeProductId, recipe, rates)
    : null;
  const knownIngredients = Array.from(new Set(rates.map((r) => r.item_key)));

  async function addRow() {
    if (!activeProductId || !form.item_key.trim() || !form.qty_per_piece)
      return;
    setSaving(true);
    await supabase.from("product_recipes").insert({
      product_id: activeProductId,
      item_key: form.item_key.trim().toLowerCase(),
      qty_per_piece: Number(form.qty_per_piece),
      unit: form.unit,
    });
    setSaving(false);
    setForm({ item_key: "", qty_per_piece: "", unit: "g" });
    await onChange();
  }

  async function removeRow(id: string) {
    await supabase.from("product_recipes").delete().eq("id", id);
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
      <p
        style={{
          fontSize: "0.65rem",
          color: G.muted,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        Flavour Recipes (per piece)
      </p>
      <p style={{ fontSize: "0.7rem", color: G.muted, marginBottom: 12 }}>
        e.g. Mango Mochi: 12g mango + 8g rice flour. Each flavour gets its own
        cost, built from ingredient rates above.
      </p>

      <select
        value={activeProductId}
        onChange={(e) => setActiveProductId(e.target.value)}
        style={{
          width: "100%",
          background: G.glassStrong,
          border: `1px solid ${G.glassBorder}`,
          color: G.text,
          padding: "11px 14px",
          borderRadius: 10,
          fontSize: "0.88rem",
          marginBottom: 12,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id} style={{ background: "#1a2535" }}>
            {p.name}
          </option>
        ))}
      </select>

      {rows.map((row) => {
        const rate = rates.find(
          (r) => r.item_key.toLowerCase() === row.item_key.toLowerCase(),
        );
        return (
          <div
            key={row.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "7px 0",
              borderBottom: `1px solid ${G.glassBorder}`,
            }}
          >
            <p style={{ fontSize: "0.82rem", color: G.text }}>
              <span
                style={{
                  textTransform: "capitalize" as const,
                  fontWeight: 600,
                }}
              >
                {row.item_key}
              </span>
              <span style={{ color: G.muted }}>
                {" "}
                · {row.qty_per_piece}
                {row.unit}
              </span>
              {!rate && (
                <span style={{ color: G.gold, fontSize: "0.7rem" }}>
                  {" "}
                  · no rate set
                </span>
              )}
            </p>
            <button
              onClick={() => removeRow(row.id)}
              style={{
                background: "transparent",
                border: "none",
                color: G.red,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              ✕
            </button>
          </div>
        );
      })}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 0.8fr",
          gap: 6,
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        <input
          list="known-ingredients"
          placeholder="Ingredient (e.g. mango)"
          value={form.item_key}
          onChange={(e) => setForm((f) => ({ ...f, item_key: e.target.value }))}
          style={{
            background: G.glass,
            border: `1px solid ${G.glassBorder}`,
            color: G.text,
            padding: "10px 12px",
            borderRadius: 9,
            fontSize: "0.82rem",
            fontFamily: "system-ui, sans-serif",
            outline: "none",
          }}
        />
        <datalist id="known-ingredients">
          {knownIngredients.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <input
          type="number"
          placeholder="Qty/piece"
          value={form.qty_per_piece}
          onChange={(e) =>
            setForm((f) => ({ ...f, qty_per_piece: e.target.value }))
          }
          style={{
            background: G.glass,
            border: `1px solid ${G.glassBorder}`,
            color: G.text,
            padding: "10px 12px",
            borderRadius: 9,
            fontSize: "0.82rem",
            fontFamily: "system-ui, sans-serif",
            outline: "none",
          }}
        />
        <select
          value={form.unit}
          onChange={(e) =>
            setForm((f) => ({ ...f, unit: e.target.value as Unit }))
          }
          style={{
            background: G.glass,
            border: `1px solid ${G.glassBorder}`,
            color: G.text,
            padding: "10px 8px",
            borderRadius: 9,
            fontSize: "0.82rem",
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
      <button
        disabled={saving || !activeProductId}
        onClick={addRow}
        style={{
          width: "100%",
          padding: "9px",
          borderRadius: 8,
          border: `1px solid rgba(96,165,250,0.4)`,
          background: G.blueGlass,
          color: G.blue,
          fontSize: "0.8rem",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
          marginBottom: 12,
        }}
      >
        {saving ? "Adding..." : "+ Add ingredient to recipe"}
      </button>

      {cost && rows.length > 0 && (
        <div
          style={{
            background: cost.complete ? G.greenGlass : G.goldGlass,
            border: `1px solid ${cost.complete ? "rgba(52,217,123,0.3)" : G.goldBorder}`,
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: cost.complete ? G.green : G.gold,
            }}
          >
            {cost.complete ? "✓" : "⚠"} Cost per piece: ₹
            {cost.totalCost.toFixed(2)}
          </p>
          {!cost.complete && (
            <p style={{ fontSize: "0.68rem", color: G.gold, marginTop: 4 }}>
              Incomplete — add rates for ingredients marked "no rate set" above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
