"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { G } from "../_lib/theme";
import {
  computeProductCost,
  matchesIngredient,
  type IngredientRate,
  type ProductRecipeRow,
} from "../_lib/costing";
import { IngredientRatesPanel } from "./IngredientRatesPanel";
import { ProductRecipePanel } from "./ProductRecipePanel";

type Expense = {
  id: string;
  item_key: string | null;
  description: string;
  amount: number;
  date: string;
  category: string;
};

type OrderLite = {
  status: string;
  delivery_date?: string;
  order_date?: string;
  created_at?: string;
  flavours?: Record<string, number>;
};

const PAID = ["confirmed", "cooking", "cooked", "porter_booked", "dispatched"];
const MOCHI_COST_CATEGORIES = ["ingredient", "packaging"];

function mochisInRange(orders: OrderLite[], start: string, end: string | null) {
  return orders
    .filter((o) => PAID.includes(o.status))
    .filter((o) => {
      const d =
        o.delivery_date || o.order_date || o.created_at?.split("T")[0] || "";
      if (!d) return false;
      if (d < start) return false;
      if (end && d >= end) return false;
      return true;
    })
    .reduce((sum, o) => {
      if (!o.flavours) return sum;
      return sum + Object.values(o.flavours).reduce((a, b) => a + b, 0);
    }, 0);
}

