"use client";

import React, { useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize } from "@/lib/types";

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
};

const ALL_SLOTS = [
  "9–11 AM",
  "11–1 PM",
  "1–3 PM",
  "3–5 PM",
  "5–7 PM",
  "7–9 PM",
  "9–11 PM",
  "11 PM–12 AM",
];

const FLAVOUR_COLORS: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  strawberry: {
    bg: "#2a0d0d",
    border: "#791f1f",
    text: "#f09595",
    dot: "#e24b4a",
  },
  mango: { bg: "#271908", border: "#633806", text: "#fac775", dot: "#ef9f27" },
  blueberry: {
    bg: "#0e1230",
    border: "#26215c",
    text: "#afa9ec",
    dot: "#7f77dd",
  },
  kiwi: { bg: "#0e1e0e", border: "#173404", text: "#c0dd97", dot: "#639922" },
  lychee: { bg: "#280e1c", border: "#4b1528", text: "#ed93b1", dot: "#d4537e" },
  biscoff: {
    bg: "#271808",
    border: "#412402",
    text: "#fac775",
    dot: "#ba7517",
  },
  hazelnut: {
    bg: "#1e1006",
    border: "#412402",
    text: "#fac775",
    dot: "#854f0b",
  },
  chococrisp: {
    bg: "#150e06",
    border: "#2c1a06",
    text: "#d4a472",
    dot: "#85501e",
  },
  default: {
    bg: "#141e2e",
    border: "#2a3a50",
    text: "#a8b4cc",
    dot: "#6a7a90",
  },
};

function getFlavourColor(name: string) {
  const n = name.toLowerCase();
  for (const [key, val] of Object.entries(FLAVOUR_COLORS)) {
    if (n.includes(key)) return val;
  }
  return FLAVOUR_COLORS.default;
}

