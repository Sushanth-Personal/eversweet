"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize, TimeSlot, Order } from "@/lib/types";

// ── Status flow ────────────────────────────────────────────────────
const STATUS_FLOW = [
  "pending",
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
] as const;
type OrderStatus = (typeof STATUS_FLOW)[number] | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  pending: "Payment Pending",
  confirmed: "Order Confirmed",
  cooked: "Completed Cooking",
  porter_booked: "Book Porter now",
  dispatched: "Dispatched",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  pending: { bg: "#fff8e6", text: "#92640a", border: "#f5c842" },
  confirmed: { bg: "#e8f5e9", text: "#2e7d32", border: "#66bb6a" },
  cooking: { bg: "#fff3e0", text: "#e65100", border: "#ffa726" },
  cooked: { bg: "#e3f2fd", text: "#1565c0", border: "#42a5f5" },
  porter_booked: { bg: "#f3e5f5", text: "#6a1b9a", border: "#ab47bc" },
  dispatched: { bg: "#e8f5e9", text: "#1b5e20", border: "#43a047" },
  cancelled: { bg: "#ffebee", text: "#b71c1c", border: "#ef5350" },
};

function nextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current as (typeof STATUS_FLOW)[number]);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

const T = {
  bg: "#f5f5f5",
  white: "#ffffff",
  border: "#e0e0e0",
  text: "#1a1a1a",
  sub: "#555555",
  muted: "#888888",
  gold: "#b8860b",
  goldBg: "#fff8e6",
  red: "#c62828",
  redBg: "#ffebee",
  green: "#2e7d32",
  greenBg: "#e8f5e9",
  blue: "#1565c0",
  blueBg: "#e3f2fd",
  purple: "#6a1b9a",
  purpleBg: "#f3e5f5",
  orange: "#e65100",
  orangeBg: "#fff3e0",
};

// Category config
const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  ingredient: {
    label: "Ingredients",
    color: "#2e7d32",
    bg: "#e8f5e9",
    icon: "🧪",
  },
  packaging: {
    label: "Packaging",
    color: "#1565c0",
    bg: "#e3f2fd",
    icon: "📦",
  },
  equipment: {
    label: "Equipment",
    color: "#6a1b9a",
    bg: "#f3e5f5",
    icon: "🔧",
  },
  delivery: { label: "Delivery", color: "#e65100", bg: "#fff3e0", icon: "🚚" },
  other: { label: "Other", color: "#555555", bg: "#f5f5f5", icon: "📋" },
};

function Input({
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        background: T.white,
        border: `1px solid ${T.border}`,
        color: T.text,
        padding: "10px 12px",
        borderRadius: 6,
        fontSize: "0.9rem",
        marginBottom: 8,
        outline: "none",
        fontFamily: "system-ui, sans-serif",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
      }}
    />
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      style={{
        padding: "4px 10px",
        borderRadius: 4,
        border: `1px solid ${copied ? "#66bb6a" : "#bdbdbd"}`,
        background: copied ? T.greenBg : T.white,
        color: copied ? T.green : T.sub,
        fontSize: "0.72rem",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.2s",
        fontFamily: "system-ui, sans-serif",
        whiteSpace: "nowrap" as const,
      }}
    >
      {copied ? "✓ Copied" : `Copy ${label}`}
    </button>
  );
}

function Btn({
  children,
  onClick,
  variant = "default",
  disabled = false,
  full = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "purple" | "orange";
  disabled?: boolean;
  full?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: T.white,
      color: T.sub,
      border: `1px solid ${T.border}`,
    },
    primary: {
      background: "#1976d2",
      color: "#fff",
      border: "1px solid #1976d2",
    },
    danger: { background: T.redBg, color: T.red, border: `1px solid #ef9a9a` },
    purple: {
      background: "#f3e5f5",
      color: "#6a1b9a",
      border: "1px solid #ce93d8",
    },
    orange: {
      background: "#fff3e0",
      color: "#e65100",
      border: "1px solid #ffcc80",
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 14px",
        borderRadius: 5,
        fontSize: "0.8rem",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        fontFamily: "system-ui, sans-serif",
        whiteSpace: "nowrap" as const,
        width: full ? "100%" : "auto",
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = T.text,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: T.white,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          color: T.muted,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "1.7rem",
          fontWeight: 700,
          color,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </p>
      {sub && <p style={{ fontSize: "0.75rem", color: T.muted }}>{sub}</p>}
    </div>
  );
}

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
  note?: string;
};

