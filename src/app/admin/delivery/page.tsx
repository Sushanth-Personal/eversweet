// Location: src/app/admin/delivery/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// This is the single, fixed settings row shared by /admin (Trivandrum tab)
// and /admin/delivery. Never insert a second row — always upsert against
// this id so both pages read/write the exact same trip_date.
const FIXED_SETTINGS_ID = "0c62e1c2-4d73-457b-bf49-bb077ebdba3e";

const G = {
  pageBg: "#ffffff",
  glass: "rgba(0,0,0,0.03)",
  glassStrong: "#f7f7f7",
  glassBorder: "rgba(0,0,0,0.09)",
  glassBorderStrong: "rgba(0,0,0,0.14)",
  text: "#1a1a1a",
  sub: "#4a4a4a",
  muted: "#8a8a8a",
  gold: "#ff7a1a",
  goldGlass: "rgba(255,122,26,0.12)",
  goldBorder: "rgba(255,122,26,0.4)",
  green: "#1fa855",
  greenGlass: "rgba(31,168,85,0.1)",
  red: "#e0433f",
  redGlass: "rgba(224,67,63,0.08)",
  blue: "#ff7a1a",
  blueGlass: "rgba(255,122,26,0.12)",
};

type Stop = {
  id: string;
  trip_date: string;
  sequence: number;
  customer_name: string;
  phone: string | null;
  address: string | null;
  maps_url: string | null;
  distance_km: number;
  dispatch_distance_km: number;
  status: "pending" | "completed";
  completed_at: string | null;
  notes: string | null;
};

// Customer delivery charge formula: ₹50 base + ₹10 per km from dispatch point
function customerCharge(dispatchKm: number): number {
  if (!dispatchKm || dispatchKm <= 0) return 0;
  return Math.floor(50 + 9 * dispatchKm);
}

function GlassInput({
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
        background: "#ffffff",
        border: `1px solid ${G.glassBorder}`,
        color: G.text,
        padding: "10px 12px",
        borderRadius: 9,
        fontSize: "0.85rem",
        marginBottom: 8,
        outline: "none",
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box" as const,
      }}
    />
  );
}