export function CostPerMochiPanel({
  expenses = [],
  orders = [],
  products = [],
  recipe = [],
  rates = [],
  reload,
}: {
  expenses?: Expense[];
  orders?: OrderLite[];
  products?: Product[];
  recipe?: ProductRecipeRow[];
  rates?: IngredientRate[];
  reload: () => Promise<void>;
}) {
  const [showConfig, setShowConfig] = useState(false);

  // Personal spend — unchanged, separate bucket
  const personalExpenses = useMemo(
    () => expenses.filter((e) => e.category.startsWith("personal_")),
    [expenses],
  );
  const personalTotal = personalExpenses.reduce((s, e) => s + e.amount, 0);
  const personalByCat = useMemo(() => {
    const m: Record<string, number> = {};
    personalExpenses.forEach((e) => {
      const sub = e.category.replace("personal_", "");
      m[sub] = (m[sub] || 0) + e.amount;
    });
    return m;
  }, [personalExpenses]);

  // ── Per-flavour cost, from recipes + manual rates ──────────────
  const productCosts = useMemo(
    () =>
      products.map((p) => ({
        product: p,
        result: computeProductCost(p.id, recipe, rates),
      })),
    [products, recipe, rates],
  );
  const productsWithRecipe = productCosts.filter(
    (pc) => pc.result.lines.length > 0,
  );

  // Revenue/mochi-mix weighted average across paid orders, using per-flavour
  // cost where available, and the legacy blended estimate as fallback below.
  const paidOrders = orders.filter((o) => PAID.includes(o.status));
  const mochiCountByProduct: Record<string, number> = {};
  let totalMochisMade = 0;
  paidOrders.forEach((o) => {
    if (!o.flavours) return;
    Object.entries(o.flavours).forEach(([pid, qty]) => {
      mochiCountByProduct[pid] = (mochiCountByProduct[pid] || 0) + qty;
      totalMochisMade += qty;
    });
  });

  // ── Legacy auto-detected cycle costing (fallback, for ingredients   ──
  // ── that don't yet have a manual rate) ────────────────────────────
  const [canonMap, setCanonMap] = useState<Record<string, string>>({});
  const [normalizing, setNormalizing] = useState(false);

  const mochiExpenses = useMemo(
    () => expenses.filter((e) => MOCHI_COST_CATEGORIES.includes(e.category)),
    [expenses],
  );

  // Skip expense lines that already match a manual ingredient rate —
  // those are costed precisely via recipes instead, so counting them
  // again here would double-count.
  const uncoveredExpenses = useMemo(
    () =>
      mochiExpenses.filter(
        (e) =>
          !rates.some((r) =>
            matchesIngredient(e.item_key || e.description, r.item_key),
          ),
      ),
    [mochiExpenses, rates],
  );

  useEffect(() => {
    const descriptions = uncoveredExpenses.map(
      (e) => e.item_key || e.description,
    );
    const unique = Array.from(
      new Set(descriptions.map((d) => d.trim()).filter(Boolean)),
    );
    if (unique.length === 0) return;
    const missing = unique.filter((u) => !canonMap[u]);
    if (missing.length === 0) return;

    setNormalizing(true);
    fetch("/api/normalize-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: unique }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.groups) setCanonMap((prev) => ({ ...prev, ...data.groups }));
      })
      .catch((e) => console.warn("item normalization failed", e))
      .finally(() => setNormalizing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uncoveredExpenses]);

  const { closed, pending, legacyTotalPerMochi } = useMemo(() => {
    const byItem: Record<string, Expense[]> = {};
    uncoveredExpenses.forEach((e) => {
      const rawKey = (e.item_key || e.description).trim();
      const canon = canonMap[rawKey] || rawKey;
      (byItem[canon] ||= []).push(e);
    });

    const closedResults: {
      key: string;
      cycles: {
        start: string;
        end: string;
        amount: number;
        mochis: number;
        perMochi: number | null;
      }[];
      latestPerMochi: number | null;
    }[] = [];
    const pendingResults: { key: string; sinceDate: string; amount: number }[] =
      [];

    Object.entries(byItem).forEach(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const cycles: {
        start: string;
        end: string;
        amount: number;
        mochis: number;
        perMochi: number | null;
      }[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const start = sorted[i].date;
        const end = sorted[i + 1].date;
        const mochis = mochisInRange(orders, start, end);
        cycles.push({
          start,
          end,
          amount: sorted[i].amount,
          mochis,
          perMochi: mochis > 0 ? sorted[i].amount / mochis : null,
        });
      }
      const last = sorted[sorted.length - 1];
      pendingResults.push({ key, sinceDate: last.date, amount: last.amount });
      if (cycles.length > 0) {
        const latest = cycles[cycles.length - 1];
        closedResults.push({ key, cycles, latestPerMochi: latest.perMochi });
      }
    });

    const total = closedResults.reduce(
      (s, r) => s + (r.latestPerMochi || 0),
      0,
    );
    return {
      closed: closedResults,
      pending: pendingResults,
      legacyTotalPerMochi: total,
    };
  }, [uncoveredExpenses, orders, canonMap]);

  // ── Blended overall figure for the top-line stat ──────────────────
  // For each flavour actually sold: use its precise recipe cost if complete,
  // otherwise fall back to the legacy blended estimate above.
  const blendedCostPerMochi = useMemo(() => {
    if (totalMochisMade === 0) return 0;
    let weightedSum = 0;
    Object.entries(mochiCountByProduct).forEach(([pid, qty]) => {
      const pc = productCosts.find((p) => p.product.id === pid);
      const perPiece = pc?.result.complete
        ? pc.result.totalCost
        : legacyTotalPerMochi;
      weightedSum += perPiece * qty;
    });
    return weightedSum / totalMochisMade;
  }, [mochiCountByProduct, totalMochisMade, productCosts, legacyTotalPerMochi]);

  return (
    <>
      {/* Personal spending */}
      {personalExpenses.length > 0 && (
        <div
          style={{
            background: "rgba(167,139,250,0.06)",
            border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <p
            style={{
              fontSize: "0.65rem",
              color: G.purple,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              marginBottom: 4,
              fontWeight: 700,
            }}
          >
            Personal Spending (excluded from mochi cost)
          </p>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: G.purple,
              marginBottom: 10,
            }}
          >
            ₹{personalTotal.toLocaleString("en-IN")}
            <span
              style={{ fontSize: "0.68rem", color: G.muted, fontWeight: 400 }}
            >
              {" "}
              net · {personalExpenses.length} entries
            </span>
          </p>
          {Object.entries(personalByCat).map(([sub, amt]) => (
            <div
              key={sub}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                fontSize: "0.78rem",
              }}
            >
              <span
                style={{ color: G.sub, textTransform: "capitalize" as const }}
              >
                {sub}
              </span>
              <span style={{ color: G.text, fontWeight: 600 }}>
                ₹{amt.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top-line blended cost */}
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
            alignItems: "flex-start",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.65rem",
                color: G.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 4,
                fontWeight: 700,
              }}
            >
              Blended Cost / Mochi
            </p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: G.gold }}>
              ₹{blendedCostPerMochi.toFixed(2)}
              <span
                style={{ fontSize: "0.7rem", color: G.muted, fontWeight: 400 }}
              >
                {" "}
                weighted by actual sales mix
              </span>
            </p>
          </div>
          <button
            onClick={() => setShowConfig((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${G.goldBorder}`,
              background: G.goldGlass,
              color: G.gold,
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              whiteSpace: "nowrap" as const,
            }}
          >
            {showConfig ? "Hide setup" : "⚙ Set up recipes"}
          </button>
        </div>

        {/* Per-flavour breakdown */}
        {productsWithRecipe.length > 0 && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: `1px solid ${G.glassBorder}`,
            }}
          >
            <p
              style={{
                fontSize: "0.62rem",
                color: G.muted,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              By Flavour
            </p>
            {productsWithRecipe.map(({ product, result }) => (
              <div
                key={product.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: G.text }}>
                  {product.name}
                </span>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: result.complete ? G.green : G.gold,
                  }}
                >
                  {result.complete
                    ? `₹${result.totalCost.toFixed(2)}`
                    : `₹${result.totalCost.toFixed(2)} (incomplete)`}
                </span>
              </div>
            ))}
          </div>
        )}
        {productsWithRecipe.length === 0 && (
          <p style={{ fontSize: "0.72rem", color: G.muted, marginTop: 10 }}>
            No flavours have a recipe yet — showing the auto-estimated blended
            figure below. Click "Set up recipes" for exact, per-flavour costs.
          </p>
        )}
      </div>

      {/* Recipe / rate configuration — collapsed by default */}
      {showConfig && (
        <>
          <IngredientRatesPanel rates={rates} onChange={reload} />
          {products.length > 0 && (
            <ProductRecipePanel
              products={products}
              recipe={recipe}
              rates={rates}
              onChange={reload}
            />
          )}
        </>
      )}

      {/* Legacy auto-detected estimate — for ingredients without a manual rate */}
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
            marginBottom: 4,
            fontWeight: 700,
          }}
        >
          Auto-Estimated (fallback) — By Purchase Cycle
          {normalizing && (
            <span style={{ color: G.gold, marginLeft: 8 }}>
              · grouping items…
            </span>
          )}
        </p>
        <p style={{ fontSize: "0.7rem", color: G.muted, marginBottom: 12 }}>
          Only used for ingredients that don't have a manual rate yet.
          Unreliable until a cycle closes (two purchases of the same item).
        </p>
        <p
          style={{
            fontSize: "1.2rem",
            fontWeight: 800,
            color: G.sub,
            marginBottom: 14,
          }}
        >
          ₹{legacyTotalPerMochi.toFixed(2)}
          <span
            style={{ fontSize: "0.68rem", color: G.muted, fontWeight: 400 }}
          >
            {" "}
            / mochi (from {closed.length} completed-cycle item
            {closed.length !== 1 ? "s" : ""})
          </span>
        </p>

        {closed.length > 0 && (
          <>
            <p
              style={{
                fontSize: "0.62rem",
                color: G.green,
                fontWeight: 700,
                marginBottom: 8,
                textTransform: "uppercase" as const,
              }}
            >
              ✓ Calculated
            </p>
            {closed.map((r) => (
              <div
                key={r.key}
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
                      color: G.text,
                      fontWeight: 600,
                    }}
                  >
                    {r.key}
                  </p>
                  <p style={{ fontSize: "0.68rem", color: G.muted }}>
                    latest cycle {r.cycles[r.cycles.length - 1].start} →{" "}
                    {r.cycles[r.cycles.length - 1].end} ·{" "}
                    {r.cycles[r.cycles.length - 1].mochis} mochis
                  </p>
                </div>
                <p
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: G.green,
                  }}
                >
                  {r.latestPerMochi != null
                    ? `₹${r.latestPerMochi.toFixed(2)}`
                    : "—"}
                </p>
              </div>
            ))}
          </>
        )}

        {pending.length > 0 && (
          <>
            <p
              style={{
                fontSize: "0.62rem",
                color: G.gold,
                fontWeight: 700,
                marginTop: 16,
                marginBottom: 8,
                textTransform: "uppercase" as const,
              }}
            >
              ⏳ Pending — cycle not yet complete, or add a manual rate instead
            </p>
            {pending.map((p) => (
              <div
                key={p.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                }}
              >
                <p style={{ fontSize: "0.8rem", color: G.sub }}>{p.key}</p>
                <p style={{ fontSize: "0.72rem", color: G.muted }}>
                  bought {p.sinceDate} · ₹{p.amount}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
