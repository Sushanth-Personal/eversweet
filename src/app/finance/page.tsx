"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ────────────────────────────────────────────────────────────────
   CONFIG — tune these two lines if the deal changes
──────────────────────────────────────────────────────────────── */
const COMPANY_SHARE_PER_MOCHI = 80; // ₹ kept as company float, per mochi sold
const FEED_START_DATE = "2026-07-17"; // hide anything dated before this in the activity feed
const PAID_STATUSES = [
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
];

const UNNI_NUMBER = "7907044368";
const AMMA_NUMBER = "9072437343";

/* ────────────────────────────────────────────────────────────────
   VIBRANT THEME — deliberately distinct from the dark admin panel
──────────────────────────────────────────────────────────────── */
const V = {
  bg: "linear-gradient(160deg, #eef2ff 0%, #fdf4ff 45%, #fff7ed 100%)",
  card: "rgba(255,255,255,0.75)",
  cardBorder: "rgba(255,255,255,0.9)",
  text: "#1e1b3a",
  sub: "#5b5578",
  muted: "#8b85a3",
  shadow: "0 8px 30px rgba(99,60,180,0.08)",

  unni: "#4f46e5",
  unniBg: "linear-gradient(135deg, #6366f1, #4338ca)",
  unniGlass: "rgba(79,70,229,0.08)",
  unniBorder: "rgba(79,70,229,0.25)",

  amma: "#db2777",
  ammaBg: "linear-gradient(135deg, #f472b6, #db2777)",
  ammaGlass: "rgba(219,39,119,0.08)",
  ammaBorder: "rgba(219,39,119,0.25)",

  other: "#d97706",
  otherBg: "linear-gradient(135deg, #fbbf24, #d97706)",
  otherGlass: "rgba(217,119,6,0.08)",
  otherBorder: "rgba(217,119,6,0.25)",

  kochi: "#059669",
  kochiBg: "linear-gradient(135deg, #34d399, #059669)",
  kochiGlass: "rgba(5,150,105,0.08)",
  kochiBorder: "rgba(5,150,105,0.25)",

  green: "#16a34a",
  red: "#e11d48",
  gold: "#d97706",
};

type Order = {
  id: string;
  customer_name: string;
  total_price: number;
  status: string;
  flavours: Record<string, number> | null;
  delivery_date?: string;
  order_date?: string;
  created_at?: string;
};

type IncomeSplit = {
  id: string;
  order_id: string | null;
  label: string | null;
  mochi_count: number;
  order_total: number;
  recipient: "unni" | "amma";
  company_share: number;
  personal_share_each: number;
  entry_date: string;
  created_at: string;
};

type Settlement = {
  id: string;
  direction: "unni_to_amma" | "amma_to_unni";
  amount: number;
  note: string | null;
  created_at: string;
};

type ExpenseRow = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  paid_by:
    | "unni_personal"
    | "amma_personal"
    | "company_other"
    | "company_kochi"
    | null;
  split: boolean;
};

const EXPENSE_CATEGORIES = [
  { id: "ingredient", label: "🧪 Ingredients" },
  { id: "packaging", label: "📦 Packaging" },
  { id: "equipment", label: "🔧 Equipment" },
  { id: "delivery", label: "🚚 Delivery" },
  { id: "fixed", label: "🏠 Fixed Cost" },
  { id: "marketing", label: "📣 Marketing" },
  { id: "other", label: "📋 Other" },
];

type CategoryDef = { id: string; label: string; icon: string; color: string };

const ALL_CATEGORY_DEFS: CategoryDef[] = [
  { id: "personal_food", label: "Food", icon: "🍔", color: "#ea580c" },
  { id: "personal_travel", label: "Travel", icon: "🚗", color: "#0891b2" },
  { id: "personal_loan", label: "Loan", icon: "💳", color: "#7c3aed" },
  { id: "personal_purchase", label: "Purchase", icon: "🛍️", color: "#db2777" },
  { id: "personal_other", label: "Other", icon: "📋", color: "#64748b" },
  { id: "marketing", label: "Ads", icon: "📣", color: "#e11d48" },
  { id: "ingredient", label: "Ingredients", icon: "🧪", color: "#16a34a" },
  { id: "packaging", label: "Packing", icon: "📦", color: "#2563eb" },
  { id: "delivery", label: "Traveling", icon: "🚚", color: "#d97706" },
  { id: "equipment", label: "Equipment", icon: "🔧", color: "#0891b2" },
  { id: "fixed", label: "Fixed Cost", icon: "🏠", color: "#64748b" },
  { id: "other", label: "Other", icon: "📋", color: "#64748b" },
];

