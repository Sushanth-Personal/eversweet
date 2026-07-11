// Location: src/app/tvm-delivery/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { DraggableStopList } from "./DraggableStopList";

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

// Same formula as /admin/delivery — keep these in sync if pricing changes.
// ₹50 base + ₹9/km from the dispatch point, floored to the nearest rupee.
function customerCharge(dispatchKm: number): number {
  if (!dispatchKm || dispatchKm <= 0) return 0;
  return Math.floor(50 + 9 * dispatchKm);
}

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

// Instant, offline first-pass area guess — same list the server uses,
// kept here too so badges appear immediately on load, before the
// AI refinement call (below) returns.
const KNOWN_AREAS = [
  "East Fort",
  "Peroorkada",
  "Pattom",
  "Kesavadasapuram",
  "Sasthamangalam",
  "Kowdiar",
  "Vazhuthacaud",
  "Thampanoor",
  "Vellayambalam",
  "Kumarapuram",
  "Medical College",
  "Chackai",
  "Karamana",
  "Nalanchira",
  "Sreekaryam",
  "Kazhakootam",
  "Technopark",
  "Attukal",
  "Manacaud",
  "Poojappura",
  "Kaimanam",
  "Vattiyoorkavu",
  "Muttada",
  "Pongumoodu",
  "Ulloor",
  "Palayam",
  "Statue",
  "Chalai",
  "Pettah",
  "Killipalam",
  "Thiruvallam",
  "Kovalam",
  "Vizhinjam",
  "Balaramapuram",
  "Nedumangad",
  "Kattakada",
  "Neyyattinkara",
  "PMG",
];
function guessAreaHeuristic(address: string | null): string {
  if (!address) return "";
  const lower = address.toLowerCase();
  for (const area of KNOWN_AREAS) {
    if (lower.includes(area.toLowerCase())) return area;
  }
  return "";
}

// Deterministic soft colour for each area name so the same locality
// always gets the same badge colour across the route.
const AREA_PALETTE = [
  {
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.35)",
    text: "#3f7fd6",
  },
  {
    bg: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.35)",
    text: "#8b6fe0",
  },
  {
    bg: "rgba(52,217,123,0.12)",
    border: "rgba(52,217,123,0.35)",
    text: "#1e9a55",
  },
  {
    bg: "rgba(244,114,182,0.12)",
    border: "rgba(244,114,182,0.35)",
    text: "#d1479f",
  },
  {
    bg: "rgba(255,122,26,0.12)",
    border: "rgba(255,122,26,0.35)",
    text: "#c85e12",
  },
  {
    bg: "rgba(250,204,21,0.14)",
    border: "rgba(250,204,21,0.4)",
    text: "#a37b0a",
  },
];
function areaColor(area: string) {
  let hash = 0;
  for (let i = 0; i < area.length; i++)
    hash = (hash * 31 + area.charCodeAt(i)) | 0;
  return AREA_PALETTE[Math.abs(hash) % AREA_PALETTE.length];
}

