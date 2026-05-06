"use client";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 1 — IMPORTS & TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize, Order } from "@/lib/types";

type Tab =
  | "cook"
  | "pending_payment"
  | "dispatched"
  | "customers"
  | "dashboard"
  | "more";
type MoreTab = "products" | "boxes";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  created_at: string;
};

type ExtOrder = Order & {
  insta_id?: string;
  remarks?: string;
  source?: string;
  order_date?: string;
  delivery_date?: string;
  delivery_slot?: string; // e.g. "1–3 PM" — customer-chosen time window
  batch_label?: string;
  fulfillment_type?: string;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 2 — CONSTANTS & CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TRACKING_START_DATE = "2026-04-21";

// All delivery time slots (customer-facing, 2-hour windows)
const ALL_SLOTS = [
  "9–11 AM",
  "11–1 PM",
  "1–3 PM",
  "3–5 PM",
  "5–7 PM",
  "7–9 PM",
  "9–11 PM",
  "11 PM–12 AM",
];

const STATUS_FLOW = [
  "pending",
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Payment Pending",
  confirmed: "Confirmed",
  cooking: "Cooking",
  cooked: "Cooked ✓",
  porter_booked: "Porter Booked",
  dispatched: "Dispatched",
  cancelled: "Cancelled",
};

const PAID_STATUSES = [
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
];

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  ingredient: { label: "Ingredients", icon: "🧪" },
  packaging: { label: "Packaging", icon: "📦" },
  equipment: { label: "Equipment", icon: "🔧" },
  delivery: { label: "Delivery", icon: "🚚" },
  fixed: { label: "Fixed Cost", icon: "🏠" },
  marketing: { label: "Marketing", icon: "📣" },
  other: { label: "Other", icon: "📋" },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 3 — DESIGN TOKENS (G)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const G = {
  pageBg: "#0d1520",
  navBg: "rgba(8,15,26,0.96)",
  navBorder: "rgba(255,255,255,0.06)",
  glass: "rgba(255,255,255,0.035)",
  glassHover: "rgba(255,255,255,0.06)",
  glassStrong: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderStrong: "rgba(255,255,255,0.14)",
  text: "#f0f4ff",
  sub: "#a8b4cc",
  muted: "#5a6a80",
  gold: "#f0b040",
  goldGlass: "rgba(240,176,64,0.13)",
  goldBorder: "rgba(240,176,64,0.35)",
  green: "#34d97b",
  greenGlass: "rgba(52,217,123,0.1)",
  red: "#ff5c6c",
  redGlass: "rgba(255,92,108,0.1)",
  blue: "#60a5fa",
  blueGlass: "rgba(96,165,250,0.1)",
  purple: "#a78bfa",
  purpleGlass: "rgba(167,139,250,0.1)",
  active: "#60a5fa",
};

// Flavour colour map — used for pills and big-number cards
const FLAVOUR_COLORS: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  strawberry: {
    bg: "#2a0d0d",
    border: "#791f1f",
    text: "#f09595",
    dot: "#e24b4a",
  },
  mango: { bg: "#271908", border: "#633806", text: "#fac775", dot: "#ef9f27" },
  blueberry: {
    bg: "#0e1230",
    border: "#26215c",
    text: "#afa9ec",
    dot: "#7f77dd",
  },
  kiwi: { bg: "#0e1e0e", border: "#173404", text: "#c0dd97", dot: "#639922" },
  lychee: { bg: "#280e1c", border: "#4b1528", text: "#ed93b1", dot: "#d4537e" },
  biscoff: {
    bg: "#271808",
    border: "#412402",
    text: "#fac775",
    dot: "#ba7517",
  },
  hazelnut: {
    bg: "#1e1006",
    border: "#412402",
    text: "#fac775",
    dot: "#854f0b",
  },
  chococrisp: {
    bg: "#150e06",
    border: "#2c1a06",
    text: "#d4a472",
    dot: "#85501e",
  },
  coffeecrisp: {
    bg: "#150e06",
    border: "#2c1a06",
    text: "#c9a06a",
    dot: "#7a4810",
  },
  kitkat: { bg: "#2a0a0a", border: "#6b1414", text: "#f09595", dot: "#c81e1e" },
  nutella: {
    bg: "#1e0e06",
    border: "#3c1e0a",
    text: "#d4a472",
    dot: "#784014",
  },
  passion: {
    bg: "#1e0a1e",
    border: "#4b0e4b",
    text: "#cc82cc",
    dot: "#b41eb4",
  },
  default: {
    bg: "#141e2e",
    border: "#2a3a50",
    text: "#a8b4cc",
    dot: "#6a7a90",
  },
};

function getFlavourColor(name: string) {
  const n = name.toLowerCase();
  for (const [key, val] of Object.entries(FLAVOUR_COLORS)) {
    if (n.includes(key)) return val;
  }
  return FLAVOUR_COLORS.default;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 4 — SHARED UI PRIMITIVES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GlassInput({
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
        background: G.glass,
        border: `1px solid ${G.glassBorder}`,
        color: G.text,
        padding: "11px 14px",
        borderRadius: 10,
        fontSize: "0.9rem",
        marginBottom: 8,
        outline: "none",
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box" as const,
      }}
    />
  );
}

