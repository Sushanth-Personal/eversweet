"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize, TimeSlot, Order } from "@/lib/types";

type Tab =
  | "orders"
  | "dispatched"
  | "customers"
  | "dashboard"
  | "products"
  | "slots"
  | "boxes";

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
  confirmed: "Order Confirmed",
  cooking: "Cooking",
  cooked: "Completed Cooking",
  porter_booked: "Porter Booked",
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
function nextStatus(s: string): string | null {
  const i = STATUS_FLOW.indexOf(s as (typeof STATUS_FLOW)[number]);
  return i === -1 || i === STATUS_FLOW.length - 1 ? null : STATUS_FLOW[i + 1];
}

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
  fixed: { label: "Fixed Cost", color: "#37474f", bg: "#eceff1", icon: "🏠" },
  other: { label: "Other", color: "#555555", bg: "#f5f5f5", icon: "📋" },
};

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
};

// ── TRACKING START DATE — set once, never change ──────────────────
// This is the date from which cost/revenue tracking begins.
// All data before this date is ignored in the cost per mochi calculation.
const TRACKING_START_DATE = "2026-04-21";

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
};

// ── Shared components ──────────────────────────────────────────────
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "purple" | "orange";
  disabled?: boolean;
}) {
  const s: Record<string, React.CSSProperties> = {
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
    danger: { background: T.redBg, color: T.red, border: "1px solid #ef9a9a" },
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
        ...s[variant],
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

// ── Order card ─────────────────────────────────────────────────────
function OrderCard({
  order,
  isRepeat,
  slotLabel,
  productMap,
  onStatusChange,
  onCancel,
  onPorterEmail,
}: {
  order: ExtOrder;
  isRepeat: boolean;
  slotLabel: string;
  productMap: Record<string, string>;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onPorterEmail: (order: ExtOrder, slotLabel: string) => Promise<void>;
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
        {order.source === "dm" && (
          <span
            style={{
              fontSize: "0.65rem",
              padding: "2px 8px",
              borderRadius: 10,
              background: "#fce4ec",
              color: "#c2185b",
              fontWeight: 600,
            }}
          >
            📱 DM
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
          📞 {order.phone || "—"}
        </span>
        {order.phone && <CopyBtn value={order.phone} label="Phone" />}
      </div>
      {order.insta_id && (
        <p style={{ fontSize: "0.82rem", color: "#c2185b", marginBottom: 4 }}>
          📸 @{order.insta_id}
        </p>
      )}
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
      {order.remarks && (
        <p
          style={{
            fontSize: "0.82rem",
            color: "#558b2f",
            fontStyle: "italic" as const,
            marginBottom: 4,
          }}
        >
          💬 {order.remarks}
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
          📝 {order.notes}
        </p>
      )}
      <p style={{ fontSize: "0.72rem", color: T.muted, marginBottom: 12 }}>
        {new Date(order.created_at).toLocaleString("en-IN")}
        {order.dob ? ` · DOB: ${order.dob}` : ""}
      </p>
      {order.status !== "dispatched" && order.status !== "cancelled" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
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

// ── Manual order form ──────────────────────────────────────────────
function ManualOrderForm({
  boxes,
  customers,
  products,
  slots,
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
  slots: TimeSlot[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    insta_id: "",
    address: "",
    dob: "",
    remarks: "",
    notes: "",
    order_date: new Date().toISOString().split("T")[0],
    payment_method: "upi",
    status: "dispatched",
    time_slot_id: "",
  });

  const [boxRows, setBoxRows] = useState<
    { box_size_label: string; price: string }[]
  >([{ box_size_label: "", price: "" }]);

  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<typeof customers>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const f = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const totalPrice = boxRows.reduce(
    (sum, r) => sum + (Number(r.price) || 0),
    0,
  );

  function handleNameChange(v: string) {
    setForm((p) => ({ ...p, customer_name: v }));
    if (v.trim().length >= 1) {
      const matches = customers.filter((c) =>
        c.name.toLowerCase().startsWith(v.toLowerCase()),
      );
      setNameSuggestions(matches.slice(0, 6));
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }

  function selectCustomer(c: (typeof customers)[0]) {
    setForm((p) => ({
      ...p,
      customer_name: c.name,
      phone: c.phone || p.phone,
      insta_id: c.insta_id || p.insta_id,
      remarks: c.remarks || p.remarks,
    }));
    setShowSuggestions(false);
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
      } else {
        updated[i] = { ...updated[i], price: value };
      }
      return updated;
    });
  }

  function setFlavourQty(productId: string, qty: number) {
    setFlavours((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    let isFirst = true;
    for (const row of boxRows) {
      if (!row.price) continue;
      const box = boxes.find((b) => b.label === row.box_size_label);
      await supabase.from("orders").insert({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        insta_id: form.insta_id.trim(),
        address: form.address.trim() || null,
        dob: form.dob.trim() || null,
        remarks: form.remarks.trim(),
        notes: form.notes.trim() || null,
        box_size_id: box?.id || null,
        flavours: isFirst && Object.keys(flavours).length > 0 ? flavours : {},
        time_slot_id: form.time_slot_id || null,
        payment_method: form.payment_method,
        total_price: Number(row.price),
        status: form.status,
        source: "dm",
        order_date: form.order_date,
      });
      isFirst = false;
    }
    setSaving(false);
    onSave();
  }

  return (
    <div
      style={{
        background: T.white,
        border: `2px solid #1976d2`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1976d2" }}>
          Add Manual Order (DM / Walk-in)
        </p>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: T.muted,
            cursor: "pointer",
            fontSize: "1.1rem",
          }}
        >
          ✕
        </button>
      </div>

      {/* Customer name with autocomplete */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 8px",
        }}
      >
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Customer Name *"
            value={form.customer_name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => {
              if (nameSuggestions.length > 0) setShowSuggestions(true);
            }}
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
              boxSizing: "border-box" as const,
            }}
          />
          {showSuggestions && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: T.white,
                border: `1px solid #1976d2`,
                borderRadius: 6,
                zIndex: 200,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                marginTop: -6,
                overflow: "hidden",
              }}
            >
              {nameSuggestions.map((c, i) => (
                <div
                  key={i}
                  onMouseDown={() => selectCustomer(c)}
                  style={{
                    padding: "9px 12px",
                    cursor: "pointer",
                    borderBottom:
                      i < nameSuggestions.length - 1
                        ? `1px solid ${T.border}`
                        : "none",
                    background: T.white,
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background =
                      T.blueBg)
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background =
                      T.white)
                  }
                >
                  <p
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: T.text,
                    }}
                  >
                    {c.name}
                  </p>
                  {c.phone && (
                    <p style={{ fontSize: "0.72rem", color: T.muted }}>
                      📞 {c.phone}
                      {c.insta_id ? `  ·  📸 @${c.insta_id}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <Input placeholder="Phone" value={form.phone} onChange={f("phone")} />
        <Input
          placeholder="Instagram ID (without @)"
          value={form.insta_id}
          onChange={f("insta_id")}
        />
        <Input
          placeholder="DOB (DD/MM/YYYY)"
          value={form.dob}
          onChange={f("dob")}
        />
      </div>

      <Input
        placeholder="Address"
        value={form.address}
        onChange={f("address")}
      />

      {/* Time slot */}
      <select
        value={form.time_slot_id}
        onChange={(e) =>
          setForm((p) => ({ ...p, time_slot_id: e.target.value }))
        }
        style={{
          width: "100%",
          background: T.white,
          border: `1px solid ${T.border}`,
          color: form.time_slot_id ? T.text : T.muted,
          padding: "10px 12px",
          borderRadius: 6,
          fontSize: "0.9rem",
          marginBottom: 8,
          fontFamily: "system-ui, sans-serif",
          outline: "none",
        }}
      >
        <option value="">No slot (DM order)</option>
        {slots
          .filter((s) => s.is_active)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ·{" "}
              {new Date(s.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </option>
          ))}
      </select>

      {/* Box rows */}
      <p
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: T.sub,
          marginBottom: 8,
          marginTop: 4,
        }}
      >
        📦 Boxes
      </p>
      {boxRows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px 32px",
            gap: 6,
            marginBottom: 6,
            alignItems: "center",
          }}
        >
          <select
            value={row.box_size_label}
            onChange={(e) => updateBoxRow(i, "box_size_label", e.target.value)}
            style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              color: row.box_size_label ? T.text : T.muted,
              padding: "10px 12px",
              borderRadius: 6,
              fontSize: "0.88rem",
              fontFamily: "system-ui, sans-serif",
              outline: "none",
            }}
          >
            <option value="">Select box</option>
            {boxes.map((b) => (
              <option key={b.id} value={b.label}>
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
              background: T.white,
              border: `1px solid ${T.border}`,
              color: T.text,
              padding: "10px 10px",
              borderRadius: 6,
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
              background: T.redBg,
              border: `1px solid #ef9a9a`,
              color: T.red,
              borderRadius: 5,
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
            borderRadius: 5,
            border: `1px solid #1976d2`,
            background: T.blueBg,
            color: "#1976d2",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          + Add Box
        </button>
        {totalPrice > 0 && (
          <p style={{ fontSize: "0.88rem", fontWeight: 700, color: T.gold }}>
            Total: ₹{totalPrice}
          </p>
        )}
      </div>

      {/* Flavours */}
      {products.filter((p) => p.is_available).length > 0 && (
        <>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: T.sub,
              marginBottom: 8,
            }}
          >
            🍡 Flavours
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              marginBottom: 12,
            }}
          >
            {products
              .filter((p) => p.is_available)
              .map((prod) => {
                const qty = flavours[prod.id] || 0;
                return (
                  <div
                    key={prod.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: `1px solid ${qty > 0 ? "#1976d2" : T.border}`,
                      background: qty > 0 ? T.blueBg : T.white,
                      transition: "all 0.15s",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: qty > 0 ? 600 : 400,
                        color: qty > 0 ? "#1976d2" : T.text,
                        flex: 1,
                      }}
                    >
                      {prod.name}
                      {prod.is_premium && (
                        <span style={{ color: T.gold, marginLeft: 4 }}>★</span>
                      )}
                    </span>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <button
                        onClick={() => setFlavourQty(prod.id, qty - 1)}
                        disabled={qty === 0}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          border: `1px solid ${T.border}`,
                          background: T.white,
                          color: T.sub,
                          cursor: qty === 0 ? "not-allowed" : "pointer",
                          fontSize: "1rem",
                          lineHeight: "1",
                          opacity: qty === 0 ? 0.3 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          minWidth: 16,
                          textAlign: "center" as const,
                          color: T.text,
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        onClick={() => setFlavourQty(prod.id, qty + 1)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          border: `1px solid #1976d2`,
                          background: "#1976d2",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "1rem",
                          lineHeight: "1",
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

      {/* Date / status / remarks */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 8px",
        }}
      >
        <Input
          placeholder="Order Date *"
          type="date"
          value={form.order_date}
          onChange={f("order_date")}
        />
        <select
          value={form.status}
          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          style={{
            width: "100%",
            background: T.white,
            border: `1px solid ${T.border}`,
            color: T.text,
            padding: "10px 12px",
            borderRadius: 6,
            fontSize: "0.9rem",
            marginBottom: 8,
            fontFamily: "system-ui, sans-serif",
            outline: "none",
          }}
        >
          <option value="dispatched">Dispatched (already delivered)</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </div>
      <Input
        placeholder="Remarks (customer feedback, notes)"
        value={form.remarks}
        onChange={f("remarks")}
      />
      <Input
        placeholder="Internal notes"
        value={form.notes}
        onChange={f("notes")}
      />

      <button
        disabled={saving || !form.customer_name || totalPrice === 0}
        onClick={handleSave}
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 6,
          border: "none",
          background:
            saving || !form.customer_name || totalPrice === 0
              ? "#ccc"
              : "#1976d2",
          color: "#fff",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {saving
          ? "Saving…"
          : `Save ${
              boxRows.filter((r) => r.price).length > 1
                ? `${boxRows.filter((r) => r.price).length} Orders`
                : "Order"
            } · ₹${totalPrice}`}
      </button>
    </div>
  );
}

// ── Bulk import JSON for orders ────────────────────────────────────
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
          padding: "8px 16px",
          borderRadius: 6,
          border: `1px solid ${T.border}`,
          background: T.white,
          color: T.sub,
          fontSize: "0.82rem",
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        📂 Bulk Import Orders (JSON / Excel export)
      </button>
    );

  return (
    <div
      style={{
        background: T.white,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: T.sub }}>
          Paste order JSON
        </p>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: T.muted,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
      <pre
        style={{
          background: "#f8f8f8",
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: "0.68rem",
          color: T.sub,
          marginBottom: 8,
          overflowX: "auto" as const,
        }}
      >
        {`[{ "customer_name":"Name", "phone":"", "insta_id":"",
   "box_size_label":"Box of 4", "total_price":499,
   "order_date":"2026-04-20", "status":"dispatched",
   "remarks":"", "payment_method":"upi" }]`}
      </pre>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste JSON here..."
        style={{
          width: "100%",
          minHeight: 100,
          background: "#f8f8f8",
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: "0.78rem",
          color: T.text,
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
          borderRadius: 6,
          border: "none",
          background: "#1976d2",
          color: "#fff",
          fontSize: "0.85rem",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {importing ? "Importing…" : "Import Orders"}
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");

  const [orders, setOrders] = useState<ExtOrder[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
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

  // ── Default to "from_start" so cost calc ignores all history ──
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

  const load = useCallback(async () => {
    const [{ data: o }, { data: s }, { data: p }, { data: b }, { data: ex }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("time_slots").select("*").order("date").order("label"),
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
    if (!slotId) return "DM Order";
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return "DM Order";
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

  async function handlePorterEmail(order: ExtOrder, slotLabel: string) {
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
      if (res.ok) flash("📧 Porter email sent ✓");
      else flash("Email send failed", "error");
    } catch {
      flash("Email send failed", "error");
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
      const valid = items
        .filter((e) => e.description && Number(e.amount) > 0)
        .map((e) => ({
          description: String(e.description).trim(),
          amount: Number(e.amount),
          category: e.category || "ingredient",
          date: e.date || new Date().toISOString().split("T")[0],
          note: e.note || "",
        }));
      if (valid.length === 0) throw new Error("No valid entries");
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

  // ── Customer grouping ──────────────────────────────────────────
  const customerMap: Record<
    string,
    {
      name: string;
      phone: string;
      insta_id: string;
      remarks: string;
      orders: ExtOrder[];
      total: number;
      latest_id: string;
    }
  > = {};
  orders.forEach((o) => {
    const key = o.phone || o.customer_name;
    if (!customerMap[key]) {
      customerMap[key] = {
        name: o.customer_name,
        phone: o.phone || "",
        insta_id: (o as ExtOrder).insta_id || "",
        remarks: (o as ExtOrder).remarks || "",
        orders: [],
        total: 0,
        latest_id: o.id,
      };
    }
    customerMap[key].orders.push(o);
    customerMap[key].total += o.total_price || 0;
    if (
      new Date(o.created_at) >
      new Date(customerMap[key].orders[0]?.created_at || 0)
    ) {
      customerMap[key].latest_id = o.id;
      customerMap[key].insta_id =
        (o as ExtOrder).insta_id || customerMap[key].insta_id;
      customerMap[key].remarks =
        (o as ExtOrder).remarks || customerMap[key].remarks;
    }
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

  // ── Dashboard period filtering ─────────────────────────────────
  // FIX: from_start uses a fixed date so data accumulates correctly.
  // Each filter function returns a filtered array (not nested filter).
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
      const dateStr =
        (item as Record<string, string>).order_date || item.created_at;
      const d = new Date(dateStr);
      if (dashPeriod === "from_start") {
        const start = new Date(TRACKING_START_DATE);
        start.setHours(0, 0, 0, 0);
        return d >= start;
      }
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

  function filterExpByPeriod(items: Expense[]): Expense[] {
    const now = new Date();
    return items.filter((item) => {
      const d = new Date(item.date);
      if (dashPeriod === "from_start") {
        const start = new Date(TRACKING_START_DATE);
        start.setHours(0, 0, 0, 0);
        return d >= start;
      }
      if (dashPeriod === "today")
        return d.toDateString() === now.toDateString();
      if (dashPeriod === "week")
        return now.getTime() - d.getTime() < 7 * 86400000;
      if (dashPeriod === "month")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return true; // "all"
    });
  }

  const paidOrders = filterByPeriod(
    orders.filter((o) => PAID_STATUSES.includes(o.status)),
  ) as ExtOrder[];
  const periodExpenses = filterExpByPeriod(expenses);
  const totalRevenue = paidOrders.reduce(
    (sum, o) => sum + (o.total_price || 0),
    0,
  );
  const totalExpenses = periodExpenses.reduce(
    (sum, e) => sum + (e.amount || 0),
    0,
  );
  const ingredientExp = periodExpenses
    .filter((e) => e.category === "ingredient")
    .reduce((sum, e) => sum + e.amount, 0);
  const packagingExp = periodExpenses
    .filter((e) => e.category === "packaging")
    .reduce((sum, e) => sum + e.amount, 0);
  const fixedExp = periodExpenses
    .filter((e) => e.category === "fixed")
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

  // ── Period button label helper ─────────────────────────────────
  function periodLabel(p: string): string {
    if (p === "from_start") return "📌 From Start";
    if (p === "today") return "Today";
    if (p === "week") return "This Week";
    if (p === "month") return "This Month";
    return "All Time";
  }

  // ── Login ──────────────────────────────────────────────────────
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
      {/* Nav */}
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
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
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
          <div style={{ display: "flex", gap: 8 }}>
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
              ↻
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("es_admin");
                setAuthed(false);
              }}
              style={{
                background: "transparent",
                border: `1px solid ${T.border}`,
                color: T.muted,
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
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
              { id: "customers", label: `Customers (${customers.length})` },
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
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                borderBottom:
                  tab === t.id ? "2px solid #1976d2" : "2px solid transparent",
                color: tab === t.id ? "#1976d2" : T.muted,
                fontSize: "0.8rem",
                fontWeight: tab === t.id ? 700 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap" as const,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {t.label}
              {t.id === "orders" && pendingCount > 0 && (
                <span
                  style={{
                    marginLeft: 5,
                    background: "#f44336",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 5px",
                    fontSize: "0.6rem",
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
        style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 80px" }}
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

        {/* ── ORDERS ─────────────────────────────────────────── */}
        {tab === "orders" && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 12,
                overflowX: "auto" as const,
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

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => setShowManualForm((f) => !f)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #1976d2",
                  background: T.blueBg,
                  color: "#1976d2",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                + Add Manual Order
              </button>
            </div>

            {showManualForm && (
              // In the tab === "orders" section, find ManualOrderForm and add customers prop:
              <ManualOrderForm
                boxes={boxes}
                slots={slots}
                customers={customers.map((c) => ({
                  name: c.name,
                  phone: c.phone,
                  insta_id: c.insta_id || "",
                  remarks: c.remarks || "",
                }))}
                products={products}
                onSave={() => {
                  load();
                  setShowManualForm(false);
                  flash("Order saved ✓");
                }}
                onClose={() => setShowManualForm(false)}
              />
            )}
            <BulkOrderImport onImport={handleBulkOrderImport} />

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
                <p style={{ color: T.muted }}>No active orders</p>
              </div>
            ) : (
              (() => {
                // Group by (phone or name) + (slot or date)
                const groups: { key: string; orders: ExtOrder[] }[] = [];
                const seen = new Map<string, ExtOrder[]>();

                activeOrders.forEach((o) => {
                  const slotOrDate =
                    o.time_slot_id ||
                    (o as ExtOrder).order_date ||
                    o.created_at?.split("T")[0];
                  const identity =
                    o.phone?.trim() || o.customer_name?.trim().toLowerCase();
                  const key = `${identity}__${slotOrDate}`;

                  if (!seen.has(key)) {
                    seen.set(key, []);
                    groups.push({ key, orders: seen.get(key)! });
                  }
                  seen.get(key)!.push(o);
                });

                return groups.map(({ key, orders: grp }) => {
                  // Single order — render normal OrderCard
                  if (grp.length === 1) {
                    return (
                      <OrderCard
                        key={grp[0].id}
                        order={grp[0]}
                        isRepeat={repeatPhones.has(grp[0].phone)}
                        slotLabel={getSlotLabel(grp[0].time_slot_id)}
                        productMap={productMap}
                        onStatusChange={handleStatusChange}
                        onCancel={handleCancel}
                        onPorterEmail={handlePorterEmail}
                      />
                    );
                  }

                  // Grouped card
                  const first = grp[0];
                  const combinedTotal = grp.reduce(
                    (s, o) => s + (o.total_price || 0),
                    0,
                  );
                  const sc =
                    STATUS_COLORS[first.status] || STATUS_COLORS.pending;
                  const allSameStatus = grp.every(
                    (o) => o.status === first.status,
                  );

                  // Merge flavours across all orders in group
                  const mergedFlavours: Record<string, number> = {};
                  grp.forEach((o) => {
                    if (!o.flavours) return;
                    Object.entries(
                      o.flavours as Record<string, number>,
                    ).forEach(([id, qty]) => {
                      mergedFlavours[id] = (mergedFlavours[id] || 0) + qty;
                    });
                  });
                  const flavourList = Object.entries(mergedFlavours)
                    .filter(([, q]) => q > 0)
                    .map(([id, q]) => `${productMap[id] || "Unknown"} ×${q}`)
                    .join(", ");

                  return (
                    <div
                      key={key}
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
                      {/* Name row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                          flexWrap: "wrap" as const,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: T.text,
                          }}
                        >
                          {first.customer_name}
                        </span>
                        <CopyBtn value={first.customer_name} label="Name" />
                        {repeatPhones.has(first.phone) && (
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
                        {(first as ExtOrder).source === "dm" && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: "#fce4ec",
                              color: "#c2185b",
                              fontWeight: 600,
                            }}
                          >
                            📱 DM
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.65rem",
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: T.goldBg,
                            color: T.gold,
                            fontWeight: 600,
                          }}
                        >
                          📦 {grp.length} boxes
                        </span>
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: "0.7rem",
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: sc.bg,
                            color: sc.text,
                            fontWeight: 700,
                          }}
                        >
                          {allSameStatus
                            ? STATUS_LABELS[first.status]
                            : grp
                                .map((o) => STATUS_LABELS[o.status])
                                .join(" / ")}
                        </span>
                      </div>

                      {/* Phone */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 5,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.9rem",
                            color: T.text,
                            fontWeight: 500,
                          }}
                        >
                          📞 {first.phone || "—"}
                        </span>
                        {first.phone && (
                          <CopyBtn value={first.phone} label="Phone" />
                        )}
                      </div>

                      {/* Instagram */}
                      {(first as ExtOrder).insta_id && (
                        <p
                          style={{
                            fontSize: "0.82rem",
                            color: "#c2185b",
                            marginBottom: 4,
                          }}
                        >
                          📸 @{(first as ExtOrder).insta_id}
                        </p>
                      )}

                      {/* Address */}
                      {first.address && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            marginBottom: 5,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.85rem",
                              color: T.sub,
                              flex: 1,
                            }}
                          >
                            📍 {first.address}
                          </span>
                          <CopyBtn value={first.address} label="Address" />
                        </div>
                      )}

                      {/* Slot + total */}
                      <p
                        style={{
                          fontSize: "0.85rem",
                          color: T.sub,
                          marginBottom: 6,
                        }}
                      >
                        🕐 {getSlotLabel(first.time_slot_id)} ·{" "}
                        <span style={{ color: T.gold, fontWeight: 600 }}>
                          ₹{combinedTotal}
                        </span>{" "}
                        · {first.payment_method}
                      </p>

                      {/* Per-box breakdown */}
                      <div
                        style={{
                          background: "#fafafa",
                          border: `1px solid ${T.border}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                          marginBottom: 6,
                        }}
                      >
                        {grp.map((o) => {
                          const boxLabel =
                            boxes.find((b) => b.id === o.box_size_id)?.label ||
                            "Unknown box";
                          return (
                            <div
                              key={o.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "3px 0",
                              }}
                            >
                              <span
                                style={{ fontSize: "0.82rem", color: T.sub }}
                              >
                                📦 {boxLabel}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.82rem",
                                  fontWeight: 600,
                                  color: T.gold,
                                }}
                              >
                                ₹{o.total_price}
                              </span>
                            </div>
                          );
                        })}
                        <div
                          style={{
                            borderTop: `1px solid ${T.border}`,
                            marginTop: 4,
                            paddingTop: 4,
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ fontSize: "0.78rem", color: T.muted }}>
                            Combined
                          </span>
                          <span
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: T.gold,
                            }}
                          >
                            ₹{combinedTotal}
                          </span>
                        </div>
                      </div>

                      {/* Flavours */}
                      {flavourList && (
                        <p
                          style={{
                            fontSize: "0.82rem",
                            color: T.muted,
                            marginBottom: 4,
                          }}
                        >
                          🍡 {flavourList}
                        </p>
                      )}

                      {/* Remarks */}
                      {(first as ExtOrder).remarks && (
                        <p
                          style={{
                            fontSize: "0.82rem",
                            color: "#558b2f",
                            fontStyle: "italic" as const,
                            marginBottom: 4,
                          }}
                        >
                          💬 {(first as ExtOrder).remarks}
                        </p>
                      )}

                      <p
                        style={{
                          fontSize: "0.72rem",
                          color: T.muted,
                          marginBottom: 12,
                        }}
                      >
                        {new Date(first.created_at).toLocaleString("en-IN")}
                      </p>

                      {/* Action buttons — advance/cancel all */}
                      {grp.every(
                        (o) =>
                          o.status !== "dispatched" && o.status !== "cancelled",
                      ) && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap" as const,
                          }}
                        >
                          {nextStatus(first.status) && (
                            <button
                              onClick={async () => {
                                for (const o of grp) {
                                  const next = nextStatus(o.status);
                                  if (next === "porter_booked") {
                                    await handlePorterEmail(
                                      o,
                                      getSlotLabel(o.time_slot_id),
                                    );
                                  }
                                  if (next)
                                    await handleStatusChange(o.id, next);
                                }
                              }}
                              style={{
                                padding: "8px 18px",
                                borderRadius: 5,
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                border: "1px solid",
                                fontFamily: "system-ui, sans-serif",
                                transition: "all 0.15s",
                                ...(first.status === "pending"
                                  ? {
                                      background: "#e3f2fd",
                                      color: "#1565c0",
                                      borderColor: "#42a5f5",
                                    }
                                  : first.status === "confirmed"
                                    ? {
                                        background: "#fff3e0",
                                        color: "#e65100",
                                        borderColor: "#ffa726",
                                      }
                                    : first.status === "cooking"
                                      ? {
                                          background: "#e8f5e9",
                                          color: "#2e7d32",
                                          borderColor: "#66bb6a",
                                        }
                                      : first.status === "cooked"
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
                              {first.status === "pending"
                                ? "→ Confirm Order"
                                : first.status === "confirmed"
                                  ? "→ Start Cooking"
                                  : first.status === "cooking"
                                    ? "✓ Cooking Done"
                                    : first.status === "cooked"
                                      ? "📦 Book Porter"
                                      : "→ Mark Dispatched"}
                            </button>
                          )}
                          <Btn
                            variant="danger"
                            onClick={async () => {
                              if (
                                !confirm(
                                  `Cancel all orders for ${first.customer_name}?`,
                                )
                              )
                                return;
                              for (const o of grp) await handleCancel(o.id);
                            }}
                          >
                            Cancel All
                          </Btn>
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* ── DISPATCHED ─────────────────────────────────────── */}
        {tab === "dispatched" && (
          <div>
            <p style={{ fontSize: "0.8rem", color: T.muted, marginBottom: 14 }}>
              {dispatchedOrders.length} dispatched orders
            </p>
            {dispatchedOrders.map((o) => (
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
                          }}
                        >
                          🔄
                        </span>
                      )}
                      {(o as ExtOrder).source === "dm" && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "#c2185b",
                            background: "#fce4ec",
                            padding: "1px 7px",
                            borderRadius: 10,
                          }}
                        >
                          📱 DM
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.82rem", color: T.sub }}>
                      {o.phone || "—"} ·{" "}
                      <span style={{ color: T.gold, fontWeight: 600 }}>
                        ₹{o.total_price}
                      </span>
                    </p>
                    {(o as ExtOrder).insta_id && (
                      <p style={{ fontSize: "0.78rem", color: "#c2185b" }}>
                        📸 @{(o as ExtOrder).insta_id}
                      </p>
                    )}
                    {o.address && (
                      <p style={{ fontSize: "0.8rem", color: T.muted }}>
                        📍 {o.address}
                      </p>
                    )}
                    {(o as ExtOrder).remarks && (
                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "#558b2f",
                          fontStyle: "italic" as const,
                        }}
                      >
                        💬 {(o as ExtOrder).remarks}
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
            ))}
          </div>
        )}

        {/* ── CUSTOMERS ──────────────────────────────────────── */}
        {tab === "customers" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="Search by name, phone, or Instagram..."
                value={customerSearch}
                onChange={setCustomerSearch}
              />
            </div>
            <p style={{ fontSize: "0.8rem", color: T.muted, marginBottom: 14 }}>
              {filteredCustomers.length} customers · ₹
              {customers.reduce((s, c) => s + c.total, 0).toLocaleString()}{" "}
              total revenue
            </p>

            {filteredCustomers.map((c) => (
              <div
                key={c.key}
                style={{
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "14px 16px",
                  marginBottom: 8,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {editingCustomer === c.key ? (
                  <div>
                    <p
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        marginBottom: 10,
                      }}
                    >
                      Editing: {c.name}
                    </p>
                    <Input
                      placeholder="Instagram ID (without @)"
                      value={editInsta}
                      onChange={setEditInsta}
                    />
                    <textarea
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      placeholder="Remarks / notes about this customer"
                      style={{
                        width: "100%",
                        minHeight: 80,
                        background: "#f8f8f8",
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        padding: "10px 12px",
                        fontSize: "0.88rem",
                        color: T.text,
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
                          const ordersForCustomer = c.orders;
                          for (const o of ordersForCustomer) {
                            await supabase
                              .from("orders")
                              .update({
                                insta_id: editInsta.trim(),
                                remarks: editRemarks.trim(),
                              })
                              .eq("id", o.id);
                          }
                          setEditingCustomer(null);
                          await load();
                          flash("Customer updated ✓");
                        }}
                        style={{
                          padding: "9px 20px",
                          borderRadius: 6,
                          border: "none",
                          background: "#1976d2",
                          color: "#fff",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "system-ui, sans-serif",
                        }}
                      >
                        Save
                      </button>
                      <Btn onClick={() => setEditingCustomer(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div>
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
                            gap: 8,
                            marginBottom: 5,
                            flexWrap: "wrap" as const,
                          }}
                        >
                          <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                            {c.name}
                          </p>
                          {c.orders.length > 1 && (
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
                              🔄 {c.orders.length}x customer
                            </span>
                          )}
                        </div>
                        {c.phone && (
                          <p
                            style={{
                              fontSize: "0.85rem",
                              color: T.sub,
                              marginBottom: 3,
                            }}
                          >
                            📞 {c.phone}
                          </p>
                        )}
                        {c.insta_id && (
                          <p
                            style={{
                              fontSize: "0.82rem",
                              color: "#c2185b",
                              marginBottom: 3,
                            }}
                          >
                            📸 @{c.insta_id}
                          </p>
                        )}
                        <p
                          style={{
                            fontSize: "0.82rem",
                            color: T.muted,
                            marginBottom: 3,
                          }}
                        >
                          {c.orders.length} order
                          {c.orders.length > 1 ? "s" : ""} ·{" "}
                          <span style={{ color: T.gold, fontWeight: 700 }}>
                            ₹{c.total.toLocaleString()}
                          </span>{" "}
                          total
                        </p>
                        <div
                          style={{
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: `1px solid ${T.border}`,
                          }}
                        >
                          {c.orders.slice(0, 3).map((o) => (
                            <p
                              key={o.id}
                              style={{
                                fontSize: "0.75rem",
                                color: T.muted,
                                marginBottom: 2,
                              }}
                            >
                              {(o as ExtOrder).order_date ||
                                o.created_at?.split("T")[0]}{" "}
                              ·{" "}
                              {boxes.find((b) => b.id === o.box_size_id)
                                ?.label || `Box`}{" "}
                              · ₹{o.total_price}
                              {o.status === "cancelled" && (
                                <span style={{ color: T.red }}>
                                  {" "}
                                  · cancelled
                                </span>
                              )}
                            </p>
                          ))}
                          {c.orders.length > 3 && (
                            <p style={{ fontSize: "0.72rem", color: T.muted }}>
                              +{c.orders.length - 3} more
                            </p>
                          )}
                        </div>
                        {c.remarks && (
                          <p
                            style={{
                              fontSize: "0.8rem",
                              color: "#558b2f",
                              fontStyle: "italic" as const,
                              marginTop: 6,
                            }}
                          >
                            💬 {c.remarks}
                          </p>
                        )}
                      </div>
                      <Btn
                        variant="primary"
                        onClick={() => {
                          setEditingCustomer(c.key);
                          setEditInsta(c.insta_id || "");
                          setEditRemarks(c.remarks || "");
                        }}
                      >
                        Edit
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── DASHBOARD ──────────────────────────────────────── */}
        {tab === "dashboard" && (
          <div>
            {/* Period selector */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap" as const,
              }}
            >
              {(["from_start", "today", "week", "month", "all"] as const).map(
                (p) => (
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
                    {periodLabel(p)}
                  </button>
                ),
              )}
            </div>
            {/* Show the tracking start date when From Start is active */}
            {dashPeriod === "from_start" && (
              <p
                style={{ fontSize: "0.72rem", color: T.blue, marginBottom: 6 }}
              >
                📌 Tracking from{" "}
                {new Date(TRACKING_START_DATE).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                onwards
              </p>
            )}
            <p
              style={{ fontSize: "0.72rem", color: T.muted, marginBottom: 14 }}
            >
              * Revenue = confirmed orders only. Pending &amp; cancelled
              excluded.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <StatCard
                label="Revenue"
                value={`₹${totalRevenue.toLocaleString()}`}
                sub={`${paidOrders.length} orders`}
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
              />
            </div>

            {/* Expense breakdown */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {[
                {
                  label: "🧪 Ingredients",
                  val: ingredientExp,
                  color: T.green,
                  bg: T.greenBg,
                },
                {
                  label: "📦 Packaging",
                  val: packagingExp,
                  color: T.blue,
                  bg: T.blueBg,
                },
                {
                  label: "🏠 Fixed Costs",
                  val: fixedExp,
                  color: "#37474f",
                  bg: "#eceff1",
                },
              ].map(({ label, val, color, bg }) => (
                <div
                  key={label}
                  style={{
                    background: bg,
                    border: `1px solid ${color}22`,
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.65rem",
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
                  <p style={{ fontSize: "0.68rem", color: T.muted }}>
                    {totalExpenses > 0
                      ? Math.round((val / totalExpenses) * 100)
                      : 0}
                    % of expenses
                  </p>
                </div>
              ))}
            </div>

            {/* Cost per mochi calculator */}
            {/* FIX: uses ingredientExp + packagingExp for true cost per mochi */}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "16px 18px",
                marginBottom: 14,
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
                🍡 Cost per Mochi
              </p>
              <p
                style={{ fontSize: "0.82rem", color: T.sub, marginBottom: 12 }}
              >
                All-time cost per mochi (ingredients + packaging) — unaffected
                by period filter.
              </p>
              {(() => {
                const trackingStart = new Date(TRACKING_START_DATE);
                trackingStart.setHours(0, 0, 0, 0);

                const trackedOrders = orders.filter((o) => {
                  if (!PAID_STATUSES.includes(o.status)) return false;
                  const dateStr = (o as ExtOrder).order_date || o.created_at;
                  return new Date(dateStr) >= trackingStart;
                });

                const trackedExpenses = expenses.filter(
                  (e) => new Date(e.date) >= trackingStart,
                );

                const allIngredientExp = trackedExpenses
                  .filter((e) => e.category === "ingredient")
                  .reduce((sum, e) => sum + e.amount, 0);
                const allPackagingExp = trackedExpenses
                  .filter((e) => e.category === "packaging")
                  .reduce((sum, e) => sum + e.amount, 0);

                const totalMochi = trackedOrders.reduce((sum, o) => {
                  const box = boxes.find((b) => b.id === o.box_size_id);
                  return sum + (box?.count || 0);
                }, 0);
                const costPerMochi =
                  totalMochi > 0
                    ? (allIngredientExp + allPackagingExp) / totalMochi
                    : 0;
                const allRevenue = trackedOrders.reduce(
                  (s, o) => s + (o.total_price || 0),
                  0,
                );
                const revenuePerMochi =
                  totalMochi > 0 ? allRevenue / totalMochi : 0;
                return (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        textAlign: "center" as const,
                        background: T.greenBg,
                        borderRadius: 6,
                        padding: "10px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.65rem",
                          color: T.green,
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        COST / MOCHI
                      </p>
                      <p
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: T.green,
                        }}
                      >
                        {totalMochi > 0 ? `₹${costPerMochi.toFixed(1)}` : "—"}
                      </p>
                      <p style={{ fontSize: "0.65rem", color: T.muted }}>
                        ingredients + packaging
                      </p>
                    </div>
                    <div
                      style={{
                        textAlign: "center" as const,
                        background: T.blueBg,
                        borderRadius: 6,
                        padding: "10px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.65rem",
                          color: T.blue,
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        REVENUE / MOCHI
                      </p>
                      <p
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: T.blue,
                        }}
                      >
                        {totalMochi > 0
                          ? `₹${revenuePerMochi.toFixed(1)}`
                          : "—"}
                      </p>
                      <p style={{ fontSize: "0.65rem", color: T.muted }}>
                        /mochi
                      </p>
                    </div>
                    <div
                      style={{
                        textAlign: "center" as const,
                        background: T.goldBg,
                        borderRadius: 6,
                        padding: "10px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.65rem",
                          color: T.gold,
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        TOTAL MOCHIS
                      </p>
                      <p
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: T.gold,
                        }}
                      >
                        {totalMochi > 0 ? totalMochi : "—"}
                      </p>
                      <p style={{ fontSize: "0.65rem", color: T.muted }}>
                        all-time delivered
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Customers summary */}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "16px 18px",
                marginBottom: 14,
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
                    {
                      new Set(paidOrders.map((o) => o.phone || o.customer_name))
                        .size
                    }
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
                    {paidOrders.filter((o) => o.status === "dispatched").length}
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
                  marginBottom: 14,
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
                {topFlavours.map(([name, count], i) => (
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
                        }}
                      >
                        {name}
                      </span>
                      <span style={{ fontSize: "0.82rem", color: T.muted }}>
                        {count}
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
                          width: `${(count / topFlavours[0][1]) * 100}%`,
                          background: i === 0 ? "#1976d2" : "#90caf9",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                ))}
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
                  marginBottom: 14,
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
                          {data.count} orders
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Expenses log */}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "16px 18px",
                marginBottom: 14,
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
                Expense Log
              </p>
              {periodExpenses.length === 0 ? (
                <p style={{ fontSize: "0.88rem", color: T.muted }}>
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
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      <div>
                        <div
                          style={{ display: "flex", gap: 6, marginBottom: 2 }}
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
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Add expense */}
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
                  placeholder="Description *"
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
                    <option value="fixed">
                      🏠 Fixed Cost (rent, utensils)
                    </option>
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
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {saving ? "Adding…" : "Add Expense"}
                </button>

                {/* JSON import for expenses */}
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: `1px solid ${T.border}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: T.sub,
                      marginBottom: 8,
                    }}
                  >
                    Bulk import expenses (JSON)
                  </p>
                  <label
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: `1px solid #1976d2`,
                      background: T.blueBg,
                      color: "#1976d2",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    📂 Upload JSON File
                    <input
                      type="file"
                      accept=".json"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const text = await f.text();
                        await handleExpenseImport(text);
                        (e.target as HTMLInputElement).value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
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
                  cursor: "pointer",
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
                    · {s.current_orders}/{s.max_orders} ·{" "}
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
                placeholder="Max orders"
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
