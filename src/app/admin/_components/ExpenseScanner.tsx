"use client";
import React, { useRef, useState } from "react";
import { G } from "../_lib/theme";

const MAX_IMAGES = 5;

const PROVIDER_STYLE: Record<
  string,
  { bg: string; color: string; border: string; label: string }
> = {
  groq: {
    bg: "rgba(167,139,250,0.15)",
    color: "#a78bfa",
    border: "rgba(167,139,250,0.3)",
    label: "Groq (Scout)",
  },
  "groq-maverick": {
    bg: "rgba(167,139,250,0.15)",
    color: "#a78bfa",
    border: "rgba(167,139,250,0.3)",
    label: "Groq (Maverick)",
  },
  openai: {
    bg: "rgba(52,217,123,0.15)",
    color: "#34d97b",
    border: "rgba(52,217,123,0.3)",
    label: "GPT-4o",
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
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<unknown[] | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    setResults(null);
    setProvider(null);
    setError(null);
    setInfo(null);
    setImages((prev) => {
      const next = [
        ...prev,
        ...Array.from(files).map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        })),
      ];
      return next.slice(0, MAX_IMAGES);
    });
  }

  function removeImage(i: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, j) => j !== i);
    });
  }

  function reset() {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setResults(null);
    setProvider(null);
    setError(null);
    setInfo(null);
  }

  async function scan() {
    if (images.length === 0) return;
    setScanning(true);
    setError(null);
    setInfo(null);
    try {
      const encoded = await Promise.all(
        images.map(
          (img) =>
            new Promise<{ imageBase64: string; mimeType: string }>(
              (resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(img.file);
                reader.onload = () =>
                  resolve({
                    imageBase64: (reader.result as string).split(",")[1],
                    mimeType: img.file.type,
                  });
                reader.onerror = reject;
              },
            ),
        ),
      );

      const res = await fetch("/api/extract-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: encoded }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }
      const data = await res.json();
      const items = data.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        // Not an error — the scan worked fine, it just found nothing worth
        // logging (e.g. household items, cleaning supplies, non-mochi stuff).
        setInfo(
          "No ingredient or packaging items found — this looks like a bill for something else (household items, supplies, etc.), so nothing was added.",
        );
        setScanning(false);
        return;
      }
      setResults(items);
      setProvider(data._provider || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setScanning(false);
    }
  }

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
        <>
          <div
            onClick={() => !scanning && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${scanning ? G.goldBorder : G.glassBorder}`,
              borderRadius: 10,
              padding: images.length > 0 ? "12px" : "24px 16px",
              textAlign: "center" as const,
              cursor: scanning ? "not-allowed" : "pointer",
              background: scanning ? G.goldGlass : "rgba(0,0,0,0.1)",
              marginBottom: images.length > 0 ? 10 : 0,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
              disabled={scanning}
            />

            {images.length === 0 ? (
              <>
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
                  {scanning
                    ? "Analyzing with AI..."
                    : "Tap to upload bill photo(s)"}
                </p>
                <p style={{ fontSize: "0.7rem", color: G.muted, marginTop: 4 }}>
                  JPG, PNG, HEIC · up to {MAX_IMAGES} at once
                </p>
              </>
            ) : (
              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}
              >
                {images.map((img, i) => (
                  <div
                    key={i}
                    style={{ position: "relative" as const, flexShrink: 0 }}
                  >
                    <img
                      src={img.preview}
                      alt={`bill-${i}`}
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: "cover" as const,
                        borderRadius: 8,
                        border: `1px solid ${G.glassBorder}`,
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(i);
                      }}
                      style={{
                        position: "absolute" as const,
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: G.red,
                        border: "none",
                        color: "#fff",
                        fontSize: "0.6rem",
                        cursor: "pointer",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      border: `2px dashed ${G.glassBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: G.muted,
                      fontSize: "1.3rem",
                      flexShrink: 0,
                    }}
                  >
                    +
                  </div>
                )}
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={scanning}
                onClick={scan}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 9,
                  border: "none",
                  background: scanning
                    ? "rgba(167,139,250,0.1)"
                    : "linear-gradient(135deg, rgba(167,139,250,0.9), rgba(96,165,250,0.85))",
                  color: scanning ? G.purple : "#0d0620",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: scanning ? "not-allowed" : "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {scanning
                  ? "Analysing..."
                  : `Analyse ${images.length} bill${images.length > 1 ? "s" : ""}`}
              </button>
              <button
                disabled={scanning}
                onClick={reset}
                style={{
                  padding: "11px 16px",
                  borderRadius: 9,
                  border: `1px solid ${G.glassBorder}`,
                  background: G.glass,
                  color: G.sub,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* Informational, non-error state: scan succeeded but found nothing relevant */}
      {info && (
        <div
          style={{
            background: G.glassStrong,
            border: `1px solid ${G.glassBorder}`,
            borderRadius: 8,
            padding: "10px 12px",
            marginTop: 10,
          }}
        >
          <p style={{ fontSize: "0.82rem", color: G.sub }}>ℹ️ {info}</p>
          <button
            onClick={reset}
            style={{
              marginTop: 6,
              fontSize: "0.75rem",
              color: G.blue,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Try a different bill
          </button>
        </div>
      )}

      {/* Genuine error state (API/network failure) */}
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
            onClick={reset}
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
                reset();
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
              onClick={reset}
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