// Always resolve a maps link — use the admin-set maps_url if present,
// otherwise fall back to a Google Maps search built from the address.
function resolveMapsHref(stop: Stop): string | null {
  if (stop.maps_url) return stop.maps_url;
  if (stop.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`;
  }
  return null;
}

type ViewMode = "start" | "single" | "list";

export default function TvmDeliveryPage() {
  const [tripDate, setTripDate] = useState<string>("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("start");
  const [hasStarted, setHasStarted] = useState(false);
  const [areaMap, setAreaMap] = useState<Record<string, string>>({});

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
      const list = (s as Stop[]) || [];
      setStops(list);

      // 1) Instant offline guess so badges show immediately.
      const instant: Record<string, string> = {};
      list.forEach((st) => {
        const g = guessAreaHeuristic(st.address);
        if (g) instant[st.id] = g;
      });
      setAreaMap(instant);

      // 2) AI refinement for addresses the heuristic couldn't tag.
      const unresolved = list.filter((st) => !instant[st.id] && st.address);
      if (unresolved.length > 0) {
        fetch("/api/extract-area", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addresses: unresolved.map((st) => st.address || ""),
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!Array.isArray(data.areas)) return;
            setAreaMap((prev) => {
              const next = { ...prev };
              unresolved.forEach((st, i) => {
                if (data.areas[i]) next[st.id] = data.areas[i];
              });
              return next;
            });
          })
          .catch((e) => console.warn("area AI lookup failed", e));
      }
    } else {
      setStops([]);
      setAreaMap({});
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

  // Press-and-drag reorder: called by DraggableStopList after a drop.
  async function persistOrder(newStops: Stop[]) {
    setStops(newStops);
    await Promise.all(
      newStops.map((s, i) =>
        supabase
          .from("tvm_delivery_stops")
          .update({ sequence: i + 1 })
          .eq("id", s.id),
      ),
    );
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

  const totalToCollect = stops
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + customerCharge(s.dispatch_distance_km), 0);
  const hasCharges = stops.some((s) => s.dispatch_distance_km > 0);

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
    const mapsHref = resolveMapsHref(stop);
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
          {mapsHref && (
            <a
              href={mapsHref}
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
              🗺️ {stop.maps_url ? "Open in Maps" : "Find on Maps"}
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

  function StopCard({
    stop,
    index,
    dragHandleProps,
    isDragging,
  }: {
    stop: Stop;
    index: number;
    dragHandleProps?: {
      onMouseDown: (e: React.MouseEvent) => void;
      onTouchStart: (e: React.TouchEvent) => void;
    };
    isDragging?: boolean;
  }) {
    const isDone = stop.status === "completed";
    const charge = customerCharge(stop.dispatch_distance_km);
    const area = areaMap[stop.id];
    const areaC = area ? areaColor(area) : null;
    return (
      <div
        style={{
          background: isDone ? "rgba(31,168,85,0.05)" : "#ffffff",
          border: `1px solid ${isDone ? "rgba(31,168,85,0.3)" : isDragging ? "#ff7a1a" : "rgba(0,0,0,0.09)"}`,
          boxShadow: isDone ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
          borderRadius: 14,
          padding: "16px 18px",
          marginBottom: 12,
          opacity: isDone ? 0.9 : 1,
          transition: isDragging ? "none" : "all 0.2s",
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
            {dragHandleProps && !isDone && (
              <div
                onMouseDown={dragHandleProps.onMouseDown}
                onTouchStart={dragHandleProps.onTouchStart}
                style={{
                  width: 28,
                  height: 44,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                  color: "#bbb",
                  cursor: "grab",
                  touchAction: "none",
                  marginLeft: -4,
                  marginTop: -8,
                }}
              >
                ⠿
              </div>
            )}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  flexWrap: "wrap" as const,
                  marginBottom: 2,
                }}
              >
                <p
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#1a1a1a",
                  }}
                >
                  {stop.customer_name}
                </p>
                {areaC && (
                  <span
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: areaC.bg,
                      border: `1px solid ${areaC.border}`,
                      color: areaC.text,
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    📍 {area}
                  </span>
                )}
              </div>
              {stop.address && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b6b6b",
                    lineHeight: 1.5,
                  }}
                >
                  {stop.address}
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

        {charge > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: isDone
                ? "rgba(31,168,85,0.05)"
                : "rgba(31,168,85,0.08)",
              border: `1px solid ${isDone ? "rgba(31,168,85,0.15)" : "rgba(31,168,85,0.3)"}`,
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 10,
            }}
          >
            <span
              style={{ fontSize: "0.8rem", color: "#3a7d4f", fontWeight: 600 }}
            >
              💰 {isDone ? "Collected" : "Collect from customer"}
            </span>
            <span
              style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1fa855" }}
            >
              ₹{charge}
            </span>
          </div>
        )}

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
        <p style={{ fontSize: "0.7rem", color: "#8a8a8a", marginBottom: 12 }}>
          {tripDate ? fmtDate(tripDate) : "No trip date set"}
        </p>

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

        {totalDistance > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.72rem",
              color: "#6b6b6b",
              marginBottom: hasCharges ? 6 : 0,
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

        {hasCharges && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.78rem",
            }}
          >
            <span style={{ color: "#6b6b6b" }}>💰 Total to collect</span>
            <span style={{ color: "#1fa855", fontWeight: 700 }}>
              ₹{totalToCollect.toLocaleString("en-IN")} remaining
            </span>
          </div>
        )}
      </div>

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
            <p
              style={{
                fontSize: "0.72rem",
                color: "#8a8a8a",
                textAlign: "center" as const,
                marginBottom: 10,
              }}
            >
              ⠿ Press and drag a stop to reorder the route
            </p>
            <DraggableStopList
              items={stops}
              getId={(s) => s.id}
              onReorder={persistOrder}
              renderItem={(stop, i, dragHandleProps, isDragging) => (
                <StopCard
                  stop={stop}
                  index={i}
                  dragHandleProps={dragHandleProps}
                  isDragging={isDragging}
                />
              )}
            />
          </>
        ) : allDone ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
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
          <div style={{ textAlign: "center", padding: "40px 20px 20px" }}>
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
              {hasCharges
                ? ` · ₹${totalToCollect.toLocaleString("en-IN")} to collect`
                : ""}
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
