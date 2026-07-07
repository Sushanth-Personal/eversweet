// Location: src/components/MaintenanceScreen.tsx
export function MaintenanceScreen() {
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
      <h1
        className="font-display"
        style={{
          fontSize: "2.4rem",
          fontWeight: 300,
          marginBottom: 16,
          lineHeight: 1.1,
        }}
      >
        Ever<em style={{ color: "var(--gold)" }}>sweet</em>
      </h1>
      <div
        style={{
          width: 36,
          height: 1,
          background: "var(--gold)",
          opacity: 0.45,
          marginBottom: 22,
        }}
      />
      <p
        style={{
          fontSize: "0.62rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase" as const,
          color: "var(--gold)",
          marginBottom: 14,
          opacity: 0.85,
        }}
      >
        Under Maintenance
      </p>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--cream-dim)",
          lineHeight: 1.8,
          marginBottom: 12,
        }}
      >
        We're making a few updates behind the scenes. Ordering will be back
        shortly — thanks for your patience!
      </p>
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--cream-dim)",
          lineHeight: 1.8,
          marginBottom: 28,
        }}
      >
        Want to place an order right now? DM us on Instagram and we'll sort you
        out.
      </p>
      <a
        href="https://instagram.com/byeversweet"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          borderRadius: 8,
          border: "1px solid var(--gold)",
          background: "rgba(184,134,11,0.08)",
          color: "var(--gold)",
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textDecoration: "none",
        }}
      >
        📩 DM us at @byeversweet →
      </a>
    </main>
  );
}
