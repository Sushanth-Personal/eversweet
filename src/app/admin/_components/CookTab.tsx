"use client";
import { useState } from "react";
import type { BoxSize } from "@/lib/types";
import { G } from "../_lib/theme";
import {
  ALL_SLOTS,
  BATCHES,
  PAID_STATUSES,
  type ExtOrder,
} from "../_lib/constants";
import { MonthCalendar } from "./MonthCalendar";
import { SlotTabs } from "./SlotTabs";
import { CookOrderCard } from "./CookOrderCard";
import { FlavourBigCard } from "./FlavourPill";

export function CookTab({
  orders,
  boxes,
  productMap,
  expandedPorter,
  onTogglePorter,
  onPorterEmail,
  onDispatch,
  onEdit,
  onCancel,
  onSendToDelivery,
}: {
  orders: ExtOrder[];
  boxes: BoxSize[];
  productMap: Record<string, string>;
  expandedPorter: Set<string>;
  onTogglePorter: (id: string) => void;
  onPorterEmail: (order: ExtOrder) => Promise<void>;
  onDispatch: (id: string) => Promise<void>;
  onEdit: (order: ExtOrder) => void;
  onCancel: (id: string) => Promise<void>;
  onSendToDelivery: (order: ExtOrder) => Promise<void>;
}) {
  function getCurrentSlot(): string {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 3600000;
    const ist = new Date(istMs);
    const h = ist.getHours() + ist.getMinutes() / 60;
    if (h < 11) return "9–11 AM";
    if (h < 13) return "11–1 PM";
    if (h < 15) return "1–3 PM";
    if (h < 17) return "3–5 PM";
    if (h < 19) return "5–7 PM";
    if (h < 21) return "7–9 PM";
    if (h < 23) return "9–11 PM";
    return "11 PM–12 AM";
  }
  const todayStr = new Date().toISOString().split("T")[0];
  type ViewMode = "all" | "batches" | "slots";
  const [viewMode, setViewMode] = useState<ViewMode>("slots");
  const [activeSlot, setActiveSlot] = useState<string>(getCurrentSlot);
  const [activeBatch, setActiveBatch] = useState<string>("Morning");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showCalendar, setShowCalendar] = useState(false);
  const activeOrders = orders.filter(
    (o) => PAID_STATUSES.includes(o.status) && o.status !== "dispatched",
  );
  const dateFilteredOrders = selectedDate
    ? activeOrders.filter((o) => {
        const d =
          o.delivery_date || o.order_date || o.created_at?.split("T")[0];
        return d === selectedDate;
      })
    : activeOrders;
  function aggregateFlavours(orderList: ExtOrder[]) {
    const totals: Record<string, number> = {};
    orderList.forEach((o) => {
      if (!o.flavours) return;
      Object.entries(o.flavours as Record<string, number>).forEach(
        ([id, qty]) => {
          const name = productMap[id] || "Unknown";
          totals[name] = (totals[name] || 0) + qty;
        },
      );
    });
    return Object.entries(totals).sort(([, a], [, b]) => b - a);
  }
  const ordersBySlot: Record<string, ExtOrder[]> = {};
  dateFilteredOrders.forEach((o) => {
    const slot = o.delivery_slot || o.batch_label || "Unscheduled";
    if (!ordersBySlot[slot]) ordersBySlot[slot] = [];
    ordersBySlot[slot].push(o);
  });
  const nowSlot = getCurrentSlot();
  const slotMeta = ALL_SLOTS.map((label) => {
    const count = (ordersBySlot[label] || []).length;
    const nowIdx = ALL_SLOTS.indexOf(nowSlot);
    const thisIdx = ALL_SLOTS.indexOf(label);
    const status: "done" | "active" | "upcoming" =
      count > 0
        ? "active"
        : thisIdx < nowIdx
          ? "done"
          : thisIdx === nowIdx
            ? "active"
            : "upcoming";
    return { label, count, status };
  });
  const slotOrders = ordersBySlot[activeSlot] || [];
  const slotFlavours = aggregateFlavours(slotOrders);
  const slotTotal = slotFlavours.reduce((s, [, q]) => s + q, 0);
  const currentBatch = BATCHES.find((b) => b.label === activeBatch)!;
  const batchOrders = dateFilteredOrders.filter((o) => {
    const slot = o.delivery_slot || o.batch_label || "";
    return currentBatch.slots.includes(slot);
  });
  const batchFlavours = aggregateFlavours(batchOrders);
  const batchTotal = batchFlavours.reduce((s, [, q]) => s + q, 0);
  const allFlavours = aggregateFlavours(dateFilteredOrders);
  const allTotal = allFlavours.reduce((s, [, q]) => s + q, 0);
  const friendlyDate = (d: string) => {
    if (d === todayStr) return "Today";
    if (d === new Date(Date.now() + 86400000).toISOString().split("T")[0])
      return "Tomorrow";
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      weekday: "short",
    });
  };
  function FlavourSection({
    flavourEntries,
    totalPieces,
    orderList,
    groupLabel,
  }: {
    flavourEntries: [string, number][];
    totalPieces: number;
    orderList: ExtOrder[];
    groupLabel: string;
  }) {
    return (
      <>
        <div
          style={{
            background: "rgba(96,165,250,0.08)",
            border: "1px solid rgba(96,165,250,0.2)",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                color: G.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 3,
                fontWeight: 600,
              }}
            >
              {viewMode === "slots"
                ? "SLOT"
                : viewMode === "batches"
                  ? "BATCH"
                  : "ALL ORDERS"}
            </p>
            <p
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: G.blue,
                lineHeight: 1,
              }}
            >
              {groupLabel}
            </p>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <p
              style={{
                fontSize: 11,
                color: G.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
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
              <span style={{ fontSize: 14, fontWeight: 500, color: G.muted }}>
                mochis
              </span>
            </p>
          </div>
        </div>
        <p
          style={{
            fontSize: "0.65rem",
            color: G.muted,
            letterSpacing: "0.13em",
            textTransform: "uppercase" as const,
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          What to make
        </p>
        {flavourEntries.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 7,
              marginBottom: 16,
            }}
          >
            {flavourEntries.map(([name, qty]) => (
              <FlavourBigCard key={name} name={name} qty={qty} />
            ))}
          </div>
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
              No orders here
            </p>
          </div>
        )}
        {orderList.length > 0 && (
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
              Orders · {groupLabel} ({orderList.length})
            </p>
            {orderList.map((order) => (
              <CookOrderCard
                key={order.id}
                order={order}
                productMap={productMap}
                boxes={boxes}
                isExpanded={expandedPorter.has(order.id)}
                onTogglePorter={() => onTogglePorter(order.id)}
                onPorterEmail={onPorterEmail}
                onDispatch={onDispatch}
                onEdit={onEdit}
                onCancel={onCancel}
                onSendToDelivery={onSendToDelivery}
              />
            ))}
          </>
        )}
      </>
    );
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px 8px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              color: G.muted,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              marginBottom: 2,
              fontWeight: 600,
            }}
          >
            Viewing
          </p>
          <p
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: selectedDate ? G.blue : G.text,
            }}
          >
            {selectedDate ? friendlyDate(selectedDate) : "All days"}
          </p>
        </div>
        <button
          onClick={() => setShowCalendar((v) => !v)}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${showCalendar ? G.blue : G.glassBorder}`,
            background: showCalendar ? G.blueGlass : G.glass,
            color: showCalendar ? G.blue : G.sub,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          📅 {showCalendar ? "Hide Calendar" : "Calendar"}
        </button>
      </div>
      {showCalendar && (
        <div style={{ padding: "0 14px" }}>
          <MonthCalendar
            orders={orders}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              if (d) setShowCalendar(false);
            }}
          />
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 0,
          margin: "6px 14px 0",
          border: `1px solid ${G.glassBorder}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {(
          [
            { id: "all", label: "All", icon: "◉" },
            { id: "batches", label: "Batches", icon: "☀" },
            { id: "slots", label: "Time Slots", icon: "🕐" },
          ] as { id: ViewMode; label: string; icon: string }[]
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setViewMode(v.id)}
            style={{
              flex: 1,
              padding: "9px 6px",
              border: "none",
              borderRight:
                v.id !== "slots" ? `1px solid ${G.glassBorder}` : "none",
              fontFamily: "system-ui, sans-serif",
              background: viewMode === v.id ? G.blueGlass : G.glass,
              color: viewMode === v.id ? G.blue : G.muted,
              fontSize: "0.78rem",
              fontWeight: viewMode === v.id ? 700 : 400,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: "0.85rem" }}>{v.icon}</span>
            {v.label}
          </button>
        ))}
      </div>
      {viewMode === "batches" && (
        <div style={{ display: "flex", gap: 6, padding: "10px 14px 0" }}>
          {BATCHES.map((b) => {
            const bOrders = dateFilteredOrders.filter((o) => {
              const slot = o.delivery_slot || o.batch_label || "";
              return b.slots.includes(slot);
            });
            const isActive = activeBatch === b.label;
            return (
              <button
                key={b.label}
                onClick={() => setActiveBatch(b.label)}
                style={{
                  flex: 1,
                  padding: "9px 8px",
                  borderRadius: 10,
                  border: `1px solid ${isActive ? "rgba(96,165,250,0.5)" : G.glassBorder}`,
                  background: isActive ? G.blueGlass : G.glass,
                  color: isActive ? G.blue : G.sub,
                  fontFamily: "system-ui, sans-serif",
                  cursor: "pointer",
                  textAlign: "center" as const,
                  transition: "all 0.15s",
                }}
              >
                <p
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: isActive ? 700 : 500,
                    marginBottom: 2,
                  }}
                >
                  {b.label}
                </p>
                <p
                  style={{
                    fontSize: "0.62rem",
                    color: isActive ? G.blue : G.muted,
                  }}
                >
                  {b.range}
                </p>
                {bOrders.length > 0 && (
                  <p
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: isActive ? G.blue : G.green,
                      marginTop: 3,
                    }}
                  >
                    {bOrders.length} order{bOrders.length !== 1 ? "s" : ""}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
      {viewMode === "slots" && (
        <SlotTabs
          slots={slotMeta}
          activeSlot={activeSlot}
          onSelect={setActiveSlot}
        />
      )}
      <div style={{ padding: "14px 14px 20px" }}>
        {viewMode === "all" && (
          <FlavourSection
            flavourEntries={allFlavours}
            totalPieces={allTotal}
            orderList={dateFilteredOrders}
            groupLabel={selectedDate ? friendlyDate(selectedDate) : "All Days"}
          />
        )}
        {viewMode === "batches" && (
          <FlavourSection
            flavourEntries={batchFlavours}
            totalPieces={batchTotal}
            orderList={batchOrders}
            groupLabel={`${currentBatch.label} · ${currentBatch.range}`}
          />
        )}
        {viewMode === "slots" && (
          <FlavourSection
            flavourEntries={slotFlavours}
            totalPieces={slotTotal}
            orderList={slotOrders}
            groupLabel={activeSlot}
          />
        )}
      </div>
    </div>
  );
}
