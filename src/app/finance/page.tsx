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
  delivery_charge?: number;
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
  delivery_charge: number;
  delivered_by: "unni" | "amma" | null;
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

type AccountBalance = {
  account_id: string;
  balance: number;
  updated_at: string;
  ledger_at_entry: number;
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
  { id: "company_other", label: "Company (Unni)", color: V.other },
  { id: "company_kochi", label: "Company (Amma)", color: V.kochi },
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
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
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

function timeAgo(iso: string | undefined) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ────────────────────────────────────────────────────────────────
   BalanceCard — now also renders a "money to move" badge with a
   one-tap confirm action. The badge is purely derived from
   (actual balance − ledger float), so it disappears automatically
   the moment that gap closes — whether via Confirm, a manual
   balance edit, or a new expense being logged against the account.
──────────────────────────────────────────────────────────────── */
function BalanceCard({
  label,
  amount,
  gradient,
  glass,
  border,
  sub,
  accountId,
  actual,
  onSaveBalance,
  transfer,
  onConfirmTransfer,
  cashEstimate,
  siblingPendingSweep,
}: {
  label: string;
  amount: number;
  gradient: string;
  glass: string;
  border: string;
  sub: string;
  accountId?: string;
  actual?: AccountBalance;
  onSaveBalance?: (
    accountId: string,
    balance: number,
    addCatchUp: boolean,
  ) => Promise<void>;
  transfer?: {
    amount: number;
    toLabel: string;
    predictedBalance: number;
  };
  onConfirmTransfer?: () => Promise<void>;
  cashEstimate?: number; // company cards only: pure cash-flow estimate, category-agnostic
  siblingPendingSweep?: number; // personal cards only: sibling company account's unswept surplus
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(actual ? String(actual.balance) : "");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reconcileStep, setReconcileStep] = useState(false);

  // Running estimate: starts from the last confirmed real balance, then
  // moves automatically with every new order/expense the ledger logs —
  // this is the number that should feel "alive", not the frozen entry itself.
  const estimate = actual
    ? actual.balance + (amount - actual.ledger_at_entry)
    : amount;

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

      {editing ? (
        <div style={{ marginBottom: 6 }}>
          {!reconcileStep ? (
            <>
              <input
                autoFocus
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{
                  width: "100%",
                  background: "#fff",
                  border: "1.5px solid rgba(99,60,180,0.25)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: V.text,
                  outline: "none",
                  boxSizing: "border-box" as const,
                  marginBottom: 6,
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled={saving || !draft}
                  onClick={() => {
                    const gap = estimate - Number(draft); // positive = money missing vs. what was expected
                    if (gap > 1) {
                      setReconcileStep(true);
                    } else {
                      (async () => {
                        if (!onSaveBalance || !accountId) return;
                        setSaving(true);
                        await onSaveBalance(accountId, Number(draft), false);
                        setSaving(false);
                        setEditing(false);
                      })();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "6px",
                    borderRadius: 7,
                    border: "none",
                    background: V.green,
                    color: "#fff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {saving ? "..." : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 7,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "transparent",
                    color: V.sub,
                    fontSize: "0.72rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            </>
          ) : accountId === "unni_personal" || accountId === "amma_personal" ? (
            (() => {
              const deficit = estimate - Number(draft);
              const sweep = siblingPendingSweep ?? 0;
              const companyLabel =
                accountId === "unni_personal"
                  ? "Company (Unni)"
                  : "Company (Amma)";
              const explained = sweep > 1;
              const fullyExplains = sweep >= deficit - 1;
              return (
                <div
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    background: explained
                      ? "rgba(22,163,74,0.06)"
                      : "rgba(99,60,180,0.06)",
                    border: `1px solid ${explained ? "rgba(22,163,74,0.25)" : "rgba(99,60,180,0.2)"}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: explained ? V.green : V.indigo,
                      marginBottom: 6,
                    }}
                  >
                    ₹{Math.round(deficit).toLocaleString("en-IN")} less than
                    expected
                  </p>
                  <p
                    style={{
                      fontSize: "0.68rem",
                      color: V.sub,
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }}
                  >
                    {explained
                      ? fullyExplains
                        ? `✓ Confirmed — ${companyLabel} currently has ₹${Math.round(sweep).toLocaleString("en-IN")} sitting unswept above its float target. That fully explains this gap. Go transfer it from that card, then re-check this one.`
                        : `${companyLabel} has ₹${Math.round(sweep).toLocaleString("en-IN")} unswept, which explains part of this gap. The remaining ₹${Math.round(deficit - sweep).toLocaleString("en-IN")} isn't accounted for by pending transfers — worth checking for untracked spending.`
                      : `${companyLabel} doesn't currently show any unswept surplus, so this gap probably isn't a pending transfer — worth checking for spending that hasn't been logged.`}
                  </p>
                  <button
                    disabled={saving}
                    onClick={async () => {
                      if (!onSaveBalance || !accountId) return;
                      setSaving(true);
                      await onSaveBalance(accountId, Number(draft), false);
                      setSaving(false);
                      setEditing(false);
                      setReconcileStep(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "7px",
                      borderRadius: 7,
                      border: "none",
                      background: explained ? V.green : V.indigo,
                      color: "#fff",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    OK, just update the balance
                  </button>
                </div>
              );
            })()
          ) : (
            <div
              style={{
                padding: "10px",
                borderRadius: 8,
                background: "rgba(217,119,6,0.08)",
                border: "1px solid rgba(217,119,6,0.3)",
              }}
            >
              <p
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#b45309",
                  marginBottom: 6,
                }}
              >
                ₹{Math.round(estimate - Number(draft)).toLocaleString("en-IN")}{" "}
                less than expected
              </p>
              <p
                style={{
                  fontSize: "0.68rem",
                  color: "#92640a",
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}
              >
                The ledger expected ~₹
                {Math.round(estimate).toLocaleString("en-IN")} but you entered ₹
                {Math.round(Number(draft)).toLocaleString("en-IN")}. Log the
                difference as an untracked expense so the estimate stays
                accurate going forward?
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled={saving}
                  onClick={async () => {
                    if (!onSaveBalance || !accountId) return;
                    setSaving(true);
                    await onSaveBalance(accountId, Number(draft), true);
                    setSaving(false);
                    setEditing(false);
                    setReconcileStep(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "7px",
                    borderRadius: 7,
                    border: "none",
                    background: "#d97706",
                    color: "#fff",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✓ Log it
                </button>
                <button
                  disabled={saving}
                  onClick={async () => {
                    if (!onSaveBalance || !accountId) return;
                    setSaving(true);
                    await onSaveBalance(accountId, Number(draft), false);
                    setSaving(false);
                    setEditing(false);
                    setReconcileStep(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "7px",
                    borderRadius: 7,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "transparent",
                    color: V.sub,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      ) : actual ? (
        <>
          <p
            style={{
              fontSize: "1.7rem",
              fontWeight: 800,
              color: V.text,
              lineHeight: 1,
            }}
          >
            {fmt(estimate)}
          </p>
          <p style={{ fontSize: "0.68rem", color: V.muted, marginTop: 5 }}>
            Estimated balance · last corrected {timeAgo(actual.updated_at)}
          </p>
          <p style={{ fontSize: "0.68rem", color: V.sub, marginTop: 2 }}>
            You confirmed {fmt(actual.balance)} then
          </p>
          {typeof cashEstimate === "number" && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px dashed rgba(0,0,0,0.1)",
              }}
            >
              <p style={{ fontSize: "0.66rem", color: V.sub }}>
                Company float target:{" "}
                <strong style={{ color: V.text }}>{fmt(amount)}</strong>
              </p>
              <p style={{ fontSize: "0.66rem", color: V.sub, marginTop: 2 }}>
                All cash in this account:{" "}
                <strong style={{ color: V.text }}>{fmt(cashEstimate)}</strong>
              </p>
            </div>
          )}
        </>
      ) : (
        <>
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
          <p style={{ fontSize: "0.72rem", color: V.sub, marginTop: 6 }}>
            {sub} (ledger estimate)
          </p>
          {typeof cashEstimate === "number" && (
            <p style={{ fontSize: "0.66rem", color: V.sub, marginTop: 4 }}>
              All cash in this account (any category):{" "}
              <strong style={{ color: V.text }}>{fmt(cashEstimate)}</strong>
            </p>
          )}
        </>
      )}

      {!editing && accountId && onSaveBalance && (
        <button
          onClick={() => {
            setDraft(String(Math.round(estimate)));
            setReconcileStep(false);
            setEditing(true);
          }}
          style={{
            marginTop: 8,
            padding: "5px 10px",
            borderRadius: 20,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "rgba(255,255,255,0.6)",
            color: V.sub,
            fontSize: "0.68rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {actual ? "✎ Update balance" : "+ Enter actual balance"}
        </button>
      )}

      {transfer && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(217,119,6,0.12)",
            border: "1px solid rgba(217,119,6,0.35)",
          }}
        >
          <p
            style={{
              fontSize: "0.72rem",
              fontWeight: 800,
              color: "#b45309",
              lineHeight: 1.4,
            }}
          >
            💸 Transfer {fmt(transfer.amount)} → {transfer.toLabel}
          </p>
          <p style={{ fontSize: "0.66rem", color: "#92640a", marginTop: 3 }}>
            Balance after: {fmt(transfer.predictedBalance)}
          </p>
          <button
            disabled={confirming}
            onClick={async () => {
              if (!onConfirmTransfer) return;
              setConfirming(true);
              await onConfirmTransfer();
              setConfirming(false);
            }}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "7px",
              borderRadius: 8,
              border: "none",
              background: "#d97706",
              color: "#fff",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: confirming ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {confirming ? "..." : "✓ Confirm transfer sent"}
          </button>
        </div>
      )}
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
type BreakdownRow = {
  label: string;
  date: string;
  amount: number;
  direction: "unni_to_amma" | "amma_to_unni";
  source: "mochi" | "delivery" | "split_expense" | "settlement";
};

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
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [accountBalances, setAccountBalances] = useState<
    Record<string, AccountBalance>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: o }, { data: s }, { data: st }, { data: ex }, { data: ab }] =
      await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, customer_name, total_price, status, flavours, delivery_date, order_date, created_at, delivery_charge",
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
        supabase.from("account_balances").select("*"),
      ]);
    if (o) setOrders(o as Order[]);
    if (s) setSplits(s as IncomeSplit[]);
    if (st) setSettlements(st as Settlement[]);
    if (ex) setExpenses(ex as ExpenseRow[]);
    if (ab) {
      const map: Record<string, AccountBalance> = {};
      (ab as AccountBalance[]).forEach((row) => {
        map[row.account_id] = row;
      });
      setAccountBalances(map);
    }
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
    let companyOtherCashIn = 0;
    let companyKochiCashIn = 0;
    let unniOwesAmmaRaw = 0;
    let ammaOwesUnniRaw = 0;
    let unniLifetimePersonal = 0;
    let ammaLifetimePersonal = 0;

    splits.forEach((s) => {
      if (s.entry_date < FEED_START_DATE) return; // keep balance math in sync with the visible feed

      // Mochi revenue splits evenly between both people — this part is fine as-is.
      unniLifetimePersonal += s.personal_share_each;
      ammaLifetimePersonal += s.personal_share_each;

      if (s.recipient === "unni") {
        companyOther += s.company_share;
        companyOtherCashIn += s.order_total; // full order amount actually landed here
      } else {
        companyKochi += s.company_share;
        companyKochiCashIn += s.order_total;
      }

      // Delivery charge belongs 100% to whoever delivered — never split.
      const deliveryCharge = s.delivery_charge || 0;
      if (deliveryCharge > 0 && s.delivered_by) {
        if (s.delivered_by === "unni") unniLifetimePersonal += deliveryCharge;
        else ammaLifetimePersonal += deliveryCharge;
      }

      // Settlement owed: the recipient's account is holding money that
      // belongs to the other person — their mochi-share, plus the full
      // delivery charge if THEY (not the recipient) were the deliverer.
      if (s.recipient === "unni") {
        // Unni's account holds the money; Unni owes Amma her mochi share,
        // plus the delivery charge if Amma delivered it.
        unniOwesAmmaRaw += s.personal_share_each;
        if (deliveryCharge > 0 && s.delivered_by === "amma")
          unniOwesAmmaRaw += deliveryCharge;
      } else {
        ammaOwesUnniRaw += s.personal_share_each;
        if (deliveryCharge > 0 && s.delivered_by === "unni")
          ammaOwesUnniRaw += deliveryCharge;
      }
    });

    let unniPersonalExp = 0;
    let ammaPersonalExp = 0;
    let companyOtherExp = 0;
    let companyKochiExp = 0;
    let companyOtherCashOut = 0;
    let companyKochiCashOut = 0;
    expenses.forEach((e) => {
      if (e.date < FEED_START_DATE) return; // keep balance math in sync with the visible feed

      // Pure cash-out: every rupee that physically left this account,
      // regardless of what category the spend was. This is what actually
      // determines the real cash sitting there right now.
      if (e.paid_by === "company_other") companyOtherCashOut += e.amount;
      else if (e.paid_by === "company_kochi") companyKochiCashOut += e.amount;

      if (isPersonalCategory(e.category)) {
        // A personal expense always reduces the SPENDER's own entitlement,
        // regardless of which physical account funded it. company_other is
        // Unni's account and company_kochi is Amma's, so if either of them
        // pays a personal expense straight out of their own company account
        // (instead of first moving it to their personal account), it still
        // correctly comes off their personal balance — not the company float.
        if (e.paid_by === "unni_personal" || e.paid_by === "company_other")
          unniPersonalExp += e.amount;
        else if (e.paid_by === "amma_personal" || e.paid_by === "company_kochi")
          ammaPersonalExp += e.amount;
      } else {
        // A company expense only reduces company float when it was actually
        // paid from a company account. If someone fronted a company expense
        // from their own personal money, that's a reimbursement situation,
        // not something we auto-attribute here.
        if (e.paid_by === "company_other") companyOtherExp += e.amount;
        else if (e.paid_by === "company_kochi") companyKochiExp += e.amount;
      }

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
      if (s.created_at.slice(0, 10) < FEED_START_DATE) return; // keep balance math in sync with the visible feed
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
      companyOtherCashEstimate: companyOtherCashIn - companyOtherCashOut,
      companyKochiCashEstimate: companyKochiCashIn - companyKochiCashOut,
      unniPersonalBalance: unniLifetimePersonal - unniPersonalExp,
      ammaPersonalBalance: ammaLifetimePersonal - ammaPersonalExp,
      netOutstanding,
    };
  }, [splits, settlements, expenses]);

  /* ---------- Settlement breakdown (drives the "See how this was
     calculated" modal) — every line item that adds to or subtracts from
     the net outstanding figure shown on the hero banner. ---------- */
  const breakdownRows = useMemo<BreakdownRow[]>(() => {
    const rows: BreakdownRow[] = [];

    splits.forEach((s) => {
      if (s.entry_date < FEED_START_DATE) return;
      const deliveryCharge = s.delivery_charge || 0;
      if (s.recipient === "unni") {
        rows.push({
          label: s.label || "Order",
          date: s.entry_date,
          amount: s.personal_share_each,
          direction: "unni_to_amma",
          source: "mochi",
        });
        if (deliveryCharge > 0 && s.delivered_by === "amma") {
          rows.push({
            label: `${s.label || "Order"} — delivery`,
            date: s.entry_date,
            amount: deliveryCharge,
            direction: "unni_to_amma",
            source: "delivery",
          });
        }
      } else {
        rows.push({
          label: s.label || "Order",
          date: s.entry_date,
          amount: s.personal_share_each,
          direction: "amma_to_unni",
          source: "mochi",
        });
        if (deliveryCharge > 0 && s.delivered_by === "unni") {
          rows.push({
            label: `${s.label || "Order"} — delivery`,
            date: s.entry_date,
            amount: deliveryCharge,
            direction: "amma_to_unni",
            source: "delivery",
          });
        }
      }
    });

    expenses.forEach((e) => {
      if (e.date < FEED_START_DATE || !e.split) return;
      if (e.paid_by === "unni_personal") {
        rows.push({
          label: `${e.description} (split)`,
          date: e.date,
          amount: e.amount / 2,
          direction: "amma_to_unni",
          source: "split_expense",
        });
      } else if (e.paid_by === "amma_personal") {
        rows.push({
          label: `${e.description} (split)`,
          date: e.date,
          amount: e.amount / 2,
          direction: "unni_to_amma",
          source: "split_expense",
        });
      }
    });

    settlements.forEach((s) => {
      if (s.created_at.slice(0, 10) < FEED_START_DATE) return;
      rows.push({
        label: s.note || "Settlement paid",
        date: s.created_at.slice(0, 10),
        amount: -s.amount,
        direction: s.direction,
        source: "settlement",
      });
    });

    return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [splits, expenses, settlements]);

  /* ---------- Transfer suggestions (drives the badges) ----------
     Purely derived from (actual balance − ledger float). This means
     the badge disappears automatically the instant that gap closes —
     whether the person taps Confirm below, edits the balance down
     manually, or a newly logged expense raises the ledger float to
     match the actual balance. No separate "confirmed" flag needed. */
  const transferMap = useMemo(() => {
    const map: Record<
      string,
      {
        amount: number;
        toAccountId: string;
        toLabel: string;
        predictedBalance: number;
      }
    > = {};
    const pairs: [string, string, number][] = [
      ["company_other", "unni_personal", totals.companyOtherBalance],
      ["company_kochi", "amma_personal", totals.companyKochiBalance],
    ];
    pairs.forEach(([fromId, toId, ledgerFloat]) => {
      const actual = accountBalances[fromId];
      if (!actual) return;
      const excess = actual.balance - ledgerFloat;
      if (excess > 1) {
        map[fromId] = {
          amount: excess,
          toAccountId: toId,
          toLabel:
            toId === "unni_personal" ? "Unni · Personal" : "Amma · Personal",
          predictedBalance: ledgerFloat,
        };
      }
    });
    return map;
  }, [accountBalances, totals]);

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
  async function saveClassification(
    order: Order,
    recipient: "unni" | "amma",
    deliveryCharge: number,
    deliveredBy: "unni" | "amma" | null,
    mochiCountOverride: number,
  ) {
    const mc = mochiCountOverride;
    const mochiSubtotal = order.total_price - deliveryCharge;
    const companyShare = Math.min(mochiSubtotal, COMPANY_SHARE_PER_MOCHI * mc);
    const remaining = mochiSubtotal - companyShare;
    await supabase.from("income_splits").insert({
      order_id: order.id,
      label: order.customer_name,
      mochi_count: mc,
      order_total: order.total_price,
      recipient,
      company_share: companyShare,
      personal_share_each: remaining / 2,
      delivery_charge: deliveryCharge,
      delivered_by: deliveryCharge > 0 ? deliveredBy : null,
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

  async function saveAccountBalance(
    accountId: string,
    balance: number,
    addCatchUp: boolean,
  ) {
    const ledgerByAccount: Record<string, number> = {
      unni_personal: totals.unniPersonalBalance,
      amma_personal: totals.ammaPersonalBalance,
      company_other: totals.companyOtherBalance,
      company_kochi: totals.companyKochiBalance,
    };
    const currentLedger = ledgerByAccount[accountId] ?? balance;

    let ledgerAtEntry = currentLedger;

    if (addCatchUp) {
      const deficit = currentLedger - balance;
      if (deficit > 1) {
        const isPersonal =
          accountId === "unni_personal" || accountId === "amma_personal";
        const { error: expenseError } = await supabase.from("expenses").insert({
          description: "Untracked spending (balance reconciliation)",
          amount: deficit,
          category: isPersonal ? "personal_other" : "other",
          date: new Date().toISOString().split("T")[0],
          paid_by: accountId,
          split: false,
        });
        if (expenseError) {
          flash("⚠ Catch-up expense failed: " + expenseError.message);
          return;
        }
        // After logging the deficit as an expense, the ledger will land
        // exactly on `balance` — use that as the fresh baseline.
        ledgerAtEntry = balance;
      }
    }

    const { error } = await supabase.from("account_balances").upsert(
      {
        account_id: accountId,
        balance,
        ledger_at_entry: ledgerAtEntry,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
    if (error) {
      flash("⚠ Save failed: " + error.message);
      return;
    }
    await load();
    flash(
      addCatchUp
        ? "Balance updated, gap logged as an expense ✓"
        : "Balance updated ✓",
    );
  }

  /* Confirms that money has actually moved out of a company account
     into the linked personal account. Sets the "from" account's
     balance to the predicted post-transfer float, and adds the
     transferred amount onto the "to" account's actual balance.
     Once this runs, transferMap recomputes to (near) zero excess,
     so the badge disappears immediately — no page reload needed. */
  async function confirmAccountTransfer(
    fromId: string,
    toId: string,
    amount: number,
    predictedFromBalance: number,
  ) {
    const toActual = accountBalances[toId];
    const now = new Date().toISOString();
    const ledgerByAccount: Record<string, number> = {
      unni_personal: totals.unniPersonalBalance,
      amma_personal: totals.ammaPersonalBalance,
      company_other: totals.companyOtherBalance,
      company_kochi: totals.companyKochiBalance,
    };
    const { error } = await supabase.from("account_balances").upsert(
      [
        {
          account_id: fromId,
          balance: predictedFromBalance,
          ledger_at_entry: predictedFromBalance,
          updated_at: now,
        },
        {
          account_id: toId,
          balance: (toActual?.balance || 0) + amount,
          ledger_at_entry:
            ledgerByAccount[toId] ?? (toActual?.balance || 0) + amount,
          updated_at: now,
        },
      ],
      { onConflict: "account_id" },
    );
    if (error) {
      flash("Transfer save failed: " + error.message);
      return;
    }
    await load();
    flash(`✓ Transfer confirmed — ${fmt(amount)} moved`);
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
            cursor: !settled ? "pointer" : "default",
          }}
          onClick={() => !settled && setShowBreakdown(true)}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettle(true);
                }}
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
              <p style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: 12 }}>
                Tap anywhere else on this card to see how this number was
                calculated
              </p>
            </>
          )}
        </Card>

        {/* Balance grid — company accounts now carry a live
            "money to move" badge derived straight from
            actual vs. ledger-float balances. */}
        {(() => {
          const companyOtherPendingSweep =
            totals.companyOtherCashEstimate - totals.companyOtherBalance;
          const companyKochiPendingSweep =
            totals.companyKochiCashEstimate - totals.companyKochiBalance;
          return (
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
                sub="Personal income since Jul 17"
                accountId="unni_personal"
                actual={accountBalances["unni_personal"]}
                onSaveBalance={saveAccountBalance}
                siblingPendingSweep={companyOtherPendingSweep}
              />
              <BalanceCard
                label="Amma · Personal"
                amount={totals.ammaPersonalBalance}
                gradient={V.ammaBg}
                glass={V.ammaGlass}
                border={V.ammaBorder}
                sub="Personal income since Jul 17"
                accountId="amma_personal"
                actual={accountBalances["amma_personal"]}
                onSaveBalance={saveAccountBalance}
                siblingPendingSweep={companyKochiPendingSweep}
              />
              <BalanceCard
                label="Company (Unni)"
                amount={totals.companyOtherBalance}
                gradient={V.otherBg}
                glass={V.otherGlass}
                border={V.otherBorder}
                sub="Unni's company account"
                accountId="company_other"
                actual={accountBalances["company_other"]}
                onSaveBalance={saveAccountBalance}
                cashEstimate={totals.companyOtherCashEstimate}
                transfer={
                  transferMap["company_other"]
                    ? {
                        amount: transferMap["company_other"].amount,
                        toLabel: transferMap["company_other"].toLabel,
                        predictedBalance:
                          transferMap["company_other"].predictedBalance,
                      }
                    : undefined
                }
                onConfirmTransfer={
                  transferMap["company_other"]
                    ? () =>
                        confirmAccountTransfer(
                          "company_other",
                          transferMap["company_other"].toAccountId,
                          transferMap["company_other"].amount,
                          transferMap["company_other"].predictedBalance,
                        )
                    : undefined
                }
              />
              <BalanceCard
                label="Company (Amma)"
                amount={totals.companyKochiBalance}
                gradient={V.kochiBg}
                glass={V.kochiGlass}
                border={V.kochiBorder}
                sub="Amma's company account"
                accountId="company_kochi"
                actual={accountBalances["company_kochi"]}
                onSaveBalance={saveAccountBalance}
                cashEstimate={totals.companyKochiCashEstimate}
                transfer={
                  transferMap["company_kochi"]
                    ? {
                        amount: transferMap["company_kochi"].amount,
                        toLabel: transferMap["company_kochi"].toLabel,
                        predictedBalance:
                          transferMap["company_kochi"].predictedBalance,
                      }
                    : undefined
                }
                onConfirmTransfer={
                  transferMap["company_kochi"]
                    ? () =>
                        confirmAccountTransfer(
                          "company_kochi",
                          transferMap["company_kochi"].toAccountId,
                          transferMap["company_kochi"].amount,
                          transferMap["company_kochi"].predictedBalance,
                        )
                    : undefined
                }
              />
            </div>
          );
        })()}

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
        <ClassifyModal
          order={classifyingOrder}
          onClose={() => setClassifyingOrder(null)}
          onSave={saveClassification}
        />
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

      {/* Modal: Settlement breakdown */}
      {showBreakdown && (
        <BreakdownModal
          rows={breakdownRows}
          netOutstanding={outstanding}
          onClose={() => setShowBreakdown(false)}
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

function ClassifyModal({
  order,
  onClose,
  onSave,
}: {
  order: Order;
  onClose: () => void;
  onSave: (
    order: Order,
    recipient: "unni" | "amma",
    deliveryCharge: number,
    deliveredBy: "unni" | "amma" | null,
    mochiCountOverride: number,
  ) => Promise<void>;
}) {
  const [recipient, setRecipient] = useState<"unni" | "amma" | null>(null);
  const [deliveryCharge, setDeliveryCharge] = useState(
    order.delivery_charge ? String(order.delivery_charge) : "",
  );
  const [deliveredBy, setDeliveredBy] = useState<"unni" | "amma" | null>(null);
  const [saving, setSaving] = useState(false);
  const [mochiCountOverride, setMochiCountOverride] = useState(
    String(mochiCount(order)),
  );

  const hasDelivery = Number(deliveryCharge) > 0;
  const mochiSubtotal =
    order.total_price - (hasDelivery ? Number(deliveryCharge) : 0);
  const readyToSave =
    !!recipient &&
    (!hasDelivery || !!deliveredBy) &&
    Number(mochiCountOverride) > 0;
  const mochiLooksWrong = Number(mochiCountOverride) === 0;

  return (
    <Modal onClose={onClose} title={`Classify: ${order.customer_name}`}>
      <p style={{ fontSize: "0.85rem", color: V.sub, marginBottom: 10 }}>
        {fmt(order.total_price)} total.
      </p>

      <Field label="Mochi count — check this against the actual order before saving">
        <input
          style={{
            ...inputStyle,
            border: mochiLooksWrong ? "1.5px solid #e11d48" : inputStyle.border,
          }}
          type="number"
          value={mochiCountOverride}
          onChange={(e) => setMochiCountOverride(e.target.value)}
        />
        {mochiLooksWrong && (
          <p
            style={{
              fontSize: "0.7rem",
              color: V.red,
              marginTop: 4,
              fontWeight: 600,
            }}
          >
            ⚠ 0 mochis will send the ENTIRE order amount to the personal split
            with no company float. This is almost never correct — double check
            the real order before saving.
          </p>
        )}
      </Field>

      <Field label="Who did the customer pay?">
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setRecipient("unni")}
            style={{
              flex: 1,
              padding: "14px 12px",
              borderRadius: 14,
              border: `2px solid ${recipient === "unni" ? V.unni : "transparent"}`,
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
            onClick={() => setRecipient("amma")}
            style={{
              flex: 1,
              padding: "14px 12px",
              borderRadius: 14,
              border: `2px solid ${recipient === "amma" ? V.amma : "transparent"}`,
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
      </Field>

      <Field
        label={
          order.delivery_charge
            ? "Delivery charge (from order, edit if wrong)"
            : "Delivery charge, if any (₹) — goes 100% to whoever delivered, never split"
        }
      >
        <input
          style={inputStyle}
          type="number"
          placeholder="0"
          value={deliveryCharge}
          onChange={(e) => setDeliveryCharge(e.target.value)}
        />
      </Field>

      {hasDelivery && (
        <Field label="Who delivered it?">
          <div style={{ display: "flex", gap: 10 }}>
            {(["unni", "amma"] as const).map((who) => (
              <button
                key={who}
                onClick={() => setDeliveredBy(who)}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 10,
                  border: `1.5px solid ${deliveredBy === who ? (who === "unni" ? V.unni : V.amma) : "rgba(99,60,180,0.15)"}`,
                  background:
                    deliveredBy === who
                      ? who === "unni"
                        ? V.unniGlass
                        : V.ammaGlass
                      : "transparent",
                  color:
                    deliveredBy === who
                      ? who === "unni"
                        ? V.unni
                        : V.amma
                      : V.sub,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "capitalize" as const,
                }}
              >
                {who}
              </button>
            ))}
          </div>
        </Field>
      )}

      {hasDelivery && (
        <p
          style={{
            fontSize: "0.72rem",
            color: V.sub,
            marginBottom: 12,
            padding: "8px 10px",
            background: "rgba(99,60,180,0.05)",
            borderRadius: 8,
          }}
        >
          Mochi subtotal: {fmt(mochiSubtotal)} (this part splits normally) ·
          Delivery: {fmt(Number(deliveryCharge))} (goes entirely to{" "}
          {deliveredBy || "whoever delivered"})
        </p>
      )}

      <button
        disabled={!readyToSave || saving}
        onClick={async () => {
          setSaving(true);
          await onSave(
            order,
            recipient!,
            hasDelivery ? Number(deliveryCharge) : 0,
            hasDelivery ? deliveredBy : null,
            Number(mochiCountOverride),
          );
          setSaving(false);
        }}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: "none",
          background: readyToSave
            ? "linear-gradient(135deg, #34d399, #059669)"
            : "rgba(0,0,0,0.08)",
          color: readyToSave ? "#fff" : V.muted,
          fontWeight: 700,
          cursor: readyToSave ? "pointer" : "not-allowed",
          marginTop: 4,
        }}
      >
        {saving ? "Saving..." : "✓ Save Classification"}
      </button>
    </Modal>
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

function BreakdownModal({
  rows,
  netOutstanding,
  onClose,
}: {
  rows: BreakdownRow[];
  netOutstanding: number;
  onClose: () => void;
}) {
  const sourceLabel: Record<BreakdownRow["source"], string> = {
    mochi: "🍡 Mochi share",
    delivery: "🚚 Delivery",
    split_expense: "🔀 Split expense",
    settlement: "✓ Settled",
  };
  const owerIsUnni = netOutstanding > 0.5;
  const settled = Math.abs(netOutstanding) <= 0.5;

  return (
    <Modal onClose={onClose} title="How this was calculated">
      <p style={{ fontSize: "0.8rem", color: V.sub, marginBottom: 4 }}>
        Every line that adds to or reduces the balance, most recent first.
      </p>
      <div
        style={{
          maxHeight: "55vh",
          overflowY: "auto" as const,
          marginBottom: 14,
          marginTop: 12,
        }}
      >
        {rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: V.muted }}>
            Nothing to show yet.
          </p>
        ) : (
          rows.map((r, i) => {
            const isSettlement = r.source === "settlement";
            const arrow =
              r.direction === "unni_to_amma" ? "Unni → Amma" : "Amma → Unni";
            const dirColor = isSettlement
              ? V.green
              : r.direction === "unni_to_amma"
                ? V.unni
                : V.amma;
            const dirBg = isSettlement
              ? "rgba(22,163,74,0.06)"
              : r.direction === "unni_to_amma"
                ? V.unniGlass
                : V.ammaGlass;
            return (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: dirBg,
                  border: `1px solid ${dirColor}30`,
                  borderLeft: `4px solid ${dirColor}`,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: V.text,
                        marginBottom: 4,
                      }}
                    >
                      {r.label}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap" as const,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.66rem",
                          fontWeight: 800,
                          color: "#fff",
                          background: dirColor,
                          padding: "2px 8px",
                          borderRadius: 20,
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {isSettlement
                          ? r.direction === "unni_to_amma"
                            ? "Unni paid Amma"
                            : "Amma paid Unni"
                          : arrow}
                      </span>
                      <span style={{ fontSize: "0.66rem", color: V.muted }}>
                        {r.date} · {sourceLabel[r.source]}
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap" as const,
                      color: isSettlement ? V.green : V.text,
                    }}
                  >
                    {isSettlement ? "−" : "+"}
                    {fmt(Math.abs(r.amount))}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: settled ? "rgba(22,163,74,0.1)" : "rgba(99,60,180,0.06)",
          border: `1px solid ${settled ? "rgba(22,163,74,0.3)" : "rgba(99,60,180,0.15)"}`,
        }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: V.muted,
            textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
            marginBottom: 4,
          }}
        >
          Net result
        </p>
        <p style={{ fontSize: "1.2rem", fontWeight: 800, color: V.text }}>
          {settled
            ? "✓ All settled"
            : `${owerIsUnni ? "Unni" : "Amma"} owes ${owerIsUnni ? "Amma" : "Unni"} ${fmt(Math.abs(netOutstanding))}`}
        </p>
      </div>
    </Modal>
  );
}
