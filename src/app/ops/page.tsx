// Location: src/app/ops/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const V = {
  bg: "linear-gradient(160deg, #eef2ff 0%, #fdf4ff 45%, #fff7ed 100%)",
  card: "rgba(255,255,255,0.78)",
  cardBorder: "rgba(255,255,255,0.9)",
  text: "#1e1b3a",
  sub: "#5b5578",
  muted: "#8b85a3",
  shadow: "0 8px 30px rgba(99,60,180,0.08)",
  green: "#16a34a",
  red: "#e11d48",
};

const PAID_STATUSES = [
  "confirmed",
  "cooking",
  "cooked",
  "porter_booked",
  "dispatched",
];

function todayStr() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().split("T")[0];
}
function monthPrefix() {
  return todayStr().slice(0, 7);
}

export default function OpsHub() {
  const [stats, setStats] = useState<{
    revenue: number;
    expenses: number;
    orders: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const month = monthPrefix();
      const [{ data: orders }, { data: expenses }] = await Promise.all([
        supabase
          .from("orders")
          .select("total_price, status, delivery_date, order_date, created_at")
          .in("status", PAID_STATUSES),
        supabase
          .from("expenses")
          .select("amount, category, date")
          .gte("date", `${month}-01`),
      ]);
      const monthOrders = (orders || []).filter((o) => {
        const d =
          o.delivery_date || o.order_date || o.created_at?.split("T")[0] || "";
        return d.startsWith(month);
      });
      const revenue = monthOrders.reduce((s, o) => s + (o.total_price || 0), 0);
      const exp = (expenses || [])
        .filter((e) => !e.category.startsWith("personal_"))
        .reduce((s, e) => s + (e.amount || 0), 0);
      setStats({ revenue, expenses: exp, orders: monthOrders.length });
    }
    load();
  }, []);

  const tiles = [
    {
      href: "/expenses",
      icon: "💸",
      label: "Expenses",
      desc: "Track spending, scan bank messages",
      gradient: "linear-gradient(135deg, #a78bfa, #6366f1)",
    },
    {
      href: "/admin",
      icon: "🍡",
      label: "Orders",
      desc: "Cook queue, orders, customers",
      gradient: "linear-gradient(135deg, #fb923c, #ea580c)",
    },
    {
      href: "/finance",
      icon: "💰",
      label: "Finance",
      desc: "Unni & Amma income, settlements",
      gradient: "linear-gradient(135deg, #f472b6, #db2777)",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: V.bg,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: V.text,
        paddingBottom: 60,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');`,
        }}
      />

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "36px 20px 8px",
          textAlign: "center" as const,
        }}
      >
        <p style={{ fontSize: "2.4rem", marginBottom: 4 }}>🍡</p>
        <h1 style={{ fontSize: "1.7rem", fontWeight: 800 }}>Eversweet Ops</h1>
        <p style={{ fontSize: "0.85rem", color: V.sub, marginTop: 4 }}>
          Everything, in one place
        </p>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 20px 0" }}>
        {/* Dashboard highlight tile — bigger, shows live numbers */}
        <Link href="/admin" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #4f46e5, #7c3aed, #db2777)",
              borderRadius: 24,
              padding: 24,
              color: "#fff",
              marginBottom: 16,
              boxShadow: "0 12px 32px rgba(99,60,180,0.3)",
              cursor: "pointer",
            }}
          >
            <p
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                opacity: 0.85,
                marginBottom: 14,
              }}
            >
              📊 This Month's Highlights
            </p>
            {!stats ? (
              <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>Loading…</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 14,
                }}
              >
                <div>
                  <p style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                    ₹{stats.revenue.toLocaleString("en-IN")}
                  </p>
                  <p style={{ fontSize: "0.68rem", opacity: 0.8 }}>Revenue</p>
                </div>
                <div>
                  <p style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                    ₹{stats.expenses.toLocaleString("en-IN")}
                  </p>
                  <p style={{ fontSize: "0.68rem", opacity: 0.8 }}>Expenses</p>
                </div>
                <div>
                  <p style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                    {stats.orders}
                  </p>
                  <p style={{ fontSize: "0.68rem", opacity: 0.8 }}>Orders</p>
                </div>
              </div>
            )}
            <p style={{ fontSize: "0.75rem", marginTop: 16, opacity: 0.85 }}>
              Tap for full dashboard →
            </p>
          </div>
        </Link>

        {/* Section tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            marginBottom: 20,
            alignItems: "stretch",
          }}
        >
          {tiles.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              style={{
                textDecoration: "none",
                display: "block",
                height: "100%",
              }}
            >
              <div
                style={{
                  background: V.card,
                  border: `1px solid ${V.cardBorder}`,
                  borderRadius: 20,
                  boxShadow: V.shadow,
                  backdropFilter: "blur(10px)",
                  padding: 20,
                  cursor: "pointer",
                  transition: "transform 0.15s",
                  height: "100%",
                  minHeight: 160,
                  boxSizing: "border-box" as const,
                  display: "flex",
                  flexDirection: "column" as const,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: t.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.4rem",
                    marginBottom: 12,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                  }}
                >
                  {t.icon}
                </div>
                <p
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: V.text,
                    marginBottom: 3,
                  }}
                >
                  {t.label}
                </p>
                <p
                  style={{ fontSize: "0.72rem", color: V.sub, lineHeight: 1.4 }}
                >
                  {t.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
