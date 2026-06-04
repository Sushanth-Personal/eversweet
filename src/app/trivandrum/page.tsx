"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";

const WHATSAPP_NUMBER = "917907044368";
const TRAVEL_CHARGE = 200;
const TRIP_DATE = "";
const PICKUP_LOCATIONS = [
  { name: "Thampanoor", area: "Railway Station area · South Trivandrum" },
  { name: "Pattom", area: "Pattom Junction · Central Trivandrum" },
  { name: "Kazhakkoottam", area: "Near Technopark · North Trivandrum" },
];
const BOXES = [
  { count: 4, price: 599, label: "Box of 4" },
  { count: 6, price: 849, label: "Box of 6" },
];

function resolveBoxes(total: number) {
  if (total < 4)
    return { boxes: [] as any[], totalBoxPrice: 0, isClean: false };
  let best: { b4: number; b6: number; price: number } | null = null;
  for (let b6 = Math.floor(total / 6); b6 >= 0; b6--) {
    const rem = total - b6 * 6;
    if (rem >= 0 && rem % 4 === 0) {
      const price = (rem / 4) * 599 + b6 * 849;
      if (!best || price < best.price) best = { b4: rem / 4, b6, price };
    }
  }
  if (best) {
    const boxes = [];
    if (best.b4 > 0) boxes.push({ ...BOXES[0], qty: best.b4 });
    if (best.b6 > 0) boxes.push({ ...BOXES[1], qty: best.b6 });
    return { boxes, totalBoxPrice: best.price, isClean: true };
  }
  const rPrice = (n: number) => {
    for (let b6 = Math.floor(n / 6); b6 >= 0; b6--) {
      const r = n - b6 * 6;
      if (r >= 0 && r % 4 === 0) return b6 * 849 + (r / 4) * 599;
    }
    return 0;
  };
  const rLabel = (n: number) => {
    for (let b6 = Math.floor(n / 6); b6 >= 0; b6--) {
      const r = n - b6 * 6;
      if (r >= 0 && r % 4 === 0) {
        const p = [];
        if (b6 > 0) p.push(`${b6 > 1 ? b6 + "× " : ""}Box of 6`);
        if (r / 4 > 0) p.push(`${r / 4 > 1 ? r / 4 + "× " : ""}Box of 4`);
        return p.join(" + ");
      }
    }
    return "";
  };
  let below = total - 1;
  while (below >= 4) {
    let f = false;
    for (let b6 = Math.floor(below / 6); b6 >= 0; b6--) {
      const r = below - b6 * 6;
      if (r >= 0 && r % 4 === 0) {
        f = true;
        break;
      }
    }
    if (f) break;
    below--;
  }
  let above = total + 1;
  while (above <= total + 6) {
    let f = false;
    for (let b6 = Math.floor(above / 6); b6 >= 0; b6--) {
      const r = above - b6 * 6;
      if (r >= 0 && r % 4 === 0) {
        f = true;
        break;
      }
    }
    if (f) break;
    above++;
  }
  return {
    boxes: [],
    totalBoxPrice: 0,
    isClean: false,
    nudge: {
      add: above - total,
      remove: total - below,
      addLabel: rLabel(above),
      removeLabel: rLabel(below),
      addPrice: rPrice(above),
      removePrice: rPrice(below),
    },
  };
}

function getImg(name: string, url: string | null): string {
  if (url) return url;
  const n = name.toLowerCase();
  if (n.includes("strawberry"))
    return "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mochi-strawberry.webp";
  if (n.includes("mango"))
    return "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mango-mochi.png";
  return "https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mochi-strawberry.webp";
}

