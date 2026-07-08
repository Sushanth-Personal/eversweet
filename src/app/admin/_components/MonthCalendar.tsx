"use client";
import { useState } from "react";
import { G } from "../_lib/theme";
import { PAID_STATUSES, type ExtOrder } from "../_lib/constants";

export function MonthCalendar({
  orders,
  selectedDate,
  onSelectDate,
}: {
  orders: ExtOrder[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const countByDate: Record<string, number> = {};
  orders.forEach((o) => {
    if (!PAID_STATUSES.includes(o.status) && o.status !== "pending") return;
    const d = o.delivery_date || o.order_date || o.created_at?.split("T")[0];
    if (d) countByDate[d] = (countByDate[d] || 0) + 1;
  });
  const { year, month } = viewMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];
  const startPad = (firstDay + 6) % 7;
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  function toDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const monthName = new Date(year, month).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return (
    <div style={{ background: G.glassStrong, border: `1px solid ${G.glassBorderStrong}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button
          onClick={() => setViewMonth((v) => { const d = new Date(v.year, v.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, color: G.sub, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          ‹
        </button>
        <p style={{ fontSize: 15, fontWeight: 700, color: G.text }}>{monthName}</p>
        <button
          onClick={() => setViewMonth((v) => { const d = new Date(v.year, v.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, color: G.sub, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          ›
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} style={{ textAlign: "center" as const, fontSize: 10, fontWeight: 700, color: G.muted, letterSpacing: "0.08em", padding: "3px 0" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = toDateStr(day);
          const count = countByDate[dateStr] || 0;
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === todayStr;
          return (
            <button
              key={i}
              onClick={() => onSelectDate(isSelected ? "" : dateStr)}
              style={{
                padding: "6px 4px",
                borderRadius: 8,
                border: `1px solid ${isSelected ? G.blue : isToday ? G.goldBorder : count > 0 ? "rgba(52,217,123,0.25)" : G.glassBorder}`,
                background: isSelected ? G.blueGlass : isToday ? G.goldGlass : count > 0 ? G.greenGlass : "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isSelected || isToday ? 700 : 400, color: isSelected ? G.blue : isToday ? G.gold : G.text, lineHeight: 1 }}>
                {day}
              </span>
              {count > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? G.blue : G.green, lineHeight: 1 }}>{count}</span>
              ) : (
                <span style={{ fontSize: 10, color: "transparent", lineHeight: 1 }}>·</span>
              )}
            </button>
          );
        })}
      </div>
      {selectedDate && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${G.glassBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: G.blue, fontWeight: 600 }}>
            Showing: {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </p>
          <button onClick={() => onSelectDate("")} style={{ background: "transparent", border: "none", color: G.muted, fontSize: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
            Show all ✕
          </button>
        </div>
      )}
    </div>
  );
}
