// Location: src/app/expenses/page.tsx
"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";

const V = {
  bg: "linear-gradient(160deg, #eef2ff 0%, #fdf4ff 45%, #fff7ed 100%)",
  card: "rgba(255,255,255,0.78)",
  cardBorder: "rgba(255,255,255,0.9)",
  text: "#1e1b3a",
  sub: "#5b5578",
  shadow: "0 8px 30px rgba(99,60,180,0.08)",
};

export default function ExpensesHub() {
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
        style={{ maxWidth: 640, margin: "0 auto", padding: "22px 20px 8px" }}
      >
        <Link
          href="/ops"
          style={{ fontSize: "0.75rem", color: V.sub, textDecoration: "none" }}
        >
          ← Hub
        </Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 4 }}>
          💸 Expenses
        </h1>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px" }}>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <Link href="/expenses/record" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "linear-gradient(150deg, #a78bfa, #6366f1)",
                borderRadius: 24,
                padding: "36px 20px",
                color: "#fff",
                textAlign: "center" as const,
                cursor: "pointer",
                boxShadow: "0 12px 32px rgba(99,60,180,0.28)",
                minHeight: 200,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p style={{ fontSize: "2.4rem", marginBottom: 12 }}>➕</p>
              <p
                style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 4 }}
              >
                Record New Expense
              </p>
              <p style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                Scan a screenshot or pick a category
              </p>
            </div>
          </Link>

          <Link href="/expenses/dashboard" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "linear-gradient(150deg, #fb923c, #ea580c)",
                borderRadius: 24,
                padding: "36px 20px",
                color: "#fff",
                textAlign: "center" as const,
                cursor: "pointer",
                boxShadow: "0 12px 32px rgba(234,88,12,0.28)",
                minHeight: 200,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p style={{ fontSize: "2.4rem", marginBottom: 12 }}>📊</p>
              <p
                style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 4 }}
              >
                Expenses Dashboard
              </p>
              <p style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                Spend by category, full history
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
