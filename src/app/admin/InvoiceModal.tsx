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

const KOCHI_PRICES: Record<number, number> = { 4: 499, 6: 699, 8: 899 };
const TVM_PRICES: Record<number, number> = { 4: 699, 6: 899 };
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

function resolveBoxes(total: number, isTvm: boolean): BoxLine[] {
  if (total <= 0) return [];
  const prices = isTvm ? TVM_PRICES : KOCHI_PRICES;
  const sizes = isTvm ? [4, 6] : [4, 6, 8];
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
  const [phone, setPhone] = useState("9072437343");
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const prices = isTvm ? TVM_PRICES : KOCHI_PRICES;
  const availSizes = isTvm ? [4, 6] : [4, 6, 8];
  const boxes = resolveBoxes(totalMochis, isTvm);
  const boxTotal = boxes.reduce((s, b) => s + b.price * b.qty, 0);
  const dc = parseFloat(deliveryCharge) || 0;
  const grandTotal = boxTotal + dc;
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
  const delivStr = fmtDeliveryDate(deliveryDate, deliverySlot);

  const billText = [
    "          EVERSWEET",
    "    Cloud Kitchen · Kochi",
    "",
    LINE,
    row("Invoice", bn),
    row("Date", fmtInvoiceDate()),
    delivStr ? row("Delivery", delivStr) : "",
    LINE,
    totalMochis > 0 ? `${totalMochis} mochis` : "",
    totalMochis > 0 ? boxLines : "",
    dc > 0 ? row("  Delivery charge", `₹${dc.toLocaleString("en-IN")}`) : "",
    LINE,
    row("TOTAL", `₹${grandTotal.toLocaleString("en-IN")}`),
    LINE,
    `Payment to: +91 ${phone}`,
    "",
    "  Eversweet 🍡 · Fresh mochi, Kochi",
  ]
    .filter((l) => l !== "")
    .join("\n");

  async function generateImage(): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    const scale = 2;
    const W = 540,
      PAD = 48;
    const lines = billText.split("\n");
    const lineH = 36;
    const H = PAD * 2 + lines.length * lineH + 40;
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Gold top bar
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(0, 0, W, 8);

    // Text
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = "#111111";
    lines.forEach((line, i) => {
      // Center the header lines
      if (i < 2) {
        ctx.textAlign = "center";
        ctx.font =
          i === 0
            ? "bold 16px 'Courier New', monospace"
            : "14px 'Courier New', monospace";
        ctx.fillText(line, W / 2, PAD + 16 + i * lineH);
      } else {
        ctx.textAlign = "left";
        ctx.font = "13px 'Courier New', monospace";
        ctx.fillText(line, PAD, PAD + 16 + i * lineH);
      }
    });

    // Gold bottom bar
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(0, H - 8, W, 8);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function generate() {
    if (totalMochis === 0) return;
    setGenerating(true);
    try {
      // Create pending order in Supabase
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("orders").insert({
        customer_name: `Invoice ${bn}`,
        phone: phone,
        box_size_id: null,
        flavours: {},
        delivery_date: deliveryDate || today,
        delivery_slot: deliverySlot,
        payment_method: "upi",
        total_price: grandTotal,
        status: "pending",
        source: isTvm ? "trivandrum" : "dm",
        order_date: today,
        notes: `Auto-created invoice. Boxes: ${boxes.map((b) => `${b.qty > 1 ? b.qty + "×" : ""}Box of ${b.size}`).join(", ")}. Auto-cancels midnight IST if unconfirmed.`,
      });

      // Generate image and share via native share sheet
      const blob = await generateImage();
      if (blob) {
        const file = new File([blob], `eversweet-invoice-${bn}.png`, {
          type: "image/png",
        });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Eversweet Invoice ${bn}`,
          });
        } else {
          // Fallback — download the image
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `eversweet-invoice-${bn}.png`;
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
              🧾 New Invoice
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
            <span>🚂 Trivandrum pricing (4→₹699, 6→₹899)</span>
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

          {/* Delivery charge + phone */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div>
              <label style={lbl}>Delivery charge ₹</label>
              <input
                type="number"
                style={{ ...inp, marginBottom: 0 }}
                placeholder="0"
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
              />
            </div>
            <div>
              <label style={lbl}>Payment number</label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 6,
                }}
              >
                {["9072437343", "7907044368"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPhone(p)}
                    style={{
                      padding: "7px 8px",
                      borderRadius: 8,
                      border: `1px solid ${phone === p ? G.goldBorder : G.glassBorder}`,
                      background: phone === p ? G.goldGlass : G.glass,
                      color: phone === p ? G.gold : G.sub,
                      fontSize: "0.72rem",
                      fontWeight: phone === p ? 700 : 400,
                      cursor: "pointer",
                      fontFamily: "system-ui",
                      textAlign: "center" as const,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grand total */}
          {totalMochis > 0 && (
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
              disabled={generating || totalMochis === 0}
              style={{
                width: "100%",
                padding: "15px",
                borderRadius: 12,
                border: "none",
                background:
                  totalMochis > 0
                    ? `linear-gradient(135deg, rgba(240,176,64,0.9), rgba(180,130,40,0.8))`
                    : G.glass,
                color: totalMochis > 0 ? "#160c08" : G.muted,
                fontSize: "1rem",
                fontWeight: 700,
                cursor: totalMochis > 0 ? "pointer" : "not-allowed",
                fontFamily: "system-ui",
                transition: "all 0.2s",
              }}
            >
              {generating
                ? "Creating..."
                : totalMochis === 0
                  ? "Add mochis first"
                  : `Generate Invoice Image →`}
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
