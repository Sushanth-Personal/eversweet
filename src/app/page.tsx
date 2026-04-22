"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize, CustomerForm } from "@/lib/types";

const IMG: Record<string, string> = {
  matcha:
    "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mango-mochi.png",
  strawberry:
    "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mochi-strawberry.webp",
  default:
    "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mochi-strawberry.webp",
};

// ── Your payment details ───────────────────────────────────────────
const UPI_ID = "YOUR_UPI_ID_HERE"; // e.g. "yourname@okicici" — replace this!
const WHATSAPP_NUMBER = "917907044368"; // already in your code

function getImg(name: string, url: string | null): string {
  if (url) return url;
  const n = name.toLowerCase();
  if (n.includes("mango")) return IMG.matcha;
  if (n.includes("strawberry")) return IMG.strawberry;
  if (n.includes("coffee"))
    return "https://images.unsplash.com/photo-1541167760496-162955ed8a9f?w=600&q=80";
  return IMG.default;
}

// ── Static batch definitions — no DB needed ────────────────────────
const BATCHES = [
  {
    id: "morning",
    label: "Morning Batch",
    icon: "🌅",
    timeRange: "9AM – 12PM",
  },
  {
    id: "afternoon",
    label: "Afternoon Batch",
    icon: "☀️",
    timeRange: "12PM – 4PM",
  },
  {
    id: "evening",
    label: "Evening Batch",
    icon: "🌙",
    timeRange: "5PM – 8PM",
  },
] as const;

type BatchId = (typeof BATCHES)[number]["id"];

// ── Real testimonials from customer DMs ───────────────────────────
const TESTIMONIALS = [
  {
    name: "Sneha R.",
    handle: "via Instagram DM",
    text: "Absolutely loved these mochis! Soft, chewy, and perfectly sweet — each bite just melts in the mouth. Definitely craving more!",
    avatar: "S",
  },
  {
    name: "Divya M.",
    handle: "via Instagram DM",
    text: "The mochis are amazing.... too good 🩷 Thank you for the surprise!",
    avatar: "D",
  },
  {
    name: "Anju K.",
    handle: "via Instagram DM",
    text: "Hi got the Mochi. It was yummy.. we loved it 😍 Thank you",
    avatar: "A",
  },
  {
    name: "Priya S.",
    handle: "via Instagram DM",
    text: "Sooooooo good! We finished in seconds. Will get more from u ❤️",
    avatar: "P",
  },
  {
    name: "Nithya V.",
    handle: "via Instagram DM",
    text: "Its was soo good! Nalla taste. But fruit flavours was awesome ❤️❤️❤️❤️",
    avatar: "N",
  },
];

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getAutoBox(boxes: BoxSize[], totalPicked: number): BoxSize | null {
  if (totalPicked === 0) return null;
  const sorted = [...boxes].sort((a, b) => a.count - b.count);
  return (
    sorted.find((b) => b.count >= totalPicked) || sorted[sorted.length - 1]
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p
      style={{
        fontSize: "0.62rem",
        letterSpacing: "0.2em",
        textTransform: "uppercase" as const,
        color: "var(--gold)",
        marginBottom: 8,
        opacity: 0.85,
        textAlign: "center",
      }}
    >
      {text}
    </p>
  );
}

function GoldLine() {
  return (
    <div
      style={{
        width: 36,
        height: 1,
        background: "var(--gold)",
        opacity: 0.45,
        marginTop: 10,
        marginBottom: 22,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    />
  );
}

// ── Build UPI intent URL ──────────────────────────────────────────
function buildUpiUrl(amount: number, name: string): string {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: "Eversweet",
    am: String(amount),
    cu: "INR",
    tn: `Eversweet order for ${name}`,
  });
  return `upi://pay?${params.toString()}`;
}

