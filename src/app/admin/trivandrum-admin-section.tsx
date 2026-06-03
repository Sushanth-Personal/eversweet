// ─────────────────────────────────────────────────────────────────
// TRIVANDRUM ADMIN SECTION
// Instructions:
// 1. Add "trivandrum" to your Tab type
// 2. Add the state variables below to AdminPage
// 3. Add the NavBtn for Trivandrum
// 4. Paste the tab content block into your tab rendering section
// 5. Add loadTrivandrum() call inside your load() function
// ─────────────────────────────────────────────────────────────────

// ── 1. Add to Tab type ────────────────────────────────────────────
// type Tab = "cook" | "pending_payment" | "orders" | "customers" | "dashboard" | "more" | "trivandrum";

// ── 2. Add these state variables inside AdminPage ─────────────────
/*
const [tvmOrders, setTvmOrders] = useState<ExtOrder[]>([]);
const [tvmSettings, setTvmSettings] = useState({
  pickup_name: "",
  pickup_address: "",
  pickup_maps_url: "",
  min_orders: 8,
  current_message: "",
  is_active: true,
});
const [tvmSettingsId, setTvmSettingsId] = useState<string>("");
const [savingTvm, setSavingTvm] = useState(false);
*/

// ── 3. Add to your load() function ───────────────────────────────
/*
const { data: tvmO } = await supabase
  .from("orders")
  .select("*")
  .eq("source", "trivandrum")
  .order("created_at", { ascending: false });
if (tvmO) setTvmOrders(tvmO as ExtOrder[]);

const { data: tvmS } = await supabase
  .from("trivandrum_settings")
  .select("*")
  .single();
if (tvmS) {
  setTvmSettings({
    pickup_name: tvmS.pickup_name || "",
    pickup_address: tvmS.pickup_address || "",
    pickup_maps_url: tvmS.pickup_maps_url || "",
    min_orders: tvmS.min_orders || 8,
    current_message: tvmS.current_message || "",
    is_active: tvmS.is_active ?? true,
  });
  setTvmSettingsId(tvmS.id);
}
*/

// ── 4. Add NavBtn (inside your bottom nav div) ────────────────────
/*
<NavBtn id="trivandrum" icon="🚂" label="TVM" />
*/

// ── 5. Paste this entire block into your tab rendering section ────

