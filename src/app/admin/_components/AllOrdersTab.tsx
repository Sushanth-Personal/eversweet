"use client";
import React from "react";
import type { BoxSize } from "@/lib/types";
import { G } from "../_lib/theme";
import { PAID_STATUSES, STATUS_LABELS, type ExtOrder, type OrdersFilterPreset } from "../_lib/constants";
import { FlavourPill } from "./FlavourPill";

export function AllOrdersTab({
  orders,
  productMap,
  boxes,
  onEdit,
  onCancel,
  onStatusChange,
  filterPreset,
  onFilterPresetConsumed,
  dashPeriod,
  trackingStart,
}: {
  orders: ExtOrder[];
  productMap: Record<string, string>;
  boxes: BoxSize[];
  onEdit: (order: ExtOrder) => void;
  onCancel: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: string) => Promise<void>;
  filterPreset: OrdersFilterPreset;
  onFilterPresetConsumed: () => void;
  dashPeriod: "from_start" | "today" | "week" | "month" | "all";
  trackingStart: string;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchText, setSearchText] = React.useState("");
  React.useEffect(() => {
    if (!filterPreset) return;
    if (filterPreset === "today_paid") { setDateFilter("today"); setStatusFilter("paid"); }
    else if (filterPreset === "period_paid") {
      if (dashPeriod === "today") setDateFilter("today");
      else if (dashPeriod === "week") setDateFilter("week");
      else if (dashPeriod === "month") setDateFilter("month");
      else if (dashPeriod === "from_start") setDateFilter("from_start");
      else setDateFilter("all");
      setStatusFilter("paid");
    }
    onFilterPresetConsumed();
  }, [filterPreset]);
  const filtered = orders.filter((o) => {
    if (o.status === "cancelled" && statusFilter !== "cancelled") return false;
    const orderDate = o.delivery_date || o.order_date || o.created_at?.split("T")[0] || "";
    if (dateFilter === "today") { if (orderDate !== todayStr) return false; }
    else if (dateFilter === "week") {
      const now = new Date();
      const localNow = new Date(now.getTime() + 5.5 * 3600000);
      const day = localNow.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(localNow);
      monday.setDate(localNow.getDate() - diff);
      if (orderDate < monday.toISOString().split("T")[0] || orderDate > todayStr) return false;
    } else if (dateFilter === "month") { if (!orderDate.startsWith(todayStr.substring(0, 7))) return false; }
    else if (dateFilter === "from_start") { if (orderDate < trackingStart) return false; }
    if (statusFilter === "paid") { if (!PAID_STATUSES.includes(o.status)) return false; }
    else if (statusFilter !== "all") { if (o.status !== statusFilter) return false; }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      if (!o.customer_name?.toLowerCase().includes(q) && !(o.phone || "").includes(q) && !(o.insta_id || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const filteredRevenue = filtered.filter((o) => PAID_STATUSES.includes(o.status)).reduce((s, o) => s + (o.total_price || 0), 0);
  const DATE_FILTERS = [
    { id: "all", label: "All Time" },
    { id: "today", label: "Today" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "from_start", label: "📌 Since Start" },
  ];
  const STATUS_FILTERS = [
    { id: "all", label: "All" },
    { id: "paid", label: "✓ Paid" },
    { id: "pending", label: "⏳ Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "dispatched", label: "Dispatched" },
    { id: "cancelled", label: "Cancelled" },
  ];
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 14px 20px" }}>
      <div style={{ marginBottom: 10 }}>
        <input
          placeholder="Search name, phone, Instagram..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: "100%", background: G.glass, border: `1px solid ${G.glassBorder}`, color: G.text, padding: "11px 14px", borderRadius: 10, fontSize: "0.9rem", outline: "none", fontFamily: "system-ui, sans-serif", boxSizing: "border-box" as const }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" as const, scrollbarWidth: "none" as const, marginBottom: 8, paddingBottom: 2 }}>
        {DATE_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setDateFilter(f.id)}
            style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 20, border: `1px solid ${dateFilter === f.id ? "rgba(96,165,250,0.5)" : G.glassBorder}`, background: dateFilter === f.id ? G.blueGlass : G.glass, color: dateFilter === f.id ? G.blue : G.muted, fontSize: "0.75rem", fontWeight: dateFilter === f.id ? 700 : 400, cursor: "pointer", fontFamily: "system-ui, sans-serif", whiteSpace: "nowrap" as const }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" as const, scrollbarWidth: "none" as const, marginBottom: 14, paddingBottom: 2 }}>
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.id;
          let activeColor = G.blue;
          if (f.id === "paid") activeColor = G.green;
          if (f.id === "pending") activeColor = G.gold;
          if (f.id === "cancelled") activeColor = G.red;
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 20, border: `1px solid ${isActive ? `${activeColor}60` : G.glassBorder}`, background: isActive ? `${activeColor}18` : G.glass, color: isActive ? activeColor : G.muted, fontSize: "0.75rem", fontWeight: isActive ? 700 : 400, cursor: "pointer", fontFamily: "system-ui, sans-serif", whiteSpace: "nowrap" as const }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div style={{ background: G.glassStrong, border: `1px solid ${G.glassBorderStrong}`, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: "0.82rem", color: G.muted }}>
          <span style={{ color: G.text, fontWeight: 700 }}>{filtered.length}</span> orders
        </p>
        {filteredRevenue > 0 && <p style={{ fontSize: "0.88rem", fontWeight: 700, color: G.green }}>₹{filteredRevenue.toLocaleString()} revenue</p>}
      </div>
      {filtered.length === 0 ? (
        <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 14, padding: "48px 20px", textAlign: "center" as const }}>
          <p style={{ fontSize: "2rem", marginBottom: 8 }}>🔍</p>
          <p style={{ color: G.muted }}>No orders match this filter</p>
        </div>
      ) : (
        filtered.map((o) => {
          const isPending = o.status === "pending";
          const isCancelled = o.status === "cancelled";
          const isDispatched = o.status === "dispatched";
          const statusColor = isPending ? G.gold : isCancelled ? G.red : isDispatched ? G.green : G.blue;
          const statusBg = isPending ? G.goldGlass : isCancelled ? G.redGlass : isDispatched ? G.greenGlass : G.blueGlass;
          const flavours = o.flavours ? Object.entries(o.flavours as Record<string, number>).filter(([, q]) => q > 0) : [];
          return (
            <div
              key={o.id}
              style={{ background: G.glassStrong, border: `0.5px solid ${isCancelled ? "rgba(255,92,108,0.15)" : isDispatched ? "rgba(52,217,123,0.18)" : G.glassBorder}`, borderLeft: `3px solid ${statusColor}50`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, opacity: isCancelled ? 0.55 : 1 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.95rem", fontWeight: 700, color: G.text, marginBottom: 2 }}>{o.customer_name}</p>
                  <p style={{ fontSize: "0.78rem", color: G.muted }}>
                    {o.delivery_date ? new Date(o.delivery_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" }) : "—"}
                    {" · "}{o.delivery_slot || o.batch_label || "—"}{" · "}
                    <span style={{ color: G.gold, fontWeight: 700 }}>₹{o.total_price}</span>
                    {o.fulfillment_type === "pickup" ? " · 🏠" : " · 🚚"}
                  </p>
                  {o.phone && <p style={{ fontSize: "0.75rem", color: G.sub, marginTop: 2 }}>📞 {o.phone}</p>}
                  {o.address && <p style={{ fontSize: "0.72rem", color: G.muted, marginTop: 1 }}>📍 {o.address}</p>}
                  {o.remarks && <p style={{ fontSize: "0.72rem", color: "#86efac", fontStyle: "italic" as const, marginTop: 2 }}>💬 {o.remarks}</p>}
                  {o.source === "trivandrum" && (
                    <span style={{ fontSize: "0.6rem", padding: "2px 7px", borderRadius: 6, background: G.goldGlass, color: G.gold, fontWeight: 700, border: `1px solid ${G.goldBorder}`, display: "inline-block", marginTop: 4 }}>
                      🚂 TVM
                    </span>
                  )}
                  {flavours.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap" as const, marginTop: 6 }}>
                      {flavours.map(([id, qty]) => <FlavourPill key={id} name={productMap[id] || "Unknown"} qty={qty} />)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 6, marginLeft: 10 }}>
                  <span style={{ fontSize: "0.65rem", padding: "3px 9px", borderRadius: 8, background: statusBg, color: statusColor, fontWeight: 700, border: `1px solid ${statusColor}40`, whiteSpace: "nowrap" as const }}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                  {!isCancelled && (
                    <button
                      onClick={() => onEdit(o)}
                      style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid rgba(96,165,250,0.35)`, background: G.blueGlass, color: G.blue, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