function categoryDef(id: string): CategoryDef {
  return (
    ALL_CATEGORY_DEFS.find((c) => c.id === id) || {
      id,
      label: id,
      icon: "📋",
      color: "#64748b",
    }
  );
}

function isPersonalCategory(id: string) {
  return id.startsWith("personal_");
}

const PAYER_OPTIONS = [
  { id: "unni_personal", label: "Unni · Personal", color: V.unni },
  { id: "amma_personal", label: "Amma · Personal", color: V.amma },
  { id: "company_other", label: "Company (Other)", color: V.other },
  { id: "company_kochi", label: "Company (Kochi)", color: V.kochi },
] as const;

function mochiCount(o: Order): number {
  if (!o.flavours) return 0;
  return Object.values(o.flavours).reduce((a, b) => a + (b || 0), 0);
}

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/* ────────────────────────────────────────────────────────────────
   Small shared UI bits
──────────────────────────────────────────────────────────────── */
function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: V.card,
        border: `1px solid ${V.cardBorder}`,
        borderRadius: 20,
        boxShadow: V.shadow,
        backdropFilter: "blur(10px)",
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function BalanceCard({
  label,
  amount,
  gradient,
  glass,
  border,
  sub,
}: {
  label: string;
  amount: number;
  gradient: string;
  glass: string;
  border: string;
  sub: string;
}) {
  return (
    <Card
      style={{ background: glass, border: `1px solid ${border}`, padding: 18 }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: gradient,
          marginBottom: 12,
          boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
        }}
      />
      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          color: V.muted,
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "1.7rem",
          fontWeight: 800,
          color: V.text,
          lineHeight: 1,
        }}
      >
        {fmt(amount)}
      </p>
      <p style={{ fontSize: "0.72rem", color: V.sub, marginTop: 6 }}>{sub}</p>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: V.sub,
          marginBottom: 5,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.9)",
  border: "1.5px solid rgba(99,60,180,0.15)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: "0.9rem",
  color: V.text,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box" as const,
};

/* ────────────────────────────────────────────────────────────────
   Unified activity feed row types
──────────────────────────────────────────────────────────────── */
type ActivityRow =
  | {
      kind: "income";
      date: string;
      sortKey: string;
      label: string;
      amount: number;
      recipient: "unni" | "amma";
    }
  | { kind: "unclassified"; date: string; sortKey: string; order: Order }
  | { kind: "expense"; date: string; sortKey: string; expense: ExpenseRow };

