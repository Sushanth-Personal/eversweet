"use client";
import React, { useState } from "react";
import { G } from "../_lib/theme";

export function GlassInput({
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        background: G.glass,
        border: `1px solid ${G.glassBorder}`,
        color: G.text,
        padding: "11px 14px",
        borderRadius: 10,
        fontSize: "0.9rem",
        marginBottom: 8,
        outline: "none",
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box" as const,
      }}
    />
  );
}

export function GlassBtn({
  children,
  onClick,
  variant = "default",
  disabled = false,
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "success" | "gold";
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: G.glass, color: G.sub, border: `1px solid ${G.glassBorder}` },
    primary: { background: G.blueGlass, color: G.blue, border: `1px solid rgba(96,165,250,0.35)` },
    danger: { background: G.redGlass, color: G.red, border: `1px solid rgba(255,92,108,0.3)` },
    success: { background: G.greenGlass, color: G.green, border: `1px solid rgba(52,217,123,0.3)` },
    gold: { background: G.goldGlass, color: G.gold, border: `1px solid ${G.goldBorder}` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "7px 16px",
        borderRadius: 8,
        fontSize: "0.8rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s",
        fontFamily: "system-ui, sans-serif",
        whiteSpace: "nowrap" as const,
        width: fullWidth ? "100%" : undefined,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

export function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        if (!value) return;
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      style={{
        padding: "3px 9px",
        borderRadius: 6,
        flexShrink: 0,
        border: `1px solid ${copied ? G.green + "50" : G.glassBorder}`,
        background: copied ? G.greenGlass : G.glass,
        color: copied ? G.green : G.muted,
        fontSize: "0.68rem",
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ Copied" : `Copy ${label}`}
    </button>
  );
}

export function GlassStatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ fontSize: "0.62rem", color: G.muted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: "1.6rem", fontWeight: 700, color: color || G.text, lineHeight: 1, marginBottom: 3 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "0.7rem", color: G.muted }}>{sub}</p>}
    </div>
  );
}
