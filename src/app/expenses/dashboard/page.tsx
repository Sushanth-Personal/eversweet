// Location: src/app/expenses/dashboard/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const V = {
  bg: "linear-gradient(160deg, #eef2ff 0%, #fdf4ff 45%, #fff7ed 100%)",
  card: "rgba(255,255,255,0.78)",
  cardBorder: "rgba(255,255,255,0.9)",
  text: "#1e1b3a",
  sub: "#5b5578",
  muted: "#8b85a3",
  shadow: "0 8px 30px rgba(99,60,180,0.08)",
  green: "#16a34a",
  red: "#e11d48",
  indigo: "#4f46e5",
};

type CategoryDef = {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
};

const PERSONAL_CATEGORIES: CategoryDef[] = [
  {
    id: "personal_food",
    label: "Food",
    icon: "🍔",
    color: "#ea580c",
    bg: "rgba(234,88,12,0.1)",
  },
  {
    id: "personal_travel",
    label: "Travel",
    icon: "🚗",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.1)",
  },
  {
    id: "personal_loan",
    label: "Loan",
    icon: "💳",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.1)",
  },
  {
    id: "personal_purchase",
    label: "Purchase",
    icon: "🛍️",
    color: "#db2777",
    bg: "rgba(219,39,119,0.1)",
  },
  {
    id: "personal_other",
    label: "Other",
    icon: "📋",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
  },
];

const COMPANY_CATEGORIES: CategoryDef[] = [
  {
    id: "marketing",
    label: "Ads",
    icon: "📣",
    color: "#e11d48",
    bg: "rgba(225,29,72,0.1)",
  },
  {
    id: "ingredient",
    label: "Ingredients",
    icon: "🧪",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.1)",
  },
  {
    id: "packaging",
    label: "Packing",
    icon: "📦",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.1)",
  },
  {
    id: "delivery",
    label: "Traveling",
    icon: "🚚",
    color: "#d97706",
    bg: "rgba(217,119,6,0.1)",
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: "🔧",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.1)",
  },
  {
    id: "fixed",
    label: "Fixed Cost",
    icon: "🏠",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
  },
  {
    id: "other",
    label: "Other",
    icon: "📋",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
  },
];

const ALL_CATEGORIES = [...PERSONAL_CATEGORIES, ...COMPANY_CATEGORIES];
function isPersonal(id: string) {
  return id.startsWith("personal_");
}
function catDef(id: string): CategoryDef {
  return (
    ALL_CATEGORIES.find((c) => c.id === id) ||
    COMPANY_CATEGORIES[COMPANY_CATEGORIES.length - 1]
  );
}

const PAYER_OPTIONS = [
  { id: "unni_personal", label: "Unni · Personal" },
  { id: "amma_personal", label: "Amma · Personal" },
  { id: "company_other", label: "Company (Other)" },
  { id: "company_kochi", label: "Company (Kochi)" },
] as const;

type SavedExpense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  paid_by: string | null;
};

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
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type Scope = "total" | "personal" | "company";
type DateScope = "today" | "month" | "all" | "custom";

function istToday() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().split("T")[0];
}
function istMonthPrefix() {
  return istToday().slice(0, 7);
}

