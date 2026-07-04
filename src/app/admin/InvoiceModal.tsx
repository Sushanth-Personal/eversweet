"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

const G = {
  pageBg: "#0d1520",
  glass: "rgba(255,255,255,0.035)",
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
};

// ── Pricing ────────────────────────────────────────────────────────
// Kochi / Ernakulam: Box of 5 → ₹599, Box of 8 → ₹899
// Trivandrum:        Box of 5 → ₹899, Box of 8 → ₹1299
const KOCHI_PRICES: Record<number, number> = { 5: 599, 8: 899 };
const TVM_PRICES: Record<number, number> = { 5: 899, 8: 1299 };
const BOX_SIZES = [5, 8];

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

type BoxLine = { size: number; qty: number; price: number };
type CustomBoxLine = {
  id: string;
  size: number;
  price: number;
  qty: number;
  label: string;
};

function resolveBoxes(total: number, isTvm: boolean): BoxLine[] {
  if (total <= 0) return [];
  const prices = isTvm ? TVM_PRICES : KOCHI_PRICES;
  const sizes = BOX_SIZES;
  let best: { boxes: BoxLine[]; cost: number } | null = null;
  function search(remaining: number, sizeIdx: number, current: BoxLine[]) {
    if (remaining === 0) {
      const cost = current.reduce((s, b) => s + b.price * b.qty, 0);
      if (!best || cost < best.cost)
        best = { boxes: current.map((b) => ({ ...b })), cost };
      return;
    }
    if (sizeIdx >= sizes.length) return;
    const size = sizes[sizeIdx];
    const price = prices[size] ?? 999;
    const maxQty = Math.floor(remaining / size);
    for (let qty = maxQty; qty >= 0; qty--) {
      search(
        remaining - qty * size,
        sizeIdx + 1,
        qty > 0 ? [...current, { size, qty, price }] : [...current],
      );
    }
  }
  search(total, 0, []);
  return best ? (best as any).boxes : [];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function billNumber() {
  const d = new Date();
  return `EVS-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function fmtInvoiceDate() {
  const d = new Date();
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDeliveryDate(dateVal: string, slot: string) {
  if (!dateVal) return "";
  const d = new Date(dateVal + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const dateStr = d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return slot ? `${dateStr} · ${slot}` : dateStr;
}

export function InvoiceModal({ onClose }: { onClose: () => void }) {
  const [isTvm, setIsTvm] = useState(false);
  const [totalMochis, setTotalMochis] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("3–5 PM");
  const [deliveryCharge, setDeliveryCharge] = useState("");
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  // Custom box sizes — for one-off orders that don't fit the standard 5/8 pricing
  const [customBoxes, setCustomBoxes] = useState<CustomBoxLine[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customSize, setCustomSize] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  function addCustomBox() {
    const size = parseInt(customSize, 10);
    const price = parseFloat(customPrice);
    if (!size || size <= 0 || !price || price <= 0) return;
    setCustomBoxes((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        size,
        price,
        qty: 1,
        label: customLabel.trim() || `Box of ${size}`,
      },
    ]);
    setCustomSize("");
    setCustomPrice("");
    setCustomLabel("");
    setShowCustomForm(false);
  }

  function updateCustomQty(id: string, delta: number) {
    setCustomBoxes((prev) =>
      prev
        .map((b) => (b.id === id ? { ...b, qty: b.qty + delta } : b))
        .filter((b) => b.qty > 0),
    );
  }

  function removeCustomBox(id: string) {
    setCustomBoxes((prev) => prev.filter((b) => b.id !== id));
  }

  const prices = isTvm ? TVM_PRICES : KOCHI_PRICES;
  const availSizes = BOX_SIZES;
  const boxes = resolveBoxes(totalMochis, isTvm);
  const boxTotal = boxes.reduce((s, b) => s + b.price * b.qty, 0);
  const customBoxTotal = customBoxes.reduce((s, b) => s + b.price * b.qty, 0);
  const customMochiCount = customBoxes.reduce((s, b) => s + b.size * b.qty, 0);
  const combinedMochis = totalMochis + customMochiCount;
  const dc = parseFloat(deliveryCharge) || 0;
  const grandTotal = boxTotal + customBoxTotal + dc;
  const bn = billNumber();

  // Build bill text
  const LINE = "─".repeat(36);
  const row = (label: string, val: string) => {
    const spaces = Math.max(1, 36 - label.length - val.length);
    return label + " ".repeat(spaces) + val;
  };
  const boxLines = boxes
    .map((b) =>
      row(
        `  Box of ${b.size}${b.qty > 1 ? " ×" + b.qty : ""}`,
        `₹${(b.price * b.qty).toLocaleString("en-IN")}`,
      ),
    )
    .join("\n");
  const customBoxLines = customBoxes
    .map((b) =>
      row(
        `  ${b.label}${b.qty > 1 ? " ×" + b.qty : ""}`,
        `₹${(b.price * b.qty).toLocaleString("en-IN")}`,
      ),
    )
    .join("\n");
  const delivStr = fmtDeliveryDate(deliveryDate, deliverySlot);

  const billText = [
    "          EVERSWEET",
    "    Cloud Kitchen · Kochi",
    "",
    LINE,
    row("Receipt", bn),
    row("Date", fmtInvoiceDate()),
    delivStr ? row("Delivery", delivStr) : "",
    LINE,
    combinedMochis > 0 ? `${combinedMochis} mochis` : "",
    totalMochis > 0 ? boxLines : "",
    customBoxes.length > 0 ? customBoxLines : "",
    dc > 0 ? row("  Delivery charge", `₹${dc.toLocaleString("en-IN")}`) : "",
    LINE,
    row("TOTAL", `₹${grandTotal.toLocaleString("en-IN")}`),
    LINE,
    "  Thank you for your order!",
    "  Eversweet 🍡 · Fresh mochi, Kochi",
  ]
    .filter((l) => l !== "")
    .join("\n");

  async function generateImage(): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    const scale = 3;
    const W = 600;
    const PAD_X = 44;
    const PAD_Y = 52;
    const GOLD_BAR = 10;
    const LINE_H = 30;
    const FONT_SIZE = 15;

    const lines = billText.split("\n");

    // Calculate exact height needed
    const contentH = lines.length * LINE_H;
    const H = GOLD_BAR * 2 + PAD_Y * 2 + contentH;

    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Gold top bar
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(0, 0, W, GOLD_BAR);

    // Gold bottom bar
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(0, H - GOLD_BAR, W, GOLD_BAR);

    // Render lines
    ctx.fillStyle = "#111111";
    lines.forEach((line, i) => {
      const y = GOLD_BAR + PAD_Y + i * LINE_H + FONT_SIZE;
      const trimmed = line.trim();
      if (i === 0) {
        // EVERSWEET — big centered bold
        ctx.textAlign = "center";
        ctx.font = `bold 20px 'Courier New', monospace`;
        ctx.fillText(trimmed, W / 2, y);
      } else if (i === 1) {
        // subtitle — centered
        ctx.textAlign = "center";
        ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
        ctx.fillText(trimmed, W / 2, y);
      } else if (trimmed.startsWith("─")) {
        // Divider line
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(PAD_X, y - FONT_SIZE / 2);
        ctx.lineTo(W - PAD_X, y - FONT_SIZE / 2);
        ctx.stroke();
      } else {
        ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;
        // If line has ₹ amount — split and right-align the amount
        const rupeeIdx = line.lastIndexOf("₹");
        if (rupeeIdx > 4) {
          const leftPart = line.substring(0, rupeeIdx).trimEnd();
          const rightPart = line.substring(rupeeIdx);
          ctx.textAlign = "left";
          ctx.fillText(leftPart, PAD_X, y);
          ctx.textAlign = "right";
          ctx.fillText(rightPart, W - PAD_X, y);
        } else if (
          line.startsWith("  Thank you") ||
          line.startsWith("  Eversweet")
        ) {
          ctx.textAlign = "center";
          ctx.fillText(trimmed, W / 2, y);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(line, PAD_X, y);
        }
      }
    });

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));
  }

  async function generate() {
    if (combinedMochis === 0) return;
    setGenerating(true);
    try {
      // Create pending order in Supabase
      const today = new Date().toISOString().split("T")[0];
      const boxSummary = [
        ...boxes.map((b) => `${b.qty > 1 ? b.qty + "×" : ""}Box of ${b.size}`),
        ...customBoxes.map(
          (b) => `${b.qty > 1 ? b.qty + "×" : ""}${b.label} (custom)`,
        ),
      ].join(", ");
      await supabase.from("orders").insert({
        customer_name: `Invoice ${bn}`,
        phone: "",
        box_size_id: null,
        flavours: {},
        delivery_date: deliveryDate || today,
        delivery_slot: deliverySlot,
        payment_method: "upi",
        total_price: grandTotal,
        status: "pending",
        source: isTvm ? "trivandrum" : "dm",
        order_date: today,
        notes: `Auto-created invoice. Boxes: ${boxSummary}. Auto-cancels midnight IST if unconfirmed.`,
      });

      // Generate image and share via native share sheet
      const blob = await generateImage();
      if (blob) {
        const file = new File([blob], `eversweet-receipt-${bn}.png`, {
          type: "image/png",
        });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Eversweet Receipt ${bn}`,
          });
        } else {
          // Fallback — download the image
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `eversweet-receipt-${bn}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }

      setDone(true);
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  }

  const inp: React.CSSProperties = {
    width: "100%",
    background: G.glass,
    border: `1px solid ${G.glassBorder}`,
    color: G.text,
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: "0.9rem",
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
    marginBottom: 10,
  };

  const lbl: React.CSSProperties = {
    fontSize: "0.62rem",
    color: G.muted,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    marginBottom: 5,
    display: "block",
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: "rgba(0,0,0,0.88)",
        overflowY: "auto",
        padding: "12px",
      }}
    >
      <div
        style={{
          background: G.pageBg,
          border: `1px solid ${G.glassBorderStrong}`,
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: `1px solid ${G.glassBorder}`,
          }}
        >
          <div>
            <p style={{ fontSize: "0.95rem", fontWeight: 800, color: G.text }}>
              🧾 New Receipt
            </p>
            <p style={{ fontSize: "0.65rem", color: G.muted, marginTop: 2 }}>
              {bn} · {fmtInvoiceDate()}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: G.glass,
              border: `1px solid ${G.glassBorder}`,
              color: G.muted,
              width: 32,
              height: 32,
              borderRadius: 9,
              cursor: "pointer",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {/* TVM toggle */}
          <button
            onClick={() => {
              setIsTvm((v) => !v);
              setTotalMochis(0);
            }}
            style={{
              width: "100%",
              padding: "11px 14px",
              marginBottom: 14,
              borderRadius: 10,
              border: `1px solid ${isTvm ? G.goldBorder : G.glassBorder}`,
              background: isTvm ? G.goldGlass : G.glass,
              color: isTvm ? G.gold : G.sub,
              fontSize: "0.88rem",
              fontWeight: isTvm ? 700 : 400,
              cursor: "pointer",
              fontFamily: "system-ui",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>🚂 Trivandrum pricing (5→₹899, 8→₹1299)</span>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                border: `2px solid ${isTvm ? G.gold : G.muted}`,
                background: isTvm ? G.gold : "transparent",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                color: "#160c08",
                flexShrink: 0,
              }}
            >
              {isTvm ? "✓" : ""}
            </span>
          </button>

          {/* Box tap buttons */}
          <label style={lbl}>Tap to add mochis</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {availSizes.map((sz) => (
              <button
                key={sz}
                onClick={() => setTotalMochis((t) => t + sz)}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  borderRadius: 10,
                  border: `1px solid ${G.glassBorder}`,
                  background: G.glassStrong,
                  color: G.text,
                  cursor: "pointer",
                  fontFamily: "system-ui",
                  textAlign: "center" as const,
                }}
              >
                <p
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    color: G.gold,
                    lineHeight: 1,
                  }}
                >
                  +{sz}
                </p>
                <p
                  style={{ fontSize: "0.62rem", color: G.muted, marginTop: 3 }}
                >
                  ₹{prices[sz]}
                </p>
              </button>
            ))}
          </div>

          {/* Box summary */}
          <div
            style={{
              background: G.glassStrong,
              border: `1px solid ${totalMochis > 0 ? G.goldBorder : G.glassBorder}`,
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
              minHeight: 52,
            }}
          >
            {totalMochis === 0 ? (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: G.muted,
                  textAlign: "center" as const,
                }}
              >
                Tap boxes above to add mochis
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}
                >
                  {boxes.map((b, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: G.goldGlass,
                        border: `1px solid ${G.goldBorder}`,
                        color: G.gold,
                        padding: "4px 10px",
                        borderRadius: 20,
                      }}
                    >
                      {b.qty > 1 ? `${b.qty}× ` : ""}Box of {b.size}
                    </span>
                  ))}
                  <span style={{ fontSize: "0.75rem", color: G.muted }}>
                    {totalMochis} mochis
                  </span>
                </div>
                <button
                  onClick={() => setTotalMochis(0)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: G.muted,
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Custom box sizes */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <label style={{ ...lbl, marginBottom: 0 }}>Custom box size</label>
              <button
                onClick={() => setShowCustomForm((v) => !v)}
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: G.blue,
                  background: G.blueGlass,
                  border: `1px solid rgba(96,165,250,0.35)`,
                  borderRadius: 7,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "system-ui",
                }}
              >
                {showCustomForm ? "✕ Cancel" : "+ Add custom box"}
              </button>
            </div>

            {showCustomForm && (
              <div
                style={{
                  background: G.glassStrong,
                  border: `1px solid ${G.glassBorder}`,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <input
                    type="number"
                    placeholder="Pieces (e.g. 6)"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    style={{ ...inp, marginBottom: 0 }}
                  />
                  <input
                    type="number"
                    placeholder="Price ₹"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    style={{ ...inp, marginBottom: 0 }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Label (optional, e.g. Box of 6 - Mixed)"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  style={{ ...inp, marginBottom: 10 }}
                />
                <button
                  onClick={addCustomBox}
                  disabled={!customSize || !customPrice}
                  style={{
                    width: "100%",
                    padding: "9px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      customSize && customPrice ? G.blueGlass : G.glass,
                    color: customSize && customPrice ? G.blue : G.muted,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor:
                      customSize && customPrice ? "pointer" : "not-allowed",
                    fontFamily: "system-ui",
                  }}
                >
                  Add to receipt
                </button>
              </div>
            )}

            {customBoxes.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {customBoxes.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: G.glassStrong,
                      border: `1px solid ${G.glassBorder}`,
                      borderRadius: 9,
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: G.text,
                        }}
                      >
                        {b.label}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: G.muted }}>
                        {b.size} pcs · ₹{b.price} each
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={() => updateCustomQty(b.id, -1)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: `1px solid ${G.glassBorder}`,
                          background: G.glass,
                          color: G.sub,
                          cursor: "pointer",
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
                        {b.qty}
                      </span>
                      <button
                        onClick={() => updateCustomQty(b.id, 1)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: "1px solid rgba(96,165,250,0.4)",
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
                      <button
                        onClick={() => removeCustomBox(b.id)}
                        style={{
                          marginLeft: 4,
                          background: "transparent",
                          border: "none",
                          color: G.red,
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery date chips */}
          <label style={lbl}>Delivery date</label>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 8,
              flexWrap: "wrap" as const,
            }}
          >
            {[0, 1, 2, 3].map((offset) => {
              const d = new Date(Date.now() + offset * 86400000);
              const val = d.toISOString().split("T")[0];
              const label =
                offset === 0
                  ? "Today"
                  : offset === 1
                    ? "Tomorrow"
                    : d.toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      });
              return (
                <button
                  key={val}
                  onClick={() => setDeliveryDate(val)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: `1px solid ${deliveryDate === val ? G.goldBorder : G.glassBorder}`,
                    background: deliveryDate === val ? G.goldGlass : G.glass,
                    color: deliveryDate === val ? G.gold : G.sub,
                    fontSize: "0.8rem",
                    fontWeight: deliveryDate === val ? 700 : 400,
                    cursor: "pointer",
                    fontFamily: "system-ui",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Pick any date from calendar */}
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            style={{
              width: "100%",
              background: G.glass,
              border: `1px solid ${G.glassBorder}`,
              color: G.text,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: "0.85rem",
              fontFamily: "system-ui, sans-serif",
              outline: "none",
              boxSizing: "border-box" as const,
              marginBottom: 14,
              colorScheme: "dark" as const,
            }}
          />

          {/* Slot chips */}
          <label style={lbl}>Time slot</label>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 14,
              flexWrap: "wrap" as const,
            }}
          >
            {ALL_SLOTS.map((s) => (
              <button
                key={s}
                onClick={() => setDeliverySlot(s)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 20,
                  border: `1px solid ${deliverySlot === s ? G.goldBorder : G.glassBorder}`,
                  background: deliverySlot === s ? G.goldGlass : G.glass,
                  color: deliverySlot === s ? G.gold : G.sub,
                  fontSize: "0.78rem",
                  fontWeight: deliverySlot === s ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "system-ui",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {deliveryDate && (
            <p
              style={{
                fontSize: "0.75rem",
                color: G.gold,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              📅 {fmtDeliveryDate(deliveryDate, deliverySlot)}
            </p>
          )}

          {/* Delivery charge */}
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Delivery charge ₹ (optional)</label>
            <input
              type="number"
              style={{ ...inp, marginBottom: 0 }}
              placeholder="0"
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(e.target.value)}
            />
          </div>

          {/* Grand total */}
          {combinedMochis > 0 && (
            <div
              style={{
                background: G.goldGlass,
                border: `1px solid ${G.goldBorder}`,
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: G.gold }}>Total</span>
              <span
                style={{ fontSize: "1.8rem", fontWeight: 800, color: G.gold }}
              >
                ₹{grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Bill preview */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: "14px 16px",
              fontFamily: "'Courier New', monospace",
              fontSize: "11px",
              color: "#111",
              lineHeight: 1.8,
              whiteSpace: "pre-wrap" as const,
              wordBreak: "break-word" as const,
              marginBottom: 14,
            }}
          >
            {billText}
          </div>

          {/* Generate button */}
          {done ? (
            <div
              style={{
                background: G.greenGlass,
                border: `1px solid rgba(52,217,123,0.3)`,
                borderRadius: 12,
                padding: "16px",
                textAlign: "center" as const,
              }}
            >
              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: G.green,
                  marginBottom: 4,
                }}
              >
                ✓ Done!
              </p>
              <p style={{ fontSize: "0.78rem", color: G.sub }}>
                Order saved · Share sheet opened — send to Instagram or WhatsApp
              </p>
              <p style={{ fontSize: "0.72rem", color: G.muted, marginTop: 6 }}>
                Order auto-cancels midnight IST if payment not confirmed
              </p>
              <button
                onClick={onClose}
                style={{
                  marginTop: 12,
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: G.greenGlass,
                  color: G.green,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "system-ui",
                  fontSize: "0.88rem",
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <button
              onClick={generate}
              disabled={generating || combinedMochis === 0}
              style={{
                width: "100%",
                padding: "15px",
                borderRadius: 12,
                border: "none",
                background:
                  combinedMochis > 0
                    ? `linear-gradient(135deg, rgba(240,176,64,0.9), rgba(180,130,40,0.8))`
                    : G.glass,
                color: combinedMochis > 0 ? "#160c08" : G.muted,
                fontSize: "1rem",
                fontWeight: 700,
                cursor: combinedMochis > 0 ? "pointer" : "not-allowed",
                fontFamily: "system-ui",
                transition: "all 0.2s",
              }}
            >
              {generating
                ? "Creating..."
                : combinedMochis === 0
                  ? "Add mochis or a custom box first"
                  : `Generate Receipt Image →`}
            </button>
          )}
          <p
            style={{
              fontSize: "0.68rem",
              color: G.muted,
              marginTop: 8,
              textAlign: "center" as const,
              lineHeight: 1.6,
            }}
          >
            Creates a pending order · Generates image · Native share sheet
          </p>
        </div>
      </div>
    </div>
  );
}

export function InvoiceNavBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 14px",
        borderRadius: 9,
        border: "1px solid rgba(240,176,64,0.45)",
        background: "rgba(240,176,64,0.12)",
        color: "#f0b040",
        fontSize: "0.8rem",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "system-ui, sans-serif",
        whiteSpace: "nowrap" as const,
      }}
    >
      🧾 <span>Invoice</span>
    </button>
  );
}
