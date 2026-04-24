"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const UPI_ID = "thinkwide9-1@okicici";
const WHATSAPP_NUMBER = "917907044368";
const PAYMENT_ENABLED = false; // Set to true when ready to enable UPI payments
const BATCHES = [
  { id: "morning", label: "Morning Batch", icon: "🌅", timeRange: "9AM – 12PM" },
  { id: "afternoon", label: "Afternoon Batch", icon: "☀️", timeRange: "12PM – 4PM" },
  { id: "evening", label: "Evening Batch", icon: "🌙", timeRange: "5PM – 8PM" },
];

function getBatchIcon(label: string): string {
  const l = label?.toLowerCase() || "";
  if (l.includes("morning")) return "🌅";
  if (l.includes("afternoon")) return "☀️";
  if (l.includes("evening")) return "🌙";
  return "📦";
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

function GoldLine() {
  return (
    <div style={{ width: 36, height: 1, background: "var(--gold)", opacity: 0.45, margin: "10px auto 22px" }} />
  );
}

type OrderData = {
  id: string;
  customer_name: string;
  phone: string;
  address?: string;
  box_size_id?: string;
  flavours?: Record<string, number>;
  delivery_date?: string;
  batch_label?: string;
  total_price: number;
  status: string;
  fulfillment_type?: string;
};

type ProductMap = Record<string, string>;
type BoxMap = Record<string, string>;

export default function PayPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [productMap, setProductMap] = useState<ProductMap>({});
  const [boxMap, setBoxMap] = useState<BoxMap>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hasTappedPay, setHasTappedPay] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {

    async function load() {
      if (!id) { setNotFound(true); setLoading(false); return; }
      const [{ data: o }, { data: p }, { data: b }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("products").select("id, name"),
        supabase.from("box_sizes").select("id, label"),
      ]);
      if (!o) { setNotFound(true); setLoading(false); return; }
      setOrder(o as OrderData);
      const pm: ProductMap = {};
      (p || []).forEach((prod: { id: string; name: string }) => { pm[prod.id] = prod.name; });
      setProductMap(pm);
      const bm: BoxMap = {};
      (b || []).forEach((box: { id: string; label: string }) => { bm[box.id] = box.label; });
      setBoxMap(bm);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--cream-dim)", fontSize: "0.88rem" }}>Loading your order…</p>
      </main>
    );
  }

  if (notFound || !order) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: "2rem", marginBottom: 12 }}>🍡</p>
        <p style={{ color: "var(--cream)", fontSize: "1rem", marginBottom: 8 }}>Order not found</p>
        <p style={{ color: "var(--cream-dim)", fontSize: "0.82rem" }}>This link may be invalid or expired. Please contact us on Instagram @byeversweet.</p>
      </main>
    );
  }

  if (order.status !== "pending") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: "2rem", marginBottom: 12 }}>✅</p>
        <p style={{ color: "var(--cream)", fontSize: "1rem", marginBottom: 8 }}>This order is already confirmed!</p>
        <p style={{ color: "var(--cream-dim)", fontSize: "0.82rem" }}>No further action needed. We'll be in touch on WhatsApp.</p>
        <a href="https://instagram.com/byeversweet" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none", marginTop: 24 }}>
          Follow us @byeversweet →
        </a>
      </main>
    );
  }

  const flavourSummary = order.flavours
    ? Object.entries(order.flavours)
        .filter(([, qty]) => qty > 0)
        .map(([pid, qty]) => `${productMap[pid] || "Item"} ×${qty}`)
        .join(", ")
    : "";

  const boxLabel = order.box_size_id ? boxMap[order.box_size_id] || "Box" : "Box";
  const batchIcon = getBatchIcon(order.batch_label || "");
  const fulfillmentType = order.fulfillment_type || "delivery";

  const deliveryDateStr = order.delivery_date
    ? new Date(order.delivery_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })
    : "";

  const upiLinks = buildUpiLinks(order.total_price, order.customer_name);

  const message = [
    `Hi! I just paid ₹${order.total_price} for my Eversweet order 🍡`,
    ``,
    `📦 ${boxLabel}`,
    flavourSummary ? `🍡 ${flavourSummary}` : null,
    order.batch_label ? `${batchIcon} ${order.batch_label} · ${deliveryDateStr}` : null,
    fulfillmentType === "pickup" ? `🏠 Self Pickup` : `🚚 Delivery via Porter`,
    ``,
    `Please confirm my slot!`,
  ].filter((l) => l !== null).join("\n");

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  async function sendAlert() {
    try {
      await fetch("/api/payment-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: order!.customer_name,
          phone: order!.phone,
          address: order!.address || (fulfillmentType === "pickup" ? "Self Pickup" : ""),
          batch_label: order!.batch_label || "",
          delivery_date: deliveryDateStr,
          box_label: boxLabel,
          flavour_summary: flavourSummary,
          total_price: order!.total_price,
        }),
      });
    } catch (e) {
      console.error("Alert failed:", e);
    }
  }

  return (
    <main style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 24px", textAlign: "center", maxWidth: 420, margin: "0 auto",
    }}>
      <div style={{ fontSize: 52, marginBottom: 20 }}>🍡</div>
      <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 300, marginBottom: 16, lineHeight: 1.2 }}>
        Hi <em>{order.customer_name.split(" ")[0]}</em>,<br />
        complete your payment
      </h1>
      <p style={{ fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 8, opacity: 0.85 }}>
        to confirm your Eversweet order
      </p>
      <GoldLine />

      {/* Order summary */}
      <div style={{
        background: "rgba(184,134,11,0.08)", border: "1px solid rgba(184,134,11,0.25)",
        borderRadius: 10, padding: "14px 18px", marginBottom: 28, width: "100%", textAlign: "left",
      }}>
        <p style={{ fontSize: "0.65rem", color: "var(--gold)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Your Order</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--cream-dim)" }}>{boxLabel}</span>
            <span style={{ fontSize: "0.88rem", color: "var(--gold)", fontWeight: 700 }}>₹{order.total_price}</span>
          </div>
          {flavourSummary && (
            <p style={{ fontSize: "0.75rem", color: "var(--cream-dim)" }}>🍡 {flavourSummary}</p>
          )}
          {order.batch_label && deliveryDateStr && (
            <p style={{ fontSize: "0.75rem", color: "var(--cream-dim)" }}>
              {batchIcon} {order.batch_label} · {deliveryDateStr}
            </p>
          )}
          <p style={{ fontSize: "0.72rem", color: fulfillmentType === "pickup" ? "#a3d977" : "rgba(255,248,230,0.55)" }}>
            {fulfillmentType === "pickup" ? "🏠 Self Pickup" : "🚚 Delivery via Porter (charges extra, paid by you)"}
          </p>
        </div>
      </div>

     {/* Payment block */}
{PAYMENT_ENABLED ? (
  <div style={{
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(184,134,11,0.3)", borderRadius: 12,
    padding: "20px 18px", marginBottom: 24,
  }}>
    {/* ... all your existing payment block content unchanged ... */}
  </div>
) : (
  <div style={{
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(184,134,11,0.3)", borderRadius: 12,
    padding: "24px 18px", marginBottom: 24, textAlign: "center",
  }}>
    <p style={{ fontSize: "1.8rem", marginBottom: 12 }}>📱</p>
    <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--gold)", marginBottom: 8 }}>
      Pay via UPI to <strong>7907044368</strong> & confirm on WhatsApp
    </p>
    <p style={{ fontSize: "0.82rem", color: "var(--cream-dim)", lineHeight: 1.7, marginBottom: 20 }}>
      Please pay <strong style={{ color: "var(--gold)" }}>₹{order.total_price}</strong> to:
      <br />
      <strong style={{ color: "var(--cream)", fontSize: "1rem" }}>{UPI_ID}</strong>
    </p>

    {/* QR Code */}
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
      <div style={{ background: "white", borderRadius: 10, padding: 14, display: "inline-block" }}>
        <img
          src="/upi-qr.png"
          alt="UPI QR Code"
          style={{ width: 160, height: 160, display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <p style={{ color: "#555", fontSize: "0.7rem", marginTop: 8, textAlign: "center" }}>
          Scan to pay ₹{order.total_price}
        </p>
      </div>
    </div>

    {/* WhatsApp button */}
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: "100%", padding: "14px 20px", borderRadius: 10,
        background: "linear-gradient(135deg, #25d366 0%, #128c4a 100%)",
        color: "#fff", fontSize: "1rem", fontWeight: 700,
        textDecoration: "none", boxSizing: "border-box" as const,
        boxShadow: "0 4px 16px rgba(37,211,102,0.35)",
      }}
    >
      📲 Send Payment Screenshot on WhatsApp
    </a>
    <p style={{ fontSize: "0.7rem", color: "rgba(255,248,230,0.5)", marginTop: 12, lineHeight: 1.6 }}>
      After paying, send us the screenshot on WhatsApp to confirm your slot.
      <br />UPI ID: {UPI_ID}
    </p>
  </div>
)}

      <a href="https://instagram.com/byeversweet" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase" as const, textDecoration: "none" }}>
        Follow us @byeversweet →
      </a>
    </main>
  );
}