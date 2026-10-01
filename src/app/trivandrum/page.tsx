"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize } from "@/lib/types";
import {
  getRoadDistanceKm,
  getUserLocation,
  deliveryCharge,
  resolveLocationInput,
} from "@/lib/distance";

function getAutoBox(boxes: BoxSize[], totalPicked: number): BoxSize | null {
  if (totalPicked === 0) return null;
  const sorted = [...boxes].sort((a, b) => a.count - b.count);
  return (
    sorted.find((b) => b.count >= totalPicked) || sorted[sorted.length - 1]
  );
}

function priceFor(box: BoxSize) {
  return box.price_trivandrum ?? box.price;
}

// Punchy, sensory copy per flavour — falls back to a generic line for
// anything not explicitly listed. Edit freely as flavours change.
const FLAVOUR_COPY: Record<string, string> = {
  mango:
    "Sunshine, bitten. The kind of mango that stops a conversation mid-sentence.",
  strawberry:
    "Red, ripe, and gone in three bites — you'll reach for a second before you've finished the first.",
  blueberry:
    "A quiet burst of tart-sweet, wrapped in a cloud you didn't know existed.",
  kiwi: "Sharp, green, alive. Wakes up your whole mouth.",
  lychee: "Floral and delicate — like biting into a perfume you can eat.",
  biscoff: "Caramel, cookie, and a little bit of trouble.",
  hazelnut: "Nutty, warm, and impossible to stop at one.",
  chococrisp: "Chocolate that snaps, then melts, then disappears.",
  coffeecrisp:
    "For the ones who take their dessert like their mornings — strong.",
  kitkat: "Crunch on the outside, pure joy on the inside.",
  nutella: "The jar you hide from everyone, now in one perfect bite.",
  passion: "Tangy, tropical, a little wild. Not for the faint-hearted.",
};
function flavourTagline(name: string) {
  const key = Object.keys(FLAVOUR_COPY).find((k) =>
    name.toLowerCase().includes(k),
  );
  return key
    ? FLAVOUR_COPY[key]
    : "Made fresh this morning. One bite and you'll understand why.";
}

const WHATSAPP_NUMBER = "917907044368";

function GoldLine() {
  return (
    <div
      style={{
        width: 36,
        height: 1,
        background: "var(--gold)",
        opacity: 0.45,
        margin: "10px auto 22px",
      }}
    />
  );
}

