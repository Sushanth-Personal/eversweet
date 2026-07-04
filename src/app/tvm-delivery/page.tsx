// Location: src/app/tvm-delivery/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Stop = {
  id: string;
  trip_date: string;
  sequence: number;
  customer_name: string;
  phone: string | null;
  address: string | null;
  maps_url: string | null;
  distance_km: number;
  status: "pending" | "completed";
  completed_at: string | null;
  notes: string | null;
};

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

function fmtTime(ts: string | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type ViewMode = "start" | "single" | "list";

export default function TvmDeliveryPage() {
  const [tripDate, setTripDate] = useState<string>("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("start");
  const [hasStarted, setHasStarted] = useState(false);

  const load = useCallback(async () => {
    const { data: settings } = await supabase
      .from("trivandrum_settings")
      .select("trip_date")
      .single();
    const trip = settings?.trip_date || "";
    setTripDate(trip);

    if (trip) {
      const { data: s } = await supabase
        .from("tvm_delivery_stops")
        .select("*")
        .eq("trip_date", trip)
        .order("sequence", { ascending: true });
      setStops((s as Stop[]) || []);
    } else {
      setStops([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markComplete(id: string) {
    setUpdatingId(id);
    const stop = stops.find((s) => s.id === id);
    await supabase
      .from("tvm_delivery_stops")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);

    // Fire-and-forget — don't block the UI on the email send, and don't
    // fail the delivery mark-complete if the email happens to fail.
    if (stop) {
      const newCompletedCount =
        stops.filter((s) => s.status === "completed").length + 1;
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
    }

    await load();
    setUpdatingId(null);
  }

  async function undoComplete(id: string) {
    setUpdatingId(id);
    await supabase
      .from("tvm_delivery_stops")
      .update({ status: "pending", completed_at: null })
      .eq("id", id);
    await load();
    setUpdatingId(null);
  }

  const total = stops.length;
  const completed = stops.filter((s) => s.status === "completed").length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const totalDistance = stops.reduce((s, st) => s + (st.distance_km || 0), 0);
  const distanceCovered = stops
    .filter((s) => s.status === "completed")
    .reduce((s, st) => s + (st.distance_km || 0), 0);
  const distancePct =
    totalDistance > 0
      ? Math.min(100, Math.round((distanceCovered / totalDistance) * 100))
      : 0;

  const allDone = total > 0 && completed === total;
  const pendingStops = stops.filter((s) => s.status === "pending");
  const currentStop = pendingStops[0] || null;
  const nextStop = pendingStops[1] || null;
  const currentIndex = currentStop
    ? stops.findIndex((s) => s.id === currentStop.id)
    : -1;

  function StopActions({ stop, big = false }: { stop: Stop; big?: boolean }) {
    const isDone = stop.status === "completed";
    const isBusy = updatingId === stop.id;
    return (
      <>
        <div style={{ display: "flex", gap: 8 }}>
          {stop.phone && (
            <a
              href={`tel:${stop.phone}`}
              style={{
                flex: 1,
                padding: big ? "13px 12px" : "10px 12px",
                borderRadius: 9,
                border: "1.5px solid #ff7a1a",
                background: "#ffffff",
                color: "#ff7a1a",
                fontSize: big ? "0.92rem" : "0.8rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              📞 Call
            </a>
          )}
          {stop.maps_url && (
            <a
              href={stop.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 2,
                padding: big ? "13px 12px" : "10px 12px",
                borderRadius: 9,
                border: "none",
                background: "linear-gradient(135deg, #ff9a44, #ff7a1a)",
                color: "#fff",
                fontSize: big ? "0.92rem" : "0.8rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: "0 3px 10px rgba(255,122,26,0.3)",
              }}
            >
              🗺️ Open in Maps
            </a>
          )}
        </div>

        <button
          onClick={() =>
            isDone ? undoComplete(stop.id) : markComplete(stop.id)
          }
          disabled={isBusy}
          style={{
            width: "100%",
            marginTop: 8,
            padding: big ? "15px 12px" : "10px 12px",
            borderRadius: 9,
            border: isDone ? "1px solid rgba(31,168,85,0.4)" : "none",
            background: isDone
              ? "rgba(31,168,85,0.08)"
              : "linear-gradient(135deg, #ff9a44, #ff7a1a)",
            color: isDone ? "#1fa855" : "#fff",
            fontSize: big ? "1rem" : "0.82rem",
            fontWeight: 700,
            cursor: isBusy ? "not-allowed" : "pointer",
            opacity: isBusy ? 0.6 : 1,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            boxShadow: isDone ? "none" : "0 3px 10px rgba(255,122,26,0.3)",
          }}
        >
          {isBusy
            ? "Updating…"
            : isDone
              ? "↺ Undo (mark pending)"
              : "✓ Mark as Delivered"}
        </button>
      </>
    );
  }

  function StopCard({ stop, index }: { stop: Stop; index: number }) {
    const isDone = stop.status === "completed";
    return (
      <div
        style={{
          background: isDone ? "rgba(31,168,85,0.05)" : "#ffffff",
          border: `1px solid ${isDone ? "rgba(31,168,85,0.3)" : "rgba(0,0,0,0.09)"}`,
          boxShadow: isDone ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
          borderRadius: 14,
          padding: "16px 18px",
          marginBottom: 12,
          opacity: isDone ? 0.9 : 1,
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 10,
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: isDone
                  ? "rgba(31,168,85,0.14)"
                  : "rgba(255,122,26,0.12)",
                border: `1.5px solid ${isDone ? "#1fa855" : "rgba(255,122,26,0.45)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.78rem",
                fontWeight: 700,
                color: isDone ? "#1fa855" : "#ff7a1a",
                flexShrink: 0,
              }}
            >
              {isDone ? "✓" : index + 1}
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#1a1a1a",
                  marginBottom: 2,
                }}
              >
                {stop.customer_name}
              </p>
              {stop.address && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b6b6b",
                    lineHeight: 1.5,
                  }}
                >
                  📍 {stop.address}
                </p>
              )}
            </div>
          </div>
          {stop.distance_km > 0 && (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#ff7a1a",
                background: "rgba(255,122,26,0.1)",
                border: "1px solid rgba(255,122,26,0.3)",
                padding: "3px 9px",
                borderRadius: 20,
                flexShrink: 0,
                whiteSpace: "nowrap" as const,
              }}
            >
              {stop.distance_km} km
            </span>
          )}
        </div>

        {stop.notes && (
          <p
            style={{
              fontSize: "0.75rem",
              color: "#3a7d4f",
              fontStyle: "italic",
              marginBottom: 10,
            }}
          >
            💬 {stop.notes}
          </p>
        )}

        {isDone && stop.completed_at && (
          <p
            style={{
              fontSize: "0.72rem",
              color: "#1fa855",
              marginBottom: 10,
              fontWeight: 600,
            }}
          >
            ✓ Delivered at {fmtTime(stop.completed_at)}
          </p>
        )}

        <StopActions stop={stop} />
      </div>
    );
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        paddingBottom: 60,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: "#ffffff",
      }}
    >
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: CSS }}
      />

      {/* Sticky progress header — always visible regardless of view */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.97)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)",
          padding: "16px 20px 14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <p
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: "1.5rem",
              fontWeight: 500,
              color: "#1a1a1a",
            }}
          >
            Ever<em style={{ color: "#ff7a1a", fontStyle: "normal" }}>sweet</em>{" "}
            · TVM Run
          </p>
          {!loading && total > 0 && (
            <button
              onClick={() =>
                setViewMode(
                  viewMode === "list"
                    ? hasStarted
                      ? "single"
                      : "start"
                    : "list",
                )
              }
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#ffffff",
                color: "#4a4a4a",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                whiteSpace: "nowrap" as const,
              }}
            >
              {viewMode === "list" ? "← Back" : "☰ Full list"}
            </button>
          )}
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            color: "#8a8a8a",
            marginBottom: 12,
          }}
        >
          {tripDate ? fmtDate(tripDate) : "No trip date set"}
        </p>

        {/* Stops progress */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: allDone ? "#1fa855" : "#ff7a1a",
            }}
          >
            {allDone
              ? "✓ All deliveries complete!"
              : `${completed} of ${total} delivered`}
          </span>
          <span style={{ fontSize: "0.72rem", color: "#8a8a8a" }}>
            {progressPct}%
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "rgba(255,122,26,0.12)",
            borderRadius: 99,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: allDone
                ? "#1fa855"
                : "linear-gradient(90deg, #ffb066, #ff7a1a)",
              borderRadius: 99,
              transition: "width 0.35s ease",
            }}
          />
        </div>

        {/* Distance progress */}
        {totalDistance > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.72rem",
              color: "#6b6b6b",
            }}
          >
            <span>
              🛣️ {distanceCovered.toFixed(1)} / {totalDistance.toFixed(1)} km
              covered
            </span>
            <span style={{ color: "#ff7a1a", fontWeight: 700 }}>
              {distancePct}%
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "20px 20px 0" }}>
        {loading ? (
          <p
            style={{
              textAlign: "center",
              color: "#8a8a8a",
              fontSize: "0.85rem",
              padding: "40px 0",
            }}
          >
            Loading route…
          </p>
        ) : !tripDate ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#8a8a8a",
            }}
          >
            <p style={{ fontSize: "2rem", marginBottom: 12 }}>📅</p>
            <p style={{ fontSize: "0.88rem" }}>
              No Trivandrum trip date set yet. Ask admin to set it in /admin →
              Trivandrum tab.
            </p>
          </div>
        ) : stops.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#8a8a8a",
            }}
          >
            <p style={{ fontSize: "2rem", marginBottom: 12 }}>📦</p>
            <p style={{ fontSize: "0.88rem" }}>
              No delivery stops added yet for this trip.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <>
            {stops.map((stop, i) => (
              <StopCard key={stop.id} stop={stop} index={i} />
            ))}
          </>
        ) : allDone ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
            }}
          >
            <p style={{ fontSize: "3rem", marginBottom: 16 }}>🎉</p>
            <p
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#1fa855",
                marginBottom: 8,
              }}
            >
              All deliveries complete!
            </p>
            <p style={{ fontSize: "0.85rem", color: "#6b6b6b" }}>
              Nice work — every stop on today's route has been delivered.
            </p>
          </div>
        ) : viewMode === "start" || !hasStarted ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px 20px",
            }}
          >
            <p style={{ fontSize: "2.4rem", marginBottom: 16 }}>🚂</p>
            <p
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#1a1a1a",
                marginBottom: 6,
              }}
            >
              Ready for today's run
            </p>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#6b6b6b",
                marginBottom: 28,
                lineHeight: 1.6,
              }}
            >
              {total} stop{total !== 1 ? "s" : ""} · {totalDistance.toFixed(1)}{" "}
              km total
            </p>
            <button
              onClick={() => {
                setHasStarted(true);
                setViewMode("single");
              }}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #ff9a44, #ff7a1a)",
                color: "#fff",
                fontSize: "1.05rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                boxShadow: "0 4px 14px rgba(255,122,26,0.35)",
              }}
            >
              ▶ Start Trip
            </button>
            <button
              onClick={() => setViewMode("list")}
              style={{
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: "#8a8a8a",
                fontSize: "0.78rem",
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                textDecoration: "underline",
              }}
            >
              Or preview the full stop list first
            </button>
          </div>
        ) : currentStop ? (
          <>
            <p
              style={{
                fontSize: "0.68rem",
                color: "#8a8a8a",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                marginBottom: 10,
              }}
            >
              Current Stop
            </p>
            <StopCard stop={currentStop} index={currentIndex} />
            {nextStop && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#8a8a8a",
                  textAlign: "center" as const,
                  marginTop: 4,
                }}
              >
                Next up:{" "}
                <strong style={{ color: "#4a4a4a" }}>
                  {nextStop.customer_name}
                </strong>
              </p>
            )}
          </>
        ) : null}

        {!loading && stops.length > 0 && (
          <button
            onClick={load}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: 20,
              marginBottom: 20,
              borderRadius: 9,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "#ffffff",
              color: "#6b6b6b",
              fontSize: "0.78rem",
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            ↻ Refresh route
          </button>
        )}
      </div>
    </main>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:#ffffff;color:#1a1a1a;font-family:'DM Sans',sans-serif;font-weight:400;-webkit-font-smoothing:antialiased}
`;