function GlassBtn({
  children,
  onClick,
  variant = "default",
  disabled = false,
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "success" | "gold";
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: G.glass,
      color: G.sub,
      border: `1px solid ${G.glassBorder}`,
    },
    primary: {
      background: G.blueGlass,
      color: G.blue,
      border: `1px solid rgba(96,165,250,0.35)`,
    },
    danger: {
      background: G.redGlass,
      color: G.red,
      border: `1px solid rgba(255,92,108,0.3)`,
    },
    success: {
      background: G.greenGlass,
      color: G.green,
      border: `1px solid rgba(52,217,123,0.3)`,
    },
    gold: {
      background: G.goldGlass,
      color: G.gold,
      border: `1px solid ${G.goldBorder}`,
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "7px 16px",
        borderRadius: 8,
        fontSize: "0.8rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s",
        fontFamily: "system-ui, sans-serif",
        whiteSpace: "nowrap" as const,
        width: fullWidth ? "100%" : undefined,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        if (!value) return;
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      style={{
        padding: "3px 9px",
        borderRadius: 6,
        flexShrink: 0,
        border: `1px solid ${copied ? G.green + "50" : G.glassBorder}`,
        background: copied ? G.greenGlass : G.glass,
        color: copied ? G.green : G.muted,
        fontSize: "0.68rem",
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ Copied" : `Copy ${label}`}
    </button>
  );
}

function GlassStatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: G.glass,
        border: `1px solid ${G.glassBorder}`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <p
        style={{
          fontSize: "0.62rem",
          color: G.muted,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "1.6rem",
          fontWeight: 700,
          color: color || G.text,
          lineHeight: 1,
          marginBottom: 3,
        }}
      >
        {value}
      </p>
      {sub && <p style={{ fontSize: "0.7rem", color: G.muted }}>{sub}</p>}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 5 — FLAVOUR PILL (shared between cook view & order cards)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function FlavourPill({
  name,
  qty,
  large = false,
}: {
  name: string;
  qty: number;
  large?: boolean;
}) {
  const c = getFlavourColor(name);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: large ? "7px 14px 7px 10px" : "5px 11px 5px 8px",
        borderRadius: 20,
        background: c.bg,
        border: `1px solid ${c.border}`,
        marginRight: 5,
        marginBottom: 5,
      }}
    >
      <div
        style={{
          width: large ? 11 : 9,
          height: large ? 11 : 9,
          borderRadius: "50%",
          background: c.dot,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: large ? "0.95rem" : "0.82rem",
          fontWeight: 700,
          color: c.text,
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: large ? "0.9rem" : "0.78rem",
          fontWeight: 700,
          color: c.dot,
          background: `${c.dot}20`,
          padding: "0 5px",
          borderRadius: 6,
        }}
      >
        ×{qty}
      </span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 6 — COOK VIEW: BIG FLAVOUR SUMMARY CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function FlavourBigCard({ name, qty }: { name: string; qty: number }) {
  const c = getFlavourColor(name);
  return (
    <div
      style={{
        background: c.bg,
        border: `1.5px solid ${c.border}`,
        borderRadius: 10,
        padding: "16px 8px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: "#fff" }}
      >
        {qty}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: c.text,
          textAlign: "center" as const,
        }}
      >
        {name}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 7 — COOK VIEW: SLOT TABS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SlotTabs({
  slots,
  activeSlot,
  onSelect,
}: {
  slots: {
    label: string;
    count: number;
    status: "done" | "active" | "upcoming";
  }[];
  activeSlot: string;
  onSelect: (slot: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "12px 14px 0",
        overflowX: "auto" as const,
        scrollbarWidth: "none" as const,
      }}
    >
      {slots.map((s) => {
        const isActive = s.label === activeSlot;
        const isDone = s.status === "done";
        return (
          <div
            key={s.label}
            onClick={() => !isDone && onSelect(s.label)}
            style={{
              flexShrink: 0,
              padding: "8px 13px",
              borderRadius: 20,
              cursor: isDone ? "default" : "pointer",
              textAlign: "center" as const,
              border: `1.5px solid ${isActive ? "#378add" : isDone ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
              background: isActive
                ? "#163354"
                : isDone
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(255,255,255,0.03)",
              transition: "all 0.15s",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: isActive
                  ? "#fff"
                  : isDone
                    ? "rgba(255,255,255,0.22)"
                    : "rgba(255,255,255,0.4)",
                textDecoration: isDone ? "line-through" : "none",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 10,
                marginTop: 2,
                color: isActive
                  ? "#85b7eb"
                  : isDone
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.22)",
              }}
            >
              {isDone
                ? "✓ done"
                : s.count > 0
                  ? `${s.count} order${s.count !== 1 ? "s" : ""}`
                  : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 8 — COOK VIEW: ORDER CARD (lean, cook-optimised)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CookOrderCard({
  order,
  productMap,
  boxes,
  onPorterBook,
  onDispatch,
}: {
  order: ExtOrder;
  productMap: Record<string, string>;
  boxes: BoxSize[];
  onPorterBook: (order: ExtOrder) => Promise<void>;
  onDispatch: (id: string) => Promise<void>;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [bookingPorter, setBookingPorter] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const flavours = order.flavours
    ? Object.entries(order.flavours as Record<string, number>).filter(
        ([, q]) => q > 0,
      )
    : [];

  const boxLabel = boxes.find((b) => b.id === order.box_size_id)?.label || null;
  const totalPieces = flavours.reduce((s, [, q]) => s + q, 0);

  return (
    <div
      style={{
        background: G.glassStrong,
        border: `0.5px solid ${G.glassBorder}`,
        borderRadius: 10,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      {/* Header — name + box */}
      <div style={{ padding: "13px 14px 10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              color: G.text,
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {order.customer_name}
          </span>
          {boxLabel && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: G.gold,
                background: G.goldGlass,
                border: `1px solid ${G.goldBorder}`,
                padding: "3px 10px",
                borderRadius: 20,
                flexShrink: 0,
              }}
            >
              {boxLabel}
            </span>
          )}
        </div>
        {/* Piece count under name */}
        {totalPieces > 0 && (
          <p style={{ fontSize: 13, color: G.muted, fontWeight: 500 }}>
            {totalPieces} piece{totalPieces !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Flavour pills */}
      {flavours.length > 0 && (
        <div
          style={{
            padding: "0 14px 12px",
            display: "flex",
            flexWrap: "wrap" as const,
          }}
        >
          {flavours.map(([id, qty]) => (
            <FlavourPill
              key={id}
              name={productMap[id] || "Unknown"}
              qty={qty}
              large
            />
          ))}
        </div>
      )}

      {/* Delivery info — shown when Book Porter tapped */}
      {showInfo && (
        <div
          style={{
            background: "rgba(167,139,250,0.06)",
            borderTop: `0.5px solid rgba(167,139,250,0.18)`,
            padding: "10px 14px",
          }}
        >
          {order.phone && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 7,
                gap: 8,
              }}
            >
              <span style={{ color: G.sub, fontSize: 13 }}>
                📞 {order.phone}
              </span>
              <CopyBtn value={order.phone} label="Phone" />
            </div>
          )}
          {order.address && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ color: G.sub, fontSize: 13, flex: 1 }}>
                📍 {order.address}
              </span>
              <CopyBtn value={order.address} label="Addr" />
            </div>
          )}
          {order.remarks && (
            <p
              style={{
                fontSize: 12,
                color: "#86efac",
                fontStyle: "italic" as const,
                marginTop: 6,
              }}
            >
              💬 {order.remarks}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        style={{ display: "flex", borderTop: `0.5px solid ${G.glassBorder}` }}
      >
        <button
          disabled={bookingPorter}
          onClick={async () => {
            setShowInfo((v) => !v);
            if (!showInfo) {
              setBookingPorter(true);
              await onPorterBook(order);
              setBookingPorter(false);
            }
          }}
          style={{
            flex: 1,
            padding: "12px 10px",
            background: showInfo ? "rgba(167,139,250,0.14)" : G.purpleGlass,
            border: "none",
            color: G.purple,
            fontSize: 14,
            fontWeight: 600,
            cursor: bookingPorter ? "not-allowed" : "pointer",
            opacity: bookingPorter ? 0.5 : 1,
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          📦 {bookingPorter ? "Booking..." : "Book Porter"}
        </button>
        <div
          style={{ width: "0.5px", background: G.glassBorder, flexShrink: 0 }}
        />
        <button
          disabled={dispatching}
          onClick={async () => {
            setDispatching(true);
            await onDispatch(order.id);
            setDispatching(false);
          }}
          style={{
            flex: 1,
            padding: "12px 10px",
            background: G.greenGlass,
            border: "none",
            color: G.green,
            fontSize: 14,
            fontWeight: 600,
            cursor: dispatching ? "not-allowed" : "pointer",
            opacity: dispatching ? 0.5 : 1,
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          ✓ {dispatching ? "Saving..." : "Dispatched"}
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 9 — COOK TAB: FULL LAYOUT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CookTab({
  orders,
  boxes,
  productMap,
  onPorterBook,
  onDispatch,
}: {
  orders: ExtOrder[];
  boxes: BoxSize[];
  productMap: Record<string, string>;
  onPorterBook: (order: ExtOrder) => Promise<void>;
  onDispatch: (id: string) => Promise<void>;
}) {
  // Determine which slot is "now" based on current IST time
  function getCurrentSlot(): string {
    const now = new Date();
    const istHour =
      ((now.getUTCHours() + 5) % 24) + (now.getUTCMinutes() >= 30 ? 0.5 : 0);
    if (istHour >= 9 && istHour < 11) return "9–11 AM";
    if (istHour >= 11 && istHour < 13) return "11–1 PM";
    if (istHour >= 13 && istHour < 15) return "1–3 PM";
    if (istHour >= 15 && istHour < 17) return "3–5 PM";
    if (istHour >= 17 && istHour < 19) return "5–7 PM";
    if (istHour >= 19 && istHour < 21) return "7–9 PM";
    if (istHour >= 21 && istHour < 23) return "9–11 PM";
    return "11 PM–12 AM";
  }

  const [activeSlot, setActiveSlot] = useState<string>(getCurrentSlot);

  // Only confirmed (paid) orders appear in cook view
  const activeOrders = orders.filter(
    (o) => PAID_STATUSES.includes(o.status) && o.status !== "dispatched",
  );

  // Group by slot
  const ordersBySlot: Record<string, ExtOrder[]> = {};
  activeOrders.forEach((o) => {
    const slot = o.delivery_slot || o.batch_label || "Unscheduled";
    if (!ordersBySlot[slot]) ordersBySlot[slot] = [];
    ordersBySlot[slot].push(o);
  });

  // Build slot metadata for tabs
  const slotMeta = ALL_SLOTS.map((label) => {
    const count = (ordersBySlot[label] || []).length;
    const nowSlot = getCurrentSlot();
    const nowIdx = ALL_SLOTS.indexOf(nowSlot);
    const thisIdx = ALL_SLOTS.indexOf(label);
    const status: "done" | "active" | "upcoming" =
      thisIdx < nowIdx ? "done" : thisIdx === nowIdx ? "active" : "upcoming";
    return { label, count, status };
  });

  const slotOrders = ordersBySlot[activeSlot] || [];

  // Aggregate flavours for the selected slot
  const flavourTotals: Record<string, number> = {};
  slotOrders.forEach((o) => {
    if (!o.flavours) return;
    Object.entries(o.flavours as Record<string, number>).forEach(
      ([id, qty]) => {
        const name = productMap[id] || "Unknown";
        flavourTotals[name] = (flavourTotals[name] || 0) + qty;
      },
    );
  });
  const flavourEntries = Object.entries(flavourTotals).sort(
    ([, a], [, b]) => b - a,
  );
  const totalPieces = flavourEntries.reduce((s, [, q]) => s + q, 0);

  return (
    <div>
      {/* Slot tabs */}
      <SlotTabs
        slots={slotMeta}
        activeSlot={activeSlot}
        onSelect={setActiveSlot}
      />

      <div style={{ padding: "14px 14px 20px" }}>
        {/* Flavour section label */}
        <p
          style={{
            fontSize: "0.65rem",
            color: G.muted,
            letterSpacing: "0.13em",
            textTransform: "uppercase" as const,
            marginBottom: 10,
            marginTop: 6,
            fontWeight: 600,
          }}
        >
          What to make
        </p>

        {/* Big flavour grid */}
        {flavourEntries.length > 0 ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 7,
                marginBottom: 12,
              }}
            >
              {flavourEntries.map(([name, qty]) => (
                <FlavourBigCard key={name} name={name} qty={qty} />
              ))}
            </div>

            {/* Total strip */}
            <div
              style={{
                background: "rgba(96,165,250,0.08)",
                border: `1px solid rgba(96,165,250,0.2)`,
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: G.muted,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 3,
                    fontWeight: 600,
                  }}
                >
                  SLOT
                </p>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: G.blue,
                    lineHeight: 1,
                  }}
                >
                  {activeSlot}
                </p>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <p
                  style={{
                    fontSize: 11,
                    color: G.muted,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 3,
                    fontWeight: 600,
                  }}
                >
                  MAKE
                </p>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: G.text,
                    lineHeight: 1,
                  }}
                >
                  {totalPieces}{" "}
                  <span
                    style={{ fontSize: 14, fontWeight: 500, color: G.muted }}
                  >
                    mochis
                  </span>
                </p>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              background: G.glass,
              border: `0.5px solid ${G.glassBorder}`,
              borderRadius: 12,
              padding: "32px 20px",
              textAlign: "center" as const,
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: "2rem", marginBottom: 8 }}>✓</p>
            <p style={{ color: G.muted, fontSize: "0.88rem" }}>
              No orders in this slot
            </p>
          </div>
        )}

        {/* Order list */}
        {slotOrders.length > 0 && (
          <>
            <div
              style={{
                borderTop: `0.5px solid ${G.glassBorder}`,
                marginBottom: 12,
              }}
            />
            <p
              style={{
                fontSize: "0.65rem",
                color: G.muted,
                letterSpacing: "0.13em",
                textTransform: "uppercase" as const,
                marginBottom: 12,
                fontWeight: 600,
              }}
            >
              Orders · {activeSlot} ({slotOrders.length})
            </p>
            {slotOrders.map((order) => (
              <CookOrderCard
                key={order.id}
                order={order}
                productMap={productMap}
                boxes={boxes} // ← add this
                onPorterBook={onPorterBook}
                onDispatch={onDispatch}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 10 — MANUAL ORDER FORM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ManualOrderForm({
  boxes,
  customers,
  products,
  onSave,
  onClose,
}: {
  boxes: BoxSize[];
  customers: {
    name: string;
    phone: string;
    insta_id: string;
    remarks: string;
  }[];
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
    delivery_slot: ALL_SLOTS[2], // default 1–3 PM
    payment_method: "upi",
    status: "pending",
    fulfillment_type: "delivery" as "delivery" | "pickup",
  });
  const [boxRows, setBoxRows] = useState<
    { box_size_label: string; price: string }[]
  >([{ box_size_label: "", price: "" }]);
  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [payLinkCopied, setPayLinkCopied] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<typeof customers>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const f = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const totalPrice = boxRows.reduce((s, r) => s + (Number(r.price) || 0), 0);

  function handleNameChange(v: string) {
    setForm((p) => ({ ...p, customer_name: v }));
    if (v.trim().length >= 1) {
      const matches = customers.filter((c) =>
        c.name.toLowerCase().startsWith(v.toLowerCase()),
      );
      setNameSuggestions(matches.slice(0, 6));
      setShowSuggestions(matches.length > 0);
    } else setShowSuggestions(false);
  }

  function updateBoxRow(
    i: number,
    field: "box_size_label" | "price",
    value: string,
  ) {
    setBoxRows((rows) => {
      const updated = [...rows];
      if (field === "box_size_label") {
        const box = boxes.find((b) => b.label === value);
        updated[i] = {
          box_size_label: value,
          price: box ? String(box.price) : updated[i].price,
        };
      } else updated[i] = { ...updated[i], price: value };
      return updated;
    });
  }

  async function handleSave() {
    setSaving(true);
    let firstOrderId = "";
    let isFirst = true;
    for (const row of boxRows) {
      if (!row.price) continue;
      const box = boxes.find((b) => b.label === row.box_size_label);
      const { data } = await supabase
        .from("orders")
        .insert({
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          insta_id: form.insta_id.trim(),
          address: form.address.trim() || null,
          remarks: form.remarks.trim(),
          notes: form.notes.trim() || null,
          box_size_id: box?.id || null,
          flavours: isFirst && Object.keys(flavours).length > 0 ? flavours : {},
          delivery_date: form.delivery_date,
          delivery_slot: form.delivery_slot,
          payment_method: form.payment_method,
          total_price: Number(row.price),
          status: form.status,
          source: "dm",
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

  const paymentLink =
    savedOrderId && typeof window !== "undefined"
      ? `${window.location.origin}/pay/${savedOrderId}`
      : "";

  const selectStyle: React.CSSProperties = {
    width: "100%",
    background: G.glass,
    border: `1px solid ${G.glassBorder}`,
    color: G.text,
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: "0.88rem",
    marginBottom: 8,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
  };

  return (
    <div
      style={{
        background: G.glassStrong,
        border: `1px solid ${G.glassBorderStrong}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
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
        <p style={{ fontSize: "0.88rem", fontWeight: 700, color: G.blue }}>
          + Manual Order
        </p>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: G.muted,
            cursor: "pointer",
            fontSize: "1.1rem",
          }}
        >
          ✕
        </button>
      </div>

      {/* Name (with autocomplete) */}
      <div style={{ position: "relative" }}>
        <GlassInput
          placeholder="Customer Name *"
          value={form.customer_name}
          onChange={handleNameChange}
        />
        {showSuggestions && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "rgba(10,16,26,0.97)",
              border: `1px solid ${G.glassBorderStrong}`,
              borderRadius: 10,
              zIndex: 200,
              marginTop: -6,
              overflow: "hidden",
            }}
          >
            {nameSuggestions.map((c, i) => (
              <div
                key={i}
                onMouseDown={() => {
                  setForm((p) => ({
                    ...p,
                    customer_name: c.name,
                    phone: c.phone || p.phone,
                    insta_id: c.insta_id || p.insta_id,
                    remarks: c.remarks || p.remarks,
                  }));
                  setShowSuggestions(false);
                }}
                style={{
                  padding: "9px 12px",
                  cursor: "pointer",
                  borderBottom:
                    i < nameSuggestions.length - 1
                      ? `1px solid ${G.glassBorder}`
                      : "none",
                }}
              >
                <p
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: G.text,
                  }}
                >
                  {c.name}
                </p>
                {c.phone && (
                  <p style={{ fontSize: "0.72rem", color: G.muted }}>
                    📞 {c.phone}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 8px",
        }}
      >
        <GlassInput
          placeholder="Phone"
          value={form.phone}
          onChange={f("phone")}
        />
        <GlassInput
          placeholder="Instagram (without @)"
          value={form.insta_id}
          onChange={f("insta_id")}
        />
      </div>
      <GlassInput
        placeholder="Address"
        value={form.address}
        onChange={f("address")}
      />

      {/* Fulfillment */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["delivery", "pickup"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setForm((p) => ({ ...p, fulfillment_type: type }))}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 9,
              fontFamily: "system-ui, sans-serif",
              border: `1px solid ${form.fulfillment_type === type ? "rgba(96,165,250,0.5)" : G.glassBorder}`,
              background:
                form.fulfillment_type === type ? G.blueGlass : G.glass,
              color: form.fulfillment_type === type ? G.blue : G.sub,
              fontSize: "0.8rem",
              fontWeight: form.fulfillment_type === type ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {type === "delivery" ? "🚚 Delivery" : "🏠 Pickup"}
          </button>
        ))}
      </div>

      {/* Date + slot */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 8px",
        }}
      >
        <GlassInput
          type="date"
          placeholder="Delivery Date"
          value={form.delivery_date}
          onChange={f("delivery_date")}
        />
        <select
          value={form.delivery_slot}
          onChange={(e) =>
            setForm((p) => ({ ...p, delivery_slot: e.target.value }))
          }
          style={selectStyle}
        >
          {ALL_SLOTS.map((s) => (
            <option key={s} value={s} style={{ background: "#1a2535" }}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Box rows */}
      <p
        style={{
          fontSize: "0.72rem",
          color: G.muted,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          marginBottom: 8,
        }}
      >
        📦 Boxes
      </p>
      {boxRows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 32px",
            gap: 6,
            marginBottom: 6,
            alignItems: "center",
          }}
        >
          <select
            value={row.box_size_label}
            onChange={(e) => updateBoxRow(i, "box_size_label", e.target.value)}
            style={{
              background: G.glass,
              border: `1px solid ${G.glassBorder}`,
              color: row.box_size_label ? G.text : G.muted,
              padding: "10px 12px",
              borderRadius: 9,
              fontSize: "0.85rem",
              fontFamily: "system-ui, sans-serif",
              outline: "none",
            }}
          >
            <option value="" style={{ background: "#1a2535" }}>
              Select box
            </option>
            {boxes.map((b) => (
              <option
                key={b.id}
                value={b.label}
                style={{ background: "#1a2535" }}
              >
                {b.label} — ₹{b.price}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="₹"
            value={row.price}
            onChange={(e) => updateBoxRow(i, "price", e.target.value)}
            style={{
              background: G.glass,
              border: `1px solid ${G.glassBorder}`,
              color: G.text,
              padding: "10px",
              borderRadius: 9,
              fontSize: "0.88rem",
              fontFamily: "system-ui, sans-serif",
              outline: "none",
              width: "100%",
              boxSizing: "border-box" as const,
            }}
          />
          <button
            onClick={() =>
              setBoxRows((rows) =>
                rows.length === 1 ? rows : rows.filter((_, j) => j !== i),
              )
            }
            style={{
              background: G.redGlass,
              border: `1px solid rgba(255,92,108,0.3)`,
              color: G.red,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "0.9rem",
              width: 32,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button
          onClick={() =>
            setBoxRows((rows) => [...rows, { box_size_label: "", price: "" }])
          }
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid rgba(96,165,250,0.4)`,
            background: G.blueGlass,
            color: G.blue,
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          + Add Box
        </button>
        {totalPrice > 0 && (
          <p style={{ fontSize: "0.88rem", fontWeight: 700, color: G.gold }}>
            ₹{totalPrice}
          </p>
        )}
      </div>

      {/* Flavours */}
      {products.filter((p) => p.is_available).length > 0 && (
        <>
          <p
            style={{
              fontSize: "0.72rem",
              color: G.muted,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              marginBottom: 8,
            }}
          >
            🍡 Flavours
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 5,
              marginBottom: 12,
            }}
          >
            {products
              .filter((p) => p.is_available)
              .map((prod) => {
                const qty = flavours[prod.id] || 0;
                const c = getFlavourColor(prod.name);
                return (
                  <div
                    key={prod.id}
                    onClick={() => {
                      const n = { ...flavours };
                      if ((n[prod.id] || 0) === 0) n[prod.id] = 1;
                      else delete n[prod.id];
                      setFlavours(n);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: `1px solid ${qty > 0 ? c.border : G.glassBorder}`,
                      background: qty > 0 ? c.bg : G.glass,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {qty > 0 && (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: c.dot,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: qty > 0 ? 600 : 400,
                          color: qty > 0 ? c.text : G.sub,
                        }}
                      >
                        {prod.name}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          const n = { ...flavours };
                          const cur = n[prod.id] || 0;
                          if (cur > 0) {
                            if (cur === 1) delete n[prod.id];
                            else n[prod.id] = cur - 1;
                            setFlavours(n);
                          }
                        }}
                        disabled={qty === 0}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: `1px solid ${G.glassBorder}`,
                          background: G.glass,
                          color: G.sub,
                          cursor: qty === 0 ? "not-allowed" : "pointer",
                          opacity: qty === 0 ? 0.3 : 1,
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          minWidth: 14,
                          textAlign: "center" as const,
                          color: G.text,
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        onClick={() =>
                          setFlavours((n) => ({
                            ...n,
                            [prod.id]: (n[prod.id] || 0) + 1,
                          }))
                        }
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: `1px solid rgba(96,165,250,0.4)`,
                          background: G.blueGlass,
                          color: G.blue,
                          cursor: "pointer",
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 8px",
        }}
      >
        <GlassInput
          type="date"
          placeholder="Order Date"
          value={form.order_date}
          onChange={f("order_date")}
        />
        <select
          value={form.status}
          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          style={selectStyle}
        >
          <option value="pending" style={{ background: "#1a2535" }}>
            Pending
          </option>
          <option value="confirmed" style={{ background: "#1a2535" }}>
            Confirmed
          </option>
          <option value="dispatched" style={{ background: "#1a2535" }}>
            Dispatched
          </option>
        </select>
      </div>
      <GlassInput
        placeholder="Remarks"
        value={form.remarks}
        onChange={f("remarks")}
      />
      <GlassInput
        placeholder="Internal notes"
        value={form.notes}
        onChange={f("notes")}
      />

      <button
        disabled={saving || !form.customer_name || totalPrice === 0}
        onClick={handleSave}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 10,
          border: "none",
          background:
            saving || !form.customer_name || totalPrice === 0
              ? G.glass
              : G.blueGlass,
          color:
            saving || !form.customer_name || totalPrice === 0
              ? G.muted
              : G.blue,
          fontSize: "0.9rem",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {saving ? "Saving..." : `Save Order · ₹${totalPrice}`}
      </button>

      {savedOrderId && form.status === "pending" && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            background: G.blueGlass,
            border: `1px solid rgba(96,165,250,0.3)`,
            borderRadius: 10,
          }}
        >
          <p
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: G.blue,
              marginBottom: 6,
            }}
          >
            🔗 Payment Link
          </p>
          <p
            style={{
              fontSize: "0.68rem",
              color: G.sub,
              marginBottom: 10,
              wordBreak: "break-all" as const,
            }}
          >
            {paymentLink}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(paymentLink).then(() => {
                  setPayLinkCopied(true);
                  setTimeout(() => setPayLinkCopied(false), 2500);
                });
              }}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: 8,
                border: "none",
                background: payLinkCopied ? G.greenGlass : G.blueGlass,
                color: payLinkCopied ? G.green : G.blue,
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {payLinkCopied ? "✓ Copied!" : "📋 Copy Link"}
            </button>
            <button
              onClick={() =>
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(`Hi! Here's your Eversweet payment link 🍡\n\n${paymentLink}`)}`,
                  "_blank",
                )
              }
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                border: "none",
                background: "rgba(37,211,102,0.18)",
                color: "#25d366",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              📲 WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 11 — PENDING PAYMENT ORDER CARD (full details)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PendingOrderCard({
  order,
  productMap,
  onConfirm,
  onCancel,
}: {
  order: ExtOrder;
  productMap: Record<string, string>;
  onConfirm: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const flavours = order.flavours
    ? Object.entries(order.flavours as Record<string, number>).filter(
        ([, q]) => q > 0,
      )
    : [];

  return (
    <div
      style={{
        background: G.glassStrong,
        border: `1px solid ${G.goldBorder}`,
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <div>
          <p
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: G.text,
              marginBottom: 3,
            }}
          >
            {order.customer_name}
          </p>
          <p style={{ fontSize: "0.8rem", color: G.muted }}>
            🕐 {order.delivery_slot || order.batch_label || "—"} ·{" "}
            <span style={{ color: G.gold, fontWeight: 700 }}>
              ₹{order.total_price}
            </span>
            {order.fulfillment_type === "pickup"
              ? " · 🏠 Pickup"
              : " · 🚚 Delivery"}
          </p>
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            background: G.goldGlass,
            border: `1px solid ${G.goldBorder}`,
            fontSize: "0.68rem",
            fontWeight: 700,
            color: G.gold,
          }}
        >
          Payment Pending
        </span>
      </div>

      {flavours.length > 0 && (
        <div
          style={{
            marginBottom: 10,
            display: "flex",
            flexWrap: "wrap" as const,
          }}
        >
          {flavours.map(([id, qty]) => (
            <FlavourPill
              key={id}
              name={productMap[id] || "Unknown"}
              qty={qty}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: "0.84rem", color: G.sub }}>
          📞 {order.phone || "—"}
        </span>
        {order.phone && <CopyBtn value={order.phone} label="Phone" />}
      </div>
      {order.address && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: "0.8rem", color: G.sub, flex: 1 }}>
            📍 {order.address}
          </span>
          <CopyBtn value={order.address} label="Addr" />
        </div>
      )}
      {order.insta_id && (
        <p style={{ fontSize: "0.78rem", color: "#f472b6", marginBottom: 4 }}>
          📸 @{order.insta_id}
        </p>
      )}
      {order.remarks && (
        <p
          style={{
            fontSize: "0.78rem",
            color: "#86efac",
            fontStyle: "italic" as const,
            marginBottom: 4,
          }}
        >
          💬 {order.remarks}
        </p>
      )}

      {/* Copy payment link */}
      <div style={{ marginBottom: 10 }}>
        <CopyBtn
          value={`${typeof window !== "undefined" ? window.location.origin : ""}/pay/${order.id}`}
          label="Payment Link"
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={updating}
          onClick={async () => {
            setUpdating(true);
            await onConfirm(order.id);
            setUpdating(false);
          }}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 9,
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: updating ? "not-allowed" : "pointer",
            opacity: updating ? 0.5 : 1,
            border: "1px solid rgba(52,211,153,0.5)",
            background: "rgba(52,211,153,0.14)",
            color: G.green,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {updating ? "..." : "→ Confirm (Payment Received)"}
        </button>
        <button
          disabled={updating}
          onClick={async () => {
            if (!confirm(`Cancel order for ${order.customer_name}?`)) return;
            setUpdating(true);
            await onCancel(order.id);
            setUpdating(false);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 9,
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
            border: `1px solid rgba(255,92,108,0.3)`,
            background: G.redGlass,
            color: G.red,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 12 — BULK ORDER IMPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BulkOrderImport({
  onImport,
}: {
  onImport: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: `1px solid ${G.glassBorder}`,
          background: G.glass,
          color: G.muted,
          fontSize: "0.78rem",
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
          marginBottom: 10,
        }}
      >
        📂 Bulk Import (JSON)
      </button>
    );
  return (
    <div
      style={{
        background: G.glass,
        border: `1px solid ${G.glassBorder}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: G.sub }}>
          Paste order JSON
        </p>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: G.muted,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='[{ "customer_name":"Name", "phone":"", "delivery_slot":"1–3 PM", "total_price":499, "status":"confirmed" }]'
        style={{
          width: "100%",
          minHeight: 80,
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${G.glassBorder}`,
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: "0.75rem",
          color: G.text,
          fontFamily: "monospace",
          resize: "vertical" as const,
          outline: "none",
          boxSizing: "border-box" as const,
          marginBottom: 8,
        }}
      />
      <button
        disabled={importing || !text.trim()}
        onClick={async () => {
          setImporting(true);
          await onImport(text);
          setImporting(false);
          setText("");
          setOpen(false);
        }}
        style={{
          padding: "9px 20px",
          borderRadius: 8,
          border: `1px solid rgba(96,165,250,0.4)`,
          background: G.blueGlass,
          color: G.blue,
          fontSize: "0.85rem",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {importing ? "Importing..." : "Import"}
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 13 — EXPENSE SCANNER (AI bill scan)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExpenseScanner({
  onDataExtracted,
}: {
  onDataExtracted: (data: unknown[]) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResults(null);
    setError(null);
    setScanning(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/extract-bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "API error");
        }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setError("No items found in this bill.");
          setScanning(false);
          return;
        }
        setResults(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setScanning(false);
    };
  };

  return (
    <div
      style={{
        background: G.glass,
        border: `1px solid ${G.glassBorder}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <p
        style={{
          fontSize: "0.65rem",
          color: G.muted,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          marginBottom: 12,
          fontWeight: 700,
        }}
      >
        ✨ AI Bill Scanner
      </p>
      {!results && (
        <div
          onClick={() => !scanning && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${scanning ? G.goldBorder : G.glassBorder}`,
            borderRadius: 10,
            padding: "24px 16px",
            textAlign: "center" as const,
            cursor: scanning ? "not-allowed" : "pointer",
            background: scanning ? G.goldGlass : "rgba(0,0,0,0.1)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileChange}
            disabled={scanning}
          />
          {preview && !scanning && (
            <img
              src={preview}
              alt="Bill"
              style={{
                maxHeight: 100,
                maxWidth: "100%",
                borderRadius: 8,
                marginBottom: 10,
                objectFit: "contain" as const,
              }}
            />
          )}
          <p
            style={{
              fontSize: scanning ? "0.9rem" : "1.8rem",
              marginBottom: 6,
            }}
          >
            {scanning ? "⏳" : "📸"}
          </p>
          <p
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: scanning ? G.gold : G.sub,
            }}
          >
            {scanning ? "Analyzing with AI..." : "Tap to upload bill photo"}
          </p>
          <p style={{ fontSize: "0.7rem", color: G.muted, marginTop: 4 }}>
            JPG, PNG, HEIC supported
          </p>
        </div>
      )}
      {error && (
        <div
          style={{
            background: G.redGlass,
            border: `1px solid rgba(255,92,108,0.3)`,
            borderRadius: 8,
            padding: "10px 12px",
            marginTop: 10,
          }}
        >
          <p style={{ fontSize: "0.82rem", color: G.red }}>⚠ {error}</p>
          <button
            onClick={() => {
              setError(null);
              setPreview(null);
            }}
            style={{
              marginTop: 6,
              fontSize: "0.75rem",
              color: G.red,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Try again
          </button>
        </div>
      )}
      {results && (
        <div>
          <p
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: G.green,
              marginBottom: 10,
            }}
          >
            ✓ Found {results.length} item{results.length !== 1 ? "s" : ""}
          </p>
          <div style={{ marginBottom: 12 }}>
            {(
              results as {
                description: string;
                amount: number;
                category: string;
              }[]
            ).map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  marginBottom: 5,
                  background:
                    item.category === "packaging" ? G.blueGlass : G.greenGlass,
                  border: `1px solid ${item.category === "packaging" ? "rgba(96,165,250,0.2)" : "rgba(52,211,123,0.2)"}`,
                }}
              >
                <div>
                  <span style={{ fontSize: "0.72rem", marginRight: 6 }}>
                    {item.category === "packaging" ? "📦" : "🧪"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      color: G.text,
                    }}
                  >
                    {item.description}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "0.62rem",
                      padding: "1px 6px",
                      borderRadius: 6,
                      background: G.glass,
                      color: G.muted,
                    }}
                  >
                    {item.category}
                  </span>
                </div>
                <span
                  style={{ fontSize: "0.88rem", fontWeight: 700, color: G.red }}
                >
                  ₹{item.amount}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                onDataExtracted(results!);
                setResults(null);
                setPreview(null);
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: `1px solid rgba(96,165,250,0.3)`,
                background: G.blueGlass,
                color: G.blue,
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              ✓ Save All to Expenses
            </button>
            <button
              onClick={() => {
                setResults(null);
                setPreview(null);
                setError(null);
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: `1px solid ${G.glassBorder}`,
                background: G.glass,
                color: G.sub,
                fontSize: "0.88rem",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 14 — EXPENSE IMPORTER (JSON paste / upload)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExpenseImporter({
  onImport,
}: {
  onImport: (text: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setError("");
    if (!text.trim()) {
      setError("Paste JSON first");
      return;
    }
    try {
      JSON.parse(text.trim());
    } catch {
      setError("Invalid JSON");
      return;
    }
    setImporting(true);
    await onImport(text.trim());
    setImporting(false);
    setText("");
  }

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: `1px solid ${G.glassBorder}`,
      }}
    >
      <p
        style={{
          fontSize: "0.72rem",
          color: G.muted,
          fontWeight: 600,
          marginBottom: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
        }}
      >
        Bulk import expenses
      </p>
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 12,
          border: `1px solid ${G.glassBorder}`,
          borderRadius: 8,
          overflow: "hidden",
          width: "fit-content",
        }}
      >
        {(["paste", "upload"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "6px 16px",
              border: "none",
              fontFamily: "system-ui, sans-serif",
              background: mode === m ? "rgba(96,165,250,0.2)" : G.glass,
              color: mode === m ? G.blue : G.muted,
              fontSize: "0.78rem",
              fontWeight: mode === m ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {m === "paste" ? "Paste" : "Upload"}
          </button>
        ))}
      </div>
      {mode === "paste" ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            placeholder="Paste JSON..."
            style={{
              width: "100%",
              minHeight: 100,
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${error ? "rgba(255,92,108,0.5)" : G.glassBorder}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: "0.75rem",
              color: G.text,
              fontFamily: "monospace",
              resize: "vertical" as const,
              outline: "none",
              marginBottom: 6,
              boxSizing: "border-box" as const,
            }}
          />
          {error && (
            <p style={{ fontSize: "0.72rem", color: G.red, marginBottom: 8 }}>
              ⚠ {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={importing || !text.trim()}
              onClick={run}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: `1px solid rgba(96,165,250,0.4)`,
                background: G.blueGlass,
                color: G.blue,
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {importing ? "Importing..." : "Import"}
            </button>
            {text && (
              <button
                onClick={() => {
                  setText("");
                  setError("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: G.muted,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <label
          style={{
            display: "inline-block",
            padding: "9px 18px",
            borderRadius: 8,
            border: `1px solid rgba(96,165,250,0.4)`,
            background: G.blueGlass,
            color: G.blue,
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          📂 Choose JSON File
          <input
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const fi = e.target.files?.[0];
              if (!fi) return;
              setImporting(true);
              await onImport(await fi.text());
              setImporting(false);
              (e.target as HTMLInputElement).value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 15 — MAIN APP COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("cook");
  const [moreTab, setMoreTab] = useState<MoreTab>("products");

  const [orders, setOrders] = useState<ExtOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [repeatPhones, setRepeatPhones] = useState<Set<string>>(new Set());

  const [showManualForm, setShowManualForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [editRemarks, setEditRemarks] = useState("");
  const [editInsta, setEditInsta] = useState("");

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
    "from_start" | "today" | "week" | "month" | "all"
  >("from_start");

  useEffect(() => {
    if (localStorage.getItem("es_admin") === "true") setAuthed(true);
  }, []);

  const productMap: Record<string, string> = {};
  products.forEach((p) => {
    productMap[p.id] = p.name;
  });

  // ── Data loading ───────────────────────────────────────────
  const load = useCallback(async () => {
    const [{ data: o }, { data: p }, { data: b }, { data: ex }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("products").select("*").order("sort_order"),
        supabase.from("box_sizes").select("*").order("sort_order"),
        supabase
          .from("expenses")
          .select("*")
          .order("date", { ascending: false }),
      ]);
    if (o) {
      setOrders(o as ExtOrder[]);
      const counts: Record<string, number> = {};
      (o as ExtOrder[]).forEach((ord) => {
        if (ord.phone) counts[ord.phone] = (counts[ord.phone] || 0) + 1;
      });
      setRepeatPhones(
        new Set(
          Object.entries(counts)
            .filter(([, c]) => c > 1)
            .map(([ph]) => ph),
        ),
      );
    }
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

  // ── Order actions ──────────────────────────────────────────
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

  async function handlePorterEmail(order: ExtOrder) {
    try {
      const res = await fetch("/api/porter-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: order.customer_name,
          phone: order.phone,
          address: order.address,
          slot: order.delivery_slot || order.batch_label,
          total_price: order.total_price,
        }),
      });
      if (res.ok) flash("📧 Porter email sent ✓");
      else flash("Email failed", "error");
    } catch {
      flash("Email failed", "error");
    }
  }

  async function handleBulkOrderImport(text: string) {
    try {
      const data = JSON.parse(text.trim());
      const items = Array.isArray(data) ? data : data.orders;
      if (!Array.isArray(items)) throw new Error("Expected array");
      const res = await fetch("/api/import-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await load();
      flash(`${result.imported} orders imported ✓`);
    } catch (err: unknown) {
      flash(
        `Import failed: ${err instanceof Error ? err.message : "Invalid JSON"}`,
        "error",
      );
    }
  }

  async function handleExpenseImport(text: string) {
    try {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data.expenses;
      if (!Array.isArray(items)) throw new Error("Expected array");
      const now = new Date();
      const uploadedDate = new Date(now.getTime() + 5.5 * 3600000)
        .toISOString()
        .split("T")[0];
      const valid = items
        .filter(
          (e: { description: string; amount: number }) =>
            e.description && Number(e.amount) > 0,
        )
        .map(
          (e: {
            description: string;
            amount: number;
            category?: string;
            note?: string;
          }) => ({
            description: String(e.description).trim(),
            amount: Number(e.amount),
            category: e.category || "ingredient",
            date: uploadedDate,
            note: e.note || "AI Scanned Bill",
          }),
        );
      if (valid.length === 0) throw new Error("No valid entries");
      const { error } = await supabase.from("expenses").insert(valid);
      if (error) throw error;
      await load();
      flash(`${valid.length} expenses added ✓`);
    } catch (err: unknown) {
      flash(
        `Import failed: ${err instanceof Error ? err.message : "Invalid JSON"}`,
        "error",
      );
    }
  }

  // ── Dashboard helpers ──────────────────────────────────────
  function filterByPeriod<T extends { created_at: string }>(items: T[]): T[] {
    const now = new Date();
    const localNow = new Date(now.getTime() + 5.5 * 3600000);
    const todayStr = localNow.toISOString().split("T")[0];
    return items.filter((item) => {
      const dateStr =
        (item as Record<string, string>).order_date ||
        item.created_at.split("T")[0];
      if (dashPeriod === "from_start") return dateStr >= TRACKING_START_DATE;
      if (dashPeriod === "today") return dateStr === todayStr;
      if (dashPeriod === "week") {
        const day = localNow.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(localNow);
        monday.setDate(localNow.getDate() - diff);
        return (
          dateStr >= monday.toISOString().split("T")[0] && dateStr <= todayStr
        );
      }
      if (dashPeriod === "month")
        return dateStr.startsWith(todayStr.substring(0, 7));
      return true;
    });
  }
  function filterExpByPeriod(items: Expense[]): Expense[] {
    const now = new Date();
    const localNow = new Date(now.getTime() + 5.5 * 3600000);
    const todayStr = localNow.toISOString().split("T")[0];
    return items.filter((item) => {
      if (dashPeriod === "from_start") return item.date >= TRACKING_START_DATE;
      if (dashPeriod === "today") return item.date === todayStr;
      if (dashPeriod === "week") {
        const day = localNow.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(localNow);
        monday.setDate(localNow.getDate() - diff);
        return item.date >= monday.toISOString().split("T")[0];
      }
      if (dashPeriod === "month")
        return item.date.startsWith(todayStr.substring(0, 7));
      return true;
    });
  }

  const paidOrders = filterByPeriod(
    orders.filter((o) => PAID_STATUSES.includes(o.status)),
  ) as ExtOrder[];
  const periodExpenses = filterExpByPeriod(expenses);
  const totalRevenue = paidOrders.reduce((s, o) => s + (o.total_price || 0), 0);
  const totalExpenses = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const ingredientExp = periodExpenses
    .filter((e) => e.category === "ingredient")
    .reduce((s, e) => s + e.amount, 0);
  const packagingExp = periodExpenses
    .filter((e) => e.category === "packaging")
    .reduce((s, e) => s + e.amount, 0);
  const fixedExp = periodExpenses
    .filter((e) => e.category === "fixed")
    .reduce((s, e) => s + e.amount, 0);
  const marketingExp = periodExpenses
    .filter((e) => e.category === "marketing")
    .reduce((s, e) => s + e.amount, 0);
  const profit = totalRevenue - totalExpenses;
  const totalMochis = paidOrders.reduce(
    (s, o) =>
      s +
      (o.flavours
        ? Object.values(o.flavours as Record<string, number>).reduce(
            (a, q) => a + q,
            0,
          )
        : 0),
    0,
  );
  const costPerMochi =
    totalMochis > 0 ? Math.round(totalExpenses / totalMochis) : 0;
  const revenuePerMochi =
    totalMochis > 0 ? Math.round(totalRevenue / totalMochis) : 0;

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
    const label = boxes.find((b) => b.id === o.box_size_id)?.label || "Unknown";
    if (!boxRevenue[label]) boxRevenue[label] = { count: 0, revenue: 0 };
    boxRevenue[label].count++;
    boxRevenue[label].revenue += o.total_price || 0;
  });

  const pendingPaymentOrders = orders.filter((o) => o.status === "pending");
  const dispatchedOrders = orders.filter((o) => o.status === "dispatched");
  const pendingCount = pendingPaymentOrders.length;

  // ── Customer map ───────────────────────────────────────────
  const customerMap: Record<
    string,
    {
      name: string;
      phone: string;
      insta_id: string;
      remarks: string;
      orders: ExtOrder[];
      total: number;
    }
  > = {};
  orders.forEach((o) => {
    const key = o.phone || o.customer_name;
    if (!customerMap[key])
      customerMap[key] = {
        name: o.customer_name,
        phone: o.phone || "",
        insta_id: o.insta_id || "",
        remarks: o.remarks || "",
        orders: [],
        total: 0,
      };
    customerMap[key].orders.push(o);
    customerMap[key].total += o.total_price || 0;
    if (o.insta_id) customerMap[key].insta_id = o.insta_id;
    if (o.remarks) customerMap[key].remarks = o.remarks;
  });
  const customers = Object.entries(customerMap)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.total - a.total);
  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      (c.insta_id || "").toLowerCase().includes(customerSearch.toLowerCase()),
  );

  // ── Nav button ─────────────────────────────────────────────
  function NavBtn({
    id,
    icon,
    label,
    badge,
  }: {
    id: Tab;
    icon: string;
    label: string;
    badge?: number;
  }) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          padding: "8px 4px 6px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative" as const,
        }}
      >
        <div style={{ position: "relative" }}>
          <span
            style={{
              fontSize: "1.4rem",
              filter: active ? "none" : "grayscale(0.5) opacity(0.5)",
              transition: "all 0.2s",
            }}
          >
            {icon}
          </span>
          {badge && badge > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -6,
                background: "#ff5c6c",
                color: "#fff",
                borderRadius: 8,
                padding: "1px 5px",
                fontSize: "0.55rem",
                fontWeight: 700,
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <span
          style={{
            fontSize: "0.58rem",
            fontWeight: active ? 700 : 400,
            color: active ? G.active : G.muted,
            letterSpacing: "0.04em",
            transition: "all 0.2s",
          }}
        >
          {label}
        </span>
        {active && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 24,
              height: 2,
              background: G.active,
              borderRadius: 1,
            }}
          />
        )}
      </button>
    );
  }

  const selectStyle: React.CSSProperties = {
    width: "100%",
    background: G.glass,
    border: `1px solid ${G.glassBorder}`,
    color: G.text,
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: "0.88rem",
    marginBottom: 8,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 16 — LOGIN SCREEN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!authed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: G.pageBg,
          padding: 24,
        }}
      >
        <div
          style={{
            background: G.glassStrong,
            border: `1px solid ${G.glassBorderStrong}`,
            borderRadius: 20,
            padding: 32,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <h1
            style={{
              fontSize: "1.8rem",
              fontWeight: 700,
              color: G.text,
              marginBottom: 4,
            }}
          >
            Eversweet
          </h1>
          <p style={{ fontSize: "0.85rem", color: G.muted, marginBottom: 24 }}>
            Admin Panel
          </p>
          <GlassInput
            type="password"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          {pwError && (
            <p style={{ fontSize: "0.82rem", color: G.red, marginBottom: 8 }}>
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
              padding: "13px",
              borderRadius: 10,
              border: "none",
              background: "rgba(96,165,250,0.22)",
              color: G.blue,
              fontSize: "0.95rem",
              fontWeight: 700,
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 17 — APP SHELL (top bar + content + bottom nav)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <main
      style={{
        background: G.pageBg,
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: G.text,
        paddingBottom: 80,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: G.navBg,
          borderBottom: `1px solid ${G.navBorder}`,
          padding: "12px 16px",
          position: "sticky" as const,
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: "1rem", fontWeight: 700, color: G.text }}>
              🍡 Eversweet
            </h1>
            {pendingCount > 0 && (
              <span
                style={{
                  background: "#ff5c6c",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "2px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                }}
              >
                {pendingCount} unpaid
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={load}
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
                color: G.sub,
                padding: "5px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              ↻
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("es_admin");
                setAuthed(false);
              }}
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
                color: G.muted,
                padding: "5px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              Out
            </button>
          </div>
        </div>
      </div>

      {/* Flash message */}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {msg.text && (
          <div
            style={{
              background: msg.type === "error" ? G.redGlass : G.greenGlass,
              border: `1px solid ${msg.type === "error" ? "rgba(255,92,108,0.3)" : "rgba(52,217,123,0.3)"}`,
              color: msg.type === "error" ? G.red : G.green,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.85rem",
              margin: "14px 14px 0",
              fontWeight: 500,
            }}
          >
            {msg.text}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 18 — COOK TAB
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === "cook" && (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <CookTab
            orders={orders}
            boxes={boxes}
            productMap={productMap}
            onPorterBook={handlePorterEmail}
            onDispatch={async (id) => {
              await handleStatusChange(id, "dispatched");
            }}
          />
          {/* Add order button — floating at bottom of cook section */}
          <div style={{ padding: "0 14px 14px" }}>
            <button
              onClick={() => setShowManualForm((f) => !f)}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 10,
                border: `1px solid rgba(96,165,250,0.35)`,
                background: G.blueGlass,
                color: G.blue,
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {showManualForm ? "✕ Close Form" : "+ Add Order"}
            </button>
            {showManualForm && (
              <div style={{ marginTop: 12 }}>
                <ManualOrderForm
                  boxes={boxes}
                  customers={customers.map((c) => ({
                    name: c.name,
                    phone: c.phone,
                    insta_id: c.insta_id || "",
                    remarks: c.remarks || "",
                  }))}
                  products={products}
                  onSave={(orderId) => {
                    load();
                    setShowManualForm(false);
                    flash("Order saved ✓");
                  }}
                  onClose={() => setShowManualForm(false)}
                />
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <BulkOrderImport onImport={handleBulkOrderImport} />
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 19 — PENDING PAYMENT TAB
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === "pending_payment" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          <div
            style={{
              background: G.goldGlass,
              border: `1px solid ${G.goldBorder}`,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: G.gold }}>
              💳 Awaiting payment confirmation
            </p>
            <p style={{ fontSize: "0.75rem", color: "#c8860a", marginTop: 4 }}>
              Once paid, click Confirm to move to cook queue
            </p>
          </div>
          {pendingPaymentOrders.length === 0 ? (
            <div
              style={{
                background: G.glass,
                borderRadius: 14,
                padding: 48,
                textAlign: "center" as const,
                border: `1px solid ${G.glassBorder}`,
              }}
            >
              <p style={{ fontSize: "2rem", marginBottom: 8 }}>✓</p>
              <p style={{ color: G.muted }}>No pending payments</p>
            </div>
          ) : (
            pendingPaymentOrders.map((o) => (
              <PendingOrderCard
                key={o.id}
                order={o}
                productMap={productMap}
                onConfirm={(id) => handleStatusChange(id, "confirmed")}
                onCancel={handleCancel}
              />
            ))
          )}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 20 — DISPATCHED TAB
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === "dispatched" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          <p style={{ fontSize: "0.75rem", color: G.muted, marginBottom: 14 }}>
            {dispatchedOrders.length} delivered orders
          </p>
          {dispatchedOrders.map((o) => (
            <div
              key={o.id}
              style={{
                background: G.glass,
                border: `0.5px solid ${G.glassBorder}`,
                borderLeft: `3px solid ${G.green}40`,
                borderRadius: 12,
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
                      gap: 7,
                      marginBottom: 3,
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 700,
                        color: G.text,
                      }}
                    >
                      {o.customer_name}
                    </p>
                    {repeatPhones.has(o.phone) && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: G.blue,
                          background: G.blueGlass,
                          padding: "1px 6px",
                          borderRadius: 6,
                        }}
                      >
                        🔄
                      </span>
                    )}
                    {o.source === "dm" && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: "#f472b6",
                          background: "rgba(236,72,153,0.12)",
                          padding: "1px 6px",
                          borderRadius: 6,
                        }}
                      >
                        📱 DM
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.8rem", color: G.muted }}>
                    🕐 {o.delivery_slot || o.batch_label || "—"} ·{" "}
                    <span style={{ color: G.gold, fontWeight: 700 }}>
                      ₹{o.total_price}
                    </span>
                    {o.fulfillment_type === "pickup"
                      ? " · 🏠 Pickup"
                      : " · 🚚 Delivery"}
                  </p>
                  {o.address && (
                    <p style={{ fontSize: "0.75rem", color: G.muted }}>
                      📍 {o.address}
                    </p>
                  )}
                  {o.remarks && (
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#86efac",
                        fontStyle: "italic" as const,
                      }}
                    >
                      💬 {o.remarks}
                    </p>
                  )}
                  {o.flavours &&
                    Object.entries(o.flavours as Record<string, number>).filter(
                      ([, q]) => q > 0,
                    ).length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap" as const,
                          marginTop: 5,
                        }}
                      >
                        {Object.entries(o.flavours as Record<string, number>)
                          .filter(([, q]) => q > 0)
                          .map(([id, qty]) => (
                            <FlavourPill
                              key={id}
                              name={productMap[id] || "Unknown"}
                              qty={qty}
                            />
                          ))}
                      </div>
                    )}
                </div>
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "3px 9px",
                    borderRadius: 8,
                    background: G.greenGlass,
                    color: G.green,
                    fontWeight: 700,
                    border: `1px solid rgba(52,217,123,0.3)`,
                    flexShrink: 0,
                  }}
                >
                  ✓ Done
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 21 — CUSTOMERS TAB
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === "customers" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          <div style={{ marginBottom: 14 }}>
            <GlassInput
              placeholder="Search name, phone, Instagram..."
              value={customerSearch}
              onChange={setCustomerSearch}
            />
          </div>
          <p style={{ fontSize: "0.72rem", color: G.muted, marginBottom: 14 }}>
            {filteredCustomers.length} customers · ₹
            {customers.reduce((s, c) => s + c.total, 0).toLocaleString()} total
          </p>
          {filteredCustomers.map((c) => (
            <div
              key={c.key}
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 8,
              }}
            >
              {editingCustomer === c.key ? (
                <div>
                  <p
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      marginBottom: 10,
                      color: G.text,
                    }}
                  >
                    Editing: {c.name}
                  </p>
                  <GlassInput
                    placeholder="Instagram ID (without @)"
                    value={editInsta}
                    onChange={setEditInsta}
                  />
                  <textarea
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Remarks / notes"
                    style={{
                      width: "100%",
                      minHeight: 80,
                      background: G.glass,
                      border: `1px solid ${G.glassBorder}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: "0.85rem",
                      color: G.text,
                      fontFamily: "system-ui, sans-serif",
                      resize: "vertical" as const,
                      outline: "none",
                      marginBottom: 10,
                      boxSizing: "border-box" as const,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        for (const o of c.orders)
                          await supabase
                            .from("orders")
                            .update({
                              insta_id: editInsta.trim(),
                              remarks: editRemarks.trim(),
                            })
                            .eq("id", o.id);
                        setEditingCustomer(null);
                        await load();
                        flash("Customer updated ✓");
                      }}
                      style={{
                        padding: "9px 20px",
                        borderRadius: 8,
                        border: "none",
                        background: G.blueGlass,
                        color: G.blue,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "system-ui, sans-serif",
                      }}
                    >
                      Save
                    </button>
                    <GlassBtn onClick={() => setEditingCustomer(null)}>
                      Cancel
                    </GlassBtn>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 4,
                        flexWrap: "wrap" as const,
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: G.text,
                        }}
                      >
                        {c.name}
                      </p>
                      {c.orders.length > 1 && (
                        <span
                          style={{
                            fontSize: "0.6rem",
                            padding: "2px 7px",
                            borderRadius: 8,
                            background: G.blueGlass,
                            color: G.blue,
                            fontWeight: 700,
                          }}
                        >
                          🔄 {c.orders.length}x
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <p
                        style={{
                          fontSize: "0.82rem",
                          color: G.sub,
                          marginBottom: 2,
                        }}
                      >
                        📞 {c.phone}
                      </p>
                    )}
                    {c.insta_id && (
                      <p
                        style={{
                          fontSize: "0.8rem",
                          color: "#f472b6",
                          marginBottom: 2,
                        }}
                      >
                        📸 @{c.insta_id}
                      </p>
                    )}
                    <p style={{ fontSize: "0.8rem", color: G.muted }}>
                      {c.orders.length} order{c.orders.length > 1 ? "s" : ""} ·{" "}
                      <span style={{ color: G.gold, fontWeight: 700 }}>
                        ₹{c.total.toLocaleString()}
                      </span>
                    </p>
                    {c.remarks && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#86efac",
                          fontStyle: "italic" as const,
                          marginTop: 5,
                        }}
                      >
                        💬 {c.remarks}
                      </p>
                    )}
                  </div>
                  <GlassBtn
                    variant="primary"
                    onClick={() => {
                      setEditingCustomer(c.key);
                      setEditInsta(c.insta_id || "");
                      setEditRemarks(c.remarks || "");
                    }}
                  >
                    Edit
                  </GlassBtn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 22 — DASHBOARD TAB
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === "dashboard" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          {/* Period filter */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 16,
              overflowX: "auto" as const,
            }}
          >
            {(["from_start", "today", "week", "month", "all"] as const).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setDashPeriod(p)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor:
                      dashPeriod === p ? "rgba(96,165,250,0.5)" : G.glassBorder,
                    background: dashPeriod === p ? G.blueGlass : G.glass,
                    color: dashPeriod === p ? G.blue : G.muted,
                    fontSize: "0.75rem",
                    fontWeight: dashPeriod === p ? 600 : 400,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {p === "from_start"
                    ? "📌 Start"
                    : p === "today"
                      ? "Today"
                      : p === "week"
                        ? "Week"
                        : p === "month"
                          ? "Month"
                          : "All"}
                </button>
              ),
            )}
          </div>

          <ExpenseScanner
            onDataExtracted={async (data) => {
              await handleExpenseImport(JSON.stringify(data));
            }}
          />

          {/* Stat grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <GlassStatCard
              label="Revenue"
              value={`₹${totalRevenue.toLocaleString()}`}
              sub={`${paidOrders.length} orders`}
              color={G.blue}
            />
            <GlassStatCard
              label="Expenses"
              value={`₹${totalExpenses.toLocaleString()}`}
              sub={`${periodExpenses.length} entries`}
              color={G.red}
            />
            <GlassStatCard
              label="Profit"
              value={`₹${profit.toLocaleString()}`}
              sub={profit >= 0 ? "↑ positive" : "↓ negative"}
              color={profit >= 0 ? G.green : G.red}
            />
            <GlassStatCard
              label="Avg Order"
              value={
                paidOrders.length > 0
                  ? `₹${Math.round(totalRevenue / paidOrders.length)}`
                  : "—"
              }
              sub="per order"
            />
            <GlassStatCard
              label="Cost / Mochi"
              value={totalMochis > 0 ? `₹${costPerMochi}` : "—"}
              sub={`${totalMochis} tracked`}
              color={G.sub}
            />
            <GlassStatCard
              label="Revenue / Mochi"
              value={totalMochis > 0 ? `₹${revenuePerMochi}` : "—"}
              sub={
                totalMochis > 0
                  ? `₹${revenuePerMochi - costPerMochi} margin`
                  : ""
              }
              color={G.green}
            />
          </div>

          {/* Expense category breakdown */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              {
                label: "🧪 Ingredients",
                val: ingredientExp,
                color: G.green,
                glass: G.greenGlass,
              },
              {
                label: "📦 Packaging",
                val: packagingExp,
                color: G.blue,
                glass: G.blueGlass,
              },
              {
                label: "🏠 Fixed",
                val: fixedExp,
                color: "#94a3b8",
                glass: "rgba(148,163,184,0.1)",
              },
              {
                label: "📣 Marketing",
                val: marketingExp,
                color: "#f472b6",
                glass: "rgba(244,114,182,0.1)",
              },
            ].map(({ label, val, color, glass }) => (
              <div
                key={label}
                style={{
                  background: glass,
                  border: `1px solid ${color}25`,
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.62rem",
                    color,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                  }}
                >
                  {label}
                </p>
                <p style={{ fontSize: "1.3rem", fontWeight: 700, color }}>
                  ₹{val.toLocaleString()}
                </p>
                <p style={{ fontSize: "0.65rem", color: G.muted }}>
                  {totalExpenses > 0
                    ? Math.round((val / totalExpenses) * 100)
                    : 0}
                  %
                </p>
              </div>
            ))}
          </div>

          {/* Expense log + add form */}
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
                marginBottom: 14,
                fontWeight: 700,
              }}
            >
              Expense Log
            </p>
            {periodExpenses.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: G.muted }}>
                No expenses this period
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
                      borderBottom: `1px solid ${G.glassBorder}`,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: 5, marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: G.glass,
                            color: G.sub,
                          }}
                        >
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          color: G.text,
                        }}
                      >
                        {e.description}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: G.muted }}>
                        {new Date(e.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: G.red,
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
                          color: G.muted,
                          cursor: "pointer",
                          fontSize: "1rem",
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
                borderTop: `1px solid ${G.glassBorder}`,
              }}
            >
              <p
                style={{
                  fontSize: "0.72rem",
                  color: G.muted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  marginBottom: 10,
                  fontWeight: 700,
                }}
              >
                Add Expense
              </p>
              <GlassInput
                placeholder="Description *"
                value={ne.description}
                onChange={(v) => setNe((e) => ({ ...e, description: v }))}
              />
              <GlassInput
                placeholder="Amount ₹ *"
                type="number"
                value={ne.amount}
                onChange={(v) => setNe((e) => ({ ...e, amount: v }))}
              />
              <GlassInput
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
                  style={selectStyle}
                >
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k} style={{ background: "#1a2535" }}>
                      {v.icon} {v.label}
                    </option>
                  ))}
                </select>
                <GlassInput
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
                  padding: "11px",
                  borderRadius: 10,
                  border: "none",
                  background:
                    saving || !ne.description || !ne.amount
                      ? G.glass
                      : G.blueGlass,
                  color:
                    saving || !ne.description || !ne.amount ? G.muted : G.blue,
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {saving ? "Adding..." : "Add Expense"}
              </button>
              <ExpenseImporter onImport={handleExpenseImport} />
            </div>
          </div>

          {/* Top flavours chart */}
          {topFlavours.length > 0 && (
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
                  marginBottom: 14,
                  fontWeight: 700,
                }}
              >
                Top Flavours
              </p>
              {topFlavours.map(([name, count], i) => {
                const c = getFlavourColor(name);
                return (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: c.dot,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: i === 0 ? 700 : 400,
                            color: G.text,
                          }}
                        >
                          {name}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.8rem", color: G.muted }}>
                        {count}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(count / topFlavours[0][1]) * 100}%`,
                          background: c.dot,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sales by box */}
          {Object.keys(boxRevenue).length > 0 && (
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
                  marginBottom: 14,
                  fontWeight: 700,
                }}
              >
                Sales by Box
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
                      borderBottom: `1px solid ${G.glassBorder}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        color: G.text,
                      }}
                    >
                      {label}
                    </span>
                    <div style={{ textAlign: "right" as const }}>
                      <p
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: G.blue,
                        }}
                      >
                        ₹{data.revenue.toLocaleString()}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: G.muted }}>
                        {data.count} orders
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 23 — MORE TAB (Products + Boxes)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {tab === "more" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          {/* Sub-tab toggle */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 16,
              border: `1px solid ${G.glassBorder}`,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {(["products", "boxes"] as MoreTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setMoreTab(t)}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "none",
                  fontFamily: "system-ui, sans-serif",
                  background: moreTab === t ? G.blueGlass : G.glass,
                  color: moreTab === t ? G.blue : G.muted,
                  fontSize: "0.85rem",
                  fontWeight: moreTab === t ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {t === "products" ? "🍡 Products" : "📦 Box Sizes"}
              </button>
            ))}
          </div>

          {/* Products list */}
          {moreTab === "products" && (
            <div>
              {products.map((prod) => (
                <div
                  key={prod.id}
                  style={{
                    background: G.glass,
                    border: `1px solid ${G.glassBorder}`,
                    borderRadius: 12,
                    marginBottom: 8,
                    overflow: "hidden",
                  }}
                >
                  {editingProduct === prod.id ? (
                    <div style={{ padding: 16 }}>
                      <p
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: G.sub,
                          marginBottom: 12,
                        }}
                      >
                        Editing: {prod.name}
                      </p>
                      <GlassInput
                        placeholder="Name *"
                        value={ep.name}
                        onChange={(v) => setEp((p) => ({ ...p, name: v }))}
                      />
                      <GlassInput
                        placeholder="Description"
                        value={ep.description}
                        onChange={(v) =>
                          setEp((p) => ({ ...p, description: v }))
                        }
                      />
                      <GlassInput
                        placeholder="Image URL"
                        value={ep.image_url}
                        onChange={(v) => setEp((p) => ({ ...p, image_url: v }))}
                      />
                      {ep.image_url && (
                        <img
                          src={ep.image_url}
                          alt="preview"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: "cover" as const,
                            borderRadius: 8,
                            marginBottom: 10,
                            border: `1px solid ${G.glassBorder}`,
                          }}
                        />
                      )}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: "0.85rem",
                          marginBottom: 14,
                          cursor: "pointer",
                          color: G.sub,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={ep.is_premium}
                          onChange={(e) =>
                            setEp((p) => ({
                              ...p,
                              is_premium: e.target.checked,
                            }))
                          }
                          style={{ width: "auto", accentColor: G.gold }}
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
                            borderRadius: 9,
                            border: "none",
                            background: G.blueGlass,
                            color: G.blue,
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "system-ui, sans-serif",
                          }}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <GlassBtn onClick={() => setEditingProduct(null)}>
                          Cancel
                        </GlassBtn>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                      }}
                    >
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            objectFit: "cover" as const,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            background: G.glass,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.4rem",
                            border: `1px solid ${G.glassBorder}`,
                          }}
                        >
                          🍡
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: G.text,
                          }}
                        >
                          {prod.name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.72rem",
                            color: G.muted,
                            lineHeight: 1.4,
                            marginBottom: 2,
                          }}
                        >
                          {prod.description || "No description"}
                        </p>
                        <p style={{ fontSize: "0.72rem" }}>
                          {prod.is_premium ? (
                            <span style={{ color: G.gold, fontWeight: 600 }}>
                              ★ Premium
                            </span>
                          ) : (
                            <span style={{ color: G.muted }}>Regular</span>
                          )}
                          {" · "}
                          <span
                            style={{
                              color: prod.is_available ? G.green : G.red,
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
                        <GlassBtn
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
                        </GlassBtn>
                        <GlassBtn
                          onClick={async () => {
                            await supabase
                              .from("products")
                              .update({ is_available: !prod.is_available })
                              .eq("id", prod.id);
                            load();
                          }}
                        >
                          {prod.is_available ? "Hide" : "Show"}
                        </GlassBtn>
                        <GlassBtn
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
                        </GlassBtn>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add product form */}
              <div
                style={{
                  background: G.glass,
                  border: `1px solid ${G.glassBorder}`,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: G.muted,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  Add Product
                </p>
                <GlassInput
                  placeholder="Name *"
                  value={np.name}
                  onChange={(v) => setNp((p) => ({ ...p, name: v }))}
                />
                <GlassInput
                  placeholder="Description"
                  value={np.description}
                  onChange={(v) => setNp((p) => ({ ...p, description: v }))}
                />
                <GlassInput
                  placeholder="Image URL"
                  value={np.image_url}
                  onChange={(v) => setNp((p) => ({ ...p, image_url: v }))}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.85rem",
                    marginBottom: 14,
                    cursor: "pointer",
                    color: G.sub,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={np.is_premium}
                    onChange={(e) =>
                      setNp((p) => ({ ...p, is_premium: e.target.checked }))
                    }
                    style={{ width: "auto", accentColor: G.gold }}
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
                    padding: "11px",
                    borderRadius: 10,
                    border: "none",
                    background: saving || !np.name ? G.glass : G.blueGlass,
                    color: saving || !np.name ? G.muted : G.blue,
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {saving ? "Adding..." : "Add Product"}
                </button>
              </div>
            </div>
          )}

          {/* Box sizes */}
          {moreTab === "boxes" && (
            <div>
              {boxes.map((box) => (
                <div
                  key={box.id}
                  style={{
                    background: G.glass,
                    border: `1px solid ${G.glassBorder}`,
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        color: G.text,
                      }}
                    >
                      {box.label}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: G.muted }}>
                      {box.count} pieces · ₹{box.price} ·{" "}
                      <span
                        style={{
                          color: box.is_active ? G.green : G.red,
                          fontWeight: 600,
                        }}
                      >
                        {box.is_active ? "Active" : "Hidden"}
                      </span>
                    </p>
                  </div>
                  <GlassBtn
                    onClick={async () => {
                      await supabase
                        .from("box_sizes")
                        .update({ is_active: !box.is_active })
                        .eq("id", box.id);
                      load();
                    }}
                  >
                    {box.is_active ? "Hide" : "Show"}
                  </GlassBtn>
                </div>
              ))}

              {/* Add box form */}
              <div
                style={{
                  background: G.glass,
                  border: `1px solid ${G.glassBorder}`,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: G.muted,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  Add Box Size
                </p>
                <GlassInput
                  placeholder="Label (e.g. Box of 20) *"
                  value={nb.label}
                  onChange={(v) => setNb((b) => ({ ...b, label: v }))}
                />
                <GlassInput
                  type="number"
                  placeholder="Pieces *"
                  value={nb.count}
                  onChange={(v) => setNb((b) => ({ ...b, count: v }))}
                />
                <GlassInput
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
                    padding: "11px",
                    borderRadius: 10,
                    border: "none",
                    background: "#1976d2",
                    color: "#fff",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {saving ? "Adding..." : "Add Box Size"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 24 — BOTTOM NAV
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        style={{
          position: "fixed" as const,
          bottom: 0,
          left: 0,
          right: 0,
          background: G.navBg,
          borderTop: `1px solid ${G.navBorder}`,
          zIndex: 200,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          <NavBtn id="cook" icon="🍡" label="Cook" />
          <NavBtn
            id="pending_payment"
            icon="💳"
            label="Payment"
            badge={pendingCount}
          />
          <NavBtn id="dispatched" icon="✅" label="Done" />
          <NavBtn id="customers" icon="👥" label="Customers" />
          <NavBtn id="dashboard" icon="📊" label="Dash" />
          <NavBtn id="more" icon="⚙️" label="More" />
        </div>
      </div>
    </main>
  );
}
