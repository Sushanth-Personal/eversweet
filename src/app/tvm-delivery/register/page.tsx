// Location: src/app/tvm-delivery/register/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

function fmtDate(d: string) {
  if (!d) return "";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return d;
  }
}

export default function TvmDeliveryRegisterPage() {
  const [tripDate, setTripDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("trivandrum_settings")
        .select("trip_date")
        .single();
      setTripDate(data?.trip_date || "");
      setLoading(false);
    }
    load();
  }, []);

  function f(k: keyof typeof form) {
    return (v: string) => setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    setError("");
    if (!form.customer_name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Please enter a phone number so the porter can reach you.");
      return;
    }
    if (!form.address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }
    setSaving(true);
    try {
      // Figure out the next sequence number among existing stops for this trip
      const { data: existing } = await supabase
        .from("tvm_delivery_stops")
        .select("sequence")
        .eq("trip_date", tripDate)
        .order("sequence", { ascending: false })
        .limit(1);
      const nextSeq =
        existing && existing.length > 0 ? existing[0].sequence + 1 : 1;

      const { error: insertErr } = await supabase
        .from("tvm_delivery_stops")
        .insert({
          trip_date: tripDate,
          sequence: nextSeq,
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          notes: form.notes.trim() || null,
          maps_url: null,
          distance_km: 0,
          status: "pending",
        });
      if (insertErr) throw insertErr;
      setDone(true);
    } catch (e) {
      setError("Something went wrong saving your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.12)",
    color: "#1a1a1a",
    padding: "12px 14px",
    borderRadius: 10,
    fontSize: "0.9rem",
    marginBottom: 10,
    outline: "none",
    fontFamily: "system-ui, sans-serif",
    boxSizing: "border-box" as const,
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <p style={{ color: "#8a8a8a", fontSize: "0.85rem" }}>Loading…</p>
      </main>
    );
  }

  if (!tripDate) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "2rem", marginBottom: 12 }}>📅</p>
        <p style={{ fontSize: "0.9rem", color: "#4a4a4a", maxWidth: 320 }}>
          No Trivandrum trip is scheduled right now. Please check back once a
          delivery date is announced.
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "2.4rem", marginBottom: 12 }}>✅</p>
        <p
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#1a1a1a",
            marginBottom: 8,
          }}
        >
          Thanks, {form.customer_name.split(" ")[0]}!
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#6b6b6b",
            maxWidth: 320,
            lineHeight: 1.7,
          }}
        >
          Your delivery details are saved for the {fmtDate(tripDate)} run. The
          porter will call you before arriving.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#1a1a1a",
      }}
    >
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&display=swap');
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          input::placeholder,textarea::placeholder{color:rgba(0,0,0,0.35)}`,
        }}
      />
      <div
        style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px 60px" }}
      >
        <p
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "2rem",
            fontWeight: 500,
            marginBottom: 4,
          }}
        >
          Ever<em style={{ color: "#ff7a1a", fontStyle: "normal" }}>sweet</em>
        </p>
        <p style={{ fontSize: "0.78rem", color: "#8a8a8a", marginBottom: 4 }}>
          Trivandrum Delivery — {fmtDate(tripDate)}
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#4a4a4a",
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          Add your delivery details below so our porter can find and reach you
          on the day.
        </p>

        <label
          style={{
            fontSize: "0.68rem",
            color: "#8a8a8a",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 4,
            display: "block",
          }}
        >
          Full Name *
        </label>
        <input
          style={inputStyle}
          placeholder="Your name"
          value={form.customer_name}
          onChange={(e) => f("customer_name")(e.target.value)}
        />

        <label
          style={{
            fontSize: "0.68rem",
            color: "#8a8a8a",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 4,
            display: "block",
          }}
        >
          Phone Number *
        </label>
        <input
          style={inputStyle}
          type="tel"
          placeholder="Phone the porter can call"
          value={form.phone}
          onChange={(e) => f("phone")(e.target.value)}
        />

        <label
          style={{
            fontSize: "0.68rem",
            color: "#8a8a8a",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 4,
            display: "block",
          }}
        >
          Delivery Address *
        </label>
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: "vertical" as const }}
          placeholder="Flat / house name, street, landmark, area"
          value={form.address}
          onChange={(e) => f("address")(e.target.value)}
        />

        <label
          style={{
            fontSize: "0.68rem",
            color: "#8a8a8a",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 4,
            display: "block",
          }}
        >
          Notes (optional)
        </label>
        <input
          style={inputStyle}
          placeholder="Best time to deliver, gate code, etc."
          value={form.notes}
          onChange={(e) => f("notes")(e.target.value)}
        />

        {error && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "#e0433f",
              background: "rgba(224,67,63,0.06)",
              border: "1px solid rgba(224,67,63,0.25)",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 12,
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={saving}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 11,
            border: "none",
            background: saving
              ? "rgba(255,122,26,0.5)"
              : "linear-gradient(135deg, #ff9a44, #ff7a1a)",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            boxShadow: "0 3px 12px rgba(255,122,26,0.3)",
            marginTop: 6,
          }}
        >
          {saving ? "Saving…" : "Submit Delivery Details"}
        </button>
        <p
          style={{
            fontSize: "0.68rem",
            color: "#8a8a8a",
            marginTop: 10,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Our team will add your exact map pin before the delivery day.
        </p>
      </div>
    </main>
  );
}
