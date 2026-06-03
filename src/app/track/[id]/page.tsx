"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Save this file as: src/app/track/[id]/page.tsx

const WHATSAPP_NUMBER = "917907044368";

const STATUS_STEPS = [
  {
    key: "pending",
    label: "Order Received",
    icon: "📋",
    desc: "Your order has been received. We'll confirm shortly.",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    icon: "✅",
    desc: "Order confirmed and payment received. You're in!",
  },
  {
    key: "cooking",
    label: "Being Made",
    icon: "👨‍🍳",
    desc: "Your mochi is being crafted fresh in Kochi.",
  },
  {
    key: "cooked",
    label: "Ready",
    icon: "🍡",
    desc: "Your mochi is ready and packed.",
  },
  {
    key: "dispatched",
    label: "On the Way",
    icon: "🚂",
    desc: "Your order is travelling to Trivandrum. Almost there!",
  },
  {
    key: "porter_booked",
    label: "Out for Delivery",
    icon: "🛵",
    desc: "Porter is on the way to deliver your order.",
  },
];

const PAID_STATUSES = [
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
];

type OrderData = {
  id: string;
  customer_name: string;
  phone: string;
  flavours?: Record<string, number>;
  total_price: number;
  status: string;
  source?: string;
  delivery_slot?: string;
  remarks?: string;
  created_at: string;
};