export default function TrivandrumOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [loading, setLoading] = useState(true);

  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [autoBox, setAutoBox] = useState<BoxSize | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);

  // Delivery distance state
  const [locStatus, setLocStatus] = useState<
    "idle" | "locating" | "done" | "denied" | "error"
  >("idle");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [charge, setCharge] = useState(0);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");

  async function checkFromLink() {
    if (!linkInput.trim()) return;
    setLocStatus("locating");
    setLinkError("");
    try {
      const { lat, lng } = await resolveLocationInput(linkInput.trim());
      console.log("resolved location:", { lat, lng }); // ← add this
      const km = await getRoadDistanceKm(lat, lng);
      setDistanceKm(km);
      setCharge(deliveryCharge(km));
      setLocStatus("done");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Couldn't read that link");
      setLocStatus("idle");
    }
  }
  useEffect(() => {
    async function load() {
      try {
        const [{ data: p, error: pErr }, { data: b, error: bErr }] =
          await Promise.all([
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
        if (pErr) console.error("products fetch error:", pErr);
        if (bErr) console.error("box_sizes fetch error:", bErr);
        if (p) setProducts(p);
        if (b) setBoxes(b);
      } catch (e) {
        console.error("trivandrum load() failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalPicked = Object.values(flavours).reduce((a, b) => a + b, 0);
  useEffect(
    () => setAutoBox(getAutoBox(boxes, totalPicked)),
    [flavours, boxes],
  );

  function adjustFlavour(id: string, delta: number) {
    setFlavours((prev) => {
      const cur = prev[id] || 0;
      const next = cur + delta;
      if (next < 0) return prev;
      const maxBox = [...boxes].sort((a, b) => b.count - a.count)[0];
      if (totalPicked + delta > (maxBox?.count || 16)) return prev;
      const updated = { ...prev, [id]: next };
      if (updated[id] === 0) delete updated[id];
      return updated;
    });
  }

  async function detectLocation() {
    setLocStatus("locating");
    try {
      const pos = await getUserLocation();
      const km = await getRoadDistanceKm(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      setDistanceKm(km);
      setCharge(deliveryCharge(km));
      setLocStatus("done");
    } catch (e: unknown) {
      const denied =
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as GeolocationPositionError).code === 1;
      setLocStatus(denied ? "denied" : "error");
    }
  }

  function proceedToDetails() {
    if (totalPicked === 0) {
      setError("Pick at least a few pieces to build your box.");
      return;
    }
    if (autoBox && totalPicked < autoBox.count) {
      setError(
        `Add ${autoBox.count - totalPicked} more to fill your ${autoBox.label}.`,
      );
      return;
    }
    setError("");
    setStep(2);
  }

  async function placeOrder() {
    if (!autoBox) return;
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError(
        "Name, phone, and address are all needed so the porter can find you.",
      );
      return;
    }
    setPlacing(true);
    setError("");
    try {
      const total = priceFor(autoBox) + charge;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          box_size_id: autoBox.id,
          flavours,
          delivery_date: new Date().toISOString().split("T")[0],
          payment_method: "upi",
          total_price: total,
          fulfillment_type: "delivery",
          source: "trivandrum",
          delivery_charge: charge,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      window.location.href = `/pay/${data.order_id}`;
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to place order. Please try again.",
      );
      setPlacing(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      {/* HERO */}
      <section
        style={{
          padding: "56px 24px 40px",
          textAlign: "center",
          borderBottom: "1px solid var(--border2)",
        }}
      >
        <p
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--gold)",
            opacity: 0.85,
            marginBottom: 16,
          }}
        >
          Now delivering to Trivandrum
        </p>
        <h1
          className="font-display"
          style={{
            fontSize: "2.6rem",
            fontWeight: 300,
            lineHeight: 1.15,
            marginBottom: 18,
          }}
        >
          Have you tasted <em style={{ color: "var(--gold)" }}>happiness</em> in
          one bite?
        </h1>
        <p
          style={{
            color: "var(--cream-dim)",
            fontSize: "0.9rem",
            lineHeight: 1.8,
            maxWidth: 340,
            margin: "0 auto",
          }}
        >
          Made fresh in Kochi, on the road to you the same day. Not frozen. Not
          flown in from a warehouse three weeks ago. Just mochi, made right,
          reaching Trivandrum while it's still soft.
        </p>
      </section>

      {/* PRODUCTS */}
      <section style={{ padding: "36px 24px", textAlign: "center" }}>
        <p
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: 6,
          }}
        >
          Step 1 — build your box
        </p>
        <GoldLine />
        {loading ? (
          <p style={{ color: "var(--cream-dim)", fontSize: "0.85rem" }}>
            Loading flavours…
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              textAlign: "left",
            }}
          >
            {products.map((p) => {
              const qty = flavours[p.id] || 0;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px",
                    borderRadius: 10,
                    border: `1px solid ${qty > 0 ? "var(--gold)" : "var(--border2)"}`,
                    background:
                      qty > 0 ? "rgba(184,134,11,0.06)" : "var(--surface)",
                  }}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: "var(--surface2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.6rem",
                      }}
                    >
                      🍡
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      {p.name}
                    </p>
                    <p
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--cream-dim)",
                        lineHeight: 1.5,
                        marginTop: 2,
                        marginBottom: 8,
                      }}
                    >
                      {flavourTagline(p.name)}
                    </p>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
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
                          minWidth: 18,
                          textAlign: "center",
                          color: qty > 0 ? "var(--gold)" : "var(--cream-dim)",
                          fontWeight: qty > 0 ? 700 : 400,
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

        {/* Box sizes reference */}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 6,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {[...boxes]
            .sort((a, b) => a.count - b.count)
            .map((b) => (
              <div
                key={b.id}
                style={{
                  fontSize: "0.68rem",
                  padding: "5px 10px",
                  borderRadius: 20,
                  border: `1px solid ${autoBox?.id === b.id ? "var(--gold)" : "var(--border2)"}`,
                  color:
                    autoBox?.id === b.id ? "var(--gold)" : "var(--cream-dim)",
                  background:
                    autoBox?.id === b.id
                      ? "rgba(184,134,11,0.12)"
                      : "transparent",
                }}
              >
                {b.count}pc · ₹{priceFor(b)}
              </div>
            ))}
        </div>

        {totalPicked > 0 && autoBox && (
          <p
            style={{ fontSize: "0.78rem", color: "var(--gold)", marginTop: 12 }}
          >
            {autoBox.label} — {totalPicked} of {autoBox.count} pieces chosen
          </p>
        )}
        {error && step === 1 && (
          <p style={{ color: "#e57373", fontSize: "0.8rem", marginTop: 10 }}>
            {error}
          </p>
        )}

        {totalPicked > 0 && step === 1 && (
          <button
            className="btn-gold"
            style={{ maxWidth: 280, marginTop: 18 }}
            onClick={proceedToDetails}
          >
            {autoBox && totalPicked < autoBox.count
              ? `Add ${autoBox.count - totalPicked} more →`
              : "Continue →"}
          </button>
        )}
      </section>

      {/* DETAILS + DELIVERY CHARGE */}
      {step >= 2 && (
        <section style={{ padding: "0 24px 36px", textAlign: "left" }}>
          <div className="divider" style={{ marginBottom: 24 }} />
          <p
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 14,
            }}
          >
            Step 2 — delivery details
          </p>

          <input
            className="field"
            placeholder="Full name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{ marginBottom: 10 }}
          />
          <input
            className="field"
            placeholder="Phone number *"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            style={{ marginBottom: 10 }}
          />
          <input
            className="field"
            placeholder="Delivery address *"
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
            style={{ marginBottom: 16 }}
          />

          {/* Delivery charge widget */}
          <div
            style={{
              background: "rgba(184,134,11,0.06)",
              border: "1px solid rgba(184,134,11,0.25)",
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <p
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--gold)",
                marginBottom: 6,
              }}
            >
              Delivery charge
            </p>

            {locStatus === "done" && distanceKm !== null ? (
              <p style={{ fontSize: "0.82rem", color: "var(--cream)" }}>
                ~{distanceKm.toFixed(1)} km from Thampanoor ·{" "}
                <strong style={{ color: "var(--gold)" }}>₹{charge}</strong>{" "}
                delivery
              </p>
            ) : (
              <>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--cream-dim)",
                    marginBottom: 10,
                  }}
                >
                  Share your Google Maps location and we'll work out the charge
                  instantly.
                </p>
                <button
                  className="btn-ghost"
                  onClick={detectLocation}
                  disabled={locStatus === "locating"}
                  style={{ width: "100%", marginBottom: 10 }}
                >
                  📍{" "}
                  {locStatus === "locating"
                    ? "Locating…"
                    : "Use my current location"}
                </button>

                <p
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--cream-dim)",
                    textAlign: "center",
                    margin: "6px 0",
                  }}
                >
                  — or —
                </p>

                <p
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--cream-dim)",
                    marginBottom: 6,
                  }}
                >
                  In Google Maps: tap your pin → Share → copy the link → paste
                  below
                </p>
                <input
                  className="field"
                  placeholder="Paste your Google Maps location link here"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <button
                  className="btn-ghost"
                  onClick={checkFromLink}
                  disabled={!linkInput.trim() || locStatus === "locating"}
                  style={{ width: "100%" }}
                >
                  Check delivery charge
                </button>
                {linkError && (
                  <p
                    style={{
                      fontSize: "0.72rem",
                      color: "#e57373",
                      marginTop: 8,
                    }}
                  >
                    {linkError}
                  </p>
                )}
              </>
            )}

            {(locStatus === "denied" || locStatus === "error") && (
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "var(--cream-dim)",
                  marginTop: 8,
                }}
              >
                {locStatus === "denied"
                  ? "Location access denied."
                  : "Couldn't get your location."}{" "}
                Try pasting a Maps link instead, or we'll confirm the charge on
                WhatsApp.
              </p>
            )}
          </div>

          {autoBox && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.9rem",
                marginBottom: 4,
              }}
            >
              <span>{autoBox.label}</span>
              <span>₹{priceFor(autoBox)}</span>
            </div>
          )}
          {charge > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.82rem",
                color: "var(--cream-dim)",
                marginBottom: 8,
              }}
            >
              <span>Delivery</span>
              <span>₹{charge}</span>
            </div>
          )}
          {autoBox && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--gold)",
                borderTop: "1px solid var(--border2)",
                paddingTop: 8,
                marginBottom: 16,
              }}
            >
              <span>Total</span>
              <span>₹{priceFor(autoBox) + charge}</span>
            </div>
          )}

          {error && (
            <p
              style={{ color: "#e57373", fontSize: "0.8rem", marginBottom: 12 }}
            >
              {error}
            </p>
          )}

          <button
            className="btn-gold"
            disabled={placing}
            onClick={placeOrder}
            style={{ width: "100%" }}
          >
            {placing ? "Placing order…" : "Place order →"}
          </button>
          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--cream-dim)",
              marginTop: 10,
              textAlign: "center",
            }}
          >
            You'll be taken to the payment page next.
          </p>
        </section>
      )}

      <footer
        style={{
          padding: "28px 24px",
          textAlign: "center",
          borderTop: "1px solid var(--border2)",
        }}
      >
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--gold)",
            fontSize: "0.75rem",
            textDecoration: "none",
          }}
        >
          Questions? Chat with us on WhatsApp →
        </a>
      </footer>
    </main>
  );
}
