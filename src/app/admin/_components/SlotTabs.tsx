"use client";

export function SlotTabs({
  slots,
  activeSlot,
  onSelect,
}: {
  slots: { label: string; count: number; status: "done" | "active" | "upcoming" }[];
  activeSlot: string;
  onSelect: (slot: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "12px 14px 0", overflowX: "auto" as const, scrollbarWidth: "none" as const }}>
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
              background: isActive ? "#163354" : isDone ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#fff" : isDone ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.4)", textDecoration: isDone ? "line-through" : "none" }}>
              {s.label}
            </div>
            <div style={{ fontSize: 10, marginTop: 2, color: isActive ? "#85b7eb" : isDone ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.22)" }}>
              {isDone ? "✓ done" : s.count > 0 ? `${s.count} order${s.count !== 1 ? "s" : ""}` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
