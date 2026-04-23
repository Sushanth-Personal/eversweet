"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize } from "@/lib/types";

const BATCHES = [
  { id: "morning", label: "Morning Batch", icon: "🌅", timeRange: "9AM – 12PM" },
  { id: "afternoon", label: "Afternoon Batch", icon: "☀️", timeRange: "12PM – 4PM" },
  { id: "evening", label: "Evening Batch", icon: "🌙", timeRange: "5PM – 8PM" },
] as const;

type BatchId = (typeof BATCHES)[number]["id"];

const UPI_ID = "thinkwide9-1@okicici";
const WHATSAPP_NUMBER = "917907044368";

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getAutoBox(boxes: BoxSize[], totalPicked: number): BoxSize | null {
  if (totalPicked === 0) return null;
  const sorted = [...boxes].sort((a, b) => a.count - b.count);
  return sorted.find((b) => b.count >= totalPicked) || sorted[sorted.length - 1];
}

function buildUpiLinks(amount: number, name: string) {
  const note = encodeURIComponent(`Eversweet order for ${name}`);
  const pa = encodeURIComponent(UPI_ID);
  const pn = encodeURIComponent("Eversweet");
  const am = encodeURIComponent(String(amount));
  const base = `pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${note}`;
  return {
    gpay: `gpay://upi/pay?${base}`,
    phonepe: `phonepe://pay?${base}`,
    paytm: `paytmmp://pay?${base}`,
    generic: `upi://pay?${base}`,
  };
}

