export const dynamic = "force-dynamic"; // MUST BE HERE
("use client");

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize, TimeSlot, CustomerForm } from "@/lib/types";

// ── Fallback images (until you upload real ones to Supabase Storage) ──
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

  // New keyword mapping for your expanded menu
  if (n.includes("mango")) return IMG.mango;
  if (n.includes("strawberry")) return IMG.strawberry;
  if (n.includes("coffee"))
    return "https://images.unsplash.com/photo-1541167760496-162955ed8a9f?w=600&q=80"; // Fallback for Coffeecrisp

  return IMG.default;
}

// ── Small reusable UI bits ─────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return <p className="section-label">{text}</p>;
}

function SectionTitle({
  children,
  size = "1.75rem",
}: {
  children: React.ReactNode;
  size?: string;
}) {
  return (
    <h2
      className="font-display"
      style={{
        fontSize: size,
        fontWeight: 300,
        lineHeight: 1.1,
        marginBottom: 6,
      }}
    >
      {children}
    </h2>
  );
}

function GoldLine() {
  return (
    <div
      style={{
        width: 36,
        height: 1,
        background: "var(--gold)",
        opacity: 0.55,
        marginTop: 12,
        marginBottom: 24,
      }}
    />
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Home() {
  // Data from Supabase
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Order state
  const [selectedBox, setSelectedBox] = useState<BoxSize | null>(null);
  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [slotId, setSlotId] = useState("");

  // UI state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  // step 1 = choose box
  // step 2 = choose flavours
  // step 3 = choose time slot
  // step 4 = customer details + payment
  // step 5 = order placed

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  // Customer form
  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    address: "",
    dob: "",
    notes: "",
  });
  const [payMethod, setPayMethod] = useState<"qr" | "phone">("qr");

  // Scroll refs
  const flavourRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<HTMLElement>(null);

  // ── Load data ───────────────────────────────────────────────────
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

  // ── Flavour helpers ─────────────────────────────────────────────
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

  // ── Step handlers ───────────────────────────────────────────────
  function pickBox(box: BoxSize) {
    setSelectedBox(box);
    setFlavours({});
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

  // ── Place order ─────────────────────────────────────────────────
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

  // ── Order confirmed screen ──────────────────────────────────────
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
            {/* Replace /upi-qr.png with your actual UPI QR code in the public/ folder */}
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
          padding: "56px 24px 40px",
          textAlign: "center",
          borderBottom: "1px solid var(--border2)",
          background: "linear-gradient(180deg, var(--bg2) 0%, var(--bg) 100%)",
        }}
      >
        {/* Logo / wordmark */}
        <div style={{ marginBottom: 24 }}>
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
        </div>

        {/* Hero image strip — pulls from your real product photos */}
        {products.filter((p) => p.image_url).slice(0, 4).length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 24,
              borderRadius: 8,
              overflow: "hidden",
              height: 180,
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

        <p
          style={{
            color: "var(--cream-dim)",
            fontSize: "0.9rem",
            lineHeight: 1.75,
            maxWidth: 300,
            margin: "0 auto 28px",
          }}
        >
          Handcrafted mochi made fresh daily. No preservatives, small batches,
          delivered straight to your door.
        </p>

        <a
          href="#order"
          className="btn-gold"
          style={{ maxWidth: 220, margin: "0 auto" }}
        >
          Order Now
        </a>

        <p style={{ marginTop: 16, fontSize: "0.7rem", color: "var(--muted)" }}>
          Brookie &amp; Tiramisu coming soon ✦
        </p>
      </section>

      {/* ══ ABOUT ══════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
        }}
      >
        <SectionLabel text="Our Story" />
        <SectionTitle>Made from scratch,{"\u00A0"}with care</SectionTitle>
        <GoldLine />
        <p
          style={{
            color: "var(--cream-dim)",
            fontSize: "0.875rem",
            lineHeight: 1.8,
          }}
        >
          Every piece of mochi at Eversweet is made by hand in our Kochi cloud
          kitchen. We use premium ingredients, skip the preservatives, and keep
          our batches small — so every box you receive is as fresh as it gets.
          We started with mochi because we love it, and we plan to keep that
          love in every batch we make.
        </p>
      </section>

      {/* ══ PRODUCTS ═══════════════════════════════════════════════ */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
        }}
      >
        <SectionLabel text="Flavours" />
        <SectionTitle>This week&apos;s menu</SectionTitle>
        <GoldLine />

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card"
                style={{ height: 200, borderRadius: 6, opacity: 0.4 }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {products.map((p) => (
              <div
                key={p.id}
                className="card fade-up"
                style={{ borderRadius: 6, overflow: "hidden" }}
              >
                <div style={{ position: "relative" }}>
                  <img
                    src={getImg(p.name, p.image_url)}
                    alt={p.name}
                    style={{
                      width: "100%",
                      height: 130,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {p.is_premium && (
                    <span className="badge-premium">Premium</span>
                  )}
                </div>
                <div style={{ padding: "10px 10px 14px" }}>
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
                      lineHeight: 1.5,
                      marginBottom: 6,
                    }}
                  >
                    {p.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ ORDER ══════════════════════════════════════════════════ */}
      <section id="order" ref={orderRef} style={{ padding: "36px 24px" }}>
        <SectionLabel text="Place Your Order" />
        <SectionTitle>Build your box</SectionTitle>
        <GoldLine />

        {/* ── STEP 1: Box size ──────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <p className="step-label">Step 1 — Choose your box size</p>
          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
              Loading…
            </p>
          ) : (
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
          )}
        </div>

        {/* ── STEP 2: Flavours ──────────────────────────────────── */}
        {step >= 2 && selectedBox && (
          <div ref={flavourRef} style={{ marginBottom: 28 }}>
            <div className="divider" style={{ marginBottom: 24 }} />
            <p className="step-label">Step 2 — Choose flavours</p>

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
                {boxFull ? "Box full ✓" : `${remaining} left to pick`}
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
                      opacity: boxFull && qty === 0 ? 0.45 : 1,
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
                      <p style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
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
                      </p>
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
                style={{
                  padding: 16,
                  borderRadius: 6,
                  textAlign: "center",
                }}
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
                              ? "rgba(192, 64, 64, 0.15)"
                              : spotsLeft <= 3
                                ? "rgba(180, 120, 0, 0.15)"
                                : "rgba(74, 138, 90, 0.15)",
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

            {/* Payment method */}
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
        style={{
          padding: "36px 24px",
          borderTop: "1px solid var(--border2)",
        }}
      >
        <SectionLabel text="FAQ" />
        <SectionTitle size="1.5rem">Good to know</SectionTitle>
        <GoldLine />

        {[
          [
            "Where do you deliver?",
            "We currently deliver within Kochi. For other locations, DM us on Instagram.",
          ],
          [
            "How fresh is the mochi?",
            "Made fresh on the day of your delivery slot. Best enjoyed within 24 hours.",
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
            "Brookie and Tiramisu are coming soon. Follow us on Instagram for the announcement.",
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
          href="https://instagram.com/eversweet.mochi"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.7rem",
            color: "var(--gold)",
            textDecoration: "none",
            letterSpacing: "0.1em",
          }}
        >
          @eversweet.mochi
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