export default function TrivandrumPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [targetBox, setTargetBox] = useState<4 | 6>(6);
  const [showOrderSection, setShowOrderSection] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("Thampanoor");
  const [homeDelivery, setHomeDelivery] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [tripDate, setTripDate] = useState(TRIP_DATE);
  const [pickupLocations, setPickupLocations] = useState(PICKUP_LOCATIONS);

  const totalPicked = Object.values(flavours).reduce((a, b) => a + b, 0);
  const resolved = resolveBoxes(totalPicked);
  const grandTotal = (resolved as any).isClean
    ? (resolved as any).totalBoxPrice + TRAVEL_CHARGE
    : 0;
  const boxLabel = (resolved as any).isClean
    ? (resolved as any).boxes
        .map((b: any) => `${b.qty > 1 ? b.qty + "× " : ""}${b.label}`)
        .join(" + ")
    : "";

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("is_available", true)
          .order("sort_order"),
        supabase.from("trivandrum_settings").select("*").single(),
      ]);
      if (p) setProducts(p);
      if (s) {
        if (s.trip_date) {
          try {
            const d = new Date(s.trip_date + "T00:00:00");
            setTripDate(
              isNaN(d.getTime())
                ? s.trip_date
                : d.toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }),
            );
          } catch {
            setTripDate(s.trip_date);
          }
        }
        if (s.pickup_locations) {
          const locs = s.pickup_locations
            .split("|")
            .map((x: string) => {
              const [name, area] = x.split("::");
              return { name: name.trim(), area: (area || "").trim() };
            })
            .filter((l: any) => l.name);
          if (locs.length > 0) setPickupLocations(locs);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  function adjust(id: string, delta: number) {
    setFlavours((prev) => {
      const next = (prev[id] || 0) + delta;
      if (next < 0) return prev;
      const u = { ...prev, [id]: next };
      if (u[id] === 0) delete u[id];
      return u;
    });
  }

  function openWhatsApp() {
    const flavourLines = Object.entries(flavours)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => {
        const p = products.find((p) => p.id === id);
        return p ? `  • ${p.name} ×${qty}` : null;
      })
      .filter(Boolean)
      .join("\n");

    const boxSummary = (resolved as any).isClean
      ? (resolved as any).boxes
          .map(
            (b: any) =>
              `${b.qty > 1 ? b.qty + "× " : ""}${b.label} (₹${b.price} each)`,
          )
          .join(", ")
      : `${totalPicked} mochis selected`;

    const lines = [
      `Hi! I'd like to pre-order from Eversweet Trivandrum 🍡`,
      ``,
      totalPicked > 0 ? `${boxSummary}` : `📦 I haven't finalized my box yet`,
      (resolved as any).isClean ? `Travel charge - ₹${TRAVEL_CHARGE}` : ``,
      (resolved as any).isClean ? `💰 Total - ₹${grandTotal}` : ``,
      ``,
      totalPicked > 0 ? `Flavours:\n${flavourLines}` : ``,
      selectedLocation ? `Pickup: ${selectedLocation}` : ``,
      homeDelivery ? `🛵 I need home delivery (Porter)` : ``,
      ``,
      `Please share details to confirm my order!`,
    ]
      .filter((l) => l !== "")
      .join("\n");

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines)}`,
      "_blank",
    );
  }

  const canShowPanel = totalPicked >= targetBox && (resolved as any).isClean;

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 120,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: "var(--bg)",
        minHeight: "100vh",
      }}
    >
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: CSS }}
      />

      {/* ANNOUNCEMENT BAR */}
      <div
        style={{
          background: "var(--gold)",
          padding: "10px 20px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#160c08",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          We're coming to Trivandrum
          {tripDate ? ` · ${tripDate}` : " · Sunday, 07 June"}
        </p>
      </div>

      {/* HERO */}
      <div style={{ position: "relative", height: 280, overflow: "hidden" }}>
        {products
          .filter((p) => p.image_url)
          .slice(0, 4)
          .map((p, i, arr) => (
            <img
              key={p.id}
              src={p.image_url!}
              alt={p.name}
              loading="eager" // ← above the fold, load immediately
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0,
                animation: `heroFade ${arr.length * 3.5}s ease-in-out ${i * 3.5}s infinite`,
              }}
            />
          ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(22,12,8,0.25) 0%, rgba(22,12,8,0.8) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
          }}
        >
          <p
            style={{
              fontSize: "0.58rem",
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 10,
              opacity: 0.9,
            }}
          >
            Kochi Cloud Kitchen
          </p>
          <h1
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: "4.2rem",
              fontWeight: 300,
              lineHeight: 0.95,
              color: "var(--cream)",
              marginBottom: 12,
            }}
          >
            Ever<em style={{ color: "var(--gold)" }}>sweet</em>
          </h1>
          <div
            style={{
              width: 36,
              height: 1,
              background: "var(--gold)",
              opacity: 0.55,
              marginBottom: 14,
            }}
          />
          <p
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: "1.2rem",
              fontWeight: 300,
              color: "rgba(245,237,224,0.88)",
              lineHeight: 1.4,
              textAlign: "center",
              maxWidth: 280,
            }}
          >
            Fresh Japanese mochi,
            <br />
            hand-carried from Kochi
          </p>
        </div>
      </div>

      {/* STORY */}
      <section
        style={{
          padding: "30px 24px 32px",
          background: "rgba(255,248,230,0.02)",
          borderBottom: "1px solid var(--border2)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "1.5rem",
            fontWeight: 300,
            lineHeight: 1.35,
            color: "var(--cream)",
            marginBottom: 14,
          }}
        >
          You asked. We're making the trip.
        </p>
        <p
          style={{
            fontSize: "0.84rem",
            color: "var(--cream-dim)",
            lineHeight: 1.85,
            marginBottom: 12,
          }}
        >
          After receiving requests from several of you in Trivandrum, we're
          bringing Eversweet mochi to your city - made fresh in Kochi the same
          morning and hand-carried by train.
        </p>
        <p
          style={{
            fontSize: "0.84rem",
            color: "var(--cream-dim)",
            lineHeight: 1.85,
          }}
        >
          This is a limited pre-order run. Pick your flavours below and place
          your order via WhatsApp.
        </p>
      </section>

      {/* PRODUCT STORY */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "1.7rem",
            fontWeight: 300,
            lineHeight: 1.3,
            color: "var(--cream)",
            marginBottom: 16,
          }}
        >
          Most mochi is made weeks ago.
          <br />
          <em style={{ color: "var(--gold)" }}>Ours was made this morning.</em>
        </p>
        <div
          style={{
            width: 32,
            height: 1,
            background: "var(--gold)",
            opacity: 0.35,
            margin: "0 auto 20px",
          }}
        />
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--cream-dim)",
            lineHeight: 1.9,
            maxWidth: 360,
            margin: "0 auto 14px",
          }}
        >
          {
            "You've had frozen mochi before. That odd, chewy-but-cold bite that never quite felt right. The rice flour skin that tears instead of yielding. The filling that tastes like a memory of fruit."
          }
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--cream-dim)",
            lineHeight: 1.9,
            maxWidth: 360,
            margin: "0 auto 14px",
          }}
        >
          {"Eversweet is built on one belief: "}
          <strong style={{ color: "var(--cream)", fontWeight: 500 }}>
            {"mochi eaten the day it's made is a completely different food."}
          </strong>
          {
            " The skin is impossibly soft. The filling is cold but not frozen. Every texture is intentional."
          }
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--cream-dim)",
            lineHeight: 1.9,
            maxWidth: 360,
            margin: "0 auto 28px",
          }}
        >
          {
            "We make each batch fresh in Kochi the same morning it reaches you. Nothing sits. Nothing is refrigerated overnight."
          }
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section
        style={{
          padding: "28px 24px",
          borderBottom: "1px solid var(--border2)",
          background: "rgba(201,168,76,0.03)",
        }}
      >
        <p
          style={{
            fontSize: "0.58rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: 14,
            opacity: 0.8,
          }}
        >
          How it works
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(
            [
              ["1", "Pick your flavours and box size below"],
              ["2", "Tap Place Order - it opens WhatsApp with your selection"],
              ["3", "We confirm your order and share payment details"],
              [
                "4",
                tripDate
                  ? `Collect your fresh mochi on ${tripDate}`
                  : "Collect your fresh mochi on the trip date - we confirm on WhatsApp",
              ],
            ] as [string, string][]
          ).map(([n, t]) => (
            <div
              key={n}
              style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(201,168,76,0.12)",
                  border: "1px solid rgba(201,168,76,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--gold)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {n}
              </div>
              <p
                style={{
                  fontSize: "0.84rem",
                  color: "var(--cream-dim)",
                  lineHeight: 1.6,
                  paddingTop: 3,
                }}
              >
                {t}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* STEP 1: FLAVOURS */}
      <section
        style={{
          padding: "36px 24px",
          borderBottom: "1px solid var(--border2)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <p
            style={{
              fontSize: "0.58rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 6,
              opacity: 0.75,
            }}
          >
            Step 1
          </p>
          <h2
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: "1.8rem",
              fontWeight: 300,
              color: "var(--cream)",
              marginBottom: 6,
            }}
          >
            Choose your flavours
          </h2>
          <div
            style={{
              width: 32,
              height: 1,
              background: "var(--gold)",
              margin: "0 auto 10px",
              opacity: 0.35,
            }}
          />
          <p style={{ fontSize: "0.78rem", color: "var(--cream-dim)" }}>
            Mix freely - the right box is worked out for you.
          </p>
        </div>

        {/* Box selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => setTargetBox(4)}
            style={{
              border: `2px solid ${targetBox === 4 ? "var(--gold)" : "rgba(255,255,255,0.09)"}`,
              borderRadius: 12,
              padding: "14px 16px",
              background:
                targetBox === 4
                  ? "rgba(201,168,76,0.07)"
                  : "rgba(255,255,255,0.02)",
              textAlign: "center" as const,
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: "all 0.2s",
              position: "relative" as const,
              overflow: "hidden",
            }}
          >
            {targetBox === 4 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  background: "var(--gold)",
                  padding: "3px 0",
                  fontSize: "0.55rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "#160c08",
                  borderRadius: "10px 10px 0 0",
                }}
              >
                Selected
              </div>
            )}
            <div style={{ marginTop: targetBox === 4 ? 14 : 0 }}>
              <p
                style={{
                  fontSize: "0.6rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                  color: targetBox === 4 ? "var(--gold)" : "var(--cream-dim)",
                  marginBottom: 6,
                }}
              >
                Box of 4
              </p>
              <p
                style={{
                  fontSize: "2.2rem",
                  fontWeight: 700,
                  color: targetBox === 4 ? "var(--gold)" : "var(--cream)",
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                ₹599
              </p>
              <p style={{ fontSize: "0.68rem", color: "var(--cream-dim)" }}>
                4 mochis
              </p>
            </div>
          </button>
          <button
            onClick={() => setTargetBox(6)}
            style={{
              border: `2px solid ${targetBox === 6 ? "var(--gold)" : "rgba(255,255,255,0.09)"}`,
              borderRadius: 12,
              padding: "14px 16px",
              background:
                targetBox === 6
                  ? "rgba(201,168,76,0.08)"
                  : "rgba(255,255,255,0.02)",
              textAlign: "center" as const,
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: "all 0.2s",
              position: "relative" as const,
              overflow: "hidden",
            }}
          >
            {targetBox === 6 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  background: "var(--gold)",
                  padding: "3px 0",
                  fontSize: "0.55rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "#160c08",
                }}
              >
                Selected
              </div>
            )}
            <div style={{ marginTop: targetBox === 6 ? 16 : 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  marginBottom: 6,
                }}
              >
                <p
                  style={{
                    fontSize: "0.6rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase" as const,
                    color: targetBox === 6 ? "var(--gold)" : "var(--cream-dim)",
                  }}
                >
                  Box of 6
                </p>
                {targetBox !== 6 && (
                  <span
                    style={{
                      fontSize: "0.5rem",
                      fontWeight: 700,
                      color: "#160c08",
                      background: "var(--gold)",
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    BEST VALUE
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: "2.2rem",
                  fontWeight: 700,
                  color: targetBox === 6 ? "var(--gold)" : "var(--cream)",
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                ₹849
              </p>
              <p style={{ fontSize: "0.68rem", color: "var(--cream-dim)" }}>
                6 mochis
              </p>
            </div>
          </button>
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginBottom: 16,
            padding: "14px 18px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            minHeight: 90,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                color:
                  totalPicked >= targetBox ? "var(--gold)" : "var(--cream-dim)",
                fontWeight: totalPicked >= targetBox ? 700 : 400,
              }}
            >
              {totalPicked === 0
                ? "Pick your mochis below"
                : `${totalPicked} of ${targetBox} selected`}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color:
                  totalPicked >= targetBox ? "var(--gold)" : "var(--cream-dim)",
                fontWeight: 600,
              }}
            >
              {targetBox === 6 ? "Box of 6 · ₹849" : "Box of 4 · ₹599"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: targetBox }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 99,
                  background:
                    i < totalPicked ? "var(--gold)" : "rgba(201,168,76,0.12)",
                  transition: "background 0.25s",
                }}
              />
            ))}
          </div>
          {totalPicked > 0 && totalPicked < targetBox && (
            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--cream-dim)",
                marginTop: 8,
              }}
            >
              {targetBox - totalPicked} more to fill your box
            </p>
          )}
          {totalPicked >= targetBox && (resolved as any).isClean && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--gold)",
                fontWeight: 700,
                marginTop: 8,
              }}
            >
              Box of {targetBox} ready - tap Place Order below
            </p>
          )}
        </div>

        {/* Flavour grid */}
        {loading ? (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  height: 190,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
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
                    borderRadius: 12,
                    overflow: "hidden",
                    border: `2px solid ${qty > 0 ? "var(--gold)" : "rgba(255,255,255,0.07)"}`,
                    background:
                      qty > 0
                        ? "rgba(201,168,76,0.1)"
                        : "rgba(255,255,255,0.02)",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <img
                      src={getImg(p.name, p.image_url)}
                      alt={p.name}
                      loading="lazy" // ← below the fold, defer loading
                      style={{
                        width: "100%",
                        height: 130,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    {p.is_premium && (
                      <span
                        style={{
                          position: "absolute",
                          top: 7,
                          left: 7,
                          background: "rgba(201,168,76,0.92)",
                          color: "#1a0e00",
                          fontSize: "0.52rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 4,
                          letterSpacing: "0.08em",
                        }}
                      >
                        PREMIUM
                      </span>
                    )}
                    {qty > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "var(--gold)",
                          color: "#1a0e00",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {qty}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "10px 12px 14px", minHeight: 90 }}>
                    <p
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: qty > 0 ? 700 : 600,
                        marginBottom: p.description ? 6 : 10,
                        color: qty > 0 ? "var(--gold)" : "var(--cream)",
                      }}
                    >
                      {p.name}
                    </p>
                    {p.description && (
                      <p
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--cream-dim)",
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}
                      >
                        {p.description}
                      </p>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 99,
                        padding: "2px",
                        width: "fit-content",
                        margin: "0 auto",
                      }}
                    >
                      <button
                        onClick={() => adjust(p.id, -1)}
                        disabled={qty === 0}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background:
                            qty > 0 ? "rgba(201,168,76,0.2)" : "transparent",
                          border: "none",
                          color:
                            qty > 0 ? "var(--gold)" : "rgba(255,255,255,0.25)",
                          fontSize: "1.2rem",
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
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          minWidth: 32,
                          textAlign: "center" as const,
                          color:
                            qty > 0 ? "var(--gold)" : "rgba(255,255,255,0.35)",
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        onClick={() => adjust(p.id, 1)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "rgba(201,168,76,0.2)",
                          border: "none",
                          color: "var(--gold)",
                          fontSize: "1.2rem",
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

        {/* Awkward number nudge */}
        {totalPicked > 0 &&
          !(resolved as any).isClean &&
          totalPicked >= 4 &&
          (resolved as any).nudge && (
            <div
              style={{
                marginTop: 14,
                padding: "16px 18px",
                background: "rgba(201,168,76,0.05)",
                border: "1px solid rgba(201,168,76,0.18)",
                borderRadius: 12,
              }}
            >
              <p
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "var(--cream)",
                  marginBottom: 12,
                }}
              >
                {totalPicked} mochis - adjust to fit a box:
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    const id = products[0]?.id;
                    if (id) adjust(id, (resolved as any).nudge.add);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(201,168,76,0.35)",
                    background: "rgba(201,168,76,0.08)",
                    color: "var(--gold)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    textAlign: "center" as const,
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--cream-dim)",
                      marginBottom: 3,
                    }}
                  >
                    Add {(resolved as any).nudge.add} more
                  </p>
                  <p style={{ fontWeight: 700, marginBottom: 3 }}>
                    {(resolved as any).nudge.addLabel}
                  </p>
                  <p style={{ fontSize: "1rem", fontWeight: 700 }}>
                    ₹{(resolved as any).nudge.addPrice + TRAVEL_CHARGE}
                  </p>
                </button>
                <button
                  onClick={() => {
                    const toRemove = (resolved as any).nudge.remove;
                    setFlavours((prev) => {
                      const u = { ...prev };
                      let rem = toRemove;
                      for (const [id, qty] of Object.entries(u).sort(
                        ([, a], [, b]) => (b as number) - (a as number),
                      )) {
                        const take = Math.min(rem, qty as number);
                        (u as any)[id] = (qty as number) - take;
                        if ((u as any)[id] === 0) delete (u as any)[id];
                        rem -= take;
                        if (rem === 0) break;
                      }
                      return u;
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    color: "var(--cream-dim)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    textAlign: "center" as const,
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--cream-dim)",
                      marginBottom: 3,
                    }}
                  >
                    Remove {(resolved as any).nudge.remove}
                  </p>
                  <p style={{ fontWeight: 700, marginBottom: 3 }}>
                    {(resolved as any).nudge.removeLabel}
                  </p>
                  <p style={{ fontSize: "1rem", fontWeight: 700 }}>
                    ₹{(resolved as any).nudge.removePrice + TRAVEL_CHARGE}
                  </p>
                </button>
              </div>
            </div>
          )}

        {/* Place Order button */}
        {canShowPanel && (
          <button
            onClick={() => {
              setShowOrderSection(true);
              setTimeout(
                () =>
                  document
                    .getElementById("order-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                50,
              );
            }}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "16px",
              borderRadius: 12,
              border: "2px solid var(--gold)",
              background: "rgba(201,168,76,0.1)",
              color: "var(--gold)",
              fontSize: "1.05rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            Place Order →
          </button>
        )}
      </section>

      {/* INLINE ORDER SECTION */}
      {showOrderSection && (
        <section
          id="order-section"
          style={{
            padding: "36px 24px",
            borderBottom: "1px solid var(--border2)",
            background: "rgba(201,168,76,0.03)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p
              style={{
                fontSize: "0.58rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--gold)",
                marginBottom: 6,
                opacity: 0.75,
              }}
            >
              Your Order
            </p>
            <h2
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: "1.8rem",
                fontWeight: 300,
                color: "var(--cream)",
                marginBottom: 6,
              }}
            >
              Review & Order
            </h2>
            <div
              style={{
                width: 32,
                height: 1,
                background: "var(--gold)",
                margin: "0 auto",
                opacity: 0.35,
              }}
            />
          </div>

          {/* Order summary */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "18px",
              marginBottom: 20,
            }}
          >
            {(resolved as any).boxes.map((b: any, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{ fontSize: "0.88rem", color: "var(--cream-dim)" }}
                >
                  {b.qty > 1 ? `${b.qty}× ` : ""}
                  {b.label}
                </span>
                <span style={{ fontSize: "0.88rem", color: "var(--cream)" }}>
                  ₹{b.price * b.qty}
                </span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: "0.88rem", color: "var(--cream-dim)" }}>
                Travel charge
              </span>
              <span style={{ fontSize: "0.88rem", color: "var(--cream)" }}>
                ₹{TRAVEL_CHARGE}
              </span>
            </div>
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "var(--cream)",
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--gold)",
                }}
              >
                ₹{grandTotal}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 12,
              }}
            >
              {Object.entries(flavours)
                .filter(([, q]) => q > 0)
                .map(([id, qty]) => {
                  const p = products.find((pr) => pr.id === id);
                  return p ? (
                    <span
                      key={id}
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--gold)",
                        background: "rgba(201,168,76,0.12)",
                        border: "1px solid rgba(201,168,76,0.3)",
                        borderRadius: 20,
                        padding: "4px 12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {p.name}
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "rgba(201,168,76,0.7)",
                          fontWeight: 400,
                        }}
                      >
                        ×{qty}
                      </span>
                    </span>
                  ) : null;
                })}
            </div>
            {tripDate && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{ fontSize: "0.72rem", color: "var(--cream-dim)" }}
                >
                  Pickup date
                </span>
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--gold)",
                  }}
                >
                  {tripDate}
                </span>
              </div>
            )}
          </div>

          {/* Pickup location */}
          <p
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "var(--gold)",
              marginBottom: 6,
              opacity: 0.8,
            }}
          >
            Choose pickup location
          </p>
          <p
            style={{
              fontSize: "0.76rem",
              color: "var(--cream-dim)",
              marginBottom: 12,
              lineHeight: 1.6,
            }}
          >
            Pick the location nearest to you - exact spot and time confirmed on
            WhatsApp.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {pickupLocations.map((loc) => (
              <button
                key={loc.name}
                onClick={() =>
                  setSelectedLocation((l) => (l === loc.name ? "" : loc.name))
                }
                style={{
                  padding: "14px 18px",
                  textAlign: "left" as const,
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: `1.5px solid ${selectedLocation === loc.name ? "var(--gold)" : "rgba(255,255,255,0.08)"}`,
                  background:
                    selectedLocation === loc.name
                      ? "rgba(201,168,76,0.06)"
                      : "rgba(255,255,255,0.02)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  transition: "all 0.18s",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color:
                        selectedLocation === loc.name
                          ? "var(--gold)"
                          : "var(--cream)",
                      marginBottom: 2,
                    }}
                  >
                    {loc.name}
                  </p>
                  <p style={{ fontSize: "0.68rem", color: "var(--cream-dim)" }}>
                    {loc.area}
                  </p>
                </div>
                {selectedLocation === loc.name && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: "rgba(201,168,76,0.18)",
                      color: "var(--gold)",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Home delivery */}
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setHomeDelivery((v) => !v)}
              style={{
                width: "100%",
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: homeDelivery
                  ? "rgba(201,168,76,0.06)"
                  : "rgba(255,255,255,0.02)",
                border: `1.5px solid ${homeDelivery ? "var(--gold)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                textAlign: "left" as const,
                transition: "all 0.18s",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  border: `2px solid ${homeDelivery ? "var(--gold)" : "rgba(255,255,255,0.2)"}`,
                  background: homeDelivery ? "var(--gold)" : "transparent",
                  flexShrink: 0,
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.18s",
                }}
              >
                {homeDelivery && (
                  <span
                    style={{
                      color: "#160c08",
                      fontSize: "0.7rem",
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <div>
                <p
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: homeDelivery ? "var(--gold)" : "var(--cream)",
                    marginBottom: 3,
                  }}
                >
                  I need home delivery
                </p>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--cream-dim)",
                    lineHeight: 1.6,
                  }}
                >
                  Porter delivery from your nearest pickup point. Additional
                  charge applies - approximate rates below.
                </p>
              </div>
            </button>
            {homeDelivery && (
              <div
                style={{
                  marginTop: 10,
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10,
                }}
              >
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--cream)",
                    marginBottom: 8,
                  }}
                >
                  🛵 Approximate Porter charges
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {[
                    ["~1.5 km", "≈ ₹55"],
                    ["~4 km", "≈ ₹80"],
                    ["~7 km", "≈ ₹110"],
                    ["~13 km", "≈ ₹170"],
                  ].map(([dist, charge]) => (
                    <div
                      key={dist}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                      }}
                    >
                      <span style={{ color: "var(--cream-dim)" }}>
                        {dist} from pickup
                      </span>
                      <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                        {charge}
                      </span>
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: "0.68rem",
                    color: "rgba(200,184,154,0.5)",
                    lineHeight: 1.6,
                  }}
                >
                  Approx ₹40 base + ₹10/km. Share your address on WhatsApp - we
                  confirm the exact charge and include it in your total. Nothing
                  to pay on delivery.
                </p>
              </div>
            )}
          </div>

          {/* WhatsApp CTA */}
          <button
            onClick={openWhatsApp}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #25d366, #128c4a)",
              color: "#fff",
              fontSize: "1.05rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 4px 20px rgba(37,211,102,0.25)",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>📲</span>
            Order via WhatsApp - ₹{grandTotal}
          </button>
          <p
            style={{
              fontSize: "0.7rem",
              color: "var(--cream-dim)",
              marginTop: 10,
              textAlign: "center",
              lineHeight: 1.7,
            }}
          >
            We'll confirm pickup details and payment on WhatsApp.
          </p>
        </section>
      )}

      {/* FAQ */}
      <div style={{ padding: "32px 24px 40px" }}>
        <button
          onClick={() => setShowMore((v) => !v)}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "var(--cream-dim)",
            fontSize: "0.8rem",
            cursor: "pointer",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>About Eversweet · FAQ</span>
          <span
            style={{
              transition: "transform 0.2s",
              transform: showMore ? "rotate(180deg)" : "none",
              display: "inline-block",
            }}
          >
            ▾
          </span>
        </button>
        {showMore && (
          <div style={{ paddingTop: 22 }}>
            {[
              [
                "What is Mochi?",
                "A Japanese dessert - soft, chewy rice flour on the outside, cold creamy fruit filling inside. Made fresh in Kochi the same morning it reaches you.",
              ],
              [
                "Why the travel charge?",
                "We travel from Kochi to Trivandrum by train, carrying your mochi fresh. The ₹200 is a one-time charge per order, not per box.",
              ],
              [
                "How does pickup work?",
                "We'll confirm the exact pickup location and timing on WhatsApp after your order.",
              ],
              [
                "Can I get home delivery?",
                "Yes - Porter delivery from your nearest pickup point. Share your address on WhatsApp, we confirm the exact charge and add it to your total. No separate payment on delivery.",
              ],
              [
                "Can I cancel?",
                "Message us on WhatsApp - we'll work something out.",
              ],
              [
                "Will you come to TVM regularly?",
                "If this run goes well - yes! We're planning regular trips.",
              ],
            ].map(([q, a]) => (
              <div
                key={q}
                style={{
                  marginBottom: 18,
                  paddingBottom: 18,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "var(--cream)",
                    marginBottom: 5,
                  }}
                >
                  {q}
                </p>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--cream-dim)",
                    lineHeight: 1.75,
                  }}
                >
                  {a}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer
        style={{
          padding: "24px",
          textAlign: "center",
          borderTop: "1px solid var(--border2)",
          background: "var(--bg2)",
        }}
      >
        <p
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "1.5rem",
            color: "var(--gold)",
            marginBottom: 6,
            fontWeight: 300,
          }}
        >
          Eversweet
        </p>
        <p
          style={{
            fontSize: "0.68rem",
            color: "var(--cream-dim)",
            marginBottom: 14,
          }}
        >
          Cloud Kitchen · Kochi, Kerala
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.82rem",
            color: "#25d366",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Chat on WhatsApp
        </a>
        <p
          style={{
            fontSize: "0.55rem",
            color: "rgba(255,248,230,0.15)",
            marginTop: 14,
          }}
        >
          © {new Date().getFullYear()} Eversweet Company
        </p>
      </footer>
    </main>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  :root { --bg:#160c08; --bg2:#1e1009; --gold:#c9a84c; --cream:#f5ede0; --cream-dim:#c8b89a; --border2:rgba(201,168,76,0.08); }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
  body{background:var(--bg);color:var(--cream);font-family:'DM Sans',sans-serif;font-weight:300;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  input,button,a{font-family:'DM Sans',sans-serif}
  input::placeholder{color:rgba(200,184,154,0.4)}
  input:focus{border-color:rgba(201,168,76,0.5)!important;outline:none}
  @keyframes heroFade{0%{opacity:0}8%{opacity:1}33%{opacity:1}41%{opacity:0}100%{opacity:0}}
`;
