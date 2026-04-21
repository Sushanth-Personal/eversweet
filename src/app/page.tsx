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

// ── Testimonials data (editable) ──────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Aswathy R.",
    handle: "@aswathy.r",
    text: "Honestly the best mochi I've had outside Japan. The strawberry one melted in my mouth. Ordered twice already this week 😭",
    avatar: "A",
  },
  {
    name: "Meera K.",
    handle: "@meerak",
    text: "The freshness is unreal. You can tell it's made the same day. Nothing like those frozen ones you get at malls.",
    avatar: "M",
  },
  {
    name: "Rishi N.",
    handle: "@rishin_",
    text: "Got the box of 12 for my sister's birthday. Everyone went silent when they tasted it. That's always a good sign 😂",
    avatar: "R",
  },
  {
    name: "Devika S.",
    handle: "@devika.eats",
    text: "Perfect balance of sweetness. The rice outer layer is so soft. Ordered mango and it actually tastes like mango, not flavouring.",
    avatar: "D",
  },
];

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
      }}
    />
  );
}

// ── Animated "nudge" banner shown when product card clicked before box ──
function NudgeBanner({ show }: { show: boolean }) {
  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: show ? 60 : 0,
        opacity: show ? 1 : 0,
        transition: "all 0.35s ease",
        marginBottom: show ? 12 : 0,
      }}
    >
      <div
        style={{
          background: "rgba(184,134,11,0.12)",
          border: "1px solid rgba(184,134,11,0.35)",
          borderRadius: 6,
          padding: "10px 14px",
          fontSize: "0.78rem",
          color: "var(--gold)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>👆</span>
        <span>Choose your box size first, then pick flavours</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBox, setSelectedBox] = useState<BoxSize | null>(null);
  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [slotId, setSlotId] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showNudge, setShowNudge] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
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

  const orderRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
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
  const remaining = selectedBox ? selectedBox.count - totalPicked : 0;
  const boxFull = remaining === 0;

  function adjustFlavour(id: string, delta: number) {
    setFlavours((prev) => {
      const cur = prev[id] || 0;
      const next = cur + delta;
      if (next < 0) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      const updated = { ...prev, [id]: next };
      if (updated[id] === 0) delete updated[id];
      return updated;
    });
  }

  function pickBox(box: BoxSize) {
    setSelectedBox(box);
    setFlavours({});
    setExpandedProduct(null);
    setShowNudge(false);
    setStep(2);
    setTimeout(
      () =>
        flavourRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      80,
    );
  }

  function handleProductCardClick(productId: string) {
    if (!selectedBox) {
      // No box selected — show nudge and scroll to box section
      setShowNudge(true);
      setTimeout(() => setShowNudge(false), 4000);
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Box is selected — expand/collapse the card
    setExpandedProduct((prev) => (prev === productId ? null : productId));
  }

  function addToBox(productId: string) {
    if (boxFull) return;
    adjustFlavour(productId, 1);
    setExpandedProduct(null);
    // Scroll to flavour picker
    flavourRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function proceedToSlot() {
    setStep(3);
    setTimeout(
      () =>
        slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  function pickSlot(id: string) {
    setSlotId(id);
    setStep(4);
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  function goBackToSlot() {
    setStep(3);
    setTimeout(
      () =>
        slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  async function placeOrder() {
    if (!selectedBox || !form.name.trim() || !form.phone.trim() || !slotId) {
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
          box_size_id: selectedBox.id,
          flavours,
          time_slot_id: slotId,
          payment_method: payMethod,
          total_price: selectedBox.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStep(5);
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
  if (step === 5) {
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
              Scan to pay ₹{selectedBox?.price}
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

        {products.filter((p) => p.image_url).slice(0, 4).length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 28,
              borderRadius: 10,
              overflow: "hidden",
              height: 190,
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
                    flex: i === 0 ? 2 : 1,
                    objectFit: "cover",
                    height: "100%",
                  }}
                />
              ))}
          </div>
        )}

        {/* StoreBrand hero copy — problem → guide → solution */}
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

        {/* CTA #1 */}
        <button
          className="btn-gold"
          style={{ maxWidth: 240, margin: "0 auto 14px" }}
          onClick={scrollToOrder}
        >
          Order Fresh Mochi →
        </button>
        <p style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
          Brookie &amp; Tiramisu coming soon ✦
        </p>
      </section>

      {/* ══ PROBLEM / EMPATHY (StoreBrand) ═══════════════════════ */}
      <section
        style={{
          padding: "32px 24px",
          borderBottom: "1px solid var(--border2)",
          background: "rgba(255,248,230,0.03)",
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
          }}
        >
          Eversweet is built on one belief:{" "}
          <strong style={{ color: "var(--cream)", fontWeight: 500 }}>
            mochi eaten the day it&apos;s made is a completely different food.
          </strong>{" "}
          The skin is impossibly soft. The filling is cold but not frozen. Every
          texture is intentional.
        </p>
        {/* CTA #2 */}
        <button
          className="btn-gold"
          style={{ maxWidth: 220 }}
          onClick={scrollToOrder}
        >
          Build My Box →
        </button>
      </section>

      {/* ══ PRODUCTS ═══════════════════════════════════════════════ */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
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

        <NudgeBanner show={showNudge} />

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
              const isExpanded = expandedProduct === p.id;
              const qty = flavours[p.id] || 0;
              return (
                <div
                  key={p.id}
                  onClick={() => handleProductCardClick(p.id)}
                  style={{
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: `1px solid ${isExpanded ? "var(--gold)" : "var(--border2)"}`,
                    background: isExpanded
                      ? "rgba(184,134,11,0.06)"
                      : "var(--surface)",
                    transition: "all 0.25s ease",
                    transform: isExpanded ? "scale(1.02)" : "scale(1)",
                    boxShadow: isExpanded
                      ? "0 8px 32px rgba(184,134,11,0.18)"
                      : "none",
                    gridColumn: isExpanded ? "span 2" : "span 1",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <img
                      src={getImg(p.name, p.image_url)}
                      alt={p.name}
                      style={{
                        width: "100%",
                        height: isExpanded ? 180 : 130,
                        objectFit: "cover",
                        display: "block",
                        transition: "height 0.25s ease",
                      }}
                    />
                    {p.is_premium && (
                      <span className="badge-premium">Premium</span>
                    )}
                    {qty > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          background: "var(--gold)",
                          color: "#1a1008",
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 10,
                        }}
                      >
                        ×{qty} in box
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      padding: isExpanded ? "14px 14px 6px" : "10px 10px 14px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 500,
                        marginBottom: 3,
                      }}
                    >
                      {p.name}
                    </p>
                    <p
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--muted)",
                        lineHeight: 1.55,
                        marginBottom: isExpanded ? 12 : 0,
                      }}
                    >
                      {p.description}
                    </p>

                    {/* Expanded: add to box button */}
                    {isExpanded && selectedBox && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ paddingBottom: 10 }}
                      >
                        {boxFull && qty === 0 ? (
                          <p
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--gold)",
                              textAlign: "center",
                              padding: "8px 0",
                            }}
                          >
                            Box is full — remove something first
                          </p>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              justifyContent: "space-between",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <button
                                className="qty-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustFlavour(p.id, -1);
                                }}
                                disabled={qty === 0}
                              >
                                −
                              </button>
                              <span
                                style={{
                                  fontSize: "0.9rem",
                                  minWidth: 18,
                                  textAlign: "center",
                                }}
                              >
                                {qty}
                              </span>
                              <button
                                className="qty-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustFlavour(p.id, 1);
                                }}
                                disabled={boxFull}
                              >
                                +
                              </button>
                            </div>
                            {qty === 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToBox(p.id);
                                }}
                                style={{
                                  padding: "6px 16px",
                                  borderRadius: 4,
                                  border: "1px solid var(--gold)",
                                  background: "rgba(184,134,11,0.15)",
                                  color: "var(--gold)",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                  fontFamily: "system-ui, sans-serif",
                                }}
                              >
                                Add to box
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA #3 — inside products section */}
        <button
          className="btn-gold"
          style={{ maxWidth: 240, margin: "20px auto 0" }}
          onClick={scrollToOrder}
        >
          Order Now →
        </button>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════════ */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
          background: "rgba(255,248,230,0.025)",
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
              }}
            >
              {/* Quote mark */}
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
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: 2,
                  }}
                >
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

        {/* CTA #4 — after social proof */}
        <button
          className="btn-gold"
          style={{ maxWidth: 240, margin: "22px auto 0" }}
          onClick={scrollToOrder}
        >
          I Want Fresh Mochi →
        </button>
      </section>

      {/* ══ ORDER ══════════════════════════════════════════════════ */}
      <section id="order" ref={orderRef} style={{ padding: "36px 24px" }}>
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

        {/* ── STEP 1: Box size ──────────────────────────────────── */}
        <div ref={boxRef} style={{ marginBottom: 28 }}>
          <p className="step-label">Step 1 — Choose your box size</p>
          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
              Loading…
            </p>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {boxes.map((box) => (
                  <button
                    key={box.id}
                    onClick={() => pickBox(box)}
                    className={`card${selectedBox?.id === box.id ? " selected" : ""}`}
                    style={{
                      padding: "14px 12px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      background: "none",
                      color: "var(--cream)",
                    }}
                  >
                    <p style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                      {box.label}
                    </p>
                    <p
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--muted)",
                        marginTop: 2,
                      }}
                    >
                      {box.count} pieces
                    </p>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--gold)",
                        marginTop: 6,
                        fontFamily: "Cormorant Garamond, serif",
                      }}
                    >
                      ₹{box.price}
                    </p>
                  </button>
                ))}
              </div>

              {/* Add another box button — shown once a box is selected */}
              {selectedBox && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => {
                      // Deselect current box, reset to allow picking again
                      setSelectedBox(null);
                      setFlavours({});
                      setStep(1);
                      setExpandedProduct(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 6,
                      border: "1px dashed rgba(184,134,11,0.4)",
                      background: "transparent",
                      color: "var(--gold)",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      fontFamily: "system-ui, sans-serif",
                      opacity: 0.8,
                    }}
                  >
                    + Change box size
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── STEP 2: Flavours ──────────────────────────────────── */}
        {step >= 2 && selectedBox && (
          <div ref={flavourRef} style={{ marginBottom: 28 }}>
            <div className="divider" style={{ marginBottom: 24 }} />
            <p className="step-label">Step 2 — Choose flavours</p>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--muted)",
                marginBottom: 12,
              }}
            >
              Tap a flavour to adjust. Fill your {selectedBox.count}-piece box.
            </p>

            {/* Progress bar */}
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
                  height: 3,
                  background: "var(--surface3)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(totalPicked / selectedBox.count) * 100}%`,
                    background: boxFull
                      ? "var(--gold)"
                      : "linear-gradient(90deg, var(--gold-dim), var(--gold))",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: "0.72rem",
                  color: boxFull ? "var(--gold)" : "var(--muted)",
                  whiteSpace: "nowrap",
                  minWidth: 80,
                }}
              >
                {boxFull ? "Box full ✓" : `${remaining} left`}
              </p>
            </div>

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
                      opacity: boxFull && qty === 0 ? 0.4 : 1,
                      transition: "opacity 0.2s",
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
                          color: qty > 0 ? "var(--cream)" : "var(--muted)",
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        className="qty-btn"
                        onClick={() => adjustFlavour(p.id, 1)}
                        disabled={boxFull}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {boxFull && (
              <button
                className="btn-gold"
                style={{ marginTop: 16 }}
                onClick={proceedToSlot}
              >
                Choose Delivery Slot →
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3: Time slot ─────────────────────────────────── */}
        {step >= 3 && (
          <div ref={slotRef} style={{ marginBottom: 28 }}>
            <div className="divider" style={{ marginBottom: 24 }} />
            <p className="step-label">Step 3 — Choose delivery time</p>

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

        {/* ── STEP 4: Customer details ──────────────────────────── */}
        {step >= 4 && (
          <div ref={formRef}>
            <div className="divider" style={{ marginBottom: 24 }} />

            {/* Back button */}
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

            <p className="step-label">Step 4 — Your details</p>

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
                    {selectedBox?.label}
                  </span>
                  <span style={{ fontSize: "0.82rem" }}>
                    ₹{selectedBox?.price}
                  </span>
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
                    ₹{selectedBox?.price}
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

            <button
              className="btn-gold"
              disabled={placing || !form.name.trim() || !form.phone.trim()}
              onClick={placeOrder}
            >
              {placing ? "Placing order…" : "Place Order"}
            </button>

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
        style={{ padding: "36px 24px", borderTop: "1px solid var(--border2)" }}
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
            "We offer Box of 4, 6, 8, 12, and 16. All flavours can be mixed and matched freely.",
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

        {/* Final CTA */}
        <button
          className="btn-gold"
          style={{ maxWidth: 240, margin: "8px auto 0" }}
          onClick={scrollToOrder}
        >
          Order Fresh Mochi →
        </button>
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
    </main>
  );
}
