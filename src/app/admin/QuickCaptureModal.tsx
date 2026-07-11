"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ExpenseScanner } from "./_components/ExpenseScanner";

const G = {
  pageBg: "#0d1520",
  glass: "rgba(255,255,255,0.035)",
  glassStrong: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderStrong: "rgba(255,255,255,0.14)",
  text: "#f0f4ff",
  sub: "#a8b4cc",
  muted: "#5a6a80",
  gold: "#f0b040",
  goldGlass: "rgba(240,176,64,0.13)",
  goldBorder: "rgba(240,176,64,0.35)",
  green: "#34d97b",
  greenGlass: "rgba(52,217,123,0.1)",
  red: "#ff5c6c",
  redGlass: "rgba(255,92,108,0.1)",
  blue: "#60a5fa",
  blueGlass: "rgba(96,165,250,0.1)",
  purple: "#a78bfa",
  purpleGlass: "rgba(167,139,250,0.1)",
};

type MainCat = "personal" | "business";
type SubCat = "food" | "travel" | "rent" | "emi" | "clothes" | "marketing";

const SUBCATS: { id: SubCat; label: string; icon: string }[] = [
  { id: "food", label: "Food", icon: "🍽️" },
  { id: "travel", label: "Travel", icon: "🚗" },
  { id: "rent", label: "Rent", icon: "🏠" },
  { id: "emi", label: "EMI", icon: "💳" },
  { id: "clothes", label: "Clothes", icon: "👕" },
  { id: "marketing", label: "Marketing", icon: "📣" },
];

type Step =
  | "choose"
  | "expense-mode"
  | "photo"
  | "keypad"
  | "main-cat"
  | "sub-cat"
  | "saved";