export function TrivandrumAdminTab({
  tvmOrders,
  tvmSettings,
  tvmSettingsId,
  savingTvm,
  setSavingTvm,
  tvmFlash,
  load,
  supabase,
  productMap,
  G,
  GlassInput,
  GlassBtn,
  FlavourPill,
}: any) {
  const MIN_ORDERS = tvmSettings.min_orders || 8;
  const paidTvmOrders = tvmOrders.filter((o: any) =>
    ["confirmed", "cooking", "cooked", "porter_booked", "dispatched"].includes(
      o.status,
    ),
  );
  const pendingTvmOrders = tvmOrders.filter((o: any) => o.status === "pending");
  const totalRevenue = paidTvmOrders.reduce(
    (s: number, o: any) => s + (o.total_price || 0),
    0,
  );
  const progress = Math.min((paidTvmOrders.length / MIN_ORDERS) * 100, 100);
  const spotsLeft = Math.max(0, MIN_ORDERS - paidTvmOrders.length);
  const thresholdMet = paidTvmOrders.length >= MIN_ORDERS;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px 20px" }}>
      {/* ── Threshold status ───────────────────────────────────── */}
      <div
        style={{
          background: thresholdMet
            ? "rgba(52,217,123,0.1)"
            : "rgba(240,176,64,0.1)",
          border: `1px solid ${thresholdMet ? "rgba(52,217,123,0.35)" : "rgba(240,176,64,0.35)"}`,
          borderRadius: 14,
          padding: "16px 18px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.65rem",
                color: thresholdMet ? "#34d97b" : "#f0b040",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Trivandrum Pre-order Status
            </p>
            <p
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: thresholdMet ? "#34d97b" : "#f0f4ff",
                lineHeight: 1,
              }}
            >
              {thresholdMet
                ? "🎉 Trip Confirmed!"
                : `${spotsLeft} more orders needed`}
            </p>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <p
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                color: "#f0f4ff",
                lineHeight: 1,
              }}
            >
              {paidTvmOrders.length}
              <span style={{ fontSize: "1rem", color: "#5a6a80" }}>
                /{MIN_ORDERS}
              </span>
            </p>
            <p style={{ fontSize: "0.65rem", color: "#5a6a80", marginTop: 2 }}>
              paid orders
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div
          style={{
            height: 8,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 99,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 99,
              width: `${progress}%`,
              background: thresholdMet
                ? "linear-gradient(90deg, #34d97b, #22c55e)"
                : "linear-gradient(90deg, rgba(240,176,64,0.6), #f0b040)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontSize: "0.72rem", color: "#5a6a80" }}>
            {pendingTvmOrders.length} pending payment · {tvmOrders.length} total
          </p>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#34d97b" }}>
            ₹{totalRevenue.toLocaleString()} collected
          </p>
        </div>
      </div>

      {/* ── Settings ───────────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            color: "#5a6a80",
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            marginBottom: 14,
            fontWeight: 700,
          }}
        >
          ⚙️ Trivandrum Settings
        </p>

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
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div>
            <p
              style={{ fontSize: "0.85rem", color: "#f0f4ff", fontWeight: 600 }}
            >
              Pre-orders Active
            </p>
            <p style={{ fontSize: "0.7rem", color: "#5a6a80" }}>
              Turn off to pause new orders from the /trivandrum page
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase
                .from("trivandrum_settings")
                .update({ is_active: !tvmSettings.is_active })
                .eq("id", tvmSettingsId);
              load();
            }}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: tvmSettings.is_active
                ? "rgba(52,217,123,0.18)"
                : "rgba(255,92,108,0.15)",
              color: tvmSettings.is_active ? "#34d97b" : "#ff5c6c",
              fontSize: "0.8rem",
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {tvmSettings.is_active ? "Active" : "Paused"}
          </button>
        </div>

        {/* Min orders */}
        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Minimum orders to confirm trip
        </p>
        <GlassInput
          placeholder="Minimum orders (e.g. 8)"
          type="number"
          value={String(tvmSettings.min_orders)}
          onChange={(v: string) => {}}
        />

        {/* Pickup location */}
        <p
          style={{
            fontSize: "0.68rem",
            color: "#5a6a80",
            marginBottom: 4,
            marginTop: 8,
          }}
        >
          Pickup Location Name
        </p>
        <GlassInput
          placeholder="e.g. Café Aromas, Kowdiar"
          value={tvmSettings.pickup_name}
          onChange={(v: string) => {}}
        />
        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Pickup Address
        </p>
        <GlassInput
          placeholder="Full address shown to customers"
          value={tvmSettings.pickup_address}
          onChange={(v: string) => {}}
        />
        <p style={{ fontSize: "0.68rem", color: "#5a6a80", marginBottom: 4 }}>
          Google Maps URL
        </p>
        <GlassInput
          placeholder="https://maps.google.com/..."
          value={tvmSettings.pickup_maps_url}
          onChange={(v: string) => {}}
        />

        {/* NOTE: In the real implementation, wire up onChange handlers to local state
            and then call supabase update on Save. This is the structure. */}
        <button
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
            marginTop: 8,
          }}
        >
          {savingTvm ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {/* ── Pending payment TVM orders ─────────────────────────── */}
      {pendingTvmOrders.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: "0.65rem",
              color: "#f0b040",
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              marginBottom: 12,
              fontWeight: 700,
            }}
          >
            💳 Awaiting Payment ({pendingTvmOrders.length})
          </p>
          {pendingTvmOrders.map((o: any) => (
            <div
              key={o.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(240,176,64,0.3)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 8,
              }}
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
                📞 {o.phone}
              </p>
              {o.flavours &&
                Object.entries(o.flavours as Record<string, number>).filter(
                  ([, q]) => q > 0,
                ).length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap" as const,
                      marginBottom: 8,
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
                    tvmFlash("Payment confirmed ✓");
                  }}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: 8,
                    border: "none",
                    background: "rgba(52,217,123,0.18)",
                    color: "#34d97b",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  ✓ Confirm Payment
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
                  style={{
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "rgba(255,92,108,0.15)",
                    color: "#ff5c6c",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Confirmed TVM orders ───────────────────────────────── */}
      <p
        style={{
          fontSize: "0.65rem",
          color: "#5a6a80",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          marginBottom: 12,
          fontWeight: 700,
        }}
      >
        ✓ Confirmed Orders ({paidTvmOrders.length})
      </p>
      {paidTvmOrders.length === 0 ? (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center" as const,
          }}
        >
          <p style={{ fontSize: "1.5rem", marginBottom: 8 }}>🚂</p>
          <p style={{ color: "#5a6a80", fontSize: "0.85rem" }}>
            No confirmed Trivandrum orders yet
          </p>
        </div>
      ) : (
        paidTvmOrders.map((o: any) => {
          const flavours = o.flavours
            ? Object.entries(o.flavours as Record<string, number>).filter(
                ([, q]) => q > 0,
              )
            : [];
          return (
            <div
              key={o.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(52,217,123,0.2)",
                borderLeft: "3px solid rgba(52,217,123,0.5)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 8,
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
                  marginBottom: 6,
                }}
              >
                📞 {o.phone}
              </p>
              {flavours.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap" as const }}>
                  {flavours.map(([id, qty]) => (
                    <FlavourPill
                      key={id}
                      name={productMap[id] || "Unknown"}
                      qty={qty}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