function OrderCard({
  order,
  isRepeat,
  slotLabel,
  productMap,
  onStatusChange,
  onCancel,
  onPorterEmail,
}: {
  order: Order;
  isRepeat: boolean;
  slotLabel: string;
  productMap: Record<string, string>;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onPorterEmail: (order: Order, slotLabel: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const next = nextStatus(order.status);
  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending;

  const flavourList = order.flavours
    ? Object.entries(order.flavours as Record<string, number>)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${productMap[id] || "Unknown"} ×${q}`)
        .join(", ")
    : "";

  return (
    <div
      style={{
        background: T.white,
        border: `1px solid ${sc.border}`,
        borderLeft: `4px solid ${sc.border}`,
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 10,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap" as const,
        }}
      >
        <span style={{ fontSize: "1rem", fontWeight: 700, color: T.text }}>
          {order.customer_name}
        </span>
        <CopyBtn value={order.customer_name} label="Name" />
        {isRepeat && (
          <span
            style={{
              fontSize: "0.65rem",
              padding: "2px 8px",
              borderRadius: 10,
              background: T.blueBg,
              color: T.blue,
              fontWeight: 600,
            }}
          >
            🔄 REPEAT
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.7rem",
            padding: "3px 10px",
            borderRadius: 12,
            background: sc.bg,
            color: sc.text,
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 5,
        }}
      >
        <span style={{ fontSize: "0.9rem", color: T.text, fontWeight: 500 }}>
          📞 {order.phone}
        </span>
        <CopyBtn value={order.phone} label="Phone" />
      </div>
      {order.address && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 5,
          }}
        >
          <span style={{ fontSize: "0.85rem", color: T.sub, flex: 1 }}>
            📍 {order.address}
          </span>
          <CopyBtn value={order.address} label="Address" />
        </div>
      )}
      <p style={{ fontSize: "0.85rem", color: T.sub, marginBottom: 4 }}>
        🕐 {slotLabel} ·{" "}
        <span style={{ color: T.gold, fontWeight: 600 }}>
          ₹{order.total_price}
        </span>{" "}
        · {order.payment_method}
      </p>
      {flavourList && (
        <p style={{ fontSize: "0.82rem", color: T.muted, marginBottom: 4 }}>
          🍡 {flavourList}
        </p>
      )}
      {order.notes && (
        <p
          style={{
            fontSize: "0.82rem",
            color: "#558b2f",
            fontStyle: "italic" as const,
            marginBottom: 4,
          }}
        >
          💬 {order.notes}
        </p>
      )}
      <p style={{ fontSize: "0.72rem", color: T.muted, marginBottom: 12 }}>
        {new Date(order.created_at).toLocaleString("en-IN")}
        {order.dob ? ` · DOB: ${order.dob}` : ""}
      </p>
      {order.status !== "dispatched" && order.status !== "cancelled" && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap" as const,
            alignItems: "center",
          }}
        >
          {next && (
            <button
              disabled={updating}
              onClick={async () => {
                setUpdating(true);
                if (next === "porter_booked") {
                  setEmailing(true);
                  await onPorterEmail(order, slotLabel);
                  setEmailing(false);
                }
                await onStatusChange(order.id, next);
                setUpdating(false);
              }}
              style={{
                padding: "8px 18px",
                borderRadius: 5,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: updating ? "not-allowed" : "pointer",
                opacity: updating ? 0.5 : 1,
                border: "1px solid",
                fontFamily: "system-ui, sans-serif",
                transition: "all 0.15s",
                ...(order.status === "pending"
                  ? {
                      background: "#e3f2fd",
                      color: "#1565c0",
                      borderColor: "#42a5f5",
                    }
                  : order.status === "confirmed"
                    ? {
                        background: "#fff3e0",
                        color: "#e65100",
                        borderColor: "#ffa726",
                      }
                    : order.status === "cooking"
                      ? {
                          background: "#e8f5e9",
                          color: "#2e7d32",
                          borderColor: "#66bb6a",
                        }
                      : order.status === "cooked"
                        ? {
                            background: "#f3e5f5",
                            color: "#6a1b9a",
                            borderColor: "#ab47bc",
                          }
                        : {
                            background: "#e8f5e9",
                            color: "#1b5e20",
                            borderColor: "#43a047",
                          }),
              }}
            >
              {updating
                ? emailing
                  ? "📧 Sending…"
                  : "…"
                : order.status === "pending"
                  ? "→ Confirm Order"
                  : order.status === "confirmed"
                    ? "→ Start Cooking"
                    : order.status === "cooking"
                      ? "✓ Cooking Done"
                      : order.status === "cooked"
                        ? "📦 Book Porter"
                        : "→ Mark Dispatched"}
            </button>
          )}
          {order.status === "cooked" && (
            <Btn
              variant="purple"
              disabled={emailing}
              onClick={async () => {
                setEmailing(true);
                await onPorterEmail(order, slotLabel);
                setEmailing(false);
              }}
            >
              {emailing ? "Sending…" : "📧 Send Porter Email"}
            </Btn>
          )}
          <Btn
            variant="danger"
            disabled={updating}
            onClick={async () => {
              if (!confirm(`Cancel order for ${order.customer_name}?`)) return;
              setUpdating(true);
              await onCancel(order.id);
              setUpdating(false);
            }}
          >
            Cancel
          </Btn>
        </div>
      )}
    </div>
  );
}

type Tab =
  | "orders"
  | "dispatched"
  | "dashboard"
  | "products"
  | "slots"
  | "boxes";

// ── Mochi Cost Calculator Component ───────────────────────────────
function MochiCostCalculator({
  expenses,
  period,
}: {
  expenses: Expense[];
  period: string;
}) {
  const [mochiCount, setMochiCount] = useState("100");
  const [boxCount, setBoxCount] = useState("10");

  const ingredientTotal = expenses
    .filter((e) => e.category === "ingredient")
    .reduce((sum, e) => sum + e.amount, 0);

  const packagingTotal = expenses
    .filter((e) => e.category === "packaging")
    .reduce((sum, e) => sum + e.amount, 0);

  const mochiNum = parseInt(mochiCount) || 0;
  const boxNum = parseInt(boxCount) || 0;

  const costPerMochi = mochiNum > 0 ? ingredientTotal / mochiNum : 0;
  const costPerBox = boxNum > 0 ? packagingTotal / boxNum : 0;
  const totalCostPerMochi =
    costPerMochi + (boxNum > 0 && mochiNum > 0 ? packagingTotal / mochiNum : 0);

  return (
    <div
      style={{
        background: T.white,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          color: T.muted,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          marginBottom: 14,
        }}
      >
        🍡 Mochi Cost Calculator
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.75rem",
              color: T.sub,
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Mochis produced
          </p>
          <input
            type="number"
            value={mochiCount}
            onChange={(e) => setMochiCount(e.target.value)}
            placeholder="e.g. 100"
            style={{
              width: "100%",
              background: "#f9f9f9",
              border: `1px solid ${T.border}`,
              color: T.text,
              padding: "9px 12px",
              borderRadius: 6,
              fontSize: "0.9rem",
              outline: "none",
              fontFamily: "system-ui, sans-serif",
            }}
          />
        </div>
        <div>
          <p
            style={{
              fontSize: "0.75rem",
              color: T.sub,
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Boxes used
          </p>
          <input
            type="number"
            value={boxCount}
            onChange={(e) => setBoxCount(e.target.value)}
            placeholder="e.g. 10"
            style={{
              width: "100%",
              background: "#f9f9f9",
              border: `1px solid ${T.border}`,
              color: T.text,
              padding: "9px 12px",
              borderRadius: 6,
              fontSize: "0.9rem",
              outline: "none",
              fontFamily: "system-ui, sans-serif",
            }}
          />
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
      >
        <div
          style={{
            background: "#e8f5e9",
            borderRadius: 8,
            padding: "12px 14px",
            textAlign: "center" as const,
          }}
        >
          <p
            style={{
              fontSize: "0.65rem",
              color: T.green,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              marginBottom: 6,
            }}
          >
            Ingredient Cost / Mochi
          </p>
          <p style={{ fontSize: "1.4rem", fontWeight: 700, color: T.green }}>
            ₹{costPerMochi.toFixed(2)}
          </p>
          <p style={{ fontSize: "0.68rem", color: T.muted, marginTop: 4 }}>
            ₹{ingredientTotal.toLocaleString()} ÷ {mochiNum || "?"}
          </p>
        </div>

        <div
          style={{
            background: "#e3f2fd",
            borderRadius: 8,
            padding: "12px 14px",
            textAlign: "center" as const,
          }}
        >
          <p
            style={{
              fontSize: "0.65rem",
              color: T.blue,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              marginBottom: 6,
            }}
          >
            Packaging Cost / Box
          </p>
          <p style={{ fontSize: "1.4rem", fontWeight: 700, color: T.blue }}>
            ₹{costPerBox.toFixed(2)}
          </p>
          <p style={{ fontSize: "0.68rem", color: T.muted, marginTop: 4 }}>
            ₹{packagingTotal.toLocaleString()} ÷ {boxNum || "?"}
          </p>
        </div>

        <div
          style={{
            background: "#fff8e6",
            borderRadius: 8,
            padding: "12px 14px",
            textAlign: "center" as const,
          }}
        >
          <p
            style={{
              fontSize: "0.65rem",
              color: T.gold,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              marginBottom: 6,
            }}
          >
            Total Cost / Mochi
          </p>
          <p style={{ fontSize: "1.4rem", fontWeight: 700, color: T.gold }}>
            ₹{totalCostPerMochi.toFixed(2)}
          </p>
          <p style={{ fontSize: "0.68rem", color: T.muted, marginTop: 4 }}>
            incl. packaging share
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Item-wise Purchase List Component ─────────────────────────────
function ItemWisePurchaseList({ expenses }: { expenses: Expense[] }) {
  const [expandedCat, setExpandedCat] = useState<string | null>("ingredient");

  // Group expenses by category
  const grouped: Record<string, Expense[]> = {};
  expenses.forEach((e) => {
    if (!grouped[e.category]) grouped[e.category] = [];
    grouped[e.category].push(e);
  });

  const categoryOrder = [
    "ingredient",
    "packaging",
    "equipment",
    "delivery",
    "other",
  ];
  const sortedCats = categoryOrder.filter((c) => grouped[c]?.length > 0);

  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div
      style={{
        background: T.white,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            color: T.muted,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
          }}
        >
          📋 Item-wise Purchase List
        </p>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: T.red }}>
          Total: ₹{grandTotal.toLocaleString()}
        </span>
      </div>

      {/* Category summary bars */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap" as const,
          marginBottom: 16,
        }}
      >
        {sortedCats.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
          const catTotal = grouped[cat].reduce((sum, e) => sum + e.amount, 0);
          const pct =
            grandTotal > 0 ? Math.round((catTotal / grandTotal) * 100) : 0;
          return (
            <button
              key={cat}
              onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 20,
                border: `1px solid ${expandedCat === cat ? cfg.color : T.border}`,
                background: expandedCat === cat ? cfg.bg : T.white,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "0.82rem" }}>{cfg.icon}</span>
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: cfg.color,
                }}
              >
                {cfg.label}
              </span>
              <span style={{ fontSize: "0.72rem", color: T.muted }}>
                ₹{catTotal.toLocaleString()}
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  color: cfg.color,
                  fontWeight: 700,
                }}
              >
                {pct}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Stacked bar chart */}
      {grandTotal > 0 && (
        <div
          style={{
            height: 8,
            borderRadius: 4,
            overflow: "hidden",
            display: "flex",
            marginBottom: 16,
          }}
        >
          {sortedCats.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
            const catTotal = grouped[cat].reduce((sum, e) => sum + e.amount, 0);
            const pct = (catTotal / grandTotal) * 100;
            return (
              <div
                key={cat}
                style={{
                  width: `${pct}%`,
                  background: cfg.color,
                  transition: "width 0.4s",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Expanded category items */}
      {expandedCat && grouped[expandedCat] && (
        <div
          style={{
            background: CATEGORY_CONFIG[expandedCat]?.bg || "#f5f5f5",
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: CATEGORY_CONFIG[expandedCat]?.color || T.sub,
              marginBottom: 10,
            }}
          >
            {CATEGORY_CONFIG[expandedCat]?.icon}{" "}
            {CATEGORY_CONFIG[expandedCat]?.label} —{" "}
            {grouped[expandedCat].length} items
          </p>
          {grouped[expandedCat]
            .sort((a, b) => b.amount - a.amount)
            .map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "7px 0",
                  borderBottom: `1px solid rgba(0,0,0,0.06)`,
                }}
              >
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      color: T.text,
                    }}
                  >
                    {e.description}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 2,
                    }}
                  >
                    <p style={{ fontSize: "0.7rem", color: T.muted }}>
                      {new Date(e.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    {e.note && (
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: CATEGORY_CONFIG[expandedCat]?.color || T.sub,
                          fontStyle: "italic" as const,
                        }}
                      >
                        {e.note}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: T.red,
                    flexShrink: 0,
                  }}
                >
                  ₹{e.amount.toLocaleString()}
                </span>
              </div>
            ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 10,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: CATEGORY_CONFIG[expandedCat]?.color,
              }}
            >
              Subtotal
            </span>
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: CATEGORY_CONFIG[expandedCat]?.color,
              }}
            >
              ₹
              {grouped[expandedCat]
                .reduce((sum, e) => sum + e.amount, 0)
                .toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {sortedCats.length === 0 && (
        <p style={{ fontSize: "0.88rem", color: T.muted, padding: "12px 0" }}>
          No expenses for this period
        </p>
      )}
    </div>
  );
}

// ── Packaging Breakdown Component ─────────────────────────────────
function PackagingBreakdown({ expenses }: { expenses: Expense[] }) {
  const packagingItems = expenses.filter((e) => e.category === "packaging");
  if (packagingItems.length === 0) return null;

  const total = packagingItems.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div
      style={{
        background: T.white,
        border: `2px solid #42a5f5`,
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            color: T.blue,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            fontWeight: 700,
          }}
        >
          📦 Packaging Costs (Separate)
        </p>
        <span
          style={{
            background: T.blueBg,
            color: T.blue,
            padding: "4px 12px",
            borderRadius: 12,
            fontSize: "0.88rem",
            fontWeight: 700,
          }}
        >
          ₹{total.toLocaleString()}
        </span>
      </div>
      {packagingItems
        .sort((a, b) => b.amount - a.amount)
        .map((e) => (
          <div
            key={e.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                {e.description}
              </p>
              <p style={{ fontSize: "0.7rem", color: T.muted }}>
                {new Date(e.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
                {e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
            <span
              style={{ fontSize: "0.9rem", fontWeight: 700, color: T.blue }}
            >
              ₹{e.amount.toLocaleString()}
            </span>
          </div>
        ))}
    </div>
  );
}

// ── Bulk Import JSON Component (Upload + Paste) ────────────────────
const EXAMPLE_JSON = `[
  {
    "description": "Glutinous rice flour 1kg",
    "amount": 180,
    "category": "ingredient",
    "date": "2025-04-20",
    "note": ""
  },
  {
    "description": "Mochi gift boxes x30",
    "amount": 420,
    "category": "packaging",
    "date": "2025-04-20",
    "note": "Packaging cost — calculate separately"
  }
]`;

function BulkImportJSON({
  onImport,
  onPaste,
}: {
  onImport: (file: File) => Promise<void>;
  onPaste: (text: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"upload" | "paste">("paste");
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [importing, setImporting] = useState(false);

  async function handlePasteImport() {
    setPasteError("");
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setPasteError("Paste some JSON first");
      return;
    }
    try {
      JSON.parse(trimmed);
    } catch {
      setPasteError("Invalid JSON — check for missing commas or brackets");
      return;
    }
    setImporting(true);
    try {
      await onPaste(trimmed);
      setPasteText("");
    } finally {
      setImporting(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    try {
      await onImport(f);
    } finally {
      setImporting(false);
      (e.target as HTMLInputElement).value = "";
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px solid ${T.border}`,
      }}
    >
      <p
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: T.sub,
          marginBottom: 10,
        }}
      >
        Bulk Import via JSON
      </p>

      {/* Mode toggle */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 14,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          overflow: "hidden",
          width: "fit-content",
        }}
      >
        {(["paste", "upload"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "7px 18px",
              border: "none",
              fontFamily: "system-ui, sans-serif",
              background: mode === m ? "#1976d2" : T.white,
              color: mode === m ? "#fff" : T.sub,
              fontSize: "0.8rem",
              fontWeight: mode === m ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {m === "paste" ? "Paste JSON" : "Upload File"}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <div>
          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPasteError("");
            }}
            placeholder={
              'Paste your JSON here...\n\nExample:\n[\n  {\n    "description": "Rice flour 1kg",\n    "amount": 180,\n    "category": "ingredient",\n    "date": "2025-04-20"\n  }\n]'
            }
            style={{
              width: "100%",
              minHeight: 140,
              background: "#f8f8f8",
              border: `1px solid ${pasteError ? T.red : T.border}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: "0.78rem",
              color: T.text,
              fontFamily: "monospace",
              resize: "vertical" as const,
              outline: "none",
              marginBottom: 8,
              boxSizing: "border-box" as const,
              lineHeight: 1.5,
            }}
          />
          {pasteError && (
            <p style={{ fontSize: "0.75rem", color: T.red, marginBottom: 8 }}>
              ⚠ {pasteError}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <button
              disabled={importing || !pasteText.trim()}
              onClick={handlePasteImport}
              style={{
                padding: "10px 24px",
                borderRadius: 6,
                border: "none",
                background: importing || !pasteText.trim() ? "#ccc" : "#1976d2",
                color: "#fff",
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor:
                  importing || !pasteText.trim() ? "not-allowed" : "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {importing ? "Importing..." : "Import JSON"}
            </button>
            {pasteText && !importing && (
              <button
                onClick={() => {
                  setPasteText("");
                  setPasteError("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                Clear
              </button>
            )}
          </div>
          <p style={{ fontSize: "0.7rem", color: T.muted }}>
            Categories: ingredient / packaging / delivery / equipment / other
          </p>
        </div>
      ) : (
        <div>
          <pre
            style={{
              background: "#f8f8f8",
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: "0.72rem",
              color: T.sub,
              marginBottom: 10,
              overflowX: "auto" as const,
            }}
          >
            {EXAMPLE_JSON}
          </pre>
          <p style={{ fontSize: "0.72rem", color: T.muted, marginBottom: 12 }}>
            Categories: ingredient / packaging / delivery / equipment / other
          </p>
          <label
            style={{
              display: "inline-block",
              padding: "9px 18px",
              borderRadius: 6,
              border: "1px solid #1976d2",
              background: importing ? "#f0f0f0" : T.blueBg,
              color: importing ? T.muted : "#1976d2",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: importing ? "not-allowed" : "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {importing ? "Importing..." : "Choose JSON File"}
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              disabled={importing}
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("es_admin") === "true") setAuthed(true);
  }, []);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");

  const [orders, setOrders] = useState<Order[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [repeatPhones, setRepeatPhones] = useState<Set<string>>(new Set());

  const [np, setNp] = useState({
    name: "",
    description: "",
    is_premium: false,
    image_url: "",
  });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [ep, setEp] = useState({
    name: "",
    description: "",
    is_premium: false,
    image_url: "",
  });
  const [ns, setNs] = useState({ label: "", date: "", max_orders: "10" });
  const [nb, setNb] = useState({ label: "", count: "", price: "" });
  const [ne, setNe] = useState({
    description: "",
    amount: "",
    category: "ingredient",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" }>({
    text: "",
    type: "success",
  });
  const [dashPeriod, setDashPeriod] = useState<
    "today" | "week" | "month" | "all"
  >("week");

  const productMap: Record<string, string> = {};
  products.forEach((p) => {
    productMap[p.id] = p.name;
  });

  const load = useCallback(async () => {
    const [{ data: o }, { data: s }, { data: p }, { data: b }, { data: ex }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("time_slots").select("*").order("date").order("label"),
        supabase.from("products").select("*").order("sort_order"),
        supabase.from("box_sizes").select("*").order("sort_order"),
        supabase
          .from("expenses")
          .select("*")
          .order("date", { ascending: false }),
      ]);
    if (o) {
      setOrders(o as Order[]);
      const counts: Record<string, number> = {};
      (o as Order[]).forEach((ord) => {
        counts[ord.phone] = (counts[ord.phone] || 0) + 1;
      });
      setRepeatPhones(
        new Set(
          Object.entries(counts)
            .filter(([, c]) => c > 1)
            .map(([ph]) => ph),
        ),
      );
    }
    if (s) setSlots(s as TimeSlot[]);
    if (p) setProducts(p as Product[]);
    if (b) setBoxes(b as BoxSize[]);
    if (ex) setExpenses(ex as Expense[]);
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  function flash(text: string, type: "success" | "error" = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 3500);
  }

  function getSlotLabel(slotId: string) {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return "—";
    return `${slot.label} · ${new Date(slot.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  }

  async function handleStatusChange(id: string, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) {
      flash("Error: " + error.message, "error");
      return;
    }
    await load();
    flash(`Marked as ${STATUS_LABELS[status]} ✓`);
  }

  async function handleCancel(id: string) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    await load();
    flash("Order cancelled");
  }

  async function handlePorterEmail(order: Order, slotLabel: string) {
    try {
      const res = await fetch("/api/porter-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: order.customer_name,
          phone: order.phone,
          address: order.address,
          slot: slotLabel,
          total_price: order.total_price,
        }),
      });
      if (res.ok) flash("📧 Porter reminder email sent ✓");
      else flash("Email send failed", "error");
    } catch {
      flash("Email send failed", "error");
    }
  }

  async function handleExpenseJSONText(text: string) {
    try {
      // Strip smart quotes and invisible characters that break JSON
      const cleaned = text
        .trim()
        .replace(/[\u201C\u201D]/g, '"') // smart double quotes
        .replace(/[\u2018\u2019]/g, "'") // smart single quotes
        .replace(/[\u00A0]/g, " ") // non-breaking spaces
        .replace(/^\uFEFF/, ""); // BOM character

      const data = JSON.parse(cleaned);
      const items = Array.isArray(data) ? data : data.expenses;
      if (!Array.isArray(items)) throw new Error("Expected a JSON array");

      const valid = items
        .filter(
          (e) =>
            e.description &&
            (typeof e.amount === "number" || typeof e.amount === "string") &&
            Number(e.amount) > 0,
        )
        .map((e) => ({
          description: String(e.description).trim(),
          amount: Number(e.amount),
          category: e.category || "ingredient",
          date: e.date || new Date().toISOString().split("T")[0],
          note: e.note || "",
        }));

      if (valid.length === 0)
        throw new Error(
          "No valid entries — check description and amount fields",
        );

      const { error } = await supabase.from("expenses").insert(valid);
      if (error) throw error;
      await load();
      flash(`${valid.length} expenses imported ✓`);
    } catch (err: unknown) {
      flash(
        `Import failed: ${err instanceof Error ? err.message : "Invalid JSON"}`,
        "error",
      );
    }
  }

  async function handleExpenseJSON(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data.expenses;
      if (!Array.isArray(items))
        throw new Error("Expected array or { expenses: [] }");

      const valid = items
        .filter(
          (e) =>
            typeof e.description === "string" &&
            typeof e.amount === "number" &&
            e.amount > 0,
        )
        .map((e) => ({
          description: e.description,
          amount: e.amount,
          category: e.category || "ingredient",
          date: e.date || new Date().toISOString().split("T")[0],
          note: e.note || "",
        }));

      if (valid.length === 0) throw new Error("No valid expense entries found");
      const { error } = await supabase.from("expenses").insert(valid);
      if (error) throw error;
      await load();
      flash(`${valid.length} expenses imported ✓`);
    } catch (err: unknown) {
      flash(
        `Import failed: ${err instanceof Error ? err.message : "Invalid file"}`,
        "error",
      );
    }
  }

  const PAID_STATUSES = [
    "confirmed",
    "cooking",
    "cooked",
    "porter_booked",
    "dispatched",
  ];

  function filterByPeriod<T extends { created_at: string }>(items: T[]): T[] {
    const now = new Date();
    return items.filter((item) => {
      const d = new Date(item.created_at);
      if (dashPeriod === "today")
        return d.toDateString() === now.toDateString();
      if (dashPeriod === "week")
        return now.getTime() - d.getTime() < 7 * 86400000;
      if (dashPeriod === "month")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return true;
    });
  }

  function filterExpByPeriod(items: Expense[]) {
    const now = new Date();
    return items.filter((item) => {
      const d = new Date(item.date);
      if (dashPeriod === "today")
        return d.toDateString() === now.toDateString();
      if (dashPeriod === "week")
        return now.getTime() - d.getTime() < 7 * 86400000;
      if (dashPeriod === "month")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return true;
    });
  }

  const paidOrders = filterByPeriod(
    orders.filter((o) => PAID_STATUSES.includes(o.status)),
  ) as Order[];
  const periodExpenses = filterExpByPeriod(expenses);

  const totalRevenue = paidOrders.reduce(
    (sum, o) => sum + (o.total_price || 0),
    0,
  );
  const totalExpenses = periodExpenses.reduce(
    (sum, e) => sum + (e.amount || 0),
    0,
  );
  const ingredientExpenses = periodExpenses
    .filter((e) => e.category === "ingredient")
    .reduce((sum, e) => sum + e.amount, 0);
  const packagingExpenses = periodExpenses
    .filter((e) => e.category === "packaging")
    .reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - totalExpenses;

  const flavourCounts: Record<string, number> = {};
  paidOrders.forEach((o) => {
    if (!o.flavours) return;
    Object.entries(o.flavours as Record<string, number>).forEach(
      ([id, qty]) => {
        const name = productMap[id] || id;
        flavourCounts[name] = (flavourCounts[name] || 0) + qty;
      },
    );
  });
  const topFlavours = Object.entries(flavourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const boxRevenue: Record<string, { count: number; revenue: number }> = {};
  paidOrders.forEach((o) => {
    const box = boxes.find((b) => b.id === o.box_size_id);
    const label = box?.label || "Unknown";
    if (!boxRevenue[label]) boxRevenue[label] = { count: 0, revenue: 0 };
    boxRevenue[label].count++;
    boxRevenue[label].revenue += o.total_price || 0;
  });

  const activeOrders = orders.filter(
    (o) => o.status !== "dispatched" && o.status !== "cancelled",
  );
  const dispatchedOrders = orders.filter((o) => o.status === "dispatched");
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  if (!authed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: T.bg,
          padding: 24,
        }}
      >
        <div
          style={{
            background: T.white,
            borderRadius: 12,
            padding: 32,
            width: "100%",
            maxWidth: 360,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            border: `1px solid ${T.border}`,
          }}
        >
          <h1
            style={{
              fontSize: "1.6rem",
              fontWeight: 700,
              color: T.text,
              marginBottom: 4,
            }}
          >
            Eversweet
          </h1>
          <p style={{ fontSize: "0.85rem", color: T.muted, marginBottom: 24 }}>
            Admin Panel
          </p>
          <Input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          {pwError && (
            <p style={{ fontSize: "0.82rem", color: T.red, marginBottom: 8 }}>
              Wrong password
            </p>
          )}
          <button
            onClick={() => {
              if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
                localStorage.setItem("es_admin", "true");
                setAuthed(true);
                setPwError(false);
              } else setPwError(true);
            }}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 6,
              border: "none",
              background: "#1976d2",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Sign In
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        background: T.bg,
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: T.text,
      }}
    >
      {/* Top nav */}
      <div
        style={{
          background: T.white,
          borderBottom: `1px solid ${T.border}`,
          padding: "0 20px",
          position: "sticky" as const,
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: T.text }}>
              Eversweet Admin
            </h1>
            {pendingCount > 0 && (
              <span
                style={{
                  background: "#f44336",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "2px 8px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                {pendingCount} new
              </span>
            )}
          </div>
          <button
            onClick={load}
            style={{
              background: "transparent",
              border: `1px solid ${T.border}`,
              color: T.sub,
              padding: "6px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 500,
            }}
          >
            ↻ Refresh
          </button>
        </div>
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "flex",
            gap: 0,
            overflowX: "auto" as const,
          }}
        >
          {(
            [
              { id: "orders", label: `Orders (${activeOrders.length})` },
              {
                id: "dispatched",
                label: `Dispatched (${dispatchedOrders.length})`,
              },
              { id: "dashboard", label: "📊 Dashboard" },
              { id: "products", label: "Products" },
              { id: "slots", label: "Slots" },
              { id: "boxes", label: "Boxes" },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "12px 18px",
                background: "transparent",
                border: "none",
                borderBottom:
                  tab === t.id ? "2px solid #1976d2" : "2px solid transparent",
                color: tab === t.id ? "#1976d2" : T.muted,
                fontSize: "0.82rem",
                fontWeight: tab === t.id ? 700 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap" as const,
                fontFamily: "system-ui, sans-serif",
                transition: "all 0.15s",
              }}
            >
              {t.label}
              {t.id === "orders" && pendingCount > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: "#f44336",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 6px",
                    fontSize: "0.62rem",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 80px" }}
      >
        {msg.text && (
          <div
            style={{
              background: msg.type === "error" ? T.redBg : T.greenBg,
              border: `1px solid ${msg.type === "error" ? "#ef9a9a" : "#a5d6a7"}`,
              color: msg.type === "error" ? T.red : T.green,
              padding: "10px 16px",
              borderRadius: 6,
              fontSize: "0.88rem",
              marginBottom: 16,
              fontWeight: 500,
            }}
          >
            {msg.text}
          </div>
        )}

        {tab === "orders" && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 16,
                overflowX: "auto" as const,
                paddingBottom: 4,
              }}
            >
              {STATUS_FLOW.map((s, i) => (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "3px 8px",
                      borderRadius: 10,
                      background: STATUS_COLORS[s].bg,
                      color: STATUS_COLORS[s].text,
                      fontWeight: 600,
                      border: `1px solid ${STATUS_COLORS[s].border}`,
                    }}
                  >
                    {STATUS_LABELS[s]}
                  </span>
                  {i < STATUS_FLOW.length - 1 && (
                    <span style={{ color: T.muted, fontSize: "0.7rem" }}>
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
            {activeOrders.length === 0 ? (
              <div
                style={{
                  background: T.white,
                  borderRadius: 8,
                  padding: 48,
                  textAlign: "center" as const,
                  border: `1px solid ${T.border}`,
                }}
              >
                <p style={{ fontSize: "2rem", marginBottom: 8 }}>✓</p>
                <p style={{ color: T.muted, fontSize: "0.9rem" }}>
                  All caught up — no active orders
                </p>
              </div>
            ) : (
              activeOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  isRepeat={repeatPhones.has(o.phone)}
                  slotLabel={getSlotLabel(o.time_slot_id)}
                  productMap={productMap}
                  onStatusChange={handleStatusChange}
                  onCancel={handleCancel}
                  onPorterEmail={handlePorterEmail}
                />
              ))
            )}
          </div>
        )}

        {tab === "dispatched" && (
          <div>
            <p style={{ fontSize: "0.8rem", color: T.muted, marginBottom: 14 }}>
              {dispatchedOrders.length} dispatched order
              {dispatchedOrders.length !== 1 ? "s" : ""}
            </p>
            {dispatchedOrders.length === 0 ? (
              <div
                style={{
                  background: T.white,
                  borderRadius: 8,
                  padding: 48,
                  textAlign: "center" as const,
                  border: `1px solid ${T.border}`,
                }}
              >
                <p style={{ color: T.muted }}>No dispatched orders yet</p>
              </div>
            ) : (
              dispatchedOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    background: T.white,
                    border: `1px solid ${T.border}`,
                    borderLeft: "4px solid #43a047",
                    borderRadius: 8,
                    padding: "12px 16px",
                    marginBottom: 8,
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                          {o.customer_name}
                        </p>
                        {repeatPhones.has(o.phone) && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: T.blue,
                              background: T.blueBg,
                              padding: "1px 7px",
                              borderRadius: 10,
                              fontWeight: 600,
                            }}
                          >
                            🔄
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "0.82rem", color: T.sub }}>
                        {o.phone} ·{" "}
                        <span style={{ color: T.gold, fontWeight: 600 }}>
                          ₹{o.total_price}
                        </span>
                      </p>
                      {o.address && (
                        <p style={{ fontSize: "0.8rem", color: T.muted }}>
                          📍 {o.address}
                        </p>
                      )}
                      <p
                        style={{
                          fontSize: "0.72rem",
                          color: T.muted,
                          marginTop: 3,
                        }}
                      >
                        {getSlotLabel(o.time_slot_id)}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        padding: "3px 9px",
                        borderRadius: 10,
                        background: T.greenBg,
                        color: T.green,
                        fontWeight: 700,
                      }}
                    >
                      ✓ Done
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── DASHBOARD ──────────────────────────────────────── */}
        {tab === "dashboard" && (
          <div>
            {/* Period selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["today", "week", "month", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setDashPeriod(p)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor: dashPeriod === p ? "#1976d2" : T.border,
                    background: dashPeriod === p ? "#1976d2" : T.white,
                    color: dashPeriod === p ? "#fff" : T.sub,
                    fontSize: "0.8rem",
                    fontWeight: dashPeriod === p ? 600 : 400,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {p === "all"
                    ? "All Time"
                    : p === "week"
                      ? "This Week"
                      : p === "month"
                        ? "This Month"
                        : "Today"}
                </button>
              ))}
            </div>

            <p
              style={{ fontSize: "0.72rem", color: T.muted, marginBottom: 16 }}
            >
              * Revenue counts confirmed orders only (excludes pending &amp;
              cancelled)
            </p>

            {/* Stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <StatCard
                label="Revenue"
                value={`₹${totalRevenue.toLocaleString()}`}
                sub={`${paidOrders.length} confirmed orders`}
                color="#1976d2"
              />
              <StatCard
                label="Total Expenses"
                value={`₹${totalExpenses.toLocaleString()}`}
                sub={`${periodExpenses.length} entries`}
                color={T.red}
              />
              <StatCard
                label="Profit"
                value={`₹${profit.toLocaleString()}`}
                sub={profit >= 0 ? "↑ Net positive" : "↓ Net negative"}
                color={profit >= 0 ? T.green : T.red}
              />
              <StatCard
                label="Avg Order"
                value={
                  paidOrders.length > 0
                    ? `₹${Math.round(totalRevenue / paidOrders.length)}`
                    : "—"
                }
                sub="per order"
                color={T.text}
              />
            </div>

            {/* Expense category quick stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: "#e8f5e9",
                  border: "1px solid #a5d6a7",
                  borderRadius: 8,
                  padding: "14px 16px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.68rem",
                    color: T.green,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  🧪 Ingredient Cost
                </p>
                <p
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: T.green,
                  }}
                >
                  ₹{ingredientExpenses.toLocaleString()}
                </p>
                <p style={{ fontSize: "0.72rem", color: T.muted }}>
                  {totalExpenses > 0
                    ? Math.round((ingredientExpenses / totalExpenses) * 100)
                    : 0}
                  % of expenses
                </p>
              </div>
              <div
                style={{
                  background: "#e3f2fd",
                  border: "1px solid #90caf9",
                  borderRadius: 8,
                  padding: "14px 16px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.68rem",
                    color: T.blue,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  📦 Packaging Cost
                </p>
                <p
                  style={{ fontSize: "1.5rem", fontWeight: 700, color: T.blue }}
                >
                  ₹{packagingExpenses.toLocaleString()}
                </p>
                <p style={{ fontSize: "0.72rem", color: T.muted }}>
                  {totalExpenses > 0
                    ? Math.round((packagingExpenses / totalExpenses) * 100)
                    : 0}
                  % of expenses
                </p>
              </div>
            </div>

            {/* Mochi Cost Calculator */}
            <MochiCostCalculator
              expenses={periodExpenses}
              period={dashPeriod}
            />

            {/* Item-wise purchase list */}
            <ItemWisePurchaseList expenses={periodExpenses} />

            {/* Packaging breakdown (separate) */}
            <PackagingBreakdown expenses={periodExpenses} />

            {/* Customers */}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "16px 18px",
                marginBottom: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  color: T.muted,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  marginBottom: 12,
                }}
              >
                Customers
              </p>
              <div style={{ display: "flex", gap: 32 }}>
                <div>
                  <p
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 700,
                      color: "#1976d2",
                    }}
                  >
                    {new Set(paidOrders.map((o) => o.phone)).size}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: T.muted }}>Unique</p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 700,
                      color: T.blue,
                    }}
                  >
                    {repeatPhones.size}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: T.muted }}>
                    Repeat 🔄
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 700,
                      color: T.green,
                    }}
                  >
                    {orders.filter((o) => o.status === "dispatched").length}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: T.muted }}>
                    Delivered
                  </p>
                </div>
              </div>
            </div>

            {/* Top flavours */}
            {topFlavours.length > 0 && (
              <div
                style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "16px 18px",
                  marginBottom: 16,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: T.muted,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 14,
                  }}
                >
                  Top Flavours
                </p>
                {topFlavours.map(([name, count], i) => {
                  const max = topFlavours[0][1];
                  return (
                    <div key={name} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.88rem",
                            fontWeight: i === 0 ? 700 : 400,
                            color: T.text,
                          }}
                        >
                          {name}
                        </span>
                        <span style={{ fontSize: "0.82rem", color: T.muted }}>
                          {count} pieces
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: "#f0f0f0",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(count / max) * 100}%`,
                            background: i === 0 ? "#1976d2" : "#90caf9",
                            borderRadius: 3,
                            transition: "width 0.4s",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Box size breakdown */}
            {Object.keys(boxRevenue).length > 0 && (
              <div
                style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "16px 18px",
                  marginBottom: 16,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: T.muted,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 14,
                  }}
                >
                  Sales by Box Size
                </p>
                {Object.entries(boxRevenue)
                  .sort(([, a], [, b]) => b.revenue - a.revenue)
                  .map(([label, data]) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                        {label}
                      </span>
                      <div style={{ textAlign: "right" as const }}>
                        <p
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: "#1976d2",
                          }}
                        >
                          ₹{data.revenue.toLocaleString()}
                        </p>
                        <p style={{ fontSize: "0.72rem", color: T.muted }}>
                          {data.count} order{data.count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Expense log + add form */}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "16px 18px",
                marginBottom: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  color: T.muted,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  marginBottom: 14,
                }}
              >
                All Expense Entries
              </p>

              {periodExpenses.length === 0 ? (
                <p
                  style={{
                    fontSize: "0.88rem",
                    color: T.muted,
                    padding: "12px 0",
                  }}
                >
                  No expenses for this period
                </p>
              ) : (
                periodExpenses.map((e) => {
                  const cfg =
                    CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.other;
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.65rem",
                              padding: "2px 7px",
                              borderRadius: 10,
                              background: cfg.bg,
                              color: cfg.color,
                              fontWeight: 600,
                            }}
                          >
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                          {e.description}
                        </p>
                        <p style={{ fontSize: "0.72rem", color: T.muted }}>
                          {new Date(e.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                          {e.note ? ` · ${e.note}` : ""}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: T.red,
                          }}
                        >
                          ₹{e.amount}
                        </span>
                        <button
                          onClick={async () => {
                            await supabase
                              .from("expenses")
                              .delete()
                              .eq("id", e.id);
                            load();
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: T.muted,
                            cursor: "pointer",
                            fontSize: "1rem",
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Add expense form */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                <p
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: T.sub,
                    marginBottom: 10,
                  }}
                >
                  Add Expense
                </p>
                <Input
                  placeholder="Description (e.g. Mango pulp 2kg) *"
                  value={ne.description}
                  onChange={(v) => setNe((e) => ({ ...e, description: v }))}
                />
                <Input
                  placeholder="Amount ₹ *"
                  type="number"
                  value={ne.amount}
                  onChange={(v) => setNe((e) => ({ ...e, amount: v }))}
                />
                <Input
                  placeholder="Note (optional)"
                  value={ne.note}
                  onChange={(v) => setNe((e) => ({ ...e, note: v }))}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <select
                    value={ne.category}
                    onChange={(e) =>
                      setNe((n) => ({ ...n, category: e.target.value }))
                    }
                    style={{
                      background: T.white,
                      border: `1px solid ${T.border}`,
                      color: T.text,
                      padding: "10px 12px",
                      borderRadius: 6,
                      fontSize: "0.88rem",
                      marginBottom: 8,
                      fontFamily: "system-ui, sans-serif",
                      outline: "none",
                    }}
                  >
                    <option value="ingredient">🧪 Ingredient</option>
                    <option value="packaging">📦 Packaging</option>
                    <option value="delivery">🚚 Delivery</option>
                    <option value="equipment">🔧 Equipment</option>
                    <option value="other">📋 Other</option>
                  </select>
                  <Input
                    type="date"
                    placeholder="Date"
                    value={ne.date}
                    onChange={(v) => setNe((e) => ({ ...e, date: v }))}
                  />
                </div>
                <button
                  disabled={saving || !ne.description || !ne.amount}
                  onClick={async () => {
                    setSaving(true);
                    await supabase.from("expenses").insert({
                      description: ne.description,
                      amount: Number(ne.amount),
                      category: ne.category,
                      date: ne.date,
                      note: ne.note,
                    });
                    setNe({
                      description: "",
                      amount: "",
                      category: "ingredient",
                      date: new Date().toISOString().split("T")[0],
                      note: "",
                    });
                    await load();
                    setSaving(false);
                    flash("Expense added ✓");
                  }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 6,
                    border: "none",
                    background:
                      saving || !ne.description || !ne.amount
                        ? "#ccc"
                        : "#1976d2",
                    color: "#fff",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    cursor:
                      saving || !ne.description || !ne.amount
                        ? "not-allowed"
                        : "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {saving ? "Adding…" : "Add Expense"}
                </button>
              </div>

              {/* JSON bulk upload / paste */}
              <BulkImportJSON
                onImport={handleExpenseJSON}
                onPaste={handleExpenseJSONText}
              />
            </div>
          </div>
        )}

        {/* ── PRODUCTS ───────────────────────────────────────── */}
        {tab === "products" && (
          <div>
            <p style={{ fontSize: "0.8rem", color: T.muted, marginBottom: 14 }}>
              Products ({products.length})
            </p>
            {products.map((prod) => (
              <div
                key={prod.id}
                style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  marginBottom: 8,
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {editingProduct === prod.id ? (
                  <div style={{ padding: "16px" }}>
                    <p
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: T.sub,
                        marginBottom: 12,
                      }}
                    >
                      Editing: {prod.name}
                    </p>
                    <Input
                      placeholder="Name *"
                      value={ep.name}
                      onChange={(v) => setEp((p) => ({ ...p, name: v }))}
                    />
                    <Input
                      placeholder="Description"
                      value={ep.description}
                      onChange={(v) => setEp((p) => ({ ...p, description: v }))}
                    />
                    <Input
                      placeholder="Image URL"
                      value={ep.image_url}
                      onChange={(v) => setEp((p) => ({ ...p, image_url: v }))}
                    />
                    {ep.image_url && (
                      <img
                        src={ep.image_url}
                        alt="preview"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 6,
                          marginBottom: 10,
                          border: `1px solid ${T.border}`,
                        }}
                      />
                    )}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: "0.88rem",
                        marginBottom: 14,
                        cursor: "pointer",
                        color: T.text,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={ep.is_premium}
                        onChange={(e) =>
                          setEp((p) => ({ ...p, is_premium: e.target.checked }))
                        }
                        style={{ width: "auto", accentColor: "#1976d2" }}
                      />
                      Premium
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          await supabase
                            .from("products")
                            .update({
                              name: ep.name,
                              description: ep.description,
                              is_premium: ep.is_premium,
                              image_url: ep.image_url || null,
                            })
                            .eq("id", prod.id);
                          setEditingProduct(null);
                          await load();
                          setSaving(false);
                          flash(`${ep.name} updated ✓`);
                        }}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: 6,
                          border: "none",
                          background: "#1976d2",
                          color: "#fff",
                          fontSize: "0.88rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "system-ui, sans-serif",
                        }}
                      >
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                      <Btn onClick={() => setEditingProduct(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                    }}
                  >
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 8,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 8,
                          background: "#f5f5f5",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.5rem",
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        🍡
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.92rem", fontWeight: 700 }}>
                        {prod.name}
                      </p>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: T.muted,
                          lineHeight: 1.4,
                          marginBottom: 3,
                        }}
                      >
                        {prod.description || <em>No description</em>}
                      </p>
                      <p style={{ fontSize: "0.75rem" }}>
                        {prod.is_premium ? (
                          <span style={{ color: T.gold, fontWeight: 600 }}>
                            ★ Premium
                          </span>
                        ) : (
                          <span style={{ color: T.muted }}>Regular</span>
                        )}
                        {" · "}
                        <span
                          style={{
                            color: prod.is_available ? T.green : T.red,
                            fontWeight: 600,
                          }}
                        >
                          {prod.is_available ? "Visible" : "Hidden"}
                        </span>
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 5,
                      }}
                    >
                      <Btn
                        variant="primary"
                        onClick={() => {
                          setEditingProduct(prod.id);
                          setEp({
                            name: prod.name,
                            description: prod.description || "",
                            is_premium: prod.is_premium,
                            image_url: prod.image_url || "",
                          });
                        }}
                      >
                        Edit
                      </Btn>
                      <Btn
                        onClick={async () => {
                          await supabase
                            .from("products")
                            .update({ is_available: !prod.is_available })
                            .eq("id", prod.id);
                          load();
                        }}
                      >
                        {prod.is_available ? "Hide" : "Show"}
                      </Btn>
                      <Btn
                        variant="danger"
                        onClick={async () => {
                          if (!confirm(`Delete ${prod.name}?`)) return;
                          await supabase
                            .from("products")
                            .delete()
                            .eq("id", prod.id);
                          load();
                        }}
                      >
                        ✕
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: 16,
                marginTop: 8,
              }}
            >
              <p
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: T.sub,
                  marginBottom: 12,
                }}
              >
                Add Product
              </p>
              <Input
                placeholder="Name *"
                value={np.name}
                onChange={(v) => setNp((p) => ({ ...p, name: v }))}
              />
              <Input
                placeholder="Description"
                value={np.description}
                onChange={(v) => setNp((p) => ({ ...p, description: v }))}
              />
              <Input
                placeholder="Image URL"
                value={np.image_url}
                onChange={(v) => setNp((p) => ({ ...p, image_url: v }))}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.88rem",
                  marginBottom: 14,
                  cursor: "pointer",
                  color: T.text,
                }}
              >
                <input
                  type="checkbox"
                  checked={np.is_premium}
                  onChange={(e) =>
                    setNp((p) => ({ ...p, is_premium: e.target.checked }))
                  }
                  style={{ width: "auto", accentColor: "#1976d2" }}
                />
                Premium
              </label>
              <button
                disabled={saving || !np.name}
                onClick={async () => {
                  setSaving(true);
                  await supabase.from("products").insert({
                    name: np.name,
                    description: np.description,
                    price: 0,
                    is_premium: np.is_premium,
                    image_url: np.image_url || null,
                    sort_order: products.length + 1,
                  });
                  setNp({
                    name: "",
                    description: "",
                    is_premium: false,
                    image_url: "",
                  });
                  await load();
                  setSaving(false);
                  flash("Product added ✓");
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 6,
                  border: "none",
                  background: saving || !np.name ? "#ccc" : "#1976d2",
                  color: "#fff",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: saving || !np.name ? "not-allowed" : "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {saving ? "Adding…" : "Add Product"}
              </button>
            </div>
          </div>
        )}

        {/* ── SLOTS ──────────────────────────────────────────── */}
        {tab === "slots" && (
          <div>
            <p style={{ fontSize: "0.8rem", color: T.muted, marginBottom: 14 }}>
              Time Slots ({slots.length})
            </p>
            {slots.map((s) => (
              <div
                key={s.id}
                style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div>
                  <p style={{ fontSize: "0.92rem", fontWeight: 700 }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: T.muted }}>
                    {new Date(s.date).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {s.current_orders}/{s.max_orders} orders ·{" "}
                    <span
                      style={{
                        color: s.is_active ? T.green : T.red,
                        fontWeight: 600,
                      }}
                    >
                      {s.is_active ? "Active" : "Disabled"}
                    </span>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn
                    variant={s.is_active ? "danger" : "primary"}
                    onClick={async () => {
                      await supabase
                        .from("time_slots")
                        .update({ is_active: !s.is_active })
                        .eq("id", s.id);
                      load();
                    }}
                  >
                    {s.is_active ? "Disable" : "Enable"}
                  </Btn>
                  <Btn
                    variant="danger"
                    onClick={async () => {
                      if (!confirm("Delete slot?")) return;
                      await supabase.from("time_slots").delete().eq("id", s.id);
                      load();
                    }}
                  >
                    ✕
                  </Btn>
                </div>
              </div>
            ))}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: 16,
                marginTop: 8,
              }}
            >
              <p
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: T.sub,
                  marginBottom: 12,
                }}
              >
                Add Slot
              </p>
              <Input
                placeholder="Label (e.g. 5:00 PM – 6:00 PM) *"
                value={ns.label}
                onChange={(v) => setNs((s) => ({ ...s, label: v }))}
              />
              <Input
                type="date"
                placeholder="Date *"
                value={ns.date}
                onChange={(v) => setNs((s) => ({ ...s, date: v }))}
              />
              <Input
                type="number"
                placeholder="Max orders (default 10)"
                value={ns.max_orders}
                onChange={(v) => setNs((s) => ({ ...s, max_orders: v }))}
              />
              <button
                disabled={saving || !ns.label || !ns.date}
                onClick={async () => {
                  setSaving(true);
                  await supabase.from("time_slots").insert({
                    label: ns.label,
                    date: ns.date,
                    max_orders: Number(ns.max_orders) || 10,
                    current_orders: 0,
                    is_active: true,
                  });
                  setNs({ label: "", date: "", max_orders: "10" });
                  await load();
                  setSaving(false);
                  flash("Slot added ✓");
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 6,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {saving ? "Adding…" : "Add Slot"}
              </button>
            </div>
          </div>
        )}

        {/* ── BOXES ──────────────────────────────────────────── */}
        {tab === "boxes" && (
          <div>
            <p style={{ fontSize: "0.8rem", color: T.muted, marginBottom: 14 }}>
              Box Sizes ({boxes.length})
            </p>
            {boxes.map((box) => (
              <div
                key={box.id}
                style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div>
                  <p style={{ fontSize: "0.92rem", fontWeight: 700 }}>
                    {box.label}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: T.muted }}>
                    {box.count} pieces · ₹{box.price} ·{" "}
                    <span
                      style={{
                        color: box.is_active ? T.green : T.red,
                        fontWeight: 600,
                      }}
                    >
                      {box.is_active ? "Active" : "Hidden"}
                    </span>
                  </p>
                </div>
                <Btn
                  onClick={async () => {
                    await supabase
                      .from("box_sizes")
                      .update({ is_active: !box.is_active })
                      .eq("id", box.id);
                    load();
                  }}
                >
                  {box.is_active ? "Hide" : "Show"}
                </Btn>
              </div>
            ))}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: 16,
                marginTop: 8,
              }}
            >
              <p
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: T.sub,
                  marginBottom: 12,
                }}
              >
                Add Box Size
              </p>
              <Input
                placeholder="Label (e.g. Box of 20) *"
                value={nb.label}
                onChange={(v) => setNb((b) => ({ ...b, label: v }))}
              />
              <Input
                type="number"
                placeholder="Pieces *"
                value={nb.count}
                onChange={(v) => setNb((b) => ({ ...b, count: v }))}
              />
              <Input
                type="number"
                placeholder="Price ₹ *"
                value={nb.price}
                onChange={(v) => setNb((b) => ({ ...b, price: v }))}
              />
              <button
                disabled={saving || !nb.label || !nb.count || !nb.price}
                onClick={async () => {
                  setSaving(true);
                  await supabase.from("box_sizes").insert({
                    label: nb.label,
                    count: Number(nb.count),
                    price: Number(nb.price),
                    is_active: true,
                    sort_order: boxes.length + 1,
                  });
                  setNb({ label: "", count: "", price: "" });
                  await load();
                  setSaving(false);
                  flash("Box size added ✓");
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 6,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {saving ? "Adding…" : "Add Box Size"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
