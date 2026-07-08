"use client";
import React, { useRef, useState } from "react";
import { G } from "../_lib/theme";

const PROVIDER_STYLE: Record<
  string,
  { bg: string; color: string; border: string; label: string }
> = {
  groq: {
    bg: "rgba(167,139,250,0.15)",
    color: "#a78bfa",
    border: "rgba(167,139,250,0.3)",
    label: "Groq",
  },
  openai: {
    bg: "rgba(52,217,123,0.15)",
    color: "#34d97b",
    border: "rgba(52,217,123,0.3)",
    label: "GPT",
  },
  gemini: {
    bg: "rgba(96,165,250,0.15)",
    color: "#60a5fa",
    border: "rgba(96,165,250,0.3)",
    label: "Gemini",
  },
};

function ProviderBadge({ provider }: { provider: string | null }) {
  if (!provider) return null;
  const style = PROVIDER_STYLE[provider] || {
    bg: "rgba(168,180,204,0.15)",
    color: "#a8b4cc",
    border: "rgba(168,180,204,0.3)",
    label: provider,
  };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.62rem",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 6,
        marginBottom: 10,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      ⚡ {style.label}
    </span>
  );
}

export function ExpenseScanner({
  onDataExtracted,
}: {
  onDataExtracted: (data: unknown[]) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<unknown[] | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResults(null);
    setProvider(null);
    setError(null);
    setScanning(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/extract-bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "API error");
        }
        const data = await res.json();
        const items = data.items || [];
        if (!Array.isArray(items) || items.length === 0) {
          setError("No items found in this bill.");
          setScanning(false);
          return;
        }
        setResults(items);
        setProvider(data._provider || null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setScanning(false);
    };
  };

  return (
    <div
      style={{
        background: G.glass,
        border: `1px solid ${G.glassBorder}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <p
        style={{
          fontSize: "0.65rem",
          color: G.muted,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          marginBottom: 12,
          fontWeight: 700,
        }}
      >
        ✨ AI Bill Scanner
      </p>
      {!results && (
        <div
          onClick={() => !scanning && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${scanning ? G.goldBorder : G.glassBorder}`,
            borderRadius: 10,
            padding: "24px 16px",
            textAlign: "center" as const,
            cursor: scanning ? "not-allowed" : "pointer",
            background: scanning ? G.goldGlass : "rgba(0,0,0,0.1)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileChange}
            disabled={scanning}
          />
          {preview && !scanning && (
            <img
              src={preview}
              alt="Bill"
              style={{
                maxHeight: 100,
                maxWidth: "100%",
                borderRadius: 8,
                marginBottom: 10,
                objectFit: "contain" as const,
              }}
            />
          )}
          <p
            style={{
              fontSize: scanning ? "0.9rem" : "1.8rem",
              marginBottom: 6,
            }}
          >
            {scanning ? "⏳" : "📸"}
          </p>
          <p
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: scanning ? G.gold : G.sub,
            }}
          >
            {scanning ? "Analyzing with AI..." : "Tap to upload bill photo"}
          </p>
          <p style={{ fontSize: "0.7rem", color: G.muted, marginTop: 4 }}>
            JPG, PNG, HEIC supported
          </p>
        </div>
      )}
      {error && (
        <div
          style={{
            background: G.redGlass,
            border: `1px solid rgba(255,92,108,0.3)`,
            borderRadius: 8,
            padding: "10px 12px",
            marginTop: 10,
          }}
        >
          <p style={{ fontSize: "0.82rem", color: G.red }}>⚠ {error}</p>
          <button
            onClick={() => {
              setError(null);
              setPreview(null);
            }}
            style={{
              marginTop: 6,
              fontSize: "0.75rem",
              color: G.red,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Try again
          </button>
        </div>
      )}
      {results && (
        <div>
          <p
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: G.green,
              marginBottom: 6,
            }}
          >
            ✓ Found {results.length} item{results.length !== 1 ? "s" : ""}
          </p>
          <div>
            <ProviderBadge provider={provider} />
          </div>
          <div style={{ marginBottom: 12 }}>
            {(
              results as {
                description: string;
                amount: number;
                category: string;
              }[]
            ).map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  marginBottom: 5,
                  background:
                    item.category === "packaging" ? G.blueGlass : G.greenGlass,
                  border: `1px solid ${item.category === "packaging" ? "rgba(96,165,250,0.2)" : "rgba(52,211,123,0.2)"}`,
                }}
              >
                <div>
                  <span style={{ fontSize: "0.72rem", marginRight: 6 }}>
                    {item.category === "packaging" ? "📦" : "🧪"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      color: G.text,
                    }}
                  >
                    {item.description}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "0.62rem",
                      padding: "1px 6px",
                      borderRadius: 6,
                      background: G.glass,
                      color: G.muted,
                    }}
                  >
                    {item.category}
                  </span>
                </div>
                <span
                  style={{ fontSize: "0.88rem", fontWeight: 700, color: G.red }}
                >
                  ₹{item.amount}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                onDataExtracted(results!);
                setResults(null);
                setPreview(null);
                setProvider(null);
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: `1px solid rgba(96,165,250,0.3)`,
                background: G.blueGlass,
                color: G.blue,
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              ✓ Save All to Expenses
            </button>
            <button
              onClick={() => {
                setResults(null);
                setPreview(null);
                setProvider(null);
                setError(null);
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: `1px solid ${G.glassBorder}`,
                background: G.glass,
                color: G.sub,
                fontSize: "0.88rem",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