export default function TvmDeliveryAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);

  const [tripDate, setTripDate] = useState<string>("");
  const [tripDateInput, setTripDateInput] = useState<string>("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    customer_name: "",
    phone: "",
    address: "",
    maps_url: "",
    distance_km: "",
    dispatch_distance_km: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (localStorage.getItem("es_admin") === "true") setAuthed(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    // Always read the one fixed settings row — never "any" row via limit(1),
    // which could silently pick a different row than the one being written to.
    const { data: settingsRow } = await supabase
      .from("trivandrum_settings")
      .select("id, trip_date")
      .eq("id", FIXED_SETTINGS_ID)
      .maybeSingle();

    setSettingsId(settingsRow?.id || FIXED_SETTINGS_ID);

    // If no trip date has been set yet, default to today so the form
    // still works immediately — admin doesn't need to save a date first.
    const trip =
      settingsRow?.trip_date || new Date().toISOString().split("T")[0];
    setTripDate(trip);
    setTripDateInput(trip);

    const { data: s } = await supabase
      .from("tvm_delivery_stops")
      .select("*")
      .eq("trip_date", trip)
      .order("sequence", { ascending: true });
    setStops((s as Stop[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  function flash(text: string) {
    setMsg(text);
    const isError = text.startsWith("⚠");
    setTimeout(() => setMsg(""), isError ? 8000 : 3000);
  }

  const [dateSaveStatus, setDateSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function persistTripDate(savingDate: string) {
    if (!savingDate) return;
    setDateSaveStatus("saving");

    // Upsert against the fixed settings id — never blindly insert a new row.
    // This guarantees /admin (Trivandrum tab) and /admin/delivery always
    // read/write the exact same trip_date.
    const { error } = await supabase.from("trivandrum_settings").upsert(
      {
        id: settingsId || FIXED_SETTINGS_ID,
        trip_date: savingDate,
      },
      { onConflict: "id" },
    );

    if (error) {
      flash(`⚠ Save failed: ${error.message}`);
      setDateSaveStatus("error");
      return;
    }

    setSettingsId(settingsId || FIXED_SETTINGS_ID);
    setTripDate(savingDate);
    await load();
    setDateSaveStatus("saved");
    flash("Trip date saved ✓");
  }

  async function addStop() {
    if (!form.customer_name.trim() || !tripDate) return;
    const nextSeq =
      stops.length > 0 ? Math.max(...stops.map((s) => s.sequence)) + 1 : 1;
    const { error } = await supabase.from("tvm_delivery_stops").insert({
      trip_date: tripDate,
      sequence: nextSeq,
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      maps_url: form.maps_url.trim() || null,
      distance_km: parseFloat(form.distance_km) || 0,
      dispatch_distance_km: parseFloat(form.dispatch_distance_km) || 0,
      notes: form.notes.trim() || null,
      status: "pending",
    });
    if (error) {
      flash(`⚠ Couldn't add stop: ${error.message}`);
      return;
    }
    setForm(emptyForm);
    setShowAddForm(false);
    await load();
    flash("Stop added ✓");
  }

  function startEdit(stop: Stop) {
    setEditingId(stop.id);
    setForm({
      customer_name: stop.customer_name,
      phone: stop.phone || "",
      address: stop.address || "",
      maps_url: stop.maps_url || "",
      distance_km: String(stop.distance_km || ""),
      dispatch_distance_km: String(stop.dispatch_distance_km || ""),
      notes: stop.notes || "",
    });
  }

  async function saveEdit(id: string) {
    const { error } = await supabase
      .from("tvm_delivery_stops")
      .update({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        maps_url: form.maps_url.trim() || null,
        distance_km: parseFloat(form.distance_km) || 0,
        dispatch_distance_km: parseFloat(form.dispatch_distance_km) || 0,
        notes: form.notes.trim() || null,
      })
      .eq("id", id);
    if (error) {
      flash(`⚠ Couldn't save changes: ${error.message}`);
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    await load();
    flash("Stop updated ✓");
  }

  async function deleteStop(id: string) {
    if (!confirm("Delete this stop?")) return;
    const { error } = await supabase
      .from("tvm_delivery_stops")
      .delete()
      .eq("id", id);
    if (error) {
      flash(`⚠ Couldn't delete stop: ${error.message}`);
      return;
    }
    await load();
    flash("Stop deleted");
  }

  async function moveStop(id: string, direction: -1 | 1) {
    const idx = stops.findIndex((s) => s.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= stops.length) return;
    const a = stops[idx];
    const b = stops[swapIdx];
    const results = await Promise.all([
      supabase
        .from("tvm_delivery_stops")
        .update({ sequence: b.sequence })
        .eq("id", a.id),
      supabase
        .from("tvm_delivery_stops")
        .update({ sequence: a.sequence })
        .eq("id", b.id),
    ]);
    const err = results.find((r) => r.error)?.error;
    if (err) {
      flash(`⚠ Couldn't reorder: ${err.message}`);
      return;
    }
    await load();
  }

  async function resetStop(id: string) {
    const { error } = await supabase
      .from("tvm_delivery_stops")
      .update({ status: "pending", completed_at: null })
      .eq("id", id);
    if (error) {
      flash(`⚠ Couldn't reset stop: ${error.message}`);
      return;
    }
    await load();
  }

  async function markDelivered(stop: Stop) {
    const { error } = await supabase
      .from("tvm_delivery_stops")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", stop.id);
    if (error) {
      flash(`⚠ Couldn't mark delivered: ${error.message}`);
      return;
    }

    const newCompletedCount =
      stops.filter((s) => s.status === "completed").length + 1;

    // Fire-and-forget — don't block the UI on the email send.
    fetch("/api/delivery-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: stop.customer_name,
        phone: stop.phone,
        address: stop.address,
        distance_km: stop.distance_km,
        trip_date: tripDate,
        sequence: stop.sequence,
        total: stops.length,
        completed: newCompletedCount,
      }),
    }).catch((e) => console.error("Delivery alert email failed:", e));

    await load();
    flash("Marked delivered ✓ (email sent)");
  }

  const completed = stops.filter((s) => s.status === "completed").length;
  const totalDistance = stops.reduce((s, st) => s + (st.distance_km || 0), 0);
  const distanceCovered = stops
    .filter((s) => s.status === "completed")
    .reduce((s, st) => s + (st.distance_km || 0), 0);
  const totalCustomerCharges = stops.reduce(
    (s, st) => s + customerCharge(st.dispatch_distance_km || 0),
    0,
  );
  const porterLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/tvm-delivery`
      : "https://eversweet.in/tvm-delivery";

  if (!authed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: G.pageBg,
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: `1px solid ${G.glassBorderStrong}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            borderRadius: 20,
            padding: 32,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: G.text,
              marginBottom: 4,
            }}
          >
            TVM Delivery
          </h1>
          <p style={{ fontSize: "0.82rem", color: G.muted, marginBottom: 24 }}>
            Admin access required
          </p>
          <GlassInput
            type="password"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          {pwError && (
            <p style={{ fontSize: "0.82rem", color: G.red, marginBottom: 8 }}>
              Wrong password
            </p>
          )}
          <button
            onClick={() => {
              if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
                localStorage.setItem("es_admin", "true");
                setAuthed(true);
                setPwError(false);
              } else setPwError(true);
            }}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #ff9a44, #ff7a1a)",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              boxShadow: "0 3px 10px rgba(255,122,26,0.3)",
            }}
          >
            Sign In
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        background: G.pageBg,
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: G.text,
        paddingBottom: 60,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderBottom: `1px solid ${G.glassBorder}`,
          padding: "14px 18px",
          position: "sticky" as const,
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700 }}>
            🚂 TVM Delivery — Porter Route
          </h1>
          <p style={{ fontSize: "0.72rem", color: G.muted, marginTop: 2 }}>
            Manage stops for the porter tracking page (/tvm-delivery)
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "18px 16px" }}>
        {msg && (
          <div
            style={{
              background: msg.startsWith("⚠") ? G.redGlass : G.greenGlass,
              border: `1px solid ${msg.startsWith("⚠") ? "rgba(224,67,63,0.3)" : "rgba(31,168,85,0.3)"}`,
              color: msg.startsWith("⚠") ? G.red : G.green,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.85rem",
              marginBottom: 14,
              fontWeight: 500,
            }}
          >
            {msg}
          </div>
        )}

        {/* Trip date */}
        <div
          style={{
            background: "#ffffff",
            border: `1px solid ${G.glassBorderStrong}`,
            boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: "0.62rem",
              color: G.muted,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Trip Date (shared with /trivandrum settings)
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="date"
              value={tripDateInput}
              onChange={(e) => {
                const v = e.target.value;
                setTripDateInput(v);
                if (v) persistTripDate(v);
              }}
              style={{
                flex: 1,
                background: "#ffffff",
                border: `1px solid ${G.glassBorder}`,
                color: G.text,
                padding: "10px 12px",
                borderRadius: 9,
                fontSize: "0.85rem",
                outline: "none",
                fontFamily: "system-ui, sans-serif",
              }}
            />
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color:
                  dateSaveStatus === "error"
                    ? G.red
                    : dateSaveStatus === "saving"
                      ? G.muted
                      : dateSaveStatus === "saved"
                        ? G.green
                        : G.muted,
                whiteSpace: "nowrap" as const,
                minWidth: 90,
              }}
            >
              {dateSaveStatus === "saving"
                ? "Saving…"
                : dateSaveStatus === "saved"
                  ? "✓ Saved"
                  : dateSaveStatus === "error"
                    ? "✕ Not saved"
                    : ""}
            </span>
          </div>
          <p style={{ fontSize: "0.68rem", color: G.muted, marginTop: 8 }}>
            Saves automatically as soon as you pick a date — no extra step.
          </p>
        </div>

        {loading ? (
          <p
            style={{
              fontSize: "0.85rem",
              color: G.muted,
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            Loading…
          </p>
        ) : (
          <>
            {/* Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  border: `1px solid ${G.glassBorder}`,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.62rem",
                    color: G.muted,
                    marginBottom: 4,
                  }}
                >
                  STOPS
                </p>
                <p
                  style={{ fontSize: "1.4rem", fontWeight: 700, color: G.text }}
                >
                  {completed} / {stops.length}
                </p>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  border: `1px solid ${G.glassBorder}`,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.62rem",
                    color: G.muted,
                    marginBottom: 4,
                  }}
                >
                  ROUTE DISTANCE
                </p>
                <p
                  style={{ fontSize: "1.4rem", fontWeight: 700, color: G.gold }}
                >
                  {distanceCovered.toFixed(1)} / {totalDistance.toFixed(1)} km
                </p>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  border: `1px solid ${G.glassBorder}`,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.62rem",
                    color: G.muted,
                    marginBottom: 4,
                  }}
                >
                  DELIVERY CHARGES
                </p>
                <p
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: G.green,
                  }}
                >
                  ₹{totalCustomerCharges.toLocaleString("en-IN")}
                </p>
                <p
                  style={{ fontSize: "0.62rem", color: G.muted, marginTop: 2 }}
                >
                  ₹50 + ₹10/km, summed
                </p>
              </div>
            </div>

            {/* Add stop */}
            <button
              onClick={() => {
                setShowAddForm((v) => !v);
                setEditingId(null);
                setForm(emptyForm);
              }}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #ff9a44, #ff7a1a)",
                color: "#fff",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                marginBottom: 12,
                boxShadow: "0 2px 8px rgba(255,122,26,0.3)",
              }}
            >
              {showAddForm ? "✕ Close" : "+ Add Delivery Stop"}
            </button>

            {showAddForm && (
              <div
                style={{
                  background: G.glassStrong,
                  border: `1px solid ${G.glassBorderStrong}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <GlassInput
                  placeholder="Customer Name *"
                  value={form.customer_name}
                  onChange={(v) => setForm((f) => ({ ...f, customer_name: v }))}
                />
                <GlassInput
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                />
                <GlassInput
                  placeholder="Address"
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                />
                <GlassInput
                  placeholder="Google Maps link (paste share URL)"
                  value={form.maps_url}
                  onChange={(v) => setForm((f) => ({ ...f, maps_url: v }))}
                />
                <GlassInput
                  type="number"
                  placeholder="Distance for this leg (km) — for porter's route total"
                  value={form.distance_km}
                  onChange={(v) => setForm((f) => ({ ...f, distance_km: v }))}
                />
                <GlassInput
                  type="number"
                  placeholder="Distance from dispatch point (km) — for customer charge"
                  value={form.dispatch_distance_km}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, dispatch_distance_km: v }))
                  }
                />
                {parseFloat(form.dispatch_distance_km) > 0 && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: G.gold,
                      fontWeight: 600,
                      marginTop: -4,
                      marginBottom: 10,
                    }}
                  >
                    → Suggested customer charge: ₹
                    {customerCharge(parseFloat(form.dispatch_distance_km))}
                  </p>
                )}
                <GlassInput
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                />
                <button
                  onClick={addStop}
                  disabled={!form.customer_name.trim()}
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: 9,
                    border: "none",
                    background: form.customer_name.trim()
                      ? "linear-gradient(135deg, #ff9a44, #ff7a1a)"
                      : G.glass,
                    color: form.customer_name.trim() ? "#fff" : G.muted,
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: form.customer_name.trim()
                      ? "pointer"
                      : "not-allowed",
                    fontFamily: "system-ui, sans-serif",
                    boxShadow: form.customer_name.trim()
                      ? "0 2px 8px rgba(255,122,26,0.3)"
                      : "none",
                  }}
                >
                  Add Stop
                </button>
              </div>
            )}

            {/* Stops list */}
            {loading ? (
              <p
                style={{
                  color: G.muted,
                  fontSize: "0.85rem",
                  textAlign: "center",
                }}
              >
                Loading…
              </p>
            ) : stops.length === 0 ? (
              <p
                style={{
                  color: G.muted,
                  fontSize: "0.85rem",
                  textAlign: "center",
                  padding: "20px 0",
                }}
              >
                No stops added yet.
              </p>
            ) : (
              stops.map((stop, i) => {
                const isEditing = editingId === stop.id;
                const isDone = stop.status === "completed";
                return (
                  <div
                    key={stop.id}
                    style={{
                      background: "#ffffff",
                      border: `1px solid ${isDone ? "rgba(31,168,85,0.3)" : G.glassBorder}`,
                      boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                    }}
                  >
                    {isEditing ? (
                      <div>
                        <GlassInput
                          placeholder="Customer Name *"
                          value={form.customer_name}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, customer_name: v }))
                          }
                        />
                        <GlassInput
                          placeholder="Phone"
                          value={form.phone}
                          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                        />
                        <GlassInput
                          placeholder="Address"
                          value={form.address}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, address: v }))
                          }
                        />
                        <GlassInput
                          placeholder="Google Maps link"
                          value={form.maps_url}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, maps_url: v }))
                          }
                        />
                        <GlassInput
                          type="number"
                          placeholder="Distance for this leg (km)"
                          value={form.distance_km}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, distance_km: v }))
                          }
                        />
                        <GlassInput
                          type="number"
                          placeholder="Distance from dispatch (km)"
                          value={form.dispatch_distance_km}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, dispatch_distance_km: v }))
                          }
                        />
                        {parseFloat(form.dispatch_distance_km) > 0 && (
                          <p
                            style={{
                              fontSize: "0.75rem",
                              color: G.gold,
                              fontWeight: 600,
                              marginTop: -4,
                              marginBottom: 10,
                            }}
                          >
                            → Suggested customer charge: ₹
                            {customerCharge(
                              parseFloat(form.dispatch_distance_km),
                            )}
                          </p>
                        )}
                        <GlassInput
                          placeholder="Notes"
                          value={form.notes}
                          onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => saveEdit(stop.id)}
                            style={{
                              flex: 1,
                              padding: "9px",
                              borderRadius: 8,
                              border: "none",
                              background:
                                "linear-gradient(135deg, #ff9a44, #ff7a1a)",
                              color: "#fff",
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "system-ui",
                              fontSize: "0.82rem",
                              boxShadow: "0 2px 8px rgba(255,122,26,0.3)",
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setForm(emptyForm);
                            }}
                            style={{
                              padding: "9px 16px",
                              borderRadius: 8,
                              border: `1px solid ${G.glassBorder}`,
                              background: "#ffffff",
                              color: G.muted,
                              cursor: "pointer",
                              fontFamily: "system-ui",
                              fontSize: "0.82rem",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", gap: 10 }}>
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: isDone ? G.greenGlass : G.goldGlass,
                                color: isDone ? G.green : G.gold,
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {isDone ? "✓" : i + 1}
                            </span>
                            <div>
                              <p
                                style={{
                                  fontSize: "0.92rem",
                                  fontWeight: 700,
                                  color: G.text,
                                }}
                              >
                                {stop.customer_name}
                              </p>
                              {stop.phone && (
                                <p
                                  style={{ fontSize: "0.75rem", color: G.sub }}
                                >
                                  📞 {stop.phone}
                                </p>
                              )}
                              {stop.address && (
                                <p
                                  style={{
                                    fontSize: "0.72rem",
                                    color: G.muted,
                                  }}
                                >
                                  📍 {stop.address}
                                </p>
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column" as const,
                              alignItems: "flex-end",
                              gap: 4,
                              flexShrink: 0,
                            }}
                          >
                            {stop.distance_km > 0 && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  color: G.gold,
                                  background: G.goldGlass,
                                  border: `1px solid ${G.goldBorder}`,
                                  padding: "3px 8px",
                                  borderRadius: 20,
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                {stop.distance_km} km route
                              </span>
                            )}
                            {stop.dispatch_distance_km > 0 && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  color: G.green,
                                  background: G.greenGlass,
                                  border: `1px solid rgba(31,168,85,0.3)`,
                                  padding: "3px 8px",
                                  borderRadius: 20,
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                ₹{customerCharge(stop.dispatch_distance_km)}{" "}
                                charge
                              </span>
                            )}
                          </div>
                        </div>
                        {stop.maps_url && (
                          <a
                            href={stop.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "0.72rem",
                              color: G.gold,
                              fontWeight: 600,
                            }}
                          >
                            🗺️ Maps link ↗
                          </a>
                        )}
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            marginTop: 10,
                            flexWrap: "wrap" as const,
                          }}
                        >
                          <button
                            onClick={() => moveStop(stop.id, -1)}
                            disabled={i === 0}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 7,
                              border: `1px solid ${G.glassBorder}`,
                              background: "#ffffff",
                              color: i === 0 ? G.muted : G.sub,
                              cursor: i === 0 ? "not-allowed" : "pointer",
                              fontSize: "0.75rem",
                              fontFamily: "system-ui",
                            }}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveStop(stop.id, 1)}
                            disabled={i === stops.length - 1}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 7,
                              border: `1px solid ${G.glassBorder}`,
                              background: "#ffffff",
                              color: i === stops.length - 1 ? G.muted : G.sub,
                              cursor:
                                i === stops.length - 1
                                  ? "not-allowed"
                                  : "pointer",
                              fontSize: "0.75rem",
                              fontFamily: "system-ui",
                            }}
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => startEdit(stop)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 7,
                              border: "none",
                              background:
                                "linear-gradient(135deg, #ff9a44, #ff7a1a)",
                              color: "#fff",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              fontFamily: "system-ui",
                              boxShadow: "0 2px 6px rgba(255,122,26,0.25)",
                            }}
                          >
                            ✏️ Edit
                          </button>
                          {!isDone && (
                            <button
                              onClick={() => markDelivered(stop)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 7,
                                border: `1px solid rgba(31,168,85,0.35)`,
                                background: G.greenGlass,
                                color: G.green,
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                fontFamily: "system-ui",
                              }}
                            >
                              ✓ Delivered
                            </button>
                          )}
                          {isDone && (
                            <button
                              onClick={() => resetStop(stop.id)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 7,
                                border: `1px solid ${G.goldBorder}`,
                                background: G.goldGlass,
                                color: G.gold,
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                fontFamily: "system-ui",
                              }}
                            >
                              ↺ Reset
                            </button>
                          )}
                          <button
                            onClick={() => deleteStop(stop.id)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 7,
                              border: `1px solid rgba(224,67,63,0.3)`,
                              background: G.redGlass,
                              color: G.red,
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              fontFamily: "system-ui",
                              marginLeft: "auto",
                            }}
                          >
                            ✕ Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}

            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                background: G.goldGlass,
                border: `1px solid ${G.goldBorder}`,
                borderRadius: 10,
              }}
            >
              <p
                style={{
                  fontSize: "0.78rem",
                  color: G.gold,
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                📲 Share the porter link: <strong>{porterLink}</strong>
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(porterLink).then(() => {
                      flash("Link copied ✓");
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: 8,
                    border: `1px solid ${G.goldBorder}`,
                    background: "#ffffff",
                    color: G.gold,
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  📋 Copy Link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hi! Here's your Eversweet delivery route for today 🚂🍡\n\n${porterLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #25d366, #128c4a)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  📲 WhatsApp
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