/* ────────────────────────────────────────────────────────────────
   Main page
──────────────────────────────────────────────────────────────── */
export default function FinancePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [splits, setSplits] = useState<IncomeSplit[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [classifyingOrder, setClassifyingOrder] = useState<Order | null>(null);
  const [showManualIncome, setShowManualIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "orders" | "expenses">(
    "all",
  );
  const [showSettle, setShowSettle] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: o }, { data: s }, { data: st }, { data: ex }] =
      await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, customer_name, total_price, status, flavours, delivery_date, order_date, created_at",
          )
          .in("status", PAID_STATUSES)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("income_splits")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("settlements")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("id, description, amount, category, date, paid_by, split")
          .order("date", { ascending: false }),
      ]);
    if (o) setOrders(o as Order[]);
    if (s) setSplits(s as IncomeSplit[]);
    if (st) setSettlements(st as Settlement[]);
    if (ex) setExpenses(ex as ExpenseRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  /* ---------- Derived numbers ---------- */
  const classifiedOrderIds = useMemo(
    () => new Set(splits.map((s) => s.order_id).filter(Boolean)),
    [splits],
  );
  const unclassifiedOrders = useMemo(
    () => orders.filter((o) => !classifiedOrderIds.has(o.id)),
    [orders, classifiedOrderIds],
  );

  const totals = useMemo(() => {
    let companyOther = 0;
    let companyKochi = 0;
    let unniOwesAmmaRaw = 0;
    let ammaOwesUnniRaw = 0;
    let lifetimePersonalEach = 0;

    splits.forEach((s) => {
      lifetimePersonalEach += s.personal_share_each;
      if (s.recipient === "unni") {
        companyOther += s.company_share;
        unniOwesAmmaRaw += s.personal_share_each;
      } else {
        companyKochi += s.company_share;
        ammaOwesUnniRaw += s.personal_share_each;
      }
    });

    let unniPersonalExp = 0;
    let ammaPersonalExp = 0;
    let companyOtherExp = 0;
    let companyKochiExp = 0;
    expenses.forEach((e) => {
      if (e.paid_by === "unni_personal") unniPersonalExp += e.amount;
      else if (e.paid_by === "amma_personal") ammaPersonalExp += e.amount;
      else if (e.paid_by === "company_other") companyOtherExp += e.amount;
      else if (e.paid_by === "company_kochi") companyKochiExp += e.amount;

      // Split personal expenses fold into the same settlement ledger as
      // income splits: whoever paid personally is owed the other half back.
      if (e.split && e.paid_by === "unni_personal")
        ammaOwesUnniRaw += e.amount / 2;
      if (e.split && e.paid_by === "amma_personal")
        unniOwesAmmaRaw += e.amount / 2;
    });

    let settledUnniToAmma = 0;
    let settledAmmaToUnni = 0;
    settlements.forEach((s) => {
      if (s.direction === "unni_to_amma") settledUnniToAmma += s.amount;
      else settledAmmaToUnni += s.amount;
    });

    const netOutstanding =
      unniOwesAmmaRaw -
      settledUnniToAmma -
      (ammaOwesUnniRaw - settledAmmaToUnni);

    return {
      companyOtherBalance: companyOther - companyOtherExp,
      companyKochiBalance: companyKochi - companyKochiExp,
      unniPersonalBalance: lifetimePersonalEach - unniPersonalExp,
      ammaPersonalBalance: lifetimePersonalEach - ammaPersonalExp,
      netOutstanding,
    };
  }, [splits, settlements, expenses]);

  /* ---------- Unified activity feed ---------- */
  const activity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [];
    splits.forEach((s) => {
      rows.push({
        kind: "income",
        date: s.entry_date,
        sortKey: s.created_at,
        label: s.label || "Income",
        amount: s.order_total,
        recipient: s.recipient,
      });
    });
    unclassifiedOrders.forEach((o) => {
      const d =
        o.delivery_date || o.order_date || o.created_at?.split("T")[0] || "";
      rows.push({
        kind: "unclassified",
        date: d,
        sortKey: o.created_at || d,
        order: o,
      });
    });
    expenses.forEach((e) => {
      rows.push({ kind: "expense", date: e.date, sortKey: e.date, expense: e });
    });
    return rows
      .filter((r) => r.date >= FEED_START_DATE)
      .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
  }, [splits, unclassifiedOrders, expenses]);

  /* ---------- Actions ---------- */
  async function saveClassification(order: Order, recipient: "unni" | "amma") {
    const mc = mochiCount(order);
    const companyShare = Math.min(
      order.total_price,
      COMPANY_SHARE_PER_MOCHI * mc,
    );
    const remaining = order.total_price - companyShare;
    await supabase.from("income_splits").insert({
      order_id: order.id,
      label: order.customer_name,
      mochi_count: mc,
      order_total: order.total_price,
      recipient,
      company_share: companyShare,
      personal_share_each: remaining / 2,
      entry_date:
        order.delivery_date ||
        order.order_date ||
        order.created_at?.split("T")[0] ||
        new Date().toISOString().split("T")[0],
    });
    setClassifyingOrder(null);
    await load();
    flash("Income classified ✓");
  }

  async function saveManualIncome(
    amount: number,
    mc: number,
    recipient: "unni" | "amma",
    label: string,
  ) {
    const companyShare = Math.min(amount, COMPANY_SHARE_PER_MOCHI * mc);
    const remaining = amount - companyShare;
    await supabase.from("income_splits").insert({
      order_id: null,
      label: label || "Manual entry",
      mochi_count: mc,
      order_total: amount,
      recipient,
      company_share: companyShare,
      personal_share_each: remaining / 2,
      entry_date: new Date().toISOString().split("T")[0],
    });
    setShowManualIncome(false);
    await load();
    flash("Income logged ✓");
  }

  async function saveExpense(
    description: string,
    amount: number,
    category: string,
    date: string,
    paidBy: string,
    split: boolean,
  ) {
    await supabase
      .from("expenses")
      .insert({ description, amount, category, date, paid_by: paidBy, split });
    setShowAddExpense(false);
    await load();
    flash("Expense logged ✓");
  }

  async function toggleSplit(expenseId: string, currentSplit: boolean) {
    await supabase
      .from("expenses")
      .update({ split: !currentSplit })
      .eq("id", expenseId);
    await load();
    flash(
      !currentSplit
        ? "Marked as split — other person owes half ✓"
        : "Split removed",
    );
  }

  async function confirmSettlement(amount: number) {
    const direction =
      totals.netOutstanding >= 0 ? "unni_to_amma" : "amma_to_unni";
    await supabase
      .from("settlements")
      .insert({ direction, amount, note: "Settled via dashboard" });
    setShowSettle(false);
    await load();
    flash("Settlement recorded ✓");
  }

  const outstanding = totals.netOutstanding;
  const owerIsUnni = outstanding > 0.5;
  const owerIsAmma = outstanding < -0.5;
  const settled = Math.abs(outstanding) <= 0.5;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: V.bg,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: V.text,
        paddingBottom: 60,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');`,
        }}
      />

      {/* Top bar */}
      <div
        style={{ padding: "22px 20px 8px", maxWidth: 760, margin: "0 auto" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>
              💰 Family Finance
            </h1>
            <p style={{ fontSize: "0.75rem", color: V.sub }}>
              Unni &amp; Amma · Eversweet
            </p>
          </div>
          <button
            onClick={load}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(99,60,180,0.2)",
              background: "rgba(255,255,255,0.7)",
              color: V.sub,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div
          style={{ maxWidth: 760, margin: "10px auto 0", padding: "0 20px" }}
        >
          <div
            style={{
              background: "rgba(22,163,74,0.1)",
              border: "1px solid rgba(22,163,74,0.3)",
              color: V.green,
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {msg}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 20px" }}>
        {/* Hero settlement banner */}
        <Card
          style={{
            background: settled
              ? "linear-gradient(135deg, #34d399, #059669)"
              : owerIsUnni
                ? "linear-gradient(135deg, #6366f1, #4338ca)"
                : "linear-gradient(135deg, #f472b6, #db2777)",
            color: "#fff",
            marginBottom: 16,
            border: "none",
          }}
        >
          {settled ? (
            <>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  opacity: 0.85,
                  marginBottom: 6,
                }}
              >
                All settled
              </p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800 }}>
                ✓ Nothing owed either way
              </p>
            </>
          ) : (
            <>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  opacity: 0.85,
                  marginBottom: 6,
                }}
              >
                {owerIsUnni
                  ? "Unni needs to transfer"
                  : "Amma needs to transfer"}
              </p>
              <p
                style={{
                  fontSize: "2.2rem",
                  fontWeight: 800,
                  marginBottom: 10,
                }}
              >
                {fmt(Math.abs(outstanding))}
              </p>
              <p
                style={{ fontSize: "0.82rem", opacity: 0.9, marginBottom: 16 }}
              >
                to{" "}
                {owerIsUnni
                  ? "Amma (9072437343 · Kavitha Anil)"
                  : "Unni (7907044368)"}
              </p>
              <button
                onClick={() => setShowSettle(true)}
                style={{
                  padding: "11px 20px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(255,255,255,0.6)",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓ Confirm Transfer Sent
              </button>
            </>
          )}
        </Card>

        {/* Balance grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <BalanceCard
            label="Unni · Personal"
            amount={totals.unniPersonalBalance}
            gradient={V.unniBg}
            glass={V.unniGlass}
            border={V.unniBorder}
            sub="Lifetime personal income"
          />
          <BalanceCard
            label="Amma · Personal"
            amount={totals.ammaPersonalBalance}
            gradient={V.ammaBg}
            glass={V.ammaGlass}
            border={V.ammaBorder}
            sub="Lifetime personal income"
          />
          <BalanceCard
            label="Company (Other)"
            amount={totals.companyOtherBalance}
            gradient={V.otherBg}
            glass={V.otherGlass}
            border={V.otherBorder}
            sub="Unni's company account"
          />
          <BalanceCard
            label="Company (Kochi)"
            amount={totals.companyKochiBalance}
            gradient={V.kochiBg}
            glass={V.kochiGlass}
            border={V.kochiBorder}
            sub="Amma's company account"
          />
        </div>

        {/* Unified activity feed */}
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap" as const,
              gap: 8,
            }}
          >
            <p style={{ fontSize: "0.95rem", fontWeight: 800 }}>
              📒 All Transactions
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowManualIncome(true)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(99,60,180,0.25)",
                  background: "rgba(99,60,180,0.06)",
                  color: V.unni,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Income
              </button>
              <button
                onClick={() => setShowAddExpense(true)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(217,119,6,0.3)",
                  background: "rgba(217,119,6,0.08)",
                  color: V.other,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Expense
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {(
              [
                { id: "all", label: "All" },
                { id: "orders", label: "Orders" },
                { id: "expenses", label: "Expenses" },
              ] as { id: "all" | "orders" | "expenses"; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFeedFilter(f.id)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 20,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1.5px solid ${feedFilter === f.id ? V.unni : "rgba(99,60,180,0.15)"}`,
                  background:
                    feedFilter === f.id ? V.unniGlass : "rgba(255,255,255,0.5)",
                  color: feedFilter === f.id ? V.unni : V.sub,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {(() => {
            const filtered = activity.filter((row) => {
              if (feedFilter === "all") return true;
              if (feedFilter === "orders")
                return row.kind === "income" || row.kind === "unclassified";
              return row.kind === "expense";
            });
            if (loading)
              return (
                <p style={{ fontSize: "0.85rem", color: V.muted }}>Loading…</p>
              );
            if (filtered.length === 0)
              return (
                <p style={{ fontSize: "0.85rem", color: V.muted }}>
                  Nothing here yet.
                </p>
              );
            return filtered.map((row, i) => {
              if (row.kind === "income") {
                return (
                  <div
                    key={`income-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "11px 0",
                      borderBottom: "1px solid rgba(99,60,180,0.08)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 500,
                          color: V.sub,
                          marginBottom: 2,
                        }}
                      >
                        {row.label}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: V.muted }}>
                        {row.date} ·{" "}
                        {row.recipient === "unni" ? "→ Unni" : "→ Amma"}
                      </p>
                    </div>
                    <p
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 800,
                        color: V.green,
                        whiteSpace: "nowrap" as const,
                        marginLeft: 10,
                      }}
                    >
                      +{fmt(row.amount)}
                    </p>
                  </div>
                );
              }
              if (row.kind === "unclassified") {
                const o = row.order;
                return (
                  <div
                    key={`unc-${o.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "11px 0",
                      borderBottom: "1px solid rgba(99,60,180,0.08)",
                      background: "rgba(217,119,6,0.05)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 500,
                          color: V.sub,
                          marginBottom: 2,
                        }}
                      >
                        {o.customer_name}{" "}
                        <span style={{ color: V.gold, fontWeight: 700 }}>
                          · needs classifying
                        </span>
                      </p>
                      <p style={{ fontSize: "0.68rem", color: V.muted }}>
                        {row.date} · {mochiCount(o)} mochis
                      </p>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <p
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 800,
                          color: V.gold,
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {fmt(o.total_price)}
                      </p>
                      <button
                        onClick={() => setClassifyingOrder(o)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "none",
                          background:
                            "linear-gradient(135deg, #6366f1, #db2777)",
                          color: "#fff",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Classify
                      </button>
                    </div>
                  </div>
                );
              }
              const e = row.expense;
              const cat = categoryDef(e.category);
              const payer = PAYER_OPTIONS.find((p) => p.id === e.paid_by);
              const canSplit =
                e.paid_by === "unni_personal" || e.paid_by === "amma_personal";
              return (
                <div
                  key={`exp-${e.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "11px 0",
                    borderBottom: "1px solid rgba(99,60,180,0.08)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        color: V.sub,
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ marginRight: 4 }}>{cat.icon}</span>
                      {e.description}
                    </p>
                    <p style={{ fontSize: "0.68rem", color: V.muted }}>
                      {e.date} ·{" "}
                      <span style={{ color: cat.color, fontWeight: 700 }}>
                        {cat.label}
                      </span>
                      {payer ? (
                        <>
                          {" "}
                          ·{" "}
                          <span style={{ color: payer.color, fontWeight: 700 }}>
                            {payer.label}
                          </span>
                        </>
                      ) : (
                        ""
                      )}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column" as const,
                      alignItems: "flex-end",
                      gap: 6,
                      marginLeft: 10,
                    }}
                  >
                    <p
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 800,
                        color: V.text,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      −{fmt(e.amount)}
                    </p>
                    {canSplit && !e.split && (
                      <button
                        onClick={() => toggleSplit(e.id, e.split)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap" as const,
                          border: "none",
                          background:
                            "linear-gradient(135deg, #6366f1, #db2777)",
                          color: "#fff",
                        }}
                      >
                        Split
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </Card>

        {/* Settlement history */}
        {settlements.length > 0 && (
          <Card>
            <p
              style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: 12 }}
            >
              🔁 Settlement History
            </p>
            {settlements.slice(0, 10).map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(99,60,180,0.08)",
                }}
              >
                <p
                  style={{ fontSize: "0.78rem", fontWeight: 500, color: V.sub }}
                >
                  {s.direction === "unni_to_amma"
                    ? "Unni → Amma"
                    : "Amma → Unni"}{" "}
                  ·{" "}
                  {new Date(s.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <p
                  style={{ fontSize: "1rem", fontWeight: 800, color: V.green }}
                >
                  {fmt(s.amount)}
                </p>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Modal: Classify order */}
      {classifyingOrder && (
        <Modal
          onClose={() => setClassifyingOrder(null)}
          title={`Classify: ${classifyingOrder.customer_name}`}
        >
          <p style={{ fontSize: "0.85rem", color: V.sub, marginBottom: 16 }}>
            {mochiCount(classifyingOrder)} mochis ·{" "}
            {fmt(classifyingOrder.total_price)} total. Who did the customer pay?
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => saveClassification(classifyingOrder, "unni")}
              style={{
                flex: 1,
                padding: "16px 12px",
                borderRadius: 14,
                border: "none",
                background: V.unniBg,
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Unni
              <br />
              <span style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                {UNNI_NUMBER}
              </span>
            </button>
            <button
              onClick={() => saveClassification(classifyingOrder, "amma")}
              style={{
                flex: 1,
                padding: "16px 12px",
                borderRadius: 14,
                border: "none",
                background: V.ammaBg,
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Amma
              <br />
              <span style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                {AMMA_NUMBER}
              </span>
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Manual income */}
      {showManualIncome && (
        <ManualIncomeModal
          onClose={() => setShowManualIncome(false)}
          onSave={saveManualIncome}
        />
      )}

      {/* Modal: Add company expense */}
      {showAddExpense && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onSave={saveExpense}
        />
      )}

      {/* Modal: Confirm settlement */}
      {showSettle && (
        <SettleModal
          suggested={Math.abs(outstanding)}
          direction={owerIsUnni ? "Unni → Amma" : "Amma → Unni"}
          onClose={() => setShowSettle(false)}
          onConfirm={confirmSettlement}
        />
      )}
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────
   Modals
──────────────────────────────────────────────────────────────── */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,20,50,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: "1rem", fontWeight: 800 }}>{title}</p>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.1rem",
              cursor: "pointer",
              color: V.muted,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function ManualIncomeModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (
    amount: number,
    mochiCount: number,
    recipient: "unni" | "amma",
    label: string,
  ) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [mc, setMc] = useState("");
  const [label, setLabel] = useState("");
  const [recipient, setRecipient] = useState<"unni" | "amma">("unni");
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Log Manual Income" onClose={onClose}>
      <Field label="Description (optional)">
        <input
          style={inputStyle}
          placeholder="e.g. Cash order, Trivandrum trip"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Field label="Amount received ₹ *">
        <input
          style={inputStyle}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label="Mochi count *">
        <input
          style={inputStyle}
          type="number"
          value={mc}
          onChange={(e) => setMc(e.target.value)}
        />
      </Field>
      <Field label="Who received it?">
        <div style={{ display: "flex", gap: 8 }}>
          {(["unni", "amma"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRecipient(r)}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: 10,
                border: `1.5px solid ${recipient === r ? (r === "unni" ? V.unni : V.amma) : "rgba(99,60,180,0.15)"}`,
                background:
                  recipient === r
                    ? r === "unni"
                      ? V.unniGlass
                      : V.ammaGlass
                    : "transparent",
                color:
                  recipient === r ? (r === "unni" ? V.unni : V.amma) : V.sub,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "capitalize" as const,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </Field>
      <button
        disabled={saving || !amount || !mc}
        onClick={async () => {
          setSaving(true);
          await onSave(Number(amount), Number(mc), recipient, label);
          setSaving(false);
        }}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg, #6366f1, #db2777)",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 6,
        }}
      >
        {saving ? "Saving..." : "Log Income"}
      </button>
    </Modal>
  );
}

function AddExpenseModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (
    description: string,
    amount: number,
    category: string,
    date: string,
    paidBy: string,
    split: boolean,
  ) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("ingredient");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paidBy, setPaidBy] = useState<string>("");
  const [split, setSplit] = useState(false);
  const [saving, setSaving] = useState(false);
  const isPersonalPayer =
    paidBy === "unni_personal" || paidBy === "amma_personal";
  return (
    <Modal title="Add Company Expense" onClose={onClose}>
      <Field label="Description *">
        <input
          style={inputStyle}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Amount ₹ *">
        <input
          style={inputStyle}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label="Category">
        <select
          style={inputStyle}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <input
          style={inputStyle}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="Who paid for this? *">
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {PAYER_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPaidBy(p.id);
                if (p.id !== "unni_personal" && p.id !== "amma_personal")
                  setSplit(false);
              }}
              style={{
                padding: "9px 8px",
                borderRadius: 10,
                fontSize: "0.78rem",
                border: `1.5px solid ${paidBy === p.id ? p.color : "rgba(99,60,180,0.15)"}`,
                background: paidBy === p.id ? `${p.color}18` : "transparent",
                color: paidBy === p.id ? p.color : V.sub,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Field>
      {isPersonalPayer && (
        <Field label="Split 50/50 with the other person?">
          <button
            onClick={() => setSplit((v) => !v)}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 10,
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              border: `1.5px solid ${split ? V.unni : "rgba(99,60,180,0.15)"}`,
              background: split ? V.unniGlass : "transparent",
              color: split ? V.unni : V.sub,
            }}
          >
            {split
              ? "✓ Split 50/50 — other person owes half"
              : "Not split — fully mine"}
          </button>
        </Field>
      )}
      <button
        disabled={saving || !description || !amount || !paidBy}
        onClick={async () => {
          setSaving(true);
          await onSave(
            description,
            Number(amount),
            category,
            date,
            paidBy,
            split,
          );
          setSaving(false);
        }}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg, #fbbf24, #d97706)",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 6,
        }}
      >
        {saving ? "Saving..." : "Add Expense"}
      </button>
    </Modal>
  );
}

function SettleModal({
  suggested,
  direction,
  onClose,
  onConfirm,
}: {
  suggested: number;
  direction: string;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(Math.round(suggested)));
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Confirm Transfer" onClose={onClose}>
      <p style={{ fontSize: "0.85rem", color: V.sub, marginBottom: 14 }}>
        Direction: <strong>{direction}</strong>. Enter the amount actually
        transferred (defaults to the full outstanding balance).
      </p>
      <Field label="Amount ₹">
        <input
          style={inputStyle}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <button
        disabled={saving || !amount || Number(amount) <= 0}
        onClick={async () => {
          setSaving(true);
          await onConfirm(Number(amount));
          setSaving(false);
        }}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg, #34d399, #059669)",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {saving ? "Recording..." : "✓ Confirm Transfer"}
      </button>
    </Modal>
  );
}
