// Location: src/app/expenses/record/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
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
  indigo: "#4f46e5",
};

type CategoryDef = {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
};

const PERSONAL_CATEGORIES: CategoryDef[] = [
  {
    id: "personal_food",
    label: "Food",
    icon: "🍔",
    color: "#ea580c",
    bg: "rgba(234,88,12,0.1)",
  },
  {
    id: "personal_travel",
    label: "Travel",
    icon: "🚗",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.1)",
  },
  {
    id: "personal_loan",
    label: "Loan",
    icon: "💳",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.1)",
  },
  {
    id: "personal_purchase",
    label: "Purchase",
    icon: "🛍️",
    color: "#db2777",
    bg: "rgba(219,39,119,0.1)",
  },
  {
    id: "personal_other",
    label: "Other",
    icon: "📋",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
  },
];

const COMPANY_CATEGORIES: CategoryDef[] = [
  {
    id: "marketing",
    label: "Ads",
    icon: "📣",
    color: "#e11d48",
    bg: "rgba(225,29,72,0.1)",
  },
  {
    id: "ingredient",
    label: "Ingredients",
    icon: "🧪",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.1)",
  },
  {
    id: "packaging",
    label: "Packing",
    icon: "📦",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.1)",
  },
  {
    id: "delivery",
    label: "Traveling",
    icon: "🚚",
    color: "#d97706",
    bg: "rgba(217,119,6,0.1)",
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: "🔧",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.1)",
  },
  {
    id: "fixed",
    label: "Fixed Cost",
    icon: "🏠",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
  },
  {
    id: "other",
    label: "Other",
    icon: "📋",
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
  },
];

function isPersonal(categoryId: string) {
  return categoryId.startsWith("personal_");
}

const PAYER_OPTIONS = [
  { id: "unni_personal", label: "Unni · Personal", color: "#4f46e5" },
  { id: "amma_personal", label: "Amma · Personal", color: "#db2777" },
  { id: "company_other", label: "Company (Other)", color: "#d97706" },
  { id: "company_kochi", label: "Company (Kochi)", color: "#059669" },
] as const;

type PendingTxn = {
  tempId: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  paidBy: string | null;
};

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: V.card,
        border: `1px solid ${V.cardBorder}`,
        borderRadius: 20,
        boxShadow: V.shadow,
        backdropFilter: "blur(10px)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.9)",
  border: "1.5px solid rgba(99,60,180,0.15)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: "0.9rem",
  color: V.text,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box" as const,
};

type Mode = "choose" | "screenshot" | "manual";

