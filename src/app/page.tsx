"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize, TimeSlot, CustomerForm } from "@/lib/types";

const IMG: Record<string, string> = {
  matcha:
    "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mango-mochi.png",
  strawberry:
    "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mochi-strawberry.webp",
  default:
    "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mochi-strawberry.webp",
};

function getImg(name: string, url: string | null): string {
  if (url) return url;
  const n = name.toLowerCase();
  if (n.includes("mango")) return IMG.matcha;
  if (n.includes("strawberry")) return IMG.strawberry;
  if (n.includes("coffee"))
    return "https://images.unsplash.com/photo-1541167760496-162955ed8a9f?w=600&q=80";
  return IMG.default;
}

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

// ── Box sizes sorted by count — used for auto-selection ───────────
const BOX_COUNTS = [4, 6, 8, 12, 16];

function getAutoBox(boxes: BoxSize[], totalPicked: number): BoxSize | null {
  if (totalPicked === 0) return null;
  // find the smallest box that fits totalPicked
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

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // New simplified flow: customer picks flavours freely
  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [slotId, setSlotId] = useState("");

  // Auto-box state
  const [autoBox, setAutoBox] = useState<BoxSize | null>(null);
  const [needsOneMore, setNeedsOneMore] = useState(false); // prompt user to add 1 more

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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

  const orderRef = useRef<HTMLElement>(null);
  const flavourRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: b }, { data: s }] = await Promise.all([
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
        supabase
          .from("time_slots")
          .select("*")
          .eq("is_active", true)
          .order("date")
          .order("label"),
      ]);
      if (p) setProducts(p);
      if (b) setBoxes(b);
      if (s) setSlots(s);
      setLoading(false);
    }
    load();
  }, []);

  const totalPicked = Object.values(flavours).reduce((a, b) => a + b, 0);

  // Recompute auto-box whenever flavours change
  useEffect(() => {
    const box = getAutoBox(boxes, totalPicked);
    setAutoBox(box);
    // Check if user is just 1 short of filling the current box
    if (box && box.count - totalPicked === 1) {
      setNeedsOneMore(true);
    } else {
      setNeedsOneMore(false);
    }
  }, [flavours, boxes]);

  function adjustFlavour(id: string, delta: number) {
    setFlavours((prev) => {
      const cur = prev[id] || 0;
      const next = cur + delta;
      if (next < 0) return prev;
      // cap at the largest box size
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

  function pickSlot(id: string) {
    setSlotId(id);
    setStep(3);
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  function goBackToSlot() {
    setStep(2);
    setTimeout(
      () =>
        slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  async function placeOrder() {
    if (!autoBox || !form.name.trim() || !form.phone.trim() || !slotId) {
      setError("Please fill in your name and phone number.");
      return;
    }
    setPlacing(true);
    setError("");
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
          time_slot_id: slotId,
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

  // ── Order confirmed ─────────────────────────────────────────────
  if (orderDone) {
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
        <p
          style={{
            color: "var(--cream-dim)",
            fontSize: "0.875rem",
            lineHeight: 1.75,
            marginBottom: 8,
          }}
        >
          Your order has been placed. We&apos;ll confirm once payment is
          received.
        </p>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.8rem",
            lineHeight: 1.75,
            marginBottom: 32,
          }}
        >
          Pay via{" "}
          {payMethod === "qr" ? "the QR code below" : "phone call / UPI"} to
          lock in your slot.
        </p>

        {payMethod === "qr" && (
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 16,
              marginBottom: 32,
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
        )}

        {payMethod === "phone" && (
          <a
            href="tel:+917907044368"
            className="btn-gold"
            style={{ marginBottom: 24, maxWidth: 260 }}
          >
            📞 Call to Confirm Payment
          </a>
        )}

        <div className="divider" style={{ width: "100%", marginBottom: 24 }} />
        <a
          href="https://instagram.com/byeversweet"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--gold)",
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
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
            {/* Bottom gradient so text below doesn't clash */}
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

      {/* ══ PRODUCTS (browse only, no box logic here) ══════════════ */}
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
                  style={{
                    borderRadius: 8,
                    overflow: "hidden",
                    border: `1px solid ${qty > 0 ? "var(--gold)" : "var(--border2)"}`,
                    background:
                      qty > 0 ? "rgba(184,134,11,0.06)" : "var(--surface)",
                    transition: "all 0.25s ease",
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
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
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
                          fontSize: "0.95rem",
                          minWidth: 20,
                          textAlign: "center",
                          color: qty > 0 ? "var(--gold)" : "var(--muted)",
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
                </div>
              );
            })}
          </div>
        )}

        {/* Live auto-box indicator */}
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
                <p
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--muted)",
                    marginTop: 3,
                    marginBottom: 0,
                  }}
                >
                  You're {autoBox!.count - totalPicked} away from a full{" "}
                  {autoBox!.label}
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

        {/* ── STEP 1: Pick flavours (no box selection needed) ──── */}
        <div ref={flavourRef} style={{ marginBottom: 28, textAlign: "left" }}>
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

              {/* Box size breakdown */}
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
                fontSize: "0.82rem", // bump from 0.78rem
                color: "#e57373", // brighter red, readable on dark bg
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
                  : "Choose Delivery Slot →"}
              </button>
            </div>
          )}
        </div>

        {/* ── STEP 2: Time slot ─────────────────────────────────── */}
        {step >= 2 && (
          <div ref={slotRef} style={{ marginBottom: 28, textAlign: "left" }}>
            <div className="divider" style={{ marginBottom: 24 }} />
            <p className="step-label">Step 2 — Choose delivery time</p>

            {slots.length === 0 ? (
              <div
                className="card"
                style={{ padding: 16, borderRadius: 6, textAlign: "center" }}
              >
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  No slots available right now.
                </p>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.75rem",
                    marginTop: 6,
                  }}
                >
                  DM us on Instagram to book.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {slots.map((slot) => {
                  const full = slot.current_orders >= slot.max_orders;
                  const spotsLeft = slot.max_orders - slot.current_orders;
                  const isSelected = slotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      disabled={full}
                      onClick={() => pickSlot(slot.id)}
                      className={`card${isSelected ? " selected" : ""}`}
                      style={{
                        padding: "14px 16px",
                        cursor: full ? "not-allowed" : "pointer",
                        textAlign: "left",
                        opacity: full ? 0.4 : 1,
                        background: "none",
                        color: "var(--cream)",
                        width: "100%",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <p style={{ fontSize: "0.87rem", fontWeight: 500 }}>
                            {slot.label}
                          </p>
                          <p
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--muted)",
                              marginTop: 2,
                            }}
                          >
                            {new Date(slot.date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            padding: "3px 8px",
                            borderRadius: 3,
                            background: full
                              ? "rgba(192,64,64,0.15)"
                              : spotsLeft <= 3
                                ? "rgba(180,120,0,0.15)"
                                : "rgba(74,138,90,0.15)",
                            color: full
                              ? "var(--red)"
                              : spotsLeft <= 3
                                ? "var(--gold)"
                                : "var(--green)",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {full
                            ? "Sold out"
                            : spotsLeft <= 3
                              ? `${spotsLeft} left`
                              : "Available"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Customer details ──────────────────────────── */}
        {step >= 3 && (
          <div ref={formRef} style={{ textAlign: "left" }}>
            <div className="divider" style={{ marginBottom: 24 }} />

            <button
              onClick={goBackToSlot}
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
              ← Back to time slots
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

            <p className="step-label" style={{ marginBottom: 10 }}>
              Payment method
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {(
                [
                  { id: "qr", label: "📱 QR / UPI", sub: "Scan & pay" },
                  {
                    id: "phone",
                    label: "📞 Call / UPI",
                    sub: "Confirm by call",
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPayMethod(m.id)}
                  className={`card${payMethod === m.id ? " selected" : ""}`}
                  style={{
                    padding: "12px",
                    cursor: "pointer",
                    textAlign: "center",
                    background: "none",
                    color: "var(--cream)",
                    transition: "all 0.2s",
                  }}
                >
                  <p style={{ fontSize: "0.82rem" }}>{m.label}</p>
                  <p
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--muted)",
                      marginTop: 3,
                    }}
                  >
                    {m.sub}
                  </p>
                </button>
              ))}
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
                      <span
                        style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                      >
                        ₹{prod.price * qty}
                      </span>
                    </div>
                  );
                })}
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
            "Made fresh on the day of your delivery slot. Best enjoyed within 24 hours. This is what separates Eversweet from the frozen mochi you've had before.",
          ],
          [
            "Why does freshness matter so much?",
            "Mochi rice flour skin becomes tough and rubbery when frozen. Fresh mochi has a completely different texture — cloud-soft, yielding, never stiff. Once you taste it fresh you'll understand.",
          ],
          [
            "Can I do advance booking?",
            "Yes! Select a future date time slot while ordering. We accept orders up to 3 days in advance.",
          ],
          [
            "How do I pay?",
            "UPI via QR code, or call us to confirm by phone. We lock in your order once payment is received.",
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
          {/* Label row */}
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

          {/* Progress bar */}
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

          {/* Dot indicators */}
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
              ? "Continue to delivery slot →"
              : `Fill ${autoBox.count - totalPicked} more piece${autoBox.count - totalPicked === 1 ? "" : "s"} to unlock slot`}
          </button>
        </div>
      )}
    </main>
  );
}
