// ─────────────────────────────────────────────────────────────────
// TRIVANDRUM ADMIN SECTION - Updated
// Deploy to: src/app/admin/trivandrum-admin-section.tsx
// ─────────────────────────────────────────────────────────────────
import React from "react";

const MOCHI_COST = 60; // cost per mochi piece

export function TrivandrumAdminTab({
  tvmOrders,
  tvmSettings,
  setTvmSettings,
  tvmSettingsId,
  savingTvm,
  setSavingTvm,
  tvmFlash,
  load,
  supabase,
  productMap,
  GlassInput,
  FlavourPill,
}: any) {
  // ── Stats ────────────────────────────────────────────────────
  const confirmedOrders = tvmOrders.filter((o: any) =>
    ["confirmed", "cooking", "cooked", "porter_booked", "dispatched"].includes(
      o.status,
    ),
  );
  const pendingOrders = tvmOrders.filter((o: any) => o.status === "pending");
  const cancelledOrders = tvmOrders.filter(
    (o: any) => o.status === "cancelled",
  );

  const totalRevenue = confirmedOrders.reduce(
    (s: number, o: any) => s + (o.total_price || 0),
    0,
  );

  // Count total mochis from confirmed orders
  const totalMochis = confirmedOrders.reduce((s: number, o: any) => {
    if (!o.flavours) return s;
    return (
      s +
      Object.values(o.flavours as Record<string, number>).reduce(
        (a: number, b: number) => a + b,
        0,
      )
    );
  }, 0);

  const mochiCost = totalMochis * MOCHI_COST;
  const grossProfit = totalRevenue - mochiCost; // before trip expenses

  // ── Local settings state ─────────────────────────────────────
  const [localSettings, setLocalSettings] = React.useState(tvmSettings);
  const [tvmExpenses, setTvmExpenses] = React.useState<any[]>([]);
  const [addingExpense, setAddingExpense] = React.useState(false);
  const [newExpense, setNewExpense] = React.useState({
    description: "",
    amount: "",
  });
  const [analytics, setAnalytics] = React.useState<{
    page_view: number;
    order_now_tap: number;
    reached_flavours: number;
    place_order_tap: number;
    whatsapp_open: number;
  } | null>(null);

  React.useEffect(() => {
    // Store trip_date in ISO format in Supabase (YYYY-MM-DD), format for display separately
    const raw = tvmSettings.trip_date || "";
    const formatted = raw
      ? new Date(raw + "T00:00:00").toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "";
    setLocalSettings({
      ...tvmSettings,
      trip_date_raw: raw,
      trip_date_display: formatted,
    });
  }, [tvmSettings]);

  React.useEffect(() => {
    async function loadExpenses() {
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("category", "trivandrum")
        .order("date", { ascending: false });
      if (data) setTvmExpenses(data);
    }
    async function loadAnalytics() {
      const events = [
        "page_view",
        "order_now_tap",
        "reached_flavours",
        "place_order_tap",
        "whatsapp_open",
      ];
      const counts: any = {};
      await Promise.all(
        events.map(async (ev) => {
          const { count } = await supabase
            .from("trivandrum_events")
            .select("*", { count: "exact", head: true })
            .eq("event", ev);
          counts[ev] = count || 0;
        }),
      );
      setAnalytics(counts);
    }
    loadExpenses();
    loadAnalytics();
  }, []);

  const totalExpenses = tvmExpenses.reduce(
    (s: number, e: any) => s + (e.amount || 0),
    0,
  );
  const netProfit = grossProfit - totalExpenses;

  async function saveSettings() {
    setSavingTvm(true);
    const payload = {
      pickup_name: localSettings.pickup_name || "",
      pickup_address: localSettings.pickup_address || "",
      pickup_maps_url: localSettings.pickup_maps_url || "",
      trip_date: localSettings.trip_date_raw || localSettings.trip_date || "",
      pickup_locations: localSettings.pickup_locations || "",
      is_active: localSettings.is_active,
    };
    const { error } = await supabase
      .from("trivandrum_settings")
      .update(payload)
      .eq("id", tvmSettingsId || "0c62e1c2-4d73-457b-bf49-bb077ebdba3e");
    if (error) {
      tvmFlash("Save failed: " + error.message);
    } else {
      setTvmSettings({ ...localSettings, trip_date: payload.trip_date });
      tvmFlash("Settings saved - trip date: " + (payload.trip_date || "none"));
    }
    setSavingTvm(false);
  }

  async function addExpense() {
    if (!newExpense.description || !newExpense.amount) return;
    const { data } = await supabase
      .from("expenses")
      .insert({
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: "trivandrum",
        date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();
    if (data) setTvmExpenses((prev: any[]) => [data, ...prev]);
    setNewExpense({ description: "", amount: "" });
    setAddingExpense(false);
  }

  const S = {
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
    } as React.CSSProperties,
    label: {
      fontSize: "0.62rem",
      color: "#5a6a80",
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      fontWeight: 700,
      marginBottom: 12,
    } as React.CSSProperties,
    stat: {
      fontSize: "1.6rem",
      fontWeight: 700,
      color: "#f0f4ff",
      lineHeight: 1,
    } as React.CSSProperties,
    sub: {
      fontSize: "0.68rem",
      color: "#5a6a80",
      marginTop: 3,
    } as React.CSSProperties,
    btn: (color: string) =>
      ({
        padding: "9px 16px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        fontSize: "0.82rem",
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
        background: `rgba(${color},0.18)`,
        color: `rgb(${color})`,
      }) as React.CSSProperties,
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px 40px" }}>
      {/* ── Stats overview ───────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={S.card}>
          <p style={S.label}>Orders</p>
          <p style={S.stat}>{confirmedOrders.length}</p>
          <p style={S.sub}>
            {pendingOrders.length} pending · {cancelledOrders.length} cancelled
          </p>
        </div>
        <div style={S.card}>
          <p style={S.label}>Mochis</p>
          <p style={S.stat}>{totalMochis}</p>
          <p style={S.sub}>Cost: ₹{mochiCost.toLocaleString()}</p>
        </div>
        <div style={S.card}>
          <p style={S.label}>Revenue</p>
          <p style={{ ...S.stat, color: "#34d97b" }}>
            ₹{totalRevenue.toLocaleString()}
          </p>
          <p style={S.sub}>From {confirmedOrders.length} paid orders</p>
        </div>
        <div
          style={{
            ...S.card,
            border: `1px solid ${netProfit >= 0 ? "rgba(52,217,123,0.3)" : "rgba(255,92,108,0.3)"}`,
          }}
        >
          <p style={S.label}>Net Profit</p>
          <p
            style={{ ...S.stat, color: netProfit >= 0 ? "#34d97b" : "#ff5c6c" }}
          >
            ₹{netProfit.toLocaleString()}
          </p>
          <p style={S.sub}>After mochi + trip expenses</p>
        </div>
      </div>

      {/* ── Funnel analytics ─────────────────────────────────── */}
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <p style={{ ...S.label, marginBottom: 0 }}>Customer Funnel</p>
          <button
            onClick={async () => {
              const events = [
                "page_view",
                "order_now_tap",
                "reached_flavours",
                "place_order_tap",
                "whatsapp_open",
              ];
              const counts: any = {};
              await Promise.all(
                events.map(async (ev) => {
                  const { count } = await supabase
                    .from("trivandrum_events")
                    .select("*", { count: "exact", head: true })
                    .eq("event", ev);
                  counts[ev] = count || 0;
                }),
              );
              setAnalytics(counts);
            }}
            style={{
              fontSize: "0.7rem",
              color: "#60a5fa",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "system-ui",
            }}
          >
            ↻ Refresh
          </button>
        </div>
        {analytics === null ? (
          <p
            style={{
              fontSize: "0.78rem",
              color: "#5a6a80",
              textAlign: "center",
              padding: "8px 0",
            }}
          >
            Loading…
          </p>
        ) : (
          (() => {
            const steps = [
              { label: "Visited page", key: "page_view", icon: "👁" },
              {
                label: "Reached flavours",
                key: "reached_flavours",
                icon: "🍡",
              },
              { label: "Tapped Order Now", key: "order_now_tap", icon: "👆" },
              {
                label: "Tapped Place Order",
                key: "place_order_tap",
                icon: "✅",
              },
              { label: "Opened WhatsApp", key: "whatsapp_open", icon: "📲" },
            ];
            const base = analytics.page_view || 1;
            return (
              <div>
                {steps.map((step, i) => {
                  const count = (analytics as any)[step.key] || 0;
                  const pct = Math.round((count / base) * 100);
                  const dropPct =
                    i > 0
                      ? Math.round(
                          (((analytics as any)[steps[i - 1].key] - count) /
                            Math.max((analytics as any)[steps[i - 1].key], 1)) *
                            100,
                        )
                      : 0;
                  return (
                    <div key={step.key} style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ fontSize: "0.8rem", color: "#f0f4ff" }}>
                          {step.icon} {step.label}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {i > 0 && dropPct > 0 && (
                            <span
                              style={{ fontSize: "0.65rem", color: "#ff5c6c" }}
                            >
                              -{dropPct}%
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              color:
                                i === 0
                                  ? "#f0f4ff"
                                  : pct > 50
                                    ? "#34d97b"
                                    : pct > 20
                                      ? "#f0b040"
                                      : "#ff5c6c",
                            }}
                          >
                            {count}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 99,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background:
                              i === 0
                                ? "rgba(96,165,250,0.6)"
                                : i === steps.length - 1
                                  ? "#34d97b"
                                  : "rgba(240,176,64,0.6)",
                            borderRadius: 99,
                            transition: "width 0.4s",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: "#5a6a80" }}>
                    WhatsApp conversion
                  </span>
                  <span
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      color: "#34d97b",
                    }}
                  >
                    {base > 0
                      ? Math.round((analytics.whatsapp_open / base) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Profit breakdown */}
      <div style={{ ...S.card, marginBottom: 14 }}>
        <p style={S.label}>Profit Breakdown</p>
        {[
          ["Revenue", `₹${totalRevenue.toLocaleString()}`, "#f0f4ff"],
          ["Mochi cost", `-₹${mochiCost.toLocaleString()}`, "#ff5c6c"],
          ["Trip expenses", `-₹${totalExpenses.toLocaleString()}`, "#ff5c6c"],
        ].map(([label, val, color]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: "0.82rem", color: "#5a6a80" }}>
              {label}
            </span>
            <span style={{ fontSize: "0.88rem", fontWeight: 600, color }}>
              {val}
            </span>
          </div>
        ))}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 10,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{ fontSize: "0.88rem", fontWeight: 700, color: "#f0f4ff" }}
          >
            Net
          </span>
          <span
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: netProfit >= 0 ? "#34d97b" : "#ff5c6c",
            }}
          >
            ₹{netProfit.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Trip Expenses ────────────────────────────────────── */}
      <div style={S.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <p style={{ ...S.label, marginBottom: 0 }}>Trip Expenses</p>
          <button
            onClick={() => setAddingExpense((v) => !v)}
            style={S.btn("96,165,250")}
          >
            {addingExpense ? "Cancel" : "+ Add"}
          </button>
        </div>

        {addingExpense && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              placeholder="Description (e.g. Train tickets)"
              value={newExpense.description}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, description: e.target.value }))
              }
              style={{
                flex: 2,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#f0f4ff",
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: "0.82rem",
                fontFamily: "system-ui, sans-serif",
                outline: "none",
              }}
            />
            <input
              placeholder="Amount"
              type="number"
              value={newExpense.amount}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, amount: e.target.value }))
              }
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#f0f4ff",
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: "0.82rem",
                fontFamily: "system-ui, sans-serif",
                outline: "none",
              }}
            />
            <button onClick={addExpense} style={S.btn("52,217,123")}>
              Save
            </button>
          </div>
        )}

        {tvmExpenses.length === 0 ? (
          <p
            style={{
              fontSize: "0.78rem",
              color: "#5a6a80",
              textAlign: "center",
              padding: "12px 0",
            }}
          >
            No expenses added yet
          </p>
        ) : (
          <div>
            {tvmExpenses.map((e: any) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div>
                  <p style={{ fontSize: "0.85rem", color: "#f0f4ff" }}>
                    {e.description}
                  </p>
                  <p style={{ fontSize: "0.68rem", color: "#5a6a80" }}>
                    {e.date}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#ff5c6c",
                  }}
                >
                  -₹{e.amount}
                </span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 10,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#f0f4ff",
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#ff5c6c",
                }}
              >
                -₹{totalExpenses.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Settings ─────────────────────────────────────────── */}
      <div style={S.card}>
        <p style={S.label}>Trivandrum Settings</p>

        {/* Active toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div>
            <p
              style={{ fontSize: "0.85rem", color: "#f0f4ff", fontWeight: 600 }}
            >
              Pre-orders Active
            </p>
            <p style={{ fontSize: "0.7rem", color: "#5a6a80" }}>
              Turn off to pause new orders on /trivandrum
            </p>
          </div>
          <button
            onClick={async () => {
              const next = !localSettings.is_active;
              setLocalSettings((p: any) => ({ ...p, is_active: next }));
              await supabase
                .from("trivandrum_settings")
                .update({ is_active: next })
                .eq(
                  "id",
                  tvmSettingsId || "0c62e1c2-4d73-457b-bf49-bb077ebdba3e",
                );
              tvmFlash(next ? "Pre-orders active" : "Pre-orders paused");
            }}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: localSettings.is_active
                ? "rgba(52,217,123,0.18)"
                : "rgba(255,92,108,0.15)",
              color: localSettings.is_active ? "#34d97b" : "#ff5c6c",
              fontSize: "0.8rem",
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {localSettings.is_active ? "Active" : "Paused"}
          </button>
        </div>

        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Trip Date
        </p>
        <input
          type="date"
          value={localSettings.trip_date_raw || ""}
          onChange={(e) => {
            const raw = e.target.value; // "2026-06-14" — stored in DB
            const display = raw
              ? new Date(raw + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "";
            setLocalSettings((p: any) => ({
              ...p,
              trip_date_raw: raw,
              trip_date: raw,
              trip_date_display: display,
            }));
          }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f0f4ff",
            padding: "9px 12px",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: 4,
            outline: "none",
            fontFamily: "system-ui, sans-serif",
            boxSizing: "border-box" as const,
            colorScheme: "dark" as const,
          }}
        />
        {localSettings.trip_date_display || localSettings.trip_date ? (
          <p
            style={{
              fontSize: "0.75rem",
              color: "#f0b040",
              marginBottom: 10,
              fontWeight: 600,
            }}
          >
            Shows as:{" "}
            {localSettings.trip_date_display ||
              new Date(
                (localSettings.trip_date || "") + "T00:00:00",
              ).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
          </p>
        ) : (
          <p
            style={{ fontSize: "0.72rem", color: "#5a6a80", marginBottom: 10 }}
          >
            No date set - hidden on customer page
          </p>
        )}

        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Pickup Locations (pipe-separated, name::area description)
        </p>
        <textarea
          placeholder="Thampanoor::Railway Station area · South Trivandrum|Pattom::Pattom Junction · Central Trivandrum"
          value={localSettings.pickup_locations || ""}
          onChange={(e) =>
            setLocalSettings((p: any) => ({
              ...p,
              pickup_locations: e.target.value,
            }))
          }
          rows={3}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f0f4ff",
            padding: "9px 12px",
            borderRadius: 8,
            fontSize: "0.82rem",
            marginBottom: 10,
            outline: "none",
            fontFamily: "system-ui, sans-serif",
            boxSizing: "border-box" as const,
            resize: "vertical",
          }}
        />

        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Pickup Name (legacy single location)
        </p>
        <input
          placeholder="e.g. Cafe Aromas, Kowdiar"
          value={localSettings.pickup_name || ""}
          onChange={(e) =>
            setLocalSettings((p: any) => ({
              ...p,
              pickup_name: e.target.value,
            }))
          }
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f0f4ff",
            padding: "9px 12px",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: 10,
            outline: "none",
            fontFamily: "system-ui, sans-serif",
            boxSizing: "border-box" as const,
          }}
        />
        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Pickup Address
        </p>
        <input
          placeholder="Full address"
          value={localSettings.pickup_address || ""}
          onChange={(e) =>
            setLocalSettings((p: any) => ({
              ...p,
              pickup_address: e.target.value,
            }))
          }
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f0f4ff",
            padding: "9px 12px",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: 10,
            outline: "none",
            fontFamily: "system-ui, sans-serif",
            boxSizing: "border-box" as const,
          }}
        />
        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Google Maps URL
        </p>
        <input
          placeholder="https://maps.google.com/..."
          value={localSettings.pickup_maps_url || ""}
          onChange={(e) =>
            setLocalSettings((p: any) => ({
              ...p,
              pickup_maps_url: e.target.value,
            }))
          }
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f0f4ff",
            padding: "9px 12px",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: 12,
            outline: "none",
            fontFamily: "system-ui, sans-serif",
            boxSizing: "border-box" as const,
          }}
        />

        <button
          onClick={saveSettings}
          disabled={savingTvm}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: 10,
            border: "none",
            background: "rgba(96,165,250,0.18)",
            color: "#60a5fa",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {savingTvm ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* ── Pending payment orders ───────────────────────────── */}
      {pendingOrders.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ ...S.label, color: "#f0b040", marginBottom: 12 }}>
            Awaiting Payment ({pendingOrders.length})
          </p>
          {pendingOrders.map((o: any) => (
            <div
              key={o.id}
              style={{ ...S.card, border: "1px solid rgba(240,176,64,0.3)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <p
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "#f0f4ff",
                  }}
                >
                  {o.customer_name}
                </p>
                <p
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "#f0b040",
                  }}
                >
                  ₹{o.total_price}
                </p>
              </div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#5a6a80",
                  marginBottom: 8,
                }}
              >
                {o.phone}
              </p>
              {o.flavours && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap" as const,
                    gap: 4,
                    marginBottom: 10,
                  }}
                >
                  {Object.entries(o.flavours as Record<string, number>)
                    .filter(([, q]) => q > 0)
                    .map(([id, qty]) => (
                      <FlavourPill
                        key={id}
                        name={productMap[id] || "Unknown"}
                        qty={qty}
                      />
                    ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={async () => {
                    await supabase
                      .from("orders")
                      .update({
                        status: "confirmed",
                        payment_confirmed_at: new Date().toISOString(),
                      })
                      .eq("id", o.id);
                    load();
                    tvmFlash("Payment confirmed");
                  }}
                  style={S.btn("52,217,123")}
                >
                  Confirm Payment
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Cancel order for ${o.customer_name}?`))
                      return;
                    await supabase
                      .from("orders")
                      .update({ status: "cancelled" })
                      .eq("id", o.id);
                    load();
                    tvmFlash("Order cancelled");
                  }}
                  style={S.btn("255,92,108")}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Confirmed orders ─────────────────────────────────── */}
      <p style={{ ...S.label, marginBottom: 12 }}>
        Confirmed Orders ({confirmedOrders.length})
      </p>
      {confirmedOrders.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "32px 20px" }}>
          <p style={{ color: "#5a6a80", fontSize: "0.85rem" }}>
            No confirmed Trivandrum orders yet
          </p>
        </div>
      ) : (
        confirmedOrders.map((o: any) => (
          <div
            key={o.id}
            style={{
              ...S.card,
              borderLeft: "3px solid rgba(52,217,123,0.5)",
              border: "1px solid rgba(52,217,123,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <p
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#f0f4ff",
                }}
              >
                {o.customer_name}
              </p>
              <p
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#34d97b",
                }}
              >
                ₹{o.total_price}
              </p>
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#5a6a80",
                marginBottom: o.flavours ? 8 : 0,
              }}
            >
              {o.phone}
            </p>
            {o.flavours && (
              <div
                style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}
              >
                {Object.entries(o.flavours as Record<string, number>)
                  .filter(([, q]) => q > 0)
                  .map(([id, qty]) => (
                    <FlavourPill
                      key={id}
                      name={productMap[id] || "Unknown"}
                      qty={qty}
                    />
                  ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