export default function ExpensesDashboardPage() {
  const [expenses, setExpenses] = useState<SavedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("total");
  const [dateScope, setDateScope] = useState<DateScope>("all");
  const [customDate, setCustomDate] = useState(istToday());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<"all" | "personal" | "company">(
    "all",
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("expenses")
        .select("id, description, amount, category, date, paid_by")
        .order("date", { ascending: false })
        .limit(300);
      if (data) setExpenses(data as SavedExpense[]);
      setLoading(false);
    }
    load();
  }, []);

  const dateFiltered = useMemo(() => {
    if (dateScope === "today")
      return expenses.filter((e) => e.date === istToday());
    if (dateScope === "month")
      return expenses.filter((e) => e.date.startsWith(istMonthPrefix()));
    if (dateScope === "custom")
      return expenses.filter((e) => e.date === customDate);
    return expenses; // 'all'
  }, [expenses, dateScope, customDate]);

  const scoped = useMemo(() => {
    if (scope === "personal")
      return dateFiltered.filter((e) => isPersonal(e.category));
    if (scope === "company")
      return dateFiltered.filter((e) => !isPersonal(e.category));
    return dateFiltered;
  }, [dateFiltered, scope]);

  const byCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    scoped.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.entries(totals)
      .map(([id, amount]) => ({ def: catDef(id), amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scoped]);

  const grandTotal = byCategory.reduce((s, c) => s + c.amount, 0);
  const maxAmount = byCategory[0]?.amount || 1;

  const historyFiltered = useMemo(() => {
    if (historyTab === "personal")
      return dateFiltered.filter((e) => isPersonal(e.category));
    if (historyTab === "company")
      return dateFiltered.filter((e) => !isPersonal(e.category));
    return dateFiltered;
  }, [dateFiltered, historyTab]);

  async function deleteExpense(id: string) {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

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

      <div
        style={{ maxWidth: 700, margin: "0 auto", padding: "22px 20px 8px" }}
      >
        <Link
          href="/expenses"
          style={{ fontSize: "0.75rem", color: V.sub, textDecoration: "none" }}
        >
          ← Expenses
        </Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 4 }}>
          📊 Dashboard
        </h1>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 20px" }}>
        {/* Date scope */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 10,
            flexWrap: "wrap" as const,
          }}
        >
          {(
            [
              { id: "today", label: "Today" },
              { id: "month", label: "This Month" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "📅 Pick a date" },
            ] as { id: DateScope; label: string }[]
          ).map((d) => (
            <button
              key={d.id}
              onClick={() => setDateScope(d.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap" as const,
                border: `1.5px solid ${dateScope === d.id ? V.indigo : "rgba(99,60,180,0.15)"}`,
                background:
                  dateScope === d.id
                    ? "rgba(79,70,229,0.1)"
                    : "rgba(255,255,255,0.5)",
                color: dateScope === d.id ? V.indigo : V.sub,
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        {dateScope === "custom" && (
          <input
            ref={dateInputRef}
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            onClick={() => {
              const el = dateInputRef.current as any;
              if (el?.showPicker) el.showPicker();
            }}
            style={{
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
              marginBottom: 14,
              cursor: "pointer",
            }}
          />
        )}

        {/* Scope toggle */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 16,
            background: "rgba(255,255,255,0.6)",
            padding: 5,
            borderRadius: 14,
            border: `1px solid ${V.cardBorder}`,
          }}
        >
          {(["total", "company", "personal"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: 10,
                border: "none",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                textTransform: "capitalize" as const,
                background:
                  scope === s
                    ? "linear-gradient(135deg, #6366f1, #db2777)"
                    : "transparent",
                color: scope === s ? "#fff" : V.sub,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Grand total */}
        <Card style={{ marginBottom: 16, textAlign: "center" as const }}>
          <p
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: V.muted,
              marginBottom: 6,
            }}
          >
            {scope === "total"
              ? "Total"
              : scope === "company"
                ? "Company"
                : "Personal"}{" "}
            Spend ·{" "}
            {dateScope === "today"
              ? "Today"
              : dateScope === "month"
                ? "This Month"
                : dateScope === "custom"
                  ? customDate
                  : "All Time"}
          </p>
          <p style={{ fontSize: "2.2rem", fontWeight: 800 }}>
            ₹{grandTotal.toLocaleString("en-IN")}
          </p>
        </Card>

        {/* Bar chart */}
        <Card style={{ marginBottom: 16 }}>
          <p style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: 16 }}>
            Spend by Category
          </p>
          {loading ? (
            <p style={{ fontSize: "0.85rem", color: V.muted }}>Loading…</p>
          ) : byCategory.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: V.muted }}>
              No expenses in this view yet.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column" as const,
                gap: 14,
              }}
            >
              {byCategory.map(({ def, amount }) => (
                <div key={def.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {def.icon} {def.label}
                    </span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                      ₹{amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 10,
                      background: "rgba(0,0,0,0.05)",
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(amount / maxAmount) * 100}%`,
                        background: def.color,
                        borderRadius: 99,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Transaction history — hidden by default */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 14,
            border: `1px solid ${V.cardBorder}`,
            background: V.card,
            color: V.text,
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: V.shadow,
            marginBottom: showHistory ? 12 : 0,
          }}
        >
          {showHistory
            ? "▲ Hide Transaction History"
            : "▼ Show Transaction History"}
        </button>

        {showHistory && (
          <Card>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(["all", "personal", "company"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setHistoryTab(t)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 20,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize" as const,
                    border: `1.5px solid ${historyTab === t ? V.indigo : "rgba(99,60,180,0.15)"}`,
                    background:
                      historyTab === t ? "rgba(79,70,229,0.1)" : "transparent",
                    color: historyTab === t ? V.indigo : V.sub,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {historyFiltered.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: V.muted }}>
                Nothing here yet.
              </p>
            ) : (
              historyFiltered.map((e) => {
                const def = catDef(e.category);
                const payer = PAYER_OPTIONS.find((p) => p.id === e.paid_by);
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "9px 0",
                      borderBottom: "1px solid rgba(99,60,180,0.08)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span style={{ fontSize: "1.2rem" }}>{def.icon}</span>
                      <div>
                        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          {e.description}
                        </p>
                        <p style={{ fontSize: "0.7rem", color: V.sub }}>
                          {e.date} ·{" "}
                          <span style={{ color: def.color, fontWeight: 700 }}>
                            {def.label}
                          </span>
                          {payer && <span> · {payer.label}</span>}
                        </p>
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <p
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: V.red,
                        }}
                      >
                        −₹{e.amount}
                      </p>
                      <button
                        onClick={() => deleteExpense(e.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: V.muted,
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