export default function RecordExpensePage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [msg, setMsg] = useState("");

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

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
        <button
          onClick={() =>
            mode === "choose"
              ? (window.location.href = "/expenses")
              : setMode("choose")
          }
          style={{
            background: "transparent",
            border: "none",
            fontSize: "0.75rem",
            color: V.sub,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← {mode === "choose" ? "Expenses" : "Back"}
        </button>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 4 }}>
          ➕ Record Expense
        </h1>
      </div>

      {msg && (
        <div
          style={{ maxWidth: 640, margin: "10px auto 0", padding: "0 20px" }}
        >
          <div
            style={{
              background: "rgba(22,163,74,0.1)",
              border: "1px solid rgba(22,163,74,0.3)",
              color: V.green,
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {msg}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 20px" }}>
        {mode === "choose" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div
              onClick={() => setMode("screenshot")}
              style={{
                background: "linear-gradient(150deg, #60a5fa, #2563eb)",
                borderRadius: 22,
                padding: "32px 16px",
                color: "#fff",
                textAlign: "center" as const,
                cursor: "pointer",
                boxShadow: "0 10px 26px rgba(37,99,235,0.28)",
                minHeight: 180,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p style={{ fontSize: "2.2rem", marginBottom: 10 }}>📸</p>
              <p style={{ fontSize: "1rem", fontWeight: 800 }}>Screenshot</p>
              <p style={{ fontSize: "0.72rem", opacity: 0.85, marginTop: 4 }}>
                AI reads bank messages
              </p>
            </div>
            <div
              onClick={() => setMode("manual")}
              style={{
                background: "linear-gradient(150deg, #f472b6, #db2777)",
                borderRadius: 22,
                padding: "32px 16px",
                color: "#fff",
                textAlign: "center" as const,
                cursor: "pointer",
                boxShadow: "0 10px 26px rgba(219,39,119,0.28)",
                minHeight: 180,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p style={{ fontSize: "2.2rem", marginBottom: 10 }}>🏷️</p>
              <p style={{ fontSize: "1rem", fontWeight: 800 }}>
                Choose Category
              </p>
              <p style={{ fontSize: "0.72rem", opacity: 0.85, marginTop: 4 }}>
                Pick a category, enter the rate
              </p>
            </div>
          </div>
        )}

        {mode === "screenshot" && (
          <ScreenshotFlow
            onSaved={() => {
              flash("Saved ✓");
              setMode("choose");
            }}
          />
        )}
        {mode === "manual" && (
          <ManualFlow
            onSaved={() => {
              flash("Saved ✓");
              setMode("choose");
            }}
          />
        )}
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────
   Screenshot scan flow
──────────────────────────────────────────────────────────────── */
function ScreenshotFlow({ onSaved }: { onSaved: () => void }) {
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState<PendingTxn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    setPending([]);
    setError(null);
    setImages((prev) =>
      [
        ...prev,
        ...Array.from(files).map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        })),
      ].slice(0, 5),
    );
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
    setPending([]);
    setError(null);
    setProvider(null);
  }

  async function scan() {
    if (images.length === 0) return;
    setScanning(true);
    setError(null);
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
      const res = await fetch("/api/extract-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: encoded }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }
      const data = await res.json();
      const items = (data.items || []) as {
        description: string;
        amount: number;
        date: string;
      }[];
      if (items.length === 0)
        setError("No debit transactions found in these screenshots.");
      else {
        setPending(
          items.map((it, i) => ({
            tempId: `${Date.now()}-${i}`,
            description: it.description,
            amount: it.amount,
            date: it.date,
            category: null,
            paidBy: null,
          })),
        );
        setProvider(data._provider || null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setScanning(false);
    }
  }

  async function saveAll() {
    const ready = pending.filter((p) => p.category);
    if (ready.length === 0) return;
    await supabase
      .from("expenses")
      .insert(
        ready.map((p) => ({
          description: p.description,
          amount: p.amount,
          category: p.category,
          date: p.date,
          paid_by: p.paidBy,
          note: "Scanned from bank message",
        })),
      );
    reset();
    onSaved();
  }

  const catAll = [...PERSONAL_CATEGORIES, ...COMPANY_CATEGORIES];
  function catDef(id: string) {
    return catAll.find((c) => c.id === id)!;
  }

  return (
    <Card>
      {pending.length === 0 && (
        <>
          <div
            onClick={() => !scanning && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${scanning ? "rgba(99,60,180,0.4)" : "rgba(99,60,180,0.2)"}`,
              borderRadius: 14,
              padding: images.length > 0 ? "12px" : "28px 16px",
              textAlign: "center" as const,
              cursor: scanning ? "not-allowed" : "pointer",
              background: scanning
                ? "rgba(99,60,180,0.05)"
                : "rgba(255,255,255,0.4)",
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
                    fontSize: scanning ? "0.9rem" : "2rem",
                    marginBottom: 8,
                  }}
                >
                  {scanning ? "⏳" : "📸"}
                </p>
                <p
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: scanning ? V.indigo : V.sub,
                  }}
                >
                  {scanning
                    ? "Reading messages..."
                    : "Tap to upload screenshot(s)"}
                </p>
                <p
                  style={{ fontSize: "0.72rem", color: V.muted, marginTop: 4 }}
                >
                  Up to 5 at once
                </p>
              </>
            ) : (
              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}
              >
                {images.map((img, i) => (
                  <div key={i} style={{ position: "relative" as const }}>
                    <img
                      src={img.preview}
                      alt=""
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: "cover" as const,
                        borderRadius: 8,
                        border: "1px solid rgba(99,60,180,0.15)",
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
                        background: V.red,
                        border: "none",
                        color: "#fff",
                        fontSize: "0.6rem",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      border: "2px dashed rgba(99,60,180,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: V.muted,
                      fontSize: "1.3rem",
                    }}
                  >
                    +
                  </div>
                )}
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                disabled={scanning}
                onClick={scan}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 10,
                  border: "none",
                  background: scanning
                    ? "rgba(99,60,180,0.15)"
                    : "linear-gradient(135deg, #6366f1, #db2777)",
                  color: scanning ? V.indigo : "#fff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: scanning ? "not-allowed" : "pointer",
                }}
              >
                {scanning
                  ? "Scanning..."
                  : `Scan ${images.length} screenshot${images.length > 1 ? "s" : ""}`}
              </button>
              <button
                disabled={scanning}
                onClick={reset}
                style={{
                  padding: "11px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(99,60,180,0.15)",
                  background: "transparent",
                  color: V.sub,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          )}
          {error && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(225,29,72,0.06)",
                border: "1px solid rgba(225,29,72,0.2)",
              }}
            >
              <p style={{ fontSize: "0.8rem", color: V.red }}>{error}</p>
            </div>
          )}
        </>
      )}

      {pending.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <p style={{ fontSize: "0.82rem", fontWeight: 700, color: V.green }}>
              ✓ Found {pending.length} transaction
              {pending.length > 1 ? "s" : ""}
            </p>
            {provider && (
              <span style={{ fontSize: "0.65rem", color: V.muted }}>
                via {provider}
              </span>
            )}
          </div>
          {pending.map((p) => {
            const def = p.category ? catDef(p.category) : null;
            return (
              <div
                key={p.tempId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: def ? def.bg : "rgba(0,0,0,0.03)",
                  border: `1px solid ${def ? def.color + "35" : "rgba(0,0,0,0.06)"}`,
                  marginBottom: 8,
                }}
              >
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {p.description}
                  </p>
                  <p style={{ fontSize: "0.7rem", color: V.sub }}>
                    {p.date} · ₹{p.amount}
                    {def && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: def.color,
                          fontWeight: 700,
                        }}
                      >
                        {def.icon} {def.label}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setPickerFor(p.tempId)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: def
                      ? `${def.color}22`
                      : "linear-gradient(135deg, #6366f1, #db2777)",
                    color: def ? def.color : "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {def ? "Change" : "Categorise"}
                </button>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              disabled={!pending.some((p) => p.category)}
              onClick={saveAll}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 10,
                border: "none",
                background: pending.some((p) => p.category)
                  ? "linear-gradient(135deg, #34d399, #059669)"
                  : "rgba(0,0,0,0.06)",
                color: pending.some((p) => p.category) ? "#fff" : V.muted,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: pending.some((p) => p.category)
                  ? "pointer"
                  : "not-allowed",
              }}
            >
              ✓ Save Categorised
            </button>
            <button
              onClick={reset}
              style={{
                padding: "11px 16px",
                borderRadius: 10,
                border: "1px solid rgba(99,60,180,0.15)",
                background: "transparent",
                color: V.sub,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {pickerFor && (
        <CategoryPicker
          onClose={() => setPickerFor(null)}
          onPick={(category, paidBy) => {
            setPending((prev) =>
              prev.map((p) =>
                p.tempId === pickerFor ? { ...p, category, paidBy } : p,
              ),
            );
            setPickerFor(null);
          }}
        />
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────
   Manual flow — category first, then enter the rate
──────────────────────────────────────────────────────────────── */
function ManualFlow({ onSaved }: { onSaved: () => void }) {
  const [category, setCategory] = useState<string | null>(null);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(true);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const catAll = [...PERSONAL_CATEGORIES, ...COMPANY_CATEGORIES];
  const def = category ? catAll.find((c) => c.id === category) : null;

  async function save() {
    if (!category || !amount) return;
    setSaving(true);
    await supabase.from("expenses").insert({
      description: description.trim() || def?.label || "Expense",
      amount: Number(amount),
      category,
      date,
      paid_by: paidBy,
    });
    setSaving(false);
    onSaved();
  }

  if (showPicker) {
    return (
      <Card>
        <CategoryPickerInline
          onPick={(cat, pb) => {
            setCategory(cat);
            setPaidBy(pb);
            setShowPicker(false);
          }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          padding: "12px 14px",
          borderRadius: 12,
          background: def!.bg,
          border: `1px solid ${def!.color}35`,
        }}
      >
        <span style={{ fontSize: "1.6rem" }}>{def!.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, color: def!.color }}>{def!.label}</p>
          {paidBy && (
            <p style={{ fontSize: "0.7rem", color: V.sub }}>
              {PAYER_OPTIONS.find((p) => p.id === paidBy)?.label}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowPicker(true)}
          style={{
            background: "transparent",
            border: "none",
            color: V.sub,
            fontSize: "0.75rem",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Change
        </button>
      </div>

      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: V.sub,
          marginBottom: 5,
        }}
      >
        Rate / Amount ₹ *
      </p>
      <input
        style={{
          ...inputStyle,
          fontSize: "1.4rem",
          fontWeight: 800,
          textAlign: "center" as const,
          marginBottom: 12,
        }}
        type="number"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus
      />

      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: V.sub,
          marginBottom: 5,
        }}
      >
        Description
      </p>
      <input
        style={{ ...inputStyle, marginBottom: 12 }}
        placeholder={def!.label}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: V.sub,
          marginBottom: 5,
        }}
      >
        Date
      </p>
      <input
        style={{ ...inputStyle, marginBottom: 16 }}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <button
        disabled={saving || !amount}
        onClick={save}
        style={{
          width: "100%",
          padding: "13px",
          borderRadius: 12,
          border: "none",
          background: amount
            ? "linear-gradient(135deg, #34d399, #059669)"
            : "rgba(0,0,0,0.06)",
          color: amount ? "#fff" : V.muted,
          fontWeight: 700,
          fontSize: "0.9rem",
          cursor: amount ? "pointer" : "not-allowed",
        }}
      >
        {saving ? "Saving..." : "✓ Save Expense"}
      </button>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────
   Category picker — inline version (used by ManualFlow) and
   modal version (used by ScreenshotFlow, which sits inside a card
   already occupied by the pending-transactions list)
──────────────────────────────────────────────────────────────── */
function CategoryPickerInline({
  onPick,
}: {
  onPick: (category: string, paidBy: string | null) => void;
}) {
  const [group, setGroup] = useState<"personal" | "company" | null>(null);
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);

  if (chosenCategory) {
    return (
      <div>
        <button
          onClick={() => setChosenCategory(null)}
          style={{
            background: "transparent",
            border: "none",
            color: V.sub,
            fontSize: "0.78rem",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          ← Back
        </button>
        <p style={{ fontWeight: 800, marginBottom: 12 }}>Who paid for this?</p>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {PAYER_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(chosenCategory, p.id)}
              style={{
                padding: "14px 10px",
                borderRadius: 12,
                border: `1.5px solid ${p.color}40`,
                background: `${p.color}14`,
                color: p.color,
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div>
        <p style={{ fontWeight: 800, marginBottom: 14 }}>
          Personal or Company?
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setGroup("personal")}
            style={{
              flex: 1,
              padding: "22px 12px",
              borderRadius: 16,
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #4338ca)",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            🙋 Personal
          </button>
          <button
            onClick={() => setGroup("company")}
            style={{
              flex: 1,
              padding: "22px 12px",
              borderRadius: 16,
              border: "none",
              background: "linear-gradient(135deg, #fbbf24, #d97706)",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            🏢 Company
          </button>
        </div>
      </div>
    );
  }

  const options =
    group === "personal" ? PERSONAL_CATEGORIES : COMPANY_CATEGORIES;
  return (
    <div>
      <button
        onClick={() => setGroup(null)}
        style={{
          background: "transparent",
          border: "none",
          color: V.sub,
          fontSize: "0.78rem",
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        ← Back
      </button>
      <p style={{ fontWeight: 800, marginBottom: 14 }}>
        {group === "personal" ? "Personal category" : "Company category"}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {options.map((c) => (
          <button
            key={c.id}
            onClick={() =>
              isPersonal(c.id) ? onPick(c.id, null) : setChosenCategory(c.id)
            }
            style={{
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              gap: 6,
              padding: "16px 8px",
              borderRadius: 14,
              border: `1.5px solid ${c.color}35`,
              background: c.bg,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "1.6rem" }}>{c.icon}</span>
            <span
              style={{ fontSize: "0.8rem", fontWeight: 700, color: c.color }}
            >
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryPicker({
  onPick,
  onClose,
}: {
  onPick: (category: string, paidBy: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,20,50,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 600,
        padding: 20,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 4,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.1rem",
              cursor: "pointer",
              color: V.muted,
            }}
          >
            ✕
          </button>
        </div>
        <CategoryPickerInline onPick={onPick} />
      </Card>
    </div>
  );
}