export function QuickCaptureModal({
  onClose,
  onOrderSelected,
  onSaved,
}: {
  onClose: () => void;
  onOrderSelected: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [amount, setAmount] = useState("");
  const [mainCat, setMainCat] = useState<MainCat | null>(null);
  const [subCat, setSubCat] = useState<SubCat | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function pressDigit(d: string) {
    setAmount((a) => {
      if (d === "." && a.includes(".")) return a;
      if (a === "0" && d !== ".") return d;
      if (a.length >= 9) return a;
      return a + d;
    });
  }
  function backspace() {
    setAmount((a) => a.slice(0, -1));
  }

  async function save() {
    if (!amount || Number(amount) <= 0 || !mainCat || !subCat) return;
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const subLabel = SUBCATS.find((s) => s.id === subCat)?.label || subCat;
    const { error } = await supabase.from("expenses").insert({
      description: description.trim() || `${subLabel} (${mainCat})`,
      amount: Number(amount),
      category: `${mainCat}_${subCat}`,
      date: today,
      note: mainCat === "personal" ? "Personal" : "Business",
    });
    setSaving(false);
    if (!error) {
      setStep("saved");
      onSaved();
      setTimeout(onClose, 1100);
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 800,
    background: "rgba(4,6,10,0.72)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  };

  const sheet: React.CSSProperties = {
    background: "linear-gradient(180deg, #121b2b 0%, #0c121e 100%)",
    border: `1px solid ${G.glassBorderStrong}`,
    boxShadow: "0 -12px 48px rgba(0,0,0,0.5)",
    borderRadius: "24px 24px 0 0",
    width: "100%",
    maxWidth: 480,
    maxHeight: "92vh",
    overflowY: "auto" as const,
  };

  function Header({
    eyebrow,
    title,
    onBack,
  }: {
    eyebrow?: string;
    title: string;
    onBack?: () => void;
  }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 20px 16px",
          borderBottom: `1px solid ${G.glassBorder}`,
          position: "sticky" as const,
          top: 0,
          background: "rgba(12,18,30,0.92)",
          backdropFilter: "blur(8px)",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: G.glassStrong,
                border: `1px solid ${G.glassBorder}`,
                color: G.sub,
                width: 34,
                height: 34,
                borderRadius: 10,
                cursor: "pointer",
                fontSize: "1rem",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ←
            </button>
          )}
          <div>
            {eyebrow && (
              <p
                style={{
                  fontSize: "0.62rem",
                  color: G.gold,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                {eyebrow}
              </p>
            )}
            <p style={{ fontSize: "1.08rem", fontWeight: 800, color: G.text }}>
              {title}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: G.glassStrong,
            border: `1px solid ${G.glassBorder}`,
            color: G.muted,
            width: 34,
            height: 34,
            borderRadius: 10,
            cursor: "pointer",
            fontSize: "1rem",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  function OptionCard({
    icon,
    iconBg,
    iconBorder,
    label,
    sub,
    accent,
    onClick,
  }: {
    icon: string;
    iconBg: string;
    iconBorder: string;
    label: string;
    sub: string;
    accent: string;
    onClick: () => void;
  }) {
    return (
      <button
        onClick={onClick}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px",
          borderRadius: 16,
          border: `1px solid ${G.glassBorder}`,
          background: G.glassStrong,
          cursor: "pointer",
          marginBottom: 12,
          fontFamily: "system-ui, sans-serif",
          textAlign: "left" as const,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: iconBg,
            border: `1px solid ${iconBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: G.text }}>
            {label}
          </p>
          <p style={{ fontSize: "0.78rem", color: G.muted, marginTop: 3 }}>
            {sub}
          </p>
        </div>
        <span style={{ fontSize: "1.1rem", color: accent, flexShrink: 0 }}>
          →
        </span>
      </button>
    );
  }

  return (
    <div
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={sheet}>
        {step === "choose" && (
          <>
            <Header eyebrow="Quick Capture" title="What are you logging?" />
            <div style={{ padding: "20px 18px 28px" }}>
              <OptionCard
                icon="📦"
                iconBg="rgba(96,165,250,0.14)"
                iconBorder="rgba(96,165,250,0.35)"
                label="Record an Order"
                sub="Add a new customer order"
                accent={G.blue}
                onClick={() => {
                  onClose();
                  onOrderSelected();
                }}
              />
              <OptionCard
                icon="💵"
                iconBg="rgba(240,176,64,0.14)"
                iconBorder="rgba(240,176,64,0.4)"
                label="Record an Expense"
                sub="Scan a bill or type an amount"
                accent={G.gold}
                onClick={() => setStep("expense-mode")}
              />
            </div>
          </>
        )}

        {step === "expense-mode" && (
          <>
            <Header
              eyebrow="Expense"
              title="How do you want to add it?"
              onBack={() => setStep("choose")}
            />
            <div style={{ padding: "20px 18px 28px" }}>
              <OptionCard
                icon="📸"
                iconBg="rgba(167,139,250,0.14)"
                iconBorder="rgba(167,139,250,0.4)"
                label="Attach a Photo"
                sub="Scan a bill — AI extracts the items"
                accent={G.purple}
                onClick={() => setStep("photo")}
              />
              <OptionCard
                icon="🔢"
                iconBg="rgba(52,217,123,0.14)"
                iconBorder="rgba(52,217,123,0.4)"
                label="Type Amount"
                sub="Enter amount and pick a category"
                accent={G.green}
                onClick={() => setStep("keypad")}
              />
            </div>
          </>
        )}

        {step === "photo" && (
          <>
            <Header
              eyebrow="Expense"
              title="Scan a Bill"
              onBack={() => setStep("expense-mode")}
            />
            <div style={{ padding: "20px 18px 28px" }}>
              <ExpenseScanner
                onDataExtracted={async (items) => {
                  const today = new Date().toISOString().split("T")[0];
                  const rows = (items as any[])
                    .filter((i) => i.description && Number(i.amount) > 0)
                    .map((i) => ({
                      description: String(i.description).trim(),
                      amount: Number(i.amount),
                      category: i.category || "other",
                      date: today,
                      note: "AI Scanned Bill",
                    }));
                  if (rows.length > 0) {
                    await supabase.from("expenses").insert(rows);
                  }
                  setStep("saved");
                  onSaved();
                  setTimeout(onClose, 1100);
                }}
              />
            </div>
          </>
        )}

        {step === "keypad" && (
          <>
            <Header
              eyebrow="Expense"
              title="Enter Amount"
              onBack={() => setStep("expense-mode")}
            />
            <div style={{ padding: "24px 20px 28px" }}>
              <div
                style={{ textAlign: "center" as const, padding: "8px 0 28px" }}
              >
                <p
                  style={{
                    fontSize: "0.68rem",
                    color: G.muted,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Amount
                </p>
                <p
                  style={{
                    fontSize: "3rem",
                    fontWeight: 800,
                    color: amount ? G.gold : G.muted,
                    fontFamily: "system-ui, sans-serif",
                    lineHeight: 1,
                  }}
                >
                  ₹{amount || "0"}
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  ".",
                  "0",
                  "⌫",
                ].map((k) => (
                  <button
                    key={k}
                    onClick={() => (k === "⌫" ? backspace() : pressDigit(k))}
                    style={{
                      padding: "20px 0",
                      borderRadius: 14,
                      border: `1px solid ${G.glassBorder}`,
                      background: k === "⌫" ? G.redGlass : G.glassStrong,
                      color: k === "⌫" ? G.red : G.text,
                      fontSize: "1.4rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                disabled={!amount || Number(amount) <= 0}
                onClick={() => setStep("main-cat")}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: 14,
                  border: "none",
                  background:
                    amount && Number(amount) > 0
                      ? "linear-gradient(135deg, rgba(240,176,64,0.9), rgba(180,130,40,0.8))"
                      : G.glass,
                  color: amount && Number(amount) > 0 ? "#160c08" : G.muted,
                  fontSize: "0.98rem",
                  fontWeight: 700,
                  cursor:
                    amount && Number(amount) > 0 ? "pointer" : "not-allowed",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                Next: Choose Category →
              </button>
            </div>
          </>
        )}

        {step === "main-cat" && (
          <>
            <Header
              eyebrow={`₹${amount}`}
              title="Personal or Business?"
              onBack={() => setStep("keypad")}
            />
            <div style={{ padding: "20px 18px 28px" }}>
              <OptionCard
                icon="🙋"
                iconBg="rgba(96,165,250,0.14)"
                iconBorder="rgba(96,165,250,0.35)"
                label="Personal"
                sub="Your own personal spending"
                accent={G.blue}
                onClick={() => {
                  setMainCat("personal");
                  setStep("sub-cat");
                }}
              />
              <OptionCard
                icon="🏢"
                iconBg="rgba(240,176,64,0.14)"
                iconBorder="rgba(240,176,64,0.4)"
                label="Business"
                sub="Eversweet business expense"
                accent={G.gold}
                onClick={() => {
                  setMainCat("business");
                  setStep("sub-cat");
                }}
              />
            </div>
          </>
        )}

        {step === "sub-cat" && (
          <>
            <Header
              eyebrow={`₹${amount} · ${mainCat === "personal" ? "Personal" : "Business"}`}
              title="Pick a Category"
              onBack={() => setStep("main-cat")}
            />
            <div style={{ padding: "20px 18px 28px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                {SUBCATS.map((s) => {
                  const active = subCat === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSubCat(s.id)}
                      style={{
                        padding: "18px 10px",
                        borderRadius: 14,
                        border: `1px solid ${active ? G.goldBorder : G.glassBorder}`,
                        background: active ? G.goldGlass : G.glassStrong,
                        color: active ? G.gold : G.sub,
                        cursor: "pointer",
                        fontFamily: "system-ui, sans-serif",
                        textAlign: "center" as const,
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>
                        {s.icon}
                      </div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                        {s.label}
                      </div>
                    </button>
                  );
                })}
              </div>
              <input
                placeholder="Note (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  background: G.glass,
                  border: `1px solid ${G.glassBorder}`,
                  color: G.text,
                  padding: "13px 14px",
                  borderRadius: 12,
                  fontSize: "0.9rem",
                  marginBottom: 16,
                  outline: "none",
                  fontFamily: "system-ui, sans-serif",
                  boxSizing: "border-box" as const,
                }}
              />
              <button
                disabled={!subCat || saving}
                onClick={save}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: 14,
                  border: "none",
                  background: subCat
                    ? "linear-gradient(135deg, rgba(52,217,123,0.9), rgba(30,160,90,0.85))"
                    : G.glass,
                  color: subCat ? "#062713" : G.muted,
                  fontSize: "0.98rem",
                  fontWeight: 700,
                  cursor: subCat ? "pointer" : "not-allowed",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {saving ? "Saving…" : `✓ Save Expense · ₹${amount}`}
              </button>
            </div>
          </>
        )}

        {step === "saved" && (
          <div style={{ padding: "56px 24px", textAlign: "center" as const }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: G.greenGlass,
                border: `1.5px solid rgba(52,217,123,0.4)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
                margin: "0 auto 16px",
                color: G.green,
              }}
            >
              ✓
            </div>
            <p style={{ fontSize: "1.05rem", fontWeight: 700, color: G.green }}>
              Saved!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function QuickCaptureNavBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:
          "linear-gradient(135deg, rgba(240,176,64,0.22), rgba(240,176,64,0.1))",
        border: `1px solid ${G.goldBorder}`,
        color: G.gold,
        width: 34,
        height: 34,
        borderRadius: 10,
        cursor: "pointer",
        fontSize: "1.05rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      ⚡
    </button>
  );
}