export default function TrackPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    async function load() {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("products").select("id, name"),
      ]);
      if (!o) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setOrder(o as OrderData);
      const pm: Record<string, string> = {};
      (p || []).forEach((prod: { id: string; name: string }) => {
        pm[prod.id] = prod.name;
      });
      setProductMap(pm);
      setLoading(false);
    }
    load();

    // Poll every 30s for live updates
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("orders")
        .select("status, delivery_slot, remarks")
        .eq("id", id)
        .single();
      if (data) setOrder((prev) => (prev ? { ...prev, ...data } : prev));
    }, 30000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading)
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#160c08",
        }}
      >
        <style>{CSS}</style>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "2rem", marginBottom: 12 }}>🍡</p>
          <p style={{ color: "#c8b89a", fontSize: "0.88rem" }}>
            Loading your order…
          </p>
        </div>
      </main>
    );

  if (notFound || !order)
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          background: "#160c08",
        }}
      >
        <style>{CSS}</style>
        <p style={{ fontSize: "2rem", marginBottom: 12 }}>🍡</p>
        <p style={{ color: "#f5ede0", fontSize: "1rem", marginBottom: 8 }}>
          Order not found
        </p>
        <p style={{ color: "#c8b89a", fontSize: "0.82rem" }}>
          This link may be invalid. Please contact us on WhatsApp.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 20,
            color: "#25d366",
            fontSize: "0.82rem",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          📲 Chat on WhatsApp →
        </a>
      </main>
    );

  const isCancelled = order.status === "cancelled";
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const currentStep = STATUS_STEPS[currentStepIdx] || STATUS_STEPS[0];

  const flavourSummary = order.flavours
    ? Object.entries(order.flavours)
        .filter(([, q]) => q > 0)
        .map(([id, qty]) => `${productMap[id] || "Item"} ×${qty}`)
        .join(", ")
    : "";

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 60,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: "#160c08",
        minHeight: "100vh",
      }}
    >
      <style>{CSS}</style>

      {/* Header */}
      <div
        style={{
          padding: "40px 24px 24px",
          textAlign: "center",
          borderBottom: "1px solid rgba(201,168,76,0.1)",
          background:
            "linear-gradient(180deg, rgba(255,248,230,0.04) 0%, transparent 100%)",
        }}
      >
        <p
          style={{
            fontSize: "0.58rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#c9a84c",
            marginBottom: 12,
            opacity: 0.8,
          }}
        >
          Order Tracking
        </p>
        <h1
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "2.4rem",
            fontWeight: 300,
            color: "#f5ede0",
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          Hi,{" "}
          <em style={{ color: "#c9a84c" }}>
            {order.customer_name.split(" ")[0]}
          </em>
        </h1>
        <p
          style={{
            fontSize: "0.72rem",
            color: "#c8b89a",
            letterSpacing: "0.08em",
          }}
        >
          Order #{id.slice(0, 8).toUpperCase()}
        </p>
      </div>

      {/* Current status hero */}
      {!isCancelled ? (
        <div
          style={{
            margin: "24px 24px 0",
            padding: "24px",
            background: "rgba(201,168,76,0.07)",
            border: "1px solid rgba(201,168,76,0.25)",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>
            {currentStep.icon}
          </div>
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#f5ede0",
              marginBottom: 6,
            }}
          >
            {currentStep.label}
          </p>
          <p style={{ fontSize: "0.82rem", color: "#c8b89a", lineHeight: 1.7 }}>
            {currentStep.desc}
          </p>
          {order.delivery_slot && (
            <p
              style={{
                fontSize: "0.78rem",
                color: "#c9a84c",
                marginTop: 10,
                fontWeight: 600,
              }}
            >
              🕐 Pickup slot: {order.delivery_slot}
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            margin: "24px 24px 0",
            padding: "24px",
            background: "rgba(220,50,50,0.08)",
            border: "1px solid rgba(220,50,50,0.25)",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>❌</div>
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#e57373",
              marginBottom: 6,
            }}
          >
            Order Cancelled
          </p>
          <p style={{ fontSize: "0.82rem", color: "#c8b89a", lineHeight: 1.7 }}>
            This order has been cancelled. Please contact us on WhatsApp if you
            have questions.
          </p>
        </div>
      )}

      {/* Progress timeline */}
      {!isCancelled && (
        <div
          style={{
            margin: "24px 24px 0",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "20px 20px",
          }}
        >
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#c9a84c",
              marginBottom: 18,
              fontWeight: 600,
              opacity: 0.8,
            }}
          >
            Progress
          </p>
          {STATUS_STEPS.map((step, i) => {
            const isDone = currentStepIdx > i;
            const isCurrent = currentStepIdx === i;
            const isPending = currentStepIdx < i;
            return (
              <div
                key={step.key}
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: i < STATUS_STEPS.length - 1 ? 4 : 0,
                  position: "relative",
                }}
              >
                {/* Line connector */}
                {i < STATUS_STEPS.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 15,
                      top: 32,
                      width: 2,
                      height: 32,
                      background: isDone
                        ? "rgba(201,168,76,0.5)"
                        : "rgba(255,255,255,0.06)",
                      zIndex: 0,
                    }}
                  />
                )}
                {/* Dot */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: isDone
                      ? "rgba(201,168,76,0.2)"
                      : isCurrent
                        ? "rgba(201,168,76,0.15)"
                        : "rgba(255,255,255,0.04)",
                    border: `2px solid ${isDone ? "#c9a84c" : isCurrent ? "rgba(201,168,76,0.6)" : "rgba(255,255,255,0.1)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isDone ? "0.75rem" : "0.9rem",
                    zIndex: 1,
                    position: "relative",
                  }}
                >
                  {isDone ? "✓" : step.icon}
                </div>
                {/* Text */}
                <div style={{ paddingTop: 4, paddingBottom: 20 }}>
                  <p
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: isCurrent ? 700 : 400,
                      color: isDone
                        ? "#c9a84c"
                        : isCurrent
                          ? "#f5ede0"
                          : "rgba(255,248,230,0.35)",
                      lineHeight: 1.2,
                    }}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p
                      style={{
                        fontSize: "0.7rem",
                        color: "#c8b89a",
                        marginTop: 3,
                        lineHeight: 1.5,
                      }}
                    >
                      {step.desc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order details */}
      <div
        style={{
          margin: "20px 24px 0",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: "20px",
        }}
      >
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#c9a84c",
            marginBottom: 16,
            fontWeight: 600,
            opacity: 0.8,
          }}
        >
          Order Details
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: "0.82rem", color: "#c8b89a" }}>Total</span>
          <span
            style={{ fontSize: "1.2rem", fontWeight: 700, color: "#c9a84c" }}
          >
            ₹{order.total_price}
          </span>
        </div>

        {flavourSummary && (
          <div style={{ marginBottom: 10 }}>
            <p
              style={{ fontSize: "0.75rem", color: "#c8b89a", marginBottom: 4 }}
            >
              Flavours
            </p>
            <p
              style={{ fontSize: "0.85rem", color: "#f5ede0", lineHeight: 1.6 }}
            >
              🍡 {flavourSummary}
            </p>
          </div>
        )}

        {order.delivery_slot && (
          <div style={{ marginBottom: 10 }}>
            <p
              style={{ fontSize: "0.75rem", color: "#c8b89a", marginBottom: 4 }}
            >
              Pickup Slot
            </p>
            <p style={{ fontSize: "0.85rem", color: "#f5ede0" }}>
              🕐 {order.delivery_slot}
            </p>
          </div>
        )}

        {order.remarks && (
          <div>
            <p
              style={{ fontSize: "0.75rem", color: "#c8b89a", marginBottom: 4 }}
            >
              Notes
            </p>
            <p
              style={{
                fontSize: "0.82rem",
                color: "#f5ede0",
                fontStyle: "italic",
              }}
            >
              {order.remarks}
            </p>
          </div>
        )}
      </div>

      {/* WhatsApp CTA */}
      <div style={{ margin: "20px 24px 0" }}>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi! I'm checking on my Eversweet order #${id.slice(0, 8).toUpperCase()}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #25d366, #128c4a)",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 4px 16px rgba(37,211,102,0.25)",
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>📲</span>
          Questions? Chat with us
        </a>
        <p
          style={{
            fontSize: "0.68rem",
            color: "rgba(255,248,230,0.35)",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          This page updates automatically every 30 seconds
        </p>
      </div>

      {/* Branding */}
      <div style={{ padding: "28px 24px 0", textAlign: "center" }}>
        <p
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "1.4rem",
            color: "#c9a84c",
            fontWeight: 300,
          }}
        >
          Eversweet
        </p>
        <p style={{ fontSize: "0.65rem", color: "#c8b89a", marginTop: 2 }}>
          Cloud Kitchen · Kochi, Kerala
        </p>
      </div>
    </main>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  body { background: #160c08; color: #f5ede0; font-family: 'DM Sans', sans-serif; font-weight: 300; -webkit-font-smoothing: antialiased; }
`;