// ── Build WhatsApp pre-filled message ─────────────────────────────
function buildWhatsAppUrl(
  customerName: string,
  amount: number,
  boxLabel: string,
  flavourSummary: string,
  batchLabel: string,
  batchIcon: string,
  deliveryDate: string,
): string {
  const message = [
    `Hi! I just paid ₹${amount} for my Eversweet order 🍡`,
    ``,
    `📦 ${boxLabel}`,
    flavourSummary ? `🍡 ${flavourSummary}` : null,
    `${batchIcon} ${batchLabel} · ${deliveryDate}`,
    ``,
    `Please confirm my slot!`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [loading, setLoading] = useState(true);

  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [selectedBatch, setSelectedBatch] = useState<BatchId | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    toDateString(new Date()),
  );

  const [autoBox, setAutoBox] = useState<BoxSize | null>(null);
  const [needsOneMore, setNeedsOneMore] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    address: "",
    dob: "",
    notes: "",
  });
  const [payMethod, setPayMethod] = useState<"qr" | "phone">("qr");
  const [orderDone, setOrderDone] = useState(false);
  // NEW: track if customer has tapped "Pay via UPI"
  const [hasTappedPay, setHasTappedPay] = useState(false);

  const orderRef = useRef<HTMLElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("is_available", true)
          .order("sort_order"),
        supabase
          .from("box_sizes")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      if (p) setProducts(p);
      if (b) setBoxes(b);
      setLoading(false);
    }
    load();
  }, []);

  const totalPicked = Object.values(flavours).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const box = getAutoBox(boxes, totalPicked);
    setAutoBox(box);
    setNeedsOneMore(!!(box && box.count - totalPicked === 1));
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
    if (totalPicked === 0) {
      setError("Please choose at least one flavour.");
      return;
    }
    if (autoBox && totalPicked < autoBox.count) {
      setError(
        `Add ${autoBox.count - totalPicked} more piece${autoBox.count - totalPicked === 1 ? "" : "s"} to fill your ${autoBox.label}.`,
      );
      return;
    }
    setError("");
    setStep(2);
    setTimeout(
      () =>
        slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  function pickBatch(id: BatchId) {
    setSelectedBatch(id);
    setStep(3);
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  async function placeOrder() {
    if (!autoBox || !form.name.trim() || !form.phone.trim() || !selectedBatch) {
      setError("Please fill in your name and phone number.");
      return;
    }
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
          address: form.address.trim(),
          dob: form.dob.trim(),
          notes: form.notes.trim(),
          box_size_id: autoBox.id,
          flavours,
          delivery_date: selectedDate,
          batch_label: batch.label,
          payment_method: payMethod,
          total_price: autoBox.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setOrderDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to place order. Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  }

  function scrollToOrder() {
    orderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const todayStr = toDateString(new Date());
  const tomorrowStr = toDateString(new Date(Date.now() + 86400000));

  function friendlyDate(dateStr: string) {
    if (dateStr === todayStr) return "Today";
    if (dateStr === tomorrowStr) return "Tomorrow";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  }

  // ── Order confirmed ─────────────────────────────────────────────
  if (orderDone) {
    const batch = BATCHES.find((b) => b.id === selectedBatch)!;

    // Build flavour summary for WhatsApp message
    const flavourSummary = Object.entries(flavours)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const prod = products.find((p) => p.id === id);
        return prod ? `${prod.name} ×${qty}` : null;
      })
      .filter(Boolean)
      .join(", ");

    const upiUrl = buildUpiUrl(autoBox?.price || 0, form.name);
    const whatsappUrl = buildWhatsAppUrl(
      form.name,
      autoBox?.price || 0,
      autoBox?.label || "",
      flavourSummary,
      batch.label,
      batch.icon,
      friendlyDate(selectedDate),
    );

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          textAlign: "center",
          maxWidth: 420,
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 20 }}>🍡</div>
        <SectionLabel text="Order Received" />
        <h1
          className="font-display"
          style={{
            fontSize: "2.4rem",
            fontWeight: 300,
            marginBottom: 16,
            lineHeight: 1.1,
          }}
        >
          Thank you,
          <br />
          <em>{form.name.split(" ")[0]}</em>
        </h1>
        <GoldLine />

        {/* Order summary pill */}
        <div
          style={{
            background: "rgba(184,134,11,0.08)",
            border: "1px solid rgba(184,134,11,0.25)",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 28,
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--cream-dim)",
              lineHeight: 1.8,
            }}
          >
            <strong style={{ color: "var(--gold)" }}>
              {batch.icon} {batch.label}
            </strong>{" "}
            on{" "}
            <strong style={{ color: "var(--gold)" }}>
              {friendlyDate(selectedDate)}
            </strong>
            <br />
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {autoBox?.label} · {flavourSummary}
            </span>
          </p>
        </div>

        {/* ── PAYMENT SECTION ── */}
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(184,134,11,0.3)",
            borderRadius: 12,
            padding: "20px 18px",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase" as const,
              color: "var(--gold)",
              marginBottom: 6,
              opacity: 0.85,
            }}
          >
            Complete Your Payment
          </p>
          <p
            style={{
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "var(--gold)",
              marginBottom: 4,
              fontFamily: "Cormorant Garamond, serif",
            }}
          >
            ₹{autoBox?.price}
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              marginBottom: 18,
              lineHeight: 1.6,
            }}
          >
            Your slot is reserved. Pay now to confirm it.
          </p>

          {/* UPI Pay Button */}
          <a
            href={upiUrl}
            onClick={() => setHasTappedPay(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "14px 20px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 700,
              textDecoration: "none",
              marginBottom: 10,
              boxSizing: "border-box" as const,
              boxShadow: "0 4px 16px rgba(26,115,232,0.35)",
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>💳</span>
            Pay ₹{autoBox?.price} via UPI
          </a>

          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--muted)",
              marginBottom: 16,
              lineHeight: 1.6,
            }}
          >
            Opens Google Pay, PhonePe, Paytm or any UPI app
            <br />
            with your amount pre-filled ✓
          </p>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: "rgba(255,255,255,0.1)",
              }}
            />
            <span
              style={{
                fontSize: "0.65rem",
                color: "var(--muted)",
                letterSpacing: "0.1em",
              }}
            >
              AFTER PAYING
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "rgba(255,255,255,0.1)",
              }}
            />
          </div>

          {/* WhatsApp Screenshot Button */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "13px 20px",
              borderRadius: 10,
              background: hasTappedPay
                ? "linear-gradient(135deg, #25d366 0%, #128c4a 100%)"
                : "rgba(37,211,102,0.12)",
              border: hasTappedPay
                ? "none"
                : "1.5px solid rgba(37,211,102,0.4)",
              color: hasTappedPay ? "#fff" : "#25d366",
              fontSize: hasTappedPay ? "1rem" : "0.9rem",
              fontWeight: 700,
              textDecoration: "none",
              boxSizing: "border-box" as const,
              transition: "all 0.3s ease",
              boxShadow: hasTappedPay
                ? "0 4px 16px rgba(37,211,102,0.35)"
                : "none",
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>
              {hasTappedPay ? "✅" : "📲"}
            </span>
            {hasTappedPay
              ? "Send Payment Screenshot on WhatsApp"
              : "Send Screenshot on WhatsApp"}
          </a>

          {hasTappedPay && (
            <p
              style={{
                fontSize: "0.7rem",
                color: "#25d366",
                marginTop: 8,
                lineHeight: 1.6,
                opacity: 0.9,
              }}
            >
              Opens WhatsApp with your order details pre-filled.
              <br />
              Just attach your payment screenshot and send! 🍡
            </p>
          )}

          {!hasTappedPay && (
            <p
              style={{
                fontSize: "0.68rem",
                color: "var(--muted)",
                marginTop: 8,
                lineHeight: 1.6,
              }}
            >
              Pay first, then send us the screenshot to lock your slot.
            </p>
          )}
        </div>

        {/* QR fallback (small, secondary) */}
        <details
          style={{
            width: "100%",
            marginBottom: 24,
            cursor: "pointer",
          }}
        >
          <summary
            style={{
              fontSize: "0.72rem",
              color: "var(--muted)",
              letterSpacing: "0.08em",
              listStyle: "none",
              textAlign: "center",
              padding: "8px 0",
              cursor: "pointer",
            }}
          >
            ▾ Pay via QR code instead
          </summary>
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              paddingTop: 16,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 8,
                padding: 16,
                display: "inline-block",
              }}
            >
              <img
                src="/upi-qr.png"
                alt="UPI QR Code"
                style={{ width: 160, height: 160, display: "block" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p
                style={{
                  color: "#555",
                  fontSize: "0.7rem",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Scan to pay ₹{autoBox?.price}
              </p>
            </div>
            <p
              style={{
                fontSize: "0.68rem",
                color: "var(--muted)",
                marginTop: 10,
              }}
            >
              UPI ID:{" "}
              <strong style={{ color: "var(--cream)" }}>{UPI_ID}</strong>
            </p>
          </div>
        </details>

        <div className="divider" style={{ width: "100%", marginBottom: 24 }} />
        <a
          href="https://instagram.com/byeversweet"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--gold)",
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase" as const,
            textDecoration: "none",
          }}
        >
          Follow us @byeversweet →
        </a>
      </main>
    );
  }

  // ── Main page ───────────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      {/* ══ HERO ══════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "56px 24px 44px",
          textAlign: "center",
          borderBottom: "1px solid var(--border2)",
          background:
            "linear-gradient(180deg, rgba(255,248,230,0.06) 0%, var(--bg) 100%)",
        }}
      >
        <p className="section-label" style={{ marginBottom: 16 }}>
          Cloud Kitchen · Kochi, Kerala
        </p>
        <h1
          className="font-display"
          style={{
            fontSize: "4rem",
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          Ever<em style={{ color: "var(--gold)" }}>sweet</em>
        </h1>
        <div
          style={{
            width: 48,
            height: 1,
            background: "var(--gold)",
            margin: "16px auto",
            opacity: 0.5,
          }}
        />

        {products.filter((p) => p.image_url).length > 0 && (
          <div
            style={{
              position: "relative",
              marginBottom: 28,
              borderRadius: 12,
              overflow: "hidden",
              height: 260,
            }}
          >
            {products
              .filter((p) => p.image_url)
              .slice(0, 4)
              .map((p, i) => (
                <img
                  key={p.id}
                  src={p.image_url!}
                  alt={p.name}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0,
                    animation: `heroFade ${products.filter((x) => x.image_url).slice(0, 4).length * 3}s ease-in-out ${i * 3}s infinite`,
                  }}
                />
              ))}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 60,
                background:
                  "linear-gradient(to bottom, transparent, var(--bg))",
              }}
            />
          </div>
        )}

        <style>{`
  @keyframes heroFade {
    0% { opacity: 0; }
    8% { opacity: 1; }
    33% { opacity: 1; }
    41% { opacity: 0; }
    100% { opacity: 0; }
  }
`}</style>

        <p
          style={{
            color: "var(--cream-dim)",
            fontSize: "1.05rem",
            lineHeight: 1.65,
            maxWidth: 320,
            margin: "0 auto 10px",
            fontStyle: "italic",
          }}
        >
          "The mochi you've been imagining — soft, fresh, made today."
        </p>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.82rem",
            lineHeight: 1.75,
            maxWidth: 300,
            margin: "0 auto 28px",
          }}
        >
          No freezers. No preservatives. Each piece made on the day of your
          delivery — because that&apos;s the only way mochi should be eaten.
        </p>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="btn-gold"
            style={{ maxWidth: 240 }}
            onClick={scrollToOrder}
          >
            Order Fresh Mochi →
          </button>
        </div>
        <p
          style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 14 }}
        >
          Brookie &amp; Tiramisu coming soon ✦
        </p>
      </section>

      {/* ══ PROBLEM / EMPATHY ═════════════════════════════════════ */}
      <section
        style={{
          padding: "32px 24px",
          borderBottom: "1px solid var(--border2)",
          background: "rgba(255,248,230,0.03)",
          textAlign: "center",
        }}
      >
        <SectionLabel text="Why Eversweet" />
        <h2
          className="font-display"
          style={{
            fontSize: "1.6rem",
            fontWeight: 300,
            lineHeight: 1.2,
            marginBottom: 6,
          }}
        >
          Most mochi is made weeks ago.
          <br />
          <em style={{ color: "var(--gold)" }}>Ours was made this morning.</em>
        </h2>
        <GoldLine />
        <p
          style={{
            color: "var(--cream-dim)",
            fontSize: "0.875rem",
            lineHeight: 1.85,
            marginBottom: 16,
            textAlign: "left",
          }}
        >
          You&apos;ve had frozen mochi — that odd, chewy-but-cold bite that
          never quite felt right. The rice flour skin that tears instead of
          yielding. The filling that tastes like a memory of fruit rather than
          the fruit itself.
        </p>
        <p
          style={{
            color: "var(--cream-dim)",
            fontSize: "0.875rem",
            lineHeight: 1.85,
            marginBottom: 20,
            textAlign: "left",
          }}
        >
          Eversweet is built on one belief:{" "}
          <strong style={{ color: "var(--cream)", fontWeight: 500 }}>
            mochi eaten the day it&apos;s made is a completely different food.
          </strong>{" "}
          The skin is impossibly soft. The filling is cold but not frozen. Every
          texture is intentional.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="btn-gold"
            style={{ maxWidth: 220 }}
            onClick={scrollToOrder}
          >
            Build My Box →
          </button>
        </div>
      </section>

      {/* ══ PRODUCTS ══════════════════════════════════════════════ */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
          textAlign: "center",
        }}
      >
        <SectionLabel text="This Week's Menu" />
        <h2
          className="font-display"
          style={{
            fontSize: "1.75rem",
            fontWeight: 300,
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Choose what you love
        </h2>
        <GoldLine />

        {loading ? (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card"
                style={{ height: 200, borderRadius: 6, opacity: 0.3 }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {products.map((p) => {
              const qty = flavours[p.id] || 0;
              return (
                <div
                  key={p.id}
                  onClick={() => adjustFlavour(p.id, 1)}
                  style={{
                    borderRadius: 8,
                    overflow: "hidden",
                    border: `1px solid ${qty > 0 ? "var(--gold)" : "var(--border2)"}`,
                    background:
                      qty > 0 ? "rgba(184,134,11,0.06)" : "var(--surface)",
                    transition: "all 0.25s ease",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <img
                      src={getImg(p.name, p.image_url)}
                      alt={p.name}
                      style={{
                        width: "100%",
                        height: 120,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    {p.is_premium && (
                      <span className="badge-premium">Premium</span>
                    )}
                    {qty > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--gold)",
                          color: "#1a0e00",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                        }}
                      >
                        {qty}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "10px 10px 12px" }}>
                    <p
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 500,
                        marginBottom: 2,
                      }}
                    >
                      {p.name}
                    </p>
                    <p
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--muted)",
                        lineHeight: 1.5,
                        marginBottom: 10,
                      }}
                    >
                      {p.description}
                    </p>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0,
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 99,
                        padding: "2px",
                        width: "fit-content",
                        margin: "0 auto",
                      }}
                    >
                      <button
                        className="qty-btn"
                        onClick={() => adjustFlavour(p.id, -1)}
                        disabled={qty === 0}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background:
                            qty > 0 ? "rgba(184,134,11,0.25)" : "transparent",
                          border: "none",
                          color:
                            qty > 0 ? "var(--gold)" : "rgba(255,255,255,0.35)",
                          fontSize: "1.1rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: qty === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontSize: "0.95rem",
                          minWidth: 28,
                          textAlign: "center",
                          color:
                            qty > 0 ? "var(--gold)" : "rgba(255,255,255,0.5)",
                          fontWeight: qty > 0 ? 700 : 400,
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        className="qty-btn"
                        onClick={() => adjustFlavour(p.id, 1)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "rgba(184,134,11,0.25)",
                          border: "none",
                          color: "var(--gold)",
                          fontSize: "1.1rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPicked > 0 && autoBox && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "rgba(184,134,11,0.10)",
              border: "1px solid rgba(184,134,11,0.35)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--gold)",
                  fontWeight: 500,
                }}
              >
                {autoBox.label} selected automatically
              </p>
              <p
                style={{
                  fontSize: "0.68rem",
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                {totalPicked} of {autoBox.count} pieces chosen · ₹
                {autoBox.price}
              </p>
            </div>
            {needsOneMore && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  background: "rgba(184,134,11,0.18)",
                  border: "1.5px dashed var(--gold)",
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--gold)",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  ✨ Add 1 more piece to fill your box!
                </p>
              </div>
            )}
          </div>
        )}

        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 20 }}
        >
          <button
            className="btn-gold"
            style={{ maxWidth: 240 }}
            onClick={scrollToOrder}
          >
            Order Now →
          </button>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════════ */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
          background: "rgba(255,248,230,0.025)",
          textAlign: "center",
        }}
      >
        <SectionLabel text="What People Say" />
        <h2
          className="font-display"
          style={{
            fontSize: "1.75rem",
            fontWeight: 300,
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Real words, real customers
        </h2>
        <GoldLine />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border2)",
                borderRadius: 8,
                padding: "14px 16px",
                position: "relative",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 10,
                  right: 14,
                  fontSize: "1.8rem",
                  color: "var(--gold)",
                  opacity: 0.2,
                  lineHeight: 1,
                  fontFamily: "Georgia, serif",
                }}
              >
                "
              </span>
              <p
                style={{
                  fontSize: "0.83rem",
                  color: "var(--cream-dim)",
                  lineHeight: 1.7,
                  marginBottom: 12,
                  fontStyle: "italic",
                }}
              >
                {t.text}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "rgba(184,134,11,0.2)",
                    border: "1px solid rgba(184,134,11,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    color: "var(--gold)",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p style={{ fontSize: "0.75rem", fontWeight: 500 }}>
                    {t.name}
                  </p>
                  <p style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                    {t.handle}
                  </p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      style={{ color: "var(--gold)", fontSize: "0.65rem" }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 22 }}
        >
          <button
            className="btn-gold"
            style={{ maxWidth: 240 }}
            onClick={scrollToOrder}
          >
            I Want Fresh Mochi →
          </button>
        </div>
      </section>

      {/* ══ ORDER ══════════════════════════════════════════════════ */}
      <section
        id="order"
        ref={orderRef}
        style={{ padding: "36px 24px", textAlign: "center" }}
      >
        <SectionLabel text="Place Your Order" />
        <h2
          className="font-display"
          style={{
            fontSize: "1.75rem",
            fontWeight: 300,
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Build your box
        </h2>
        <GoldLine />

        {/* ── STEP 1: Pick flavours ──────────────────────────────── */}
        <div style={{ marginBottom: 28, textAlign: "left" }}>
          <p className="step-label">Step 1 — Pick your flavours</p>
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--muted)",
              marginBottom: 14,
            }}
          >
            Choose as many as you like. We&apos;ll automatically select the best
            box size for you.
          </p>

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
              Loading…
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {products.map((p) => {
                const qty = flavours[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${qty > 0 ? "var(--gold)" : "var(--border2)"}`,
                      transition: "border-color 0.2s",
                    }}
                  >
                    <img
                      src={getImg(p.name, p.image_url)}
                      alt={p.name}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 4,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                        {p.name}
                      </p>
                      {p.is_premium && (
                        <span
                          style={{
                            color: "var(--gold)",
                            fontSize: "0.6rem",
                            letterSpacing: "0.1em",
                          }}
                        >
                          PREMIUM
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        className="qty-btn"
                        onClick={() => adjustFlavour(p.id, -1)}
                        disabled={qty === 0}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontSize: "0.9rem",
                          minWidth: 18,
                          textAlign: "center",
                          color: qty > 0 ? "var(--gold)" : "var(--cream-dim)",
                          fontWeight: qty > 0 ? 600 : 400,
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        className="qty-btn"
                        onClick={() => adjustFlavour(p.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-box summary */}
          {totalPicked > 0 && autoBox && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 16px",
                background: "rgba(184,134,11,0.08)",
                border: "1px solid rgba(184,134,11,0.3)",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--gold)",
                      fontWeight: 500,
                    }}
                  >
                    ✓ {autoBox.label} — ₹{autoBox.price}
                  </p>
                  <p
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--muted)",
                      marginTop: 2,
                    }}
                  >
                    {totalPicked} of {autoBox.count} pieces ·{" "}
                    {autoBox.count - totalPicked === 0
                      ? "Box full!"
                      : `${autoBox.count - totalPicked} spot${autoBox.count - totalPicked === 1 ? "" : "s"} remaining`}
                  </p>
                </div>
                {needsOneMore && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      background: "rgba(184,134,11,0.2)",
                      color: "var(--gold)",
                      padding: "4px 10px",
                      borderRadius: 20,
                    }}
                  >
                    Add 1 more to fill ✨
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {[...boxes]
                  .sort((a, b) => a.count - b.count)
                  .map((box) => (
                    <div
                      key={box.id}
                      style={{
                        fontSize: "0.65rem",
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: `1px solid ${autoBox.id === box.id ? "var(--gold)" : "var(--border2)"}`,
                        color:
                          autoBox.id === box.id
                            ? "var(--gold)"
                            : "var(--muted)",
                        background:
                          autoBox.id === box.id
                            ? "rgba(184,134,11,0.12)"
                            : "transparent",
                        transition: "all 0.2s",
                      }}
                    >
                      {box.count}pc · ₹{box.price}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {error && step === 1 && (
            <p
              style={{
                fontSize: "0.82rem",
                color: "#e57373",
                marginTop: 10,
                textAlign: "center",
                fontWeight: 500,
                padding: "8px 12px",
                background: "rgba(220,50,50,0.1)",
                borderRadius: 6,
                border: "1px solid rgba(220,50,50,0.25)",
              }}
            >
              {error}
            </p>
          )}

          {totalPicked > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <button
                className="btn-gold"
                style={{
                  maxWidth: 260,
                  opacity: autoBox && totalPicked < autoBox.count ? 0.45 : 1,
                  cursor:
                    autoBox && totalPicked < autoBox.count
                      ? "not-allowed"
                      : "pointer",
                }}
                onClick={proceedToSlot}
              >
                {autoBox && totalPicked < autoBox.count
                  ? `Add ${autoBox.count - totalPicked} more to unlock →`
                  : "Choose Delivery Date & Batch →"}
              </button>
            </div>
          )}
        </div>

        {/* ── STEP 2: Date + Batch selection ───────────────────── */}
        {step >= 2 && (
          <div ref={slotRef} style={{ marginTop: 40, textAlign: "left" }}>
            <div className="divider" style={{ marginBottom: 24 }} />
            <p className="step-label">
              Step 2 — Choose your delivery date & batch
            </p>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--muted)",
                marginBottom: 16,
              }}
            >
              Pick any date. All three batches are always available.
            </p>

            {/* Date picker */}
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontSize: "0.68rem",
                  color: "var(--gold)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                Delivery Date
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                {[
                  { label: "Today", val: todayStr },
                  { label: "Tomorrow", val: tomorrowStr },
                  {
                    label: new Date(
                      Date.now() + 2 * 86400000,
                    ).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    }),
                    val: toDateString(new Date(Date.now() + 2 * 86400000)),
                  },
                ].map((chip) => (
                  <button
                    key={chip.val}
                    onClick={() => {
                      setSelectedDate(chip.val);
                      setSelectedBatch(null);
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 20,
                      border: `1px solid ${selectedDate === chip.val ? "var(--gold)" : "var(--border2)"}`,
                      background:
                        selectedDate === chip.val
                          ? "rgba(184,134,11,0.12)"
                          : "transparent",
                      color:
                        selectedDate === chip.val
                          ? "var(--gold)"
                          : "var(--muted)",
                      fontSize: "0.78rem",
                      fontWeight: selectedDate === chip.val ? 700 : 400,
                      cursor: "pointer",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedBatch(null);
                }}
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid rgba(184,134,11,0.4)",
                  color: "var(--cream)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  fontFamily: "system-ui, sans-serif",
                  outline: "none",
                  colorScheme: "dark",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            <p
              style={{
                fontSize: "0.68rem",
                color: "var(--gold)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {friendlyDate(selectedDate)} — Choose a batch
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {BATCHES.map((batch) => {
                const isSelected = selectedBatch === batch.id;
                return (
                  <button
                    key={batch.id}
                    onClick={() => pickBatch(batch.id)}
                    style={{
                      padding: "16px 18px",
                      textAlign: "left",
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: isSelected
                        ? "1px solid var(--gold)"
                        : "1px solid var(--border2)",
                      background: isSelected
                        ? "rgba(184,134,11,0.06)"
                        : "var(--surface)",
                      borderRadius: 8,
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>
                        {batch.icon}
                      </span>
                      <div>
                        <p
                          style={{
                            fontSize: "0.95rem",
                            fontWeight: 700,
                            marginBottom: 3,
                            color: isSelected ? "var(--gold)" : "var(--cream)",
                          }}
                        >
                          {batch.label}
                        </p>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: isSelected
                              ? "rgba(184,134,11,0.7)"
                              : "var(--muted)",
                          }}
                        >
                          {batch.timeRange}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          padding: "4px 10px",
                          borderRadius: 4,
                          background: "rgba(184,134,11,0.2)",
                          color: "var(--gold)",
                          fontWeight: 700,
                        }}
                      >
                        ✓ SELECTED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 3: Customer details ──────────────────────────── */}
        {step >= 3 && (
          <div ref={formRef} style={{ textAlign: "left" }}>
            <div className="divider" style={{ marginBottom: 24 }} />

            <button
              onClick={() => {
                setStep(2);
                setTimeout(
                  () =>
                    slotRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    }),
                  80,
                );
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                fontSize: "0.78rem",
                cursor: "pointer",
                padding: "0 0 16px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              ← Back to batches
            </button>

            <p className="step-label">Step 3 — Your details</p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <input
                className="field"
                placeholder="Full Name *"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                autoComplete="name"
              />
              <input
                className="field"
                placeholder="Phone Number *"
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                autoComplete="tel"
              />
              <input
                className="field"
                placeholder="Delivery Address"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                autoComplete="street-address"
              />
              <input
                className="field"
                placeholder="Date of Birth (DD/MM/YYYY)"
                value={form.dob}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dob: e.target.value }))
                }
              />
              <textarea
                className="field"
                placeholder="Any notes or special requests? (optional)"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
                style={{ resize: "none" }}
              />
            </div>

            {/* Order summary */}
            <div
              className="card"
              style={{
                padding: "14px 16px",
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontSize: "0.65rem",
                  color: "var(--muted)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Order Summary
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span
                    style={{ fontSize: "0.82rem", color: "var(--cream-dim)" }}
                  >
                    {autoBox?.label}
                  </span>
                  <span style={{ fontSize: "0.82rem" }}>₹{autoBox?.price}</span>
                </div>
                {Object.entries(flavours).map(([id, qty]) => {
                  const prod = products.find((p) => p.id === id);
                  if (!prod || qty === 0) return null;
                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                      >
                        {prod.name} × {qty}
                      </span>
                    </div>
                  );
                })}
                {selectedBatch &&
                  (() => {
                    const batch = BATCHES.find((b) => b.id === selectedBatch)!;
                    return (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 2,
                        }}
                      >
                        <span
                          style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                        >
                          {batch.icon} {batch.label} · {batch.timeRange}
                        </span>
                        <span
                          style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                        >
                          {new Date(
                            selectedDate + "T00:00:00",
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    );
                  })()}
                <div className="divider" style={{ margin: "6px 0" }} />
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    Total
                  </span>
                  <span
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--gold)",
                      fontFamily: "Cormorant Garamond, serif",
                    }}
                  >
                    ₹{autoBox?.price}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--red)",
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                className="btn-gold"
                disabled={placing || !form.name.trim() || !form.phone.trim()}
                onClick={placeOrder}
                style={{ maxWidth: 300 }}
              >
                {placing ? "Placing order…" : "Place Order"}
              </button>
            </div>

            <p
              style={{
                fontSize: "0.68rem",
                color: "var(--muted)",
                marginTop: 10,
                textAlign: "center",
                lineHeight: 1.7,
              }}
            >
              Advance bookings welcome. We confirm once payment is received.
            </p>
          </div>
        )}
      </section>

      {/* ══ FAQ ════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "36px 24px",
          borderTop: "1px solid var(--border2)",
          textAlign: "center",
        }}
      >
        <SectionLabel text="FAQ" />
        <h2
          className="font-display"
          style={{
            fontSize: "1.5rem",
            fontWeight: 300,
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Good to know
        </h2>
        <GoldLine />

        {[
          [
            "Where do you deliver?",
            "We currently deliver within Kochi. For other locations, DM us on Instagram @byeversweet.",
          ],
          [
            "How fresh is the mochi?",
            "Made fresh on the day of your delivery batch. Best enjoyed within 24 hours. This is what separates Eversweet from the frozen mochi you've had before.",
          ],
          [
            "What are the delivery batches?",
            "We deliver in three batches — Morning (9AM–12PM), Afternoon (12PM–4PM), and Evening (5PM–8PM). You can book for any date you like, for any of the 3 batches.",
          ],
          [
            "Can I order in advance?",
            "Yes! Just pick any future date when choosing your batch. There's no limit on how far ahead you can book.",
          ],
          [
            "How do I pay?",
            "Tap the 'Pay via UPI' button on the confirmation screen — it opens Google Pay, PhonePe, or Paytm with your amount pre-filled. Then send us the screenshot on WhatsApp to confirm your slot.",
          ],
          [
            "What are the box sizes?",
            "We offer Box of 4, 6, 8, 12, and 16. All flavours can be mixed and matched freely. The right box is picked automatically based on what you choose.",
          ],
          [
            "What's coming next?",
            "Brookie and Tiramisu are coming soon. Follow us on Instagram @byeversweet for the announcement.",
          ],
        ].map(([q, a]) => (
          <div
            key={q}
            style={{
              marginBottom: 20,
              paddingBottom: 20,
              borderBottom: "1px solid var(--border2)",
              textAlign: "left",
            }}
          >
            <p
              style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: 5 }}
            >
              {q}
            </p>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                lineHeight: 1.7,
              }}
            >
              {a}
            </p>
          </div>
        ))}

        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 8 }}
        >
          <button
            className="btn-gold"
            style={{ maxWidth: 240 }}
            onClick={scrollToOrder}
          >
            Order Fresh Mochi →
          </button>
        </div>
      </section>

      {/* ══ FOOTER ═════════════════════════════════════════════════ */}
      <footer
        style={{
          padding: "28px 24px",
          textAlign: "center",
          borderTop: "1px solid var(--border2)",
          background: "var(--bg2)",
        }}
      >
        <p
          className="font-display"
          style={{
            fontSize: "1.6rem",
            color: "var(--gold)",
            marginBottom: 6,
            fontWeight: 300,
          }}
        >
          Eversweet
        </p>
        <p
          style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: 4 }}
        >
          Cloud Kitchen · Kochi, Kerala
        </p>
        <a
          href="https://instagram.com/byeversweet"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.7rem",
            color: "var(--gold)",
            textDecoration: "none",
            letterSpacing: "0.1em",
          }}
        >
          @byeversweet
        </a>
        <p
          style={{
            fontSize: "0.62rem",
            color: "var(--muted)",
            marginTop: 16,
            opacity: 0.5,
          }}
        >
          © {new Date().getFullYear()} Eversweet Company
        </p>
      </footer>

      {/* ══ STICKY BOX PROGRESS BAR ══════════════════════════════════ */}
      {totalPicked > 0 && step === 1 && autoBox && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 480,
            background: "rgba(18, 10, 5, 0.96)",
            borderTop: "1px solid rgba(184,134,11,0.4)",
            backdropFilter: "blur(12px)",
            padding: "14px 20px 20px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--gold)",
                fontWeight: 600,
                letterSpacing: "0.08em",
              }}
            >
              {autoBox.label} · ₹{autoBox.price}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                color:
                  autoBox.count - totalPicked === 0
                    ? "var(--gold)"
                    : "var(--cream-dim)",
              }}
            >
              {autoBox.count - totalPicked === 0
                ? "✓ Box full!"
                : `${autoBox.count - totalPicked} more piece${autoBox.count - totalPicked === 1 ? "" : "s"} to fill`}
            </span>
          </div>

          <div
            style={{
              width: "100%",
              height: 6,
              background: "rgba(184,134,11,0.18)",
              borderRadius: 99,
              marginBottom: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min((totalPicked / autoBox.count) * 100, 100)}%`,
                background:
                  autoBox.count - totalPicked === 0
                    ? "var(--gold)"
                    : "linear-gradient(90deg, rgba(184,134,11,0.6), var(--gold))",
                borderRadius: 99,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 14,
              justifyContent: "center",
            }}
          >
            {Array.from({ length: autoBox.count }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: Math.max(6, Math.min(14, 320 / autoBox.count - 4)),
                  height: 6,
                  borderRadius: 99,
                  background:
                    i < totalPicked ? "var(--gold)" : "rgba(184,134,11,0.2)",
                  transition: "background 0.2s ease",
                }}
              />
            ))}
          </div>

          <button
            className="btn-gold"
            style={{
              width: "100%",
              opacity: autoBox.count - totalPicked === 0 ? 1 : 0.45,
              cursor:
                autoBox.count - totalPicked === 0 ? "pointer" : "not-allowed",
            }}
            onClick={proceedToSlot}
          >
            {autoBox.count - totalPicked === 0
              ? "Continue to delivery date →"
              : `Fill ${autoBox.count - totalPicked} more piece${autoBox.count - totalPicked === 1 ? "" : "s"} to unlock`}
          </button>
        </div>
      )}
    </main>
  );
}