function buildWhatsAppUrl(
  customerName: string,
  amount: number,
  boxLabel: string,
  flavourSummary: string,
  batchLabel: string,
  batchIcon: string,
  deliveryDate: string,
  fulfillmentType: string,
): string {
  const message = [
    `Hi! I just paid ₹${amount} for my Eversweet order 🍡`,
    ``,
    `📦 ${boxLabel}`,
    flavourSummary ? `🍡 ${flavourSummary}` : null,
    `${batchIcon} ${batchLabel} · ${deliveryDate}`,
    fulfillmentType === "pickup" ? `🏠 Self Pickup` : `🚚 Delivery via Porter`,
    ``,
    `Please confirm my slot!`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

async function sendPaymentAlert(payload: {
  customer_name: string;
  phone: string;
  address: string;
  batch_label: string;
  delivery_date: string;
  box_label: string;
  flavour_summary: string;
  total_price: number;
}) {
  try {
    await fetch("/api/payment-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Payment alert failed:", e);
  }
}

function validateForm(form: { name: string; phone: string }): string {
  const nameRegex = /^[a-zA-Z\s.'-]{2,}$/;
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!form.name.trim()) return "Please enter your name.";
  if (!nameRegex.test(form.name.trim())) return "Please enter a valid name (letters only).";
  if (!form.phone.trim()) return "Please enter your phone number.";
  const cleanPhone = form.phone.replace(/\s+/g, "").replace(/^(\+91|91)/, "");
  if (!phoneRegex.test(cleanPhone)) return "Please enter a valid 10-digit Indian mobile number.";
  return "";
}

// ── Gold line divider ──────────────────────────────────────────────
function GoldLine() {
  return (
    <div style={{
      width: 36, height: 1, background: "var(--gold)", opacity: 0.45,
      margin: "10px auto 22px",
    }} />
  );
}

export default function QuickOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [loading, setLoading] = useState(true);

  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [selectedBatch, setSelectedBatch] = useState<BatchId | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");

  const [autoBox, setAutoBox] = useState<BoxSize | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "" });
  const [orderDone, setOrderDone] = useState(false);
  const [hasTappedPay, setHasTappedPay] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [savedOrder, setSavedOrder] = useState<{ autoBox: BoxSize | null; flavours: Record<string, number> } | null>(null);

  const slotRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const todayStr = toDateString(new Date());
  const tomorrowStr = toDateString(new Date(Date.now() + 86400000));

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase.from("products").select("*").eq("is_available", true).order("sort_order"),
        supabase.from("box_sizes").select("*").eq("is_active", true).order("sort_order"),
      ]);
      if (p) setProducts(p);
      if (b) setBoxes(b);
      setLoading(false);
    }
    load();
  }, []);

  const totalPicked = Object.values(flavours).reduce((a, b) => a + b, 0);

  useEffect(() => {
    setAutoBox(getAutoBox(boxes, totalPicked));
  }, [flavours, boxes]);

  function adjustFlavour(id: string, delta: number) {
    setFlavours((prev) => {
      const cur = prev[id] || 0;
      const next = cur + delta;
      if (next < 0) return prev;
      const maxBox = [...boxes].sort((a, b) => b.count - a.count)[0];
      const maxAllowed = maxBox ? maxBox.count : 16;
      if (totalPicked + delta > maxAllowed) return prev;
      const updated = { ...prev, [id]: next };
      if (updated[id] === 0) delete updated[id];
      return updated;
    });
  }

  function proceedToSlot() {
    if (totalPicked === 0) { setError("Please choose at least 4 pieces."); return; }
    if (autoBox && totalPicked < autoBox.count) {
      setError(`Add ${autoBox.count - totalPicked} more piece${autoBox.count - totalPicked === 1 ? "" : "s"} to fill your ${autoBox.label}.`);
      return;
    }
    setError("");
    setStep(2);
    setTimeout(() => slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function pickBatch(id: BatchId) {
    setSelectedBatch(id);
    setStep(3);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function friendlyDate(dateStr: string) {
    if (dateStr === todayStr) return "Today";
    if (dateStr === tomorrowStr) return "Tomorrow";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "short",
    });
  }

  async function placeOrder() {
    if (!autoBox || !selectedBatch) { setError("Something went wrong. Please refresh."); return; }
    const validationError = validateForm(form);
    if (validationError) { setError(validationError); return; }
    setPlacing(true);
    setError("");
    const batch = BATCHES.find((b) => b.id === selectedBatch)!;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.name.trim(),
          phone: form.phone.trim(),
          box_size_id: autoBox.id,
          flavours,
          delivery_date: selectedDate,
          batch_label: batch.label,
          total_price: autoBox.price,
          fulfillment_type: fulfillmentType,
          source: "mini",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSavedOrder({ autoBox, flavours });
      setOrderDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  // ── Payment screen ─────────────────────────────────────────────
  if (orderDone && savedOrder) {
    const batch = BATCHES.find((b) => b.id === selectedBatch)!;
    const flavourSummary = Object.entries(savedOrder.flavours)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const prod = products.find((p) => p.id === id);
        return prod ? `${prod.name} ×${qty}` : null;
      })
      .filter(Boolean)
      .join(", ");
    const upiLinks = buildUpiLinks(savedOrder.autoBox?.price || 0, form.name);
    const whatsappUrl = buildWhatsAppUrl(
      form.name,
      savedOrder.autoBox?.price || 0,
      savedOrder.autoBox?.label || "",
      flavourSummary,
      batch.label,
      batch.icon,
      friendlyDate(selectedDate),
      fulfillmentType,
    );

    return (
      <main style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "48px 24px", textAlign: "center", maxWidth: 420, margin: "0 auto",
      }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🍡</div>
        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 300, marginBottom: 16, lineHeight: 1.1 }}>
          Just one more step, <em>{form.name.split(" ")[0]}</em>
        </h1>
        <p style={{ fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 8, opacity: 0.85 }}>
          Please make payment to confirm your order
        </p>
        <GoldLine />

        {/* Order summary */}
        <div style={{
          background: "rgba(184,134,11,0.08)", border: "1px solid rgba(184,134,11,0.25)",
          borderRadius: 10, padding: "14px 18px", marginBottom: 28, width: "100%",
        }}>
          <p style={{ fontSize: "0.82rem", color: "var(--cream-dim)", lineHeight: 1.8 }}>
            <strong style={{ color: "var(--gold)" }}>{batch.icon} {batch.label}</strong>{" "}
            on <strong style={{ color: "var(--gold)" }}>{friendlyDate(selectedDate)}</strong>
            <br />
            <span style={{ fontSize: "0.75rem", color: "rgba(255,248,230,0.6)" }}>
              {savedOrder.autoBox?.label} · {flavourSummary}
            </span>
            <br />
            <span style={{ fontSize: "0.72rem", color: fulfillmentType === "pickup" ? "#a3d977" : "rgba(255,248,230,0.55)" }}>
              {fulfillmentType === "pickup" ? "🏠 Self Pickup" : "🚚 Delivery via Porter (charges extra)"}
            </span>
          </p>
        </div>

        {/* Payment block */}
        <div style={{
          width: "100%", background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(184,134,11,0.3)", borderRadius: 12,
          padding: "20px 18px", marginBottom: 24,
        }}>
          <p style={{ fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "var(--gold)", marginBottom: 6, opacity: 0.85 }}>
            Complete Your Payment
          </p>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--gold)", marginBottom: 4, fontFamily: "Cormorant Garamond, serif" }}>
            ₹{savedOrder.autoBox?.price}
          </p>
          <p style={{ fontSize: "0.75rem", color: "rgba(255,248,230,0.65)", marginBottom: 18, lineHeight: 1.6 }}>
            Your slot is reserved. Pay now to confirm it.
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--cream-dim)", marginBottom: 12, lineHeight: 1.6 }}>
            Tap your payment app — amount is pre-filled ✓
          </p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 4 }}>
            <a href={upiLinks.gpay} onClick={() => setHasTappedPay(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "13px 20px", borderRadius: 10, background: "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)", color: "#fff", fontSize: "0.95rem", fontWeight: 700, textDecoration: "none", boxSizing: "border-box" as const, boxShadow: "0 3px 12px rgba(26,115,232,0.35)" }}>
              <img src="https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/Payment/img.icons8.com.png" alt="GPay" style={{ width: 28, height: 28, objectFit: "contain" }} />
              Google Pay — ₹{savedOrder.autoBox?.price}
            </a>
            <a href={upiLinks.phonepe} onClick={() => setHasTappedPay(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "13px 20px", borderRadius: 10, background: "linear-gradient(135deg, #5f259f 0%, #3d1a6e 100%)", color: "#fff", fontSize: "0.95rem", fontWeight: 700, textDecoration: "none", boxSizing: "border-box" as const, boxShadow: "0 3px 12px rgba(95,37,159,0.35)" }}>
              <img src="https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/Payment/icons8-phone-pe-48.png" alt="PhonePe" style={{ width: 28, height: 28, objectFit: "contain" }} />
              PhonePe — ₹{savedOrder.autoBox?.price}
            </a>
            <a href={upiLinks.paytm} onClick={() => setHasTappedPay(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "13px 20px", borderRadius: 10, background: "linear-gradient(135deg, #00baf2 0%, #0073b7 100%)", color: "#fff", fontSize: "0.95rem", fontWeight: 700, textDecoration: "none", boxSizing: "border-box" as const, boxShadow: "0 3px 12px rgba(0,115,183,0.35)" }}>
              <img src="https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/Payment/icons8-paytm-48.png" alt="Paytm" style={{ width: 28, height: 28, objectFit: "contain" }} />
              Paytm — ₹{savedOrder.autoBox?.price}
            </a>
            <a href={upiLinks.generic} onClick={() => setHasTappedPay(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "11px 20px", borderRadius: 10, background: "transparent", border: "1px solid rgba(184,134,11,0.35)", color: "var(--cream-dim)", fontSize: "0.8rem", fontWeight: 500, textDecoration: "none", boxSizing: "border-box" as const }}>
              Other UPI App
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 16 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: "0.65rem", color: "rgba(255,248,230,0.5)", letterSpacing: "0.1em" }}>AFTER PAYING</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          </div>

          <button
            onClick={async () => {
              if (!emailSent) {
                setEmailSent(true);
                await sendPaymentAlert({
                  customer_name: form.name,
                  phone: form.phone,
                  address: fulfillmentType === "pickup" ? "Self Pickup" : "",
                  batch_label: batch.label,
                  delivery_date: friendlyDate(selectedDate),
                  box_label: savedOrder.autoBox?.label || "",
                  flavour_summary: flavourSummary,
                  total_price: savedOrder.autoBox?.price || 0,
                });
              }
              window.open(whatsappUrl, "_blank");
            }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: "13px 20px", borderRadius: 10,
              background: hasTappedPay ? "linear-gradient(135deg, #25d366 0%, #128c4a 100%)" : "rgba(37,211,102,0.12)",
              border: hasTappedPay ? "none" : "1.5px solid rgba(37,211,102,0.4)",
              color: hasTappedPay ? "#fff" : "#25d366",
              fontSize: hasTappedPay ? "1rem" : "0.9rem",
              fontWeight: 700, cursor: "pointer", boxSizing: "border-box" as const,
              transition: "all 0.3s ease",
              boxShadow: hasTappedPay ? "0 4px 16px rgba(37,211,102,0.35)" : "none",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>{emailSent ? "✅" : "📲"}</span>
            {emailSent ? "Screenshot Sent — Slot Confirmed!" : hasTappedPay ? "Send Payment Screenshot on WhatsApp" : "Send Screenshot on WhatsApp"}
          </button>

          {!hasTappedPay && (
            <p style={{ fontSize: "0.68rem", color: "rgba(255,248,230,0.6)", marginTop: 8, lineHeight: 1.6 }}>
              Pay first, then send us the screenshot to lock your slot.
            </p>
          )}
          {hasTappedPay && (
            <p style={{ fontSize: "0.7rem", color: "#25d366", marginTop: 8, lineHeight: 1.6, opacity: 0.9 }}>
              Opens WhatsApp with your order details pre-filled.<br />
              Just attach your payment screenshot and send! 🍡
            </p>
          )}
        </div>

        <a href="https://instagram.com/byeversweet" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase" as const, textDecoration: "none" }}>
          Follow us @byeversweet →
        </a>
      </main>
    );
  }

  // ── Order form ─────────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "36px 24px 80px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <p style={{ fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 10, opacity: 0.85 }}>
          Cloud Kitchen · Kochi
        </p>
        <h1 className="font-display" style={{ fontSize: "3rem", fontWeight: 300, lineHeight: 1, marginBottom: 4 }}>
          Ever<em style={{ color: "var(--gold)" }}>sweet</em>
        </h1>
        <div style={{ width: 36, height: 1, background: "var(--gold)", margin: "14px auto", opacity: 0.5 }} />
        <p style={{ fontSize: "0.82rem", color: "var(--cream-dim)", lineHeight: 1.7 }}>
          Pick your flavours, choose a delivery slot, and pay to confirm.
        </p>
      </div>

      {/* ── STEP 1: Flavours ──────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: "0.62rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4, opacity: 0.85 }}>
          Step 1
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 500, color: "var(--cream)", marginBottom: 4 }}>
          Pick your flavours
        </p>
        <p style={{ fontSize: "0.72rem", color: "var(--cream-dim)", marginBottom: 14 }}>
          Minimum 4 pieces. Mix and match freely.
        </p>

        {loading ? (
          <p style={{ color: "var(--cream-dim)", fontSize: "0.8rem" }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {products.map((p) => {
              const qty = flavours[p.id] || 0;
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                  borderRadius: 8, border: `1px solid ${qty > 0 ? "var(--gold)" : "var(--border2)"}`,
                  background: qty > 0 ? "rgba(184,134,11,0.06)" : "var(--surface)",
                  transition: "all 0.2s",
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--cream)" }}>
                      {p.name}
                      {p.is_premium && <span style={{ color: "var(--gold)", fontSize: "0.6rem", letterSpacing: "0.1em", marginLeft: 6 }}>PREMIUM</span>}
                    </p>
                    {p.description && (
                      <p style={{ fontSize: "0.68rem", color: "var(--cream-dim)", lineHeight: 1.4, marginTop: 2 }}>{p.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 0, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "2px", flexShrink: 0 }}>
                    <button onClick={() => adjustFlavour(p.id, -1)} disabled={qty === 0} style={{ width: 30, height: 30, borderRadius: "50%", background: qty > 0 ? "rgba(184,134,11,0.25)" : "transparent", border: "none", color: qty > 0 ? "var(--gold)" : "rgba(255,255,255,0.3)", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: qty === 0 ? "not-allowed" : "pointer" }}>−</button>
                    <span style={{ fontSize: "0.95rem", minWidth: 28, textAlign: "center", color: qty > 0 ? "var(--gold)" : "rgba(255,255,255,0.4)", fontWeight: qty > 0 ? 700 : 400 }}>{qty}</span>
                    <button onClick={() => adjustFlavour(p.id, 1)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(184,134,11,0.25)", border: "none", color: "var(--gold)", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Box summary */}
        {totalPicked > 0 && autoBox && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(184,134,11,0.08)", border: "1px solid rgba(184,134,11,0.3)", borderRadius: 8 }}>
            <p style={{ fontSize: "0.78rem", color: "var(--gold)", fontWeight: 500 }}>
              ✓ {autoBox.label} — ₹{autoBox.price}
            </p>
            <p style={{ fontSize: "0.68rem", color: "var(--cream-dim)", marginTop: 2 }}>
              {totalPicked} of {autoBox.count} pieces ·{" "}
              {autoBox.count - totalPicked === 0 ? "Box full!" : `${autoBox.count - totalPicked} spot${autoBox.count - totalPicked === 1 ? "" : "s"} remaining`}
            </p>
          </div>
        )}

        {error && step === 1 && (
          <p style={{ fontSize: "0.82rem", color: "#e57373", marginTop: 10, textAlign: "center", padding: "8px 12px", background: "rgba(220,50,50,0.1)", borderRadius: 6, border: "1px solid rgba(220,50,50,0.25)" }}>{error}</p>
        )}

        {totalPicked > 0 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button
              className="btn-gold"
              style={{ maxWidth: 280, opacity: autoBox && totalPicked < autoBox.count ? 0.45 : 1, cursor: autoBox && totalPicked < autoBox.count ? "not-allowed" : "pointer" }}
              onClick={proceedToSlot}
            >
              {autoBox && totalPicked < autoBox.count
                ? `Add ${autoBox.count - totalPicked} more to unlock →`
                : "Choose Delivery Date & Batch →"}
            </button>
          </div>
        )}
      </div>

      {/* ── STEP 2: Date, batch, fulfillment ─────────────────── */}
      {step >= 2 && (
        <div ref={slotRef} style={{ marginBottom: 32 }}>
          <div style={{ width: "100%", height: 1, background: "var(--border2)", marginBottom: 24 }} />
          <p style={{ fontSize: "0.62rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4, opacity: 0.85 }}>Step 2</p>
          <p style={{ fontSize: "1rem", fontWeight: 500, color: "var(--cream)", marginBottom: 14 }}>Delivery date & batch</p>

          {/* Date chips */}
          <p style={{ fontSize: "0.68rem", color: "var(--gold)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Delivery Date</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "Today", val: todayStr },
              { label: "Tomorrow", val: tomorrowStr },
              { label: new Date(Date.now() + 2 * 86400000).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }), val: toDateString(new Date(Date.now() + 2 * 86400000)) },
            ].map((chip) => (
              <button key={chip.val} onClick={() => { setSelectedDate(chip.val); setSelectedBatch(null); }} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${selectedDate === chip.val ? "var(--gold)" : "var(--border2)"}`, background: selectedDate === chip.val ? "rgba(184,134,11,0.12)" : "transparent", color: selectedDate === chip.val ? "var(--gold)" : "var(--cream-dim)", fontSize: "0.78rem", fontWeight: selectedDate === chip.val ? 700 : 400, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
                {chip.label}
              </button>
            ))}
          </div>
          <input type="date" min={todayStr} value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedBatch(null); }} style={{ width: "100%", background: "var(--surface)", border: "1px solid rgba(184,134,11,0.4)", color: "var(--cream)", padding: "10px 14px", borderRadius: 8, fontSize: "0.9rem", fontFamily: "system-ui, sans-serif", outline: "none", colorScheme: "dark", boxSizing: "border-box" as const, marginBottom: 20 }} />

          {/* Fulfillment toggle */}
          <p style={{ fontSize: "0.68rem", color: "var(--gold)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>Delivery or Pickup?</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["delivery", "pickup"] as const).map((type) => (
              <button key={type} onClick={() => setFulfillmentType(type)} style={{ flex: 1, padding: "12px 16px", borderRadius: 8, border: `1px solid ${fulfillmentType === type ? "var(--gold)" : "var(--border2)"}`, background: fulfillmentType === type ? "rgba(184,134,11,0.08)" : "var(--surface)", color: fulfillmentType === type ? "var(--gold)" : "var(--cream-dim)", fontSize: "0.85rem", fontWeight: fulfillmentType === type ? 700 : 400, cursor: "pointer", fontFamily: "system-ui, sans-serif", transition: "all 0.2s", textAlign: "left" as const }}>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>{type === "delivery" ? "🚚 Delivery" : "🏠 Self Pickup"}</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.65rem", opacity: 0.7, fontWeight: 400 }}>
                  {type === "delivery" ? "Porter charges extra, paid by you" : "Collect from our kitchen"}
                </p>
              </button>
            ))}
          </div>

          {fulfillmentType === "delivery" && (
            <div style={{ background: "rgba(255,200,100,0.06)", border: "1px solid rgba(184,134,11,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
              <p style={{ fontSize: "0.75rem", color: "var(--cream-dim)", lineHeight: 1.7 }}>
                🚚 We use <strong style={{ color: "var(--cream)" }}>Porter</strong> for delivery. Charges are based on your distance and are paid directly by you. We'll share the Porter booking link once your order is confirmed.
              </p>
            </div>
          )}

          {/* Batch selection */}
          <p style={{ fontSize: "0.68rem", color: "var(--gold)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
            {friendlyDate(selectedDate)} — Choose a batch
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {BATCHES.map((batch) => {
              const isSelected = selectedBatch === batch.id;
              return (
                <button key={batch.id} onClick={() => pickBatch(batch.id)} style={{ padding: "16px 18px", textAlign: "left", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${isSelected ? "var(--gold)" : "var(--border2)"}`, background: isSelected ? "rgba(184,134,11,0.06)" : "var(--surface)", borderRadius: 8, transition: "all 0.2s ease", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>{batch.icon}</span>
                    <div>
                      <p style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 3, color: isSelected ? "var(--gold)" : "var(--cream)" }}>{batch.label}</p>
                      <p style={{ fontSize: "0.75rem", color: isSelected ? "rgba(184,134,11,0.7)" : "var(--cream-dim)" }}>{batch.timeRange}</p>
                    </div>
                  </div>
                  {isSelected && <span style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 4, background: "rgba(184,134,11,0.2)", color: "var(--gold)", fontWeight: 700 }}>✓ SELECTED</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 3: Details ───────────────────────────────────── */}
      {step >= 3 && (
        <div ref={formRef}>
          <div style={{ width: "100%", height: 1, background: "var(--border2)", marginBottom: 24 }} />
          <button onClick={() => { setStep(2); setTimeout(() => slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }} style={{ background: "transparent", border: "none", color: "var(--cream-dim)", fontSize: "0.78rem", cursor: "pointer", padding: "0 0 16px", display: "flex", alignItems: "center", gap: 6, fontFamily: "system-ui, sans-serif" }}>
            ← Back
          </button>
          <p style={{ fontSize: "0.62rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4, opacity: 0.85 }}>Step 3</p>
          <p style={{ fontSize: "1rem", fontWeight: 500, color: "var(--cream)", marginBottom: 14 }}>Your details</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <input className="field" placeholder="Full Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" />
            <input className="field" placeholder="Phone Number *" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} autoComplete="tel" />
          </div>

          {/* Order summary */}
          <div className="card" style={{ padding: "14px 16px", borderRadius: 6, marginBottom: 16 }}>
            <p style={{ fontSize: "0.65rem", color: "var(--cream-dim)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Order Summary</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--cream-dim)" }}>{autoBox?.label}</span>
                <span style={{ fontSize: "0.82rem" }}>₹{autoBox?.price}</span>
              </div>
              {Object.entries(flavours).map(([id, qty]) => {
                const prod = products.find((p) => p.id === id);
                if (!prod || qty === 0) return null;
                return (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--cream-dim)" }}>{prod.name} × {qty}</span>
                  </div>
                );
              })}
              {selectedBatch && (() => {
                const batch = BATCHES.find((b) => b.id === selectedBatch)!;
                return (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--cream-dim)" }}>{batch.icon} {batch.label}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--cream-dim)" }}>{friendlyDate(selectedDate)}</span>
                  </div>
                );
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: "0.75rem", color: fulfillmentType === "pickup" ? "#a3d977" : "var(--cream-dim)" }}>
                  {fulfillmentType === "pickup" ? "🏠 Self Pickup" : "🚚 Delivery via Porter"}
                </span>
              </div>
              <div style={{ width: "100%", height: 1, background: "var(--border2)", margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Total</span>
                <span style={{ fontSize: "0.95rem", color: "var(--gold)", fontFamily: "Cormorant Garamond, serif" }}>₹{autoBox?.price}</span>
              </div>
              {fulfillmentType === "delivery" && (
                <p style={{ fontSize: "0.65rem", color: "rgba(255,248,230,0.5)", marginTop: 4 }}>+ Porter delivery charges paid by you directly</p>
              )}
            </div>
          </div>

          {error && (
            <p style={{ fontSize: "0.82rem", color: "#e57373", marginBottom: 12, textAlign: "center", padding: "8px 12px", background: "rgba(220,50,50,0.1)", borderRadius: 6, border: "1px solid rgba(220,50,50,0.25)" }}>{error}</p>
          )}

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn-gold" disabled={placing} onClick={placeOrder} style={{ maxWidth: 300 }}>
              {placing ? "Placing order…" : "Place Order"}
            </button>
          </div>
          <p style={{ fontSize: "0.68rem", color: "var(--cream-dim)", marginTop: 10, textAlign: "center", lineHeight: 1.7 }}>
            We confirm once payment is received.
          </p>
        </div>
      )}

      {/* Sticky bar */}
      {totalPicked > 0 && step === 1 && autoBox && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(18, 10, 5, 0.96)", borderTop: "1px solid rgba(184,134,11,0.4)", backdropFilter: "blur(12px)", padding: "14px 20px 20px", zIndex: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: "0.72rem", color: "var(--gold)", fontWeight: 600 }}>{autoBox.label} · ₹{autoBox.price}</span>
            <span style={{ fontSize: "0.72rem", color: autoBox.count - totalPicked === 0 ? "var(--gold)" : "var(--cream-dim)" }}>
              {autoBox.count - totalPicked === 0 ? "✓ Box full!" : `${autoBox.count - totalPicked} more to fill`}
            </span>
          </div>
          <div style={{ width: "100%", height: 6, background: "rgba(184,134,11,0.18)", borderRadius: 99, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min((totalPicked / autoBox.count) * 100, 100)}%`, background: autoBox.count - totalPicked === 0 ? "var(--gold)" : "linear-gradient(90deg, rgba(184,134,11,0.6), var(--gold))", borderRadius: 99, transition: "width 0.3s ease" }} />
          </div>
          <button className="btn-gold" style={{ width: "100%", opacity: autoBox.count - totalPicked === 0 ? 1 : 0.45, cursor: autoBox.count - totalPicked === 0 ? "pointer" : "not-allowed" }} onClick={proceedToSlot}>
            {autoBox.count - totalPicked === 0 ? "Continue →" : `Fill ${autoBox.count - totalPicked} more to unlock`}
          </button>
        </div>
      )}
    </main>
  );
}