function Input({
  placeholder,
  value,
  onChange,
  type = "text",
  highlight = false,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  highlight?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box" as const,
        background: highlight ? "rgba(240,176,64,0.08)" : G.glass,
        border: `1px solid ${highlight ? G.goldBorder : G.glassBorder}`,
        color: G.text,
        padding: "11px 14px",
        borderRadius: 10,
        fontSize: "0.88rem",
        marginBottom: 8,
        outline: "none",
        fontFamily: "system-ui, sans-serif",
        transition: "border-color 0.2s",
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  highlight = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  highlight?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box" as const,
        background: highlight ? "rgba(240,176,64,0.08)" : G.glass,
        border: `1px solid ${highlight ? G.goldBorder : G.glassBorder}`,
        color: G.text,
        padding: "11px 14px",
        borderRadius: 10,
        fontSize: "0.88rem",
        marginBottom: 8,
        outline: "none",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#1a2535" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FieldLabel({
  label,
  filled,
  required = false,
}: {
  label: string;
  filled: boolean;
  required?: boolean;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}
    >
      <span
        style={{
          fontSize: "0.68rem",
          color: G.muted,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
        {required && " *"}
      </span>
      {filled ? (
        <span
          style={{
            fontSize: "0.6rem",
            padding: "1px 7px",
            borderRadius: 6,
            background: G.greenGlass,
            color: G.green,
            fontWeight: 700,
            border: "1px solid rgba(52,217,123,0.25)",
          }}
        >
          ✦ AI filled
        </span>
      ) : (
        <span
          style={{
            fontSize: "0.6rem",
            padding: "1px 7px",
            borderRadius: 6,
            background: G.goldGlass,
            color: G.gold,
            fontWeight: 700,
            border: `1px solid ${G.goldBorder}`,
          }}
        >
          ✎ Fill in
        </span>
      )}
    </div>
  );
}

type AIExtracted = {
  customer_name?: string;
  phone?: string;
  insta_id?: string;
  address?: string;
  delivery_date?: string;
  delivery_slot?: string;
  flavours?: Record<string, number>;
  box_label?: string;
  total_price?: number;
  remarks?: string;
  fulfillment_type?: "delivery" | "pickup";
};

type OrderForm = {
  customer_name: string;
  phone: string;
  insta_id: string;
  address: string;
  delivery_date: string;
  delivery_slot: string;
  total_price: string;
  box_size_id: string;
  remarks: string;
  fulfillment_type: "delivery" | "pickup";
  status: string;
  order_date: string;
};

type FilledFlags = Partial<Record<keyof OrderForm | "flavours", boolean>>;

export function SmartOrderModal({
  boxes,
  products,
  customers,
  onClose,
  onSaved,
}: {
  boxes: BoxSize[];
  products: Product[];
  customers: {
    name: string;
    phone: string;
    insta_id: string;
    remarks: string;
  }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [analysed, setAnalysed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<OrderForm>({
    customer_name: "",
    phone: "",
    insta_id: "",
    address: "",
    delivery_date: today,
    delivery_slot: "1–3 PM",
    total_price: "",
    box_size_id: "",
    remarks: "",
    fulfillment_type: "delivery",
    status: "confirmed",
    order_date: today,
  });
  const [flavours, setFlavours] = useState<Record<string, number>>({});
  const [filled, setFilled] = useState<FilledFlags>({});
  const [nameSuggestions, setNameSuggestions] = useState<typeof customers>([]);
  const [showSugg, setShowSugg] = useState(false);

  const f = (k: keyof OrderForm) => (v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  function addImages(files: FileList | null) {
    if (!files) return;
    setImages((prev) => [
      ...prev,
      ...Array.from(files).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
    setAnalysed(false);
    setError(null);
  }

  function removeImage(i: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, j) => j !== i);
    });
    setAnalysed(false);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addImages(e.dataTransfer.files);
  }, []);

  async function analyse() {
    if (images.length === 0) return;
    setAnalysing(true);
    setError(null);

    try {
      // Convert images to base64 for Gemini
      const imagePayload = await Promise.all(
        images.map(
          (img) =>
            new Promise<{ data: string; mimeType: string }>(
              (resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(img.file);
                reader.onload = () => {
                  resolve({
                    data: (reader.result as string).split(",")[1],
                    mimeType: img.file.type,
                  });
                };
                reader.onerror = reject;
              },
            ),
        ),
      );

      const availableProducts = products.filter((p) => p.is_available);

      const response = await fetch("/api/extract-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: imagePayload,
          slots: ALL_SLOTS,
          products: availableProducts.map((p) => ({ id: p.id, name: p.name })),
          boxes: boxes
            .filter((b) => b.is_active)
            .map((b) => ({ id: b.id, label: b.label, price: b.price })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "API error");
      }

      const extracted: AIExtracted = await response.json();

      const newForm = { ...form };
      const newFilled: FilledFlags = {};

      if (extracted.customer_name) {
        newForm.customer_name = extracted.customer_name;
        newFilled.customer_name = true;
      }
      if (extracted.phone) {
        newForm.phone = extracted.phone;
        newFilled.phone = true;
      }
      if (extracted.insta_id) {
        newForm.insta_id = extracted.insta_id;
        newFilled.insta_id = true;
      }
      if (extracted.address) {
        newForm.address = extracted.address;
        newFilled.address = true;
      }
      if (extracted.delivery_date) {
        newForm.delivery_date = extracted.delivery_date;
        newFilled.delivery_date = true;
      }
      if (
        extracted.delivery_slot &&
        ALL_SLOTS.includes(extracted.delivery_slot)
      ) {
        newForm.delivery_slot = extracted.delivery_slot;
        newFilled.delivery_slot = true;
      }
      if (extracted.total_price) {
        newForm.total_price = String(extracted.total_price);
        newFilled.total_price = true;
      }
      if (extracted.remarks) {
        newForm.remarks = extracted.remarks;
        newFilled.remarks = true;
      }
      if (extracted.fulfillment_type) {
        newForm.fulfillment_type = extracted.fulfillment_type;
        newFilled.fulfillment_type = true;
      }

      // Box: server matched price → box ID directly
      if ((extracted as any).box_size_id) {
        newForm.box_size_id = (extracted as any).box_size_id;
        newFilled.box_size_id = true;
      }

      // Flavours: server already mapped numbered indices → product IDs, use directly
      const newFlavours: Record<string, number> = {};
      if (extracted.flavours && Object.keys(extracted.flavours).length > 0) {
        Object.assign(newFlavours, extracted.flavours);
        newFilled.flavours = true;
      }

      setForm(newForm);
      setFlavours(newFlavours);
      setFilled(newFilled);
      setAnalysed(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analysis failed. Try again.",
      );
    } finally {
      setAnalysing(false);
    }
  }

  async function save() {
    if (!form.customer_name || !form.total_price) return;
    setSaving(true);
    try {
      await supabase.from("orders").insert({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        insta_id: form.insta_id.trim(),
        address: form.address.trim() || null,
        remarks: form.remarks.trim(),
        box_size_id: form.box_size_id || null,
        flavours: Object.keys(flavours).length > 0 ? flavours : {},
        delivery_date: form.delivery_date,
        delivery_slot: form.delivery_slot,
        payment_method: "upi",
        total_price: Number(form.total_price),
        status: form.status,
        source: "dm",
        order_date: form.order_date,
        fulfillment_type: form.fulfillment_type,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const missing: string[] = [];
  if (!form.customer_name) missing.push("Name");
  if (!form.total_price) missing.push("Price");
  if (!form.delivery_date) missing.push("Date");
  const canSave = missing.length === 0;

  return (
    <div
      style={{
        position: "fixed" as const,
        inset: 0,
        zIndex: 600,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: G.pageBg,
          border: `1px solid ${G.glassBorderStrong}`,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 900,
          maxHeight: "93vh",
          overflowY: "auto" as const,
          paddingBottom: 32,
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky" as const,
            top: 0,
            zIndex: 10,
            background: G.pageBg,
            borderBottom: `1px solid ${G.glassBorder}`,
            padding: "16px 18px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: G.text,
                letterSpacing: "-0.02em",
              }}
            >
              📸 Smart Order
            </p>
            <p style={{ fontSize: "0.72rem", color: G.muted, marginTop: 2 }}>
              Upload screenshots · AI fills the form · you confirm
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: G.glass,
              border: `1px solid ${G.glassBorder}`,
              color: G.muted,
              width: 34,
              height: 34,
              borderRadius: 10,
              cursor: "pointer",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "16px 18px" }}>
          {/* Upload zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !analysing && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${images.length > 0 ? "rgba(96,165,250,0.4)" : G.glassBorder}`,
              borderRadius: 14,
              padding: images.length > 0 ? "12px" : "28px 16px",
              textAlign: "center" as const,
              cursor: analysing ? "not-allowed" : "pointer",
              background: images.length > 0 ? G.blueGlass : G.glass,
              transition: "all 0.2s",
              marginBottom: 14,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addImages(e.target.files)}
              disabled={analysing}
            />

            {images.length === 0 ? (
              <>
                <p style={{ fontSize: "2.2rem", marginBottom: 8 }}>📱</p>
                <p
                  style={{ fontSize: "0.9rem", fontWeight: 700, color: G.sub }}
                >
                  Tap to upload screenshots
                </p>
                <p
                  style={{ fontSize: "0.72rem", color: G.muted, marginTop: 4 }}
                >
                  DMs · WhatsApp · Instagram — multiple files supported
                </p>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap" as const,
                    marginBottom: 10,
                  }}
                >
                  {images.map((img, i) => (
                    <div
                      key={i}
                      style={{ position: "relative" as const, flexShrink: 0 }}
                    >
                      <img
                        src={img.preview}
                        alt={`ss-${i}`}
                        style={{
                          width: 72,
                          height: 72,
                          objectFit: "cover" as const,
                          borderRadius: 9,
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
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: G.red,
                          border: "none",
                          color: "#fff",
                          fontSize: "0.65rem",
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
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 9,
                      border: `2px dashed ${G.glassBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: G.muted,
                      fontSize: "1.5rem",
                      flexShrink: 0,
                    }}
                  >
                    +
                  </div>
                </div>
                <p style={{ fontSize: "0.72rem", color: G.blue }}>
                  {images.length} screenshot{images.length > 1 ? "s" : ""} · tap
                  to add more
                </p>
              </>
            )}
          </div>

          {/* Analyse button */}
          {images.length > 0 && !analysed && (
            <button
              disabled={analysing}
              onClick={analyse}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                border: "none",
                marginBottom: 16,
                background: analysing
                  ? "rgba(167,139,250,0.1)"
                  : "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(96,165,250,0.2))",
                color: analysing ? G.purple : "#e0d4ff",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: analysing ? "not-allowed" : "pointer",
                fontFamily: "system-ui, sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow: analysing
                  ? "none"
                  : "0 0 24px rgba(167,139,250,0.18)",
                transition: "all 0.2s",
              }}
            >
              {analysing ? (
                <>
                  <span
                    style={{
                      animation: "spin 1s linear infinite",
                      display: "inline-block",
                    }}
                  >
                    ⏳
                  </span>{" "}
                  Reading screenshots with AI…
                </>
              ) : (
                <>✦ Analyse Screenshots</>
              )}
            </button>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: G.redGlass,
                border: "1px solid rgba(255,92,108,0.3)",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 14,
              }}
            >
              <p style={{ fontSize: "0.82rem", color: G.red }}>⚠ {error}</p>
            </div>
          )}

          {/* Success banner */}
          {analysed && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(52,217,123,0.08), rgba(96,165,250,0.08))",
                border: "1px solid rgba(52,217,123,0.25)",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>✦</span>
              <div>
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: G.green,
                  }}
                >
                  AI filled {Object.values(filled).filter(Boolean).length}{" "}
                  fields
                </p>
                <p style={{ fontSize: "0.7rem", color: G.muted, marginTop: 2 }}>
                  {missing.length > 0
                    ? `Still needed: ${missing.join(", ")}`
                    : "All required fields filled — review and confirm."}
                </p>
              </div>
            </div>
          )}

          {/* Order form */}
          <div
            style={{
              background: G.glassStrong,
              border: `1px solid ${G.glassBorderStrong}`,
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                color: G.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 16,
                fontWeight: 700,
              }}
            >
              Order Details
            </p>

            <FieldLabel
              label="Customer Name"
              filled={!!filled.customer_name}
              required
            />
            <div style={{ position: "relative" as const }}>
              <Input
                placeholder="Customer Name"
                value={form.customer_name}
                onChange={(v) => {
                  f("customer_name")(v);
                  if (v.length >= 1) {
                    const matches = customers.filter((c) =>
                      c.name.toLowerCase().startsWith(v.toLowerCase()),
                    );
                    setNameSuggestions(matches.slice(0, 5));
                    setShowSugg(matches.length > 0);
                  } else setShowSugg(false);
                }}
                highlight={analysed && !filled.customer_name}
              />
              {showSugg && (
                <div
                  style={{
                    position: "absolute" as const,
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "rgba(10,16,26,0.97)",
                    border: `1px solid ${G.glassBorderStrong}`,
                    borderRadius: 10,
                    zIndex: 200,
                    marginTop: -6,
                    overflow: "hidden",
                  }}
                >
                  {nameSuggestions.map((c, i) => (
                    <div
                      key={i}
                      onMouseDown={() => {
                        setForm((p) => ({
                          ...p,
                          customer_name: c.name,
                          phone: c.phone || p.phone,
                          insta_id: c.insta_id || p.insta_id,
                          remarks: c.remarks || p.remarks,
                        }));
                        setShowSugg(false);
                      }}
                      style={{
                        padding: "9px 12px",
                        cursor: "pointer",
                        borderBottom:
                          i < nameSuggestions.length - 1
                            ? `1px solid ${G.glassBorder}`
                            : "none",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 600,
                          color: G.text,
                        }}
                      >
                        {c.name}
                      </p>
                      {c.phone && (
                        <p style={{ fontSize: "0.72rem", color: G.muted }}>
                          📞 {c.phone}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 8px",
              }}
            >
              <div>
                <FieldLabel label="Phone" filled={!!filled.phone} />
                <Input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={f("phone")}
                  highlight={analysed && !filled.phone}
                />
              </div>
              <div>
                <FieldLabel label="Instagram" filled={!!filled.insta_id} />
                <Input
                  placeholder="@handle"
                  value={form.insta_id}
                  onChange={f("insta_id")}
                  highlight={analysed && !filled.insta_id}
                />
              </div>
            </div>

            <FieldLabel
              label="Address (essentials only)"
              filled={!!filled.address}
            />
            <Input
              placeholder="Flat / Bldg / Landmark"
              value={form.address}
              onChange={f("address")}
              highlight={analysed && !filled.address}
            />
            {analysed && filled.address && (
              <p
                style={{
                  fontSize: "0.65rem",
                  color: G.muted,
                  marginTop: -6,
                  marginBottom: 8,
                  fontStyle: "italic" as const,
                }}
              >
                AI trimmed to essentials · edit if needed
              </p>
            )}

            <FieldLabel
              label="Fulfillment"
              filled={!!filled.fulfillment_type}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {(["delivery", "pickup"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    setForm((p) => ({ ...p, fulfillment_type: type }))
                  }
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 9,
                    fontFamily: "system-ui, sans-serif",
                    border: `1px solid ${form.fulfillment_type === type ? "rgba(96,165,250,0.5)" : G.glassBorder}`,
                    background:
                      form.fulfillment_type === type ? G.blueGlass : G.glass,
                    color: form.fulfillment_type === type ? G.blue : G.sub,
                    fontSize: "0.8rem",
                    fontWeight: form.fulfillment_type === type ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {type === "delivery" ? "🚚 Delivery" : "🏠 Pickup"}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 8px",
              }}
            >
              <div>
                <FieldLabel
                  label="Delivery Date"
                  filled={!!filled.delivery_date}
                  required
                />
                <Input
                  type="date"
                  placeholder="Date"
                  value={form.delivery_date}
                  onChange={f("delivery_date")}
                  highlight={analysed && !filled.delivery_date}
                />
              </div>
              <div>
                <FieldLabel label="Time Slot" filled={!!filled.delivery_slot} />
                <Select
                  value={form.delivery_slot}
                  onChange={f("delivery_slot")}
                  options={ALL_SLOTS.map((s) => ({ value: s, label: s }))}
                  highlight={analysed && !filled.delivery_slot}
                />
              </div>
            </div>

            <FieldLabel label="Box Size" filled={!!filled.box_size_id} />
            <Select
              value={form.box_size_id}
              onChange={f("box_size_id")}
              options={[
                { value: "", label: "Select box" },
                ...boxes
                  .filter((b) => b.is_active)
                  .map((b) => ({
                    value: b.id,
                    label: `${b.label} — ₹${b.price}`,
                  })),
              ]}
              highlight={analysed && !filled.box_size_id}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0 8px",
              }}
            >
              <div>
                <FieldLabel
                  label="Total Price"
                  filled={!!filled.total_price}
                  required
                />
                <Input
                  type="number"
                  placeholder="₹"
                  value={form.total_price}
                  onChange={f("total_price")}
                  highlight={analysed && !filled.total_price}
                />
              </div>
              <div>
                <FieldLabel label="Status" filled />
                <Select
                  value={form.status}
                  onChange={f("status")}
                  options={[
                    { value: "pending", label: "Pending Payment" },
                    { value: "confirmed", label: "Confirmed" },
                  ]}
                />
              </div>
            </div>

            <FieldLabel label="Remarks" filled={!!filled.remarks} />
            <Input
              placeholder="Allergies, special requests…"
              value={form.remarks}
              onChange={f("remarks")}
              highlight={analysed && !filled.remarks}
            />
          </div>

          {/* Flavours */}
          {products.filter((p) => p.is_available).length > 0 && (
            <div
              style={{
                background: G.glassStrong,
                border: `1px solid ${analysed && !filled.flavours ? G.goldBorder : G.glassBorderStrong}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    color: G.muted,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    fontWeight: 700,
                  }}
                >
                  🍡 Flavours
                </p>
                {analysed &&
                  (filled.flavours ? (
                    <span
                      style={{
                        fontSize: "0.6rem",
                        padding: "1px 7px",
                        borderRadius: 6,
                        background: G.greenGlass,
                        color: G.green,
                        fontWeight: 700,
                        border: "1px solid rgba(52,217,123,0.25)",
                      }}
                    >
                      ✦ AI filled
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "0.6rem",
                        padding: "1px 7px",
                        borderRadius: 6,
                        background: G.goldGlass,
                        color: G.gold,
                        fontWeight: 700,
                        border: `1px solid ${G.goldBorder}`,
                      }}
                    >
                      ✎ Fill in
                    </span>
                  ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                }}
              >
                {products
                  .filter((p) => p.is_available)
                  .map((prod) => {
                    const qty = flavours[prod.id] || 0;
                    const c = getFlavourColor(prod.name);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => {
                          const n = { ...flavours };
                          if (!n[prod.id]) n[prod.id] = 1;
                          else delete n[prod.id];
                          setFlavours(n);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: 9,
                          border: `1px solid ${qty > 0 ? c.border : G.glassBorder}`,
                          background: qty > 0 ? c.bg : G.glass,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {qty > 0 && (
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: c.dot,
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: qty > 0 ? 600 : 400,
                              color: qty > 0 ? c.text : G.sub,
                            }}
                          >
                            {prod.name}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              const n = { ...flavours };
                              if ((n[prod.id] || 0) > 1) n[prod.id]--;
                              else delete n[prod.id];
                              setFlavours(n);
                            }}
                            disabled={qty === 0}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 4,
                              border: `1px solid ${G.glassBorder}`,
                              background: G.glass,
                              color: G.sub,
                              cursor: qty === 0 ? "not-allowed" : "pointer",
                              opacity: qty === 0 ? 0.3 : 1,
                              fontSize: "0.9rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              minWidth: 14,
                              textAlign: "center" as const,
                              color: G.text,
                            }}
                          >
                            {qty}
                          </span>
                          <button
                            onClick={() =>
                              setFlavours((n) => ({
                                ...n,
                                [prod.id]: (n[prod.id] || 0) + 1,
                              }))
                            }
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 4,
                              border: "1px solid rgba(96,165,250,0.4)",
                              background: G.blueGlass,
                              color: G.blue,
                              cursor: "pointer",
                              fontSize: "0.9rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Missing warning */}
          {analysed && missing.length > 0 && (
            <div
              style={{
                background: G.goldGlass,
                border: `1px solid ${G.goldBorder}`,
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 14,
              }}
            >
              <p
                style={{ fontSize: "0.82rem", color: G.gold, fontWeight: 600 }}
              >
                ✎ Please fill in: {missing.join(", ")}
              </p>
            </div>
          )}

          {/* Save CTA */}
          <button
            disabled={saving || !canSave || !analysed}
            onClick={save}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 13,
              border: "none",
              fontSize: "1rem",
              fontWeight: 800,
              fontFamily: "system-ui, sans-serif",
              cursor:
                saving || !canSave || !analysed ? "not-allowed" : "pointer",
              background:
                saving || !canSave || !analysed
                  ? G.glass
                  : "linear-gradient(135deg, rgba(52,217,123,0.3), rgba(96,165,250,0.25))",
              color: saving || !canSave || !analysed ? G.muted : G.green,
              boxShadow:
                saving || !canSave || !analysed
                  ? "none"
                  : "0 0 28px rgba(52,217,123,0.15)",
              transition: "all 0.2s",
              letterSpacing: "-0.01em",
            }}
          >
            {saving
              ? "Saving…"
              : !analysed
                ? "Analyse screenshots first"
                : !canSave
                  ? `Fill in: ${missing.join(", ")}`
                  : `✓ Add Order · ₹${Number(form.total_price).toLocaleString()}`}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function SmartOrderNavBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 9,
        border: "1px solid rgba(167,139,250,0.45)",
        background: "rgba(167,139,250,0.12)",
        color: "#c4b5fd",
        fontSize: "1.2rem",
        cursor: "pointer",
      }}
    >
      📸
    </button>
  );
}
