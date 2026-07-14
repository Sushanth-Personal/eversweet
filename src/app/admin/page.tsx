"use client";

import React, { useEffect, useState, useCallback } from "react";
import { SmartOrderModal, SmartOrderNavBtn } from "./SmartOrderModal";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize } from "@/lib/types";
import { TrivandrumAdminTab } from "./trivandrum-admin-section";
import { InvoiceModal, InvoiceNavBtn } from "./InvoiceModal";
import { QuickCaptureModal, QuickCaptureNavBtn } from "./QuickCaptureModal";
import { G, getFlavourColor } from "./_lib/theme";
import { CostPerMochiPanel } from "./_components/CostPerMochiPanel";
import type { IngredientRate, ProductRecipeRow } from "./_lib/costing";
import {
  ALL_SLOTS,
  CATEGORY_CONFIG,
  PAID_STATUSES,
  STATUS_LABELS,
  TRACKING_START_DATE,
  type Expense,
  type ExtOrder,
  type MoreTab,
  type OrdersFilterPreset,
  type Tab,
} from "./_lib/constants";

import { GlassInput, GlassBtn, GlassStatCard } from "./_components/Shared";
import { FlavourPill } from "./_components/FlavourPill";
import { StartDateEditor } from "./_components/StartDateEditor";
import { CookTab } from "./_components/CookTab";
import { ManualOrderForm } from "./_components/ManualOrderForm";
import { PendingOrderCard } from "./_components/PendingOrderCard";
import { BulkOrderImport } from "./_components/BulkOrderImport";
import { ExpenseScanner } from "./_components/ExpenseScanner";
import { ExpenseImporter } from "./_components/ExpenseImporter";
import { OrderEditModal } from "./_components/OrderEditModal";
import { AllOrdersTab } from "./_components/AllOrdersTab";
import { BoxSizeRow } from "./_components/BoxSizeRow";

export default function AdminPage() {
  /* ---------- State ---------- */
  const [showSmartOrder, setShowSmartOrder] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("cook");
  const [ordersFilterPreset, setOrdersFilterPreset] =
    useState<OrdersFilterPreset>(null);
  const [moreTab, setMoreTab] = useState<MoreTab>("products");
  const [orders, setOrders] = useState<ExtOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<BoxSize[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [repeatPhones, setRepeatPhones] = useState<Set<string>>(new Set());
  const [showManualForm, setShowManualForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [editRemarks, setEditRemarks] = useState("");
  const [editInsta, setEditInsta] = useState("");
  const [editingOrder, setEditingOrder] = useState<ExtOrder | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [np, setNp] = useState({
    name: "",
    description: "",
    is_premium: false,
    image_url: "",
  });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [ep, setEp] = useState({
    name: "",
    description: "",
    is_premium: false,
    image_url: "",
  });

  // "Add Box Size" form — includes Trivandrum price (priceTvm)
  const [nb, setNb] = useState({
    label: "",
    count: "",
    price: "",
    priceTvm: "",
  });

  const [ne, setNe] = useState({
    description: "",
    amount: "",
    category: "ingredient",
    date: new Date().toISOString().split("T")[0],
    note: "",
    item_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" }>({
    text: "",
    type: "success",
  });
  const [dashPeriod, setDashPeriod] = useState<
    "from_start" | "today" | "week" | "month" | "all"
  >("from_start");
  const [trackingStart, setTrackingStart] = useState<string>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("es_tracking_start") || TRACKING_START_DATE
      : TRACKING_START_DATE,
  );
  const [expandedPorter, setExpandedPorter] = useState<Set<string>>(new Set());

  // TVM state
  const [tvmOrders, setTvmOrders] = useState<ExtOrder[]>([]);
  const [tvmSettings, setTvmSettings] = useState({
    pickup_name: "",
    pickup_address: "",
    pickup_maps_url: "",
    is_active: true,
    trip_date: "",
    pickup_locations: "",
  });
  const [tvmSettingsId, setTvmSettingsId] = useState<string>("");
  const [savingTvm, setSavingTvm] = useState(false);

  // Cost-per-mochi state
  const [ingredientRates, setIngredientRates] = useState<IngredientRate[]>([]);
  const [productRecipes, setProductRecipes] = useState<ProductRecipeRow[]>([]);

  useEffect(() => {
    if (localStorage.getItem("es_admin") === "true") setAuthed(true);
  }, []);

  const productMap: Record<string, string> = {};
  products.forEach((p) => {
    productMap[p.id] = p.name;
  });

  /* ---------- Data loading ---------- */
  const load = useCallback(async () => {
    const [
      { data: o },
      { data: p },
      { data: b },
      { data: ex },
      { data: tvmO },
      { data: tvmS },
      { data: rates },
      { data: recipes },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("box_sizes").select("*").order("sort_order"),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase
        .from("orders")
        .select("*")
        .eq("source", "trivandrum")
        .order("created_at", { ascending: false }),
      supabase.from("trivandrum_settings").select("*").single(),
      supabase.from("ingredient_rates").select("*"),
      supabase.from("product_recipes").select("*"),
    ]);
    if (o) {
      setOrders(o as ExtOrder[]);
      const counts: Record<string, number> = {};
      (o as ExtOrder[]).forEach((ord) => {
        if (ord.phone) counts[ord.phone] = (counts[ord.phone] || 0) + 1;
      });
      setRepeatPhones(
        new Set(
          Object.entries(counts)
            .filter(([, c]) => c > 1)
            .map(([ph]) => ph),
        ),
      );
    }
    if (p) setProducts(p as Product[]);
    if (b) setBoxes(b as BoxSize[]);
    if (ex) setExpenses(ex as Expense[]);
    if (tvmO) setTvmOrders(tvmO as ExtOrder[]);
    if (tvmS) {
      setTvmSettings({
        pickup_name: tvmS.pickup_name || "",
        pickup_address: tvmS.pickup_address || "",
        pickup_maps_url: tvmS.pickup_maps_url || "",
        is_active: tvmS.is_active ?? true,
        trip_date: tvmS.trip_date || "",
        pickup_locations: tvmS.pickup_locations || "",
      });
      setTvmSettingsId(tvmS.id);
    }
    if (rates) setIngredientRates(rates as IngredientRate[]);
    if (recipes) setProductRecipes(recipes as ProductRecipeRow[]);
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  function flash(text: string, type: "success" | "error" = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 3500);
  }
  function slugify(s: string) {
    return s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  /* ---------- Handlers ---------- */
  async function handleStatusChange(id: string, status: string) {
    const updatePayload: Record<string, unknown> = { status };
    if (status === "confirmed")
      updatePayload.payment_confirmed_at = new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id);
    if (error) {
      flash("Error: " + error.message, "error");
      return;
    }
    await load();
    flash(`Marked as ${STATUS_LABELS[status] || status} ✓`);
  }

  async function handleCancel(id: string) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    await load();
    flash("Order cancelled");
  }

  async function handlePorterEmail(order: ExtOrder) {
    try {
      const res = await fetch("/api/porter-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: order.customer_name,
          phone: order.phone,
          address: order.address,
          slot: order.delivery_slot || order.batch_label,
          total_price: order.total_price,
        }),
      });
      if (res.ok) flash("📧 Porter email sent ✓");
      else flash("Email failed", "error");
    } catch {
      flash("Email failed", "error");
    }
  }

  const FIXED_TVM_SETTINGS_ID = "0c62e1c2-4d73-457b-bf49-bb077ebdba3e";

  async function handleSendToDelivery(order: ExtOrder) {
    const tripDate = tvmSettings.trip_date;
    if (!tripDate) {
      flash("Set a Trivandrum trip date first (Trivandrum tab)", "error");
      return;
    }

    // Avoid adding the same order twice
    const { data: existing } = await supabase
      .from("tvm_delivery_stops")
      .select("id, sequence")
      .eq("trip_date", tripDate)
      .order("sequence", { ascending: false });

    const alreadyThere = (existing || []).some(
      (s: any) => s.notes && s.notes.includes(order.id.slice(0, 8)),
    );
    if (alreadyThere) {
      flash("This order is already on the delivery route");
      return;
    }

    const nextSeq =
      existing && existing.length > 0 ? existing[0].sequence + 1 : 1;

    const isPickup = order.fulfillment_type === "pickup";
    const { error } = await supabase.from("tvm_delivery_stops").insert({
      trip_date: tripDate,
      sequence: nextSeq,
      customer_name: order.customer_name,
      phone: order.phone || null,
      address: order.address || null,
      maps_url: null,
      distance_km: 0,
      dispatch_distance_km: 0,
      notes: `Order #${order.id.slice(0, 8).toUpperCase()}${isPickup ? " · Marked Pickup — confirm before dispatch" : ""}`,
      status: "pending",
    });

    if (error) {
      flash("Failed to add to delivery route: " + error.message, "error");
      return;
    }
    flash(`${order.customer_name} added to delivery route ✓`);
  }

  async function handleBulkOrderImport(text: string) {
    try {
      const data = JSON.parse(text.trim());
      const items = Array.isArray(data) ? data : data.orders;
      if (!Array.isArray(items)) throw new Error("Expected array");
      const res = await fetch("/api/import-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await load();
      flash(`${result.imported} orders imported ✓`);
    } catch (err: unknown) {
      flash(
        `Import failed: ${err instanceof Error ? err.message : "Invalid JSON"}`,
        "error",
      );
    }
  }

  async function handleExpenseImport(text: string) {
    try {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data.expenses;
      if (!Array.isArray(items)) throw new Error("Expected array");
      const now = new Date();
      const uploadedDate = new Date(now.getTime() + 5.5 * 3600000)
        .toISOString()
        .split("T")[0];
      const valid = items
        .filter(
          (e: { description: string; amount: number }) =>
            e.description && Number(e.amount) > 0,
        )
        .map(
          (e: {
            description: string;
            amount: number;
            category?: string;
            note?: string;
          }) => ({
            description: String(e.description).trim(),
            amount: Number(e.amount),
            category: e.category || "ingredient",
            date: uploadedDate,
            note: e.note || "AI Scanned Bill",
          }),
        );
      if (valid.length === 0) throw new Error("No valid entries");
      const { error } = await supabase.from("expenses").insert(valid);
      if (error) throw error;
      await load();
      flash(`${valid.length} expenses added ✓`);
    } catch (err: unknown) {
      flash(
        `Import failed: ${err instanceof Error ? err.message : "Invalid JSON"}`,
        "error",
      );
    }
  }

  function filterRevenueByPeriod(items: ExtOrder[]): ExtOrder[] {
    const now = new Date();
    const localNow = new Date(now.getTime() + 5.5 * 3600000);
    const todayStr = localNow.toISOString().split("T")[0];
    return items.filter((item) => {
      const confirmedAt = item.payment_confirmed_at;
      const dateStr = confirmedAt
        ? new Date(confirmedAt).toISOString().split("T")[0]
        : item.delivery_date ||
          item.order_date ||
          item.created_at?.split("T")[0] ||
          "";
      if (dashPeriod === "from_start") return dateStr >= trackingStart;
      if (dashPeriod === "today") return dateStr === todayStr;
      if (dashPeriod === "week") {
        const day = localNow.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(localNow);
        monday.setDate(localNow.getDate() - diff);
        return (
          dateStr >= monday.toISOString().split("T")[0] && dateStr <= todayStr
        );
      }
      if (dashPeriod === "month")
        return dateStr.startsWith(todayStr.substring(0, 7));
      return true;
    });
  }

  function filterExpByPeriod(items: Expense[]): Expense[] {
    const now = new Date();
    const localNow = new Date(now.getTime() + 5.5 * 3600000);
    const todayStr = localNow.toISOString().split("T")[0];
    return items.filter((item) => {
      if (dashPeriod === "from_start") return item.date >= trackingStart;
      if (dashPeriod === "today") return item.date === todayStr;
      if (dashPeriod === "week") {
        const day = localNow.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(localNow);
        monday.setDate(localNow.getDate() - diff);
        return item.date >= monday.toISOString().split("T")[0];
      }
      if (dashPeriod === "month")
        return item.date.startsWith(todayStr.substring(0, 7));
      return true;
    });
  }

  /* ---------- Derived/computed values ---------- */
  const paidOrders = filterRevenueByPeriod(
    orders.filter((o) => PAID_STATUSES.includes(o.status)),
  ) as ExtOrder[];
  const periodExpenses = filterExpByPeriod(expenses);
  const totalRevenue = paidOrders.reduce((s, o) => s + (o.total_price || 0), 0);
  const totalExpenses = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const ingredientExp = periodExpenses
    .filter((e) => e.category === "ingredient")
    .reduce((s, e) => s + e.amount, 0);
  const packagingExp = periodExpenses
    .filter((e) => e.category === "packaging")
    .reduce((s, e) => s + e.amount, 0);
  const fixedExp = periodExpenses
    .filter((e) => e.category === "fixed")
    .reduce((s, e) => s + e.amount, 0);
  const marketingExp = periodExpenses
    .filter((e) => e.category === "marketing")
    .reduce((s, e) => s + e.amount, 0);
  const profit = totalRevenue - totalExpenses;
  const totalMochis = paidOrders.reduce(
    (s, o) =>
      s +
      (o.flavours
        ? Object.values(o.flavours as Record<string, number>).reduce(
            (a, q) => a + q,
            0,
          )
        : 0),
    0,
  );
  const costPerMochi =
    totalMochis > 0 ? Math.round(totalExpenses / totalMochis) : 0;
  const revenuePerMochi =
    totalMochis > 0 ? Math.round(totalRevenue / totalMochis) : 0;
  const flavourCounts: Record<string, number> = {};
  paidOrders.forEach((o) => {
    if (!o.flavours) return;
    Object.entries(o.flavours as Record<string, number>).forEach(
      ([id, qty]) => {
        const name = productMap[id] || id;
        flavourCounts[name] = (flavourCounts[name] || 0) + qty;
      },
    );
  });
  const topFlavours = Object.entries(flavourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  const boxRevenue: Record<string, { count: number; revenue: number }> = {};
  paidOrders.forEach((o) => {
    const label = boxes.find((b) => b.id === o.box_size_id)?.label || "Unknown";
    if (!boxRevenue[label]) boxRevenue[label] = { count: 0, revenue: 0 };
    boxRevenue[label].count++;
    boxRevenue[label].revenue += o.total_price || 0;
  });

  const pendingPaymentOrders = orders.filter(
    (o) => o.status === "pending" && o.source !== "trivandrum",
  );
  const pendingCount = pendingPaymentOrders.length;

  const tvmPaid = tvmOrders.filter((o) => PAID_STATUSES.includes(o.status));
  const tvmPending = tvmOrders.filter((o) => o.status === "pending");
  const tvmMet = tvmPaid.length >= 10;

  const customerMap: Record<
    string,
    {
      name: string;
      phone: string;
      insta_id: string;
      remarks: string;
      orders: ExtOrder[];
      total: number;
    }
  > = {};
  orders.forEach((o) => {
    const key = o.phone || o.customer_name;
    if (!customerMap[key])
      customerMap[key] = {
        name: o.customer_name,
        phone: o.phone || "",
        insta_id: o.insta_id || "",
        remarks: o.remarks || "",
        orders: [],
        total: 0,
      };
    customerMap[key].orders.push(o);
    customerMap[key].total += o.total_price || 0;
    if (o.insta_id) customerMap[key].insta_id = o.insta_id;
    if (o.remarks) customerMap[key].remarks = o.remarks;
  });
  const customers = Object.entries(customerMap)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.total - a.total);
  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      (c.insta_id || "").toLowerCase().includes(customerSearch.toLowerCase()),
  );

  /* ---------- NavBtn ---------- */
  function NavBtn({
    id,
    icon,
    label,
    badge,
  }: {
    id: Tab;
    icon: string;
    label: string;
    badge?: number;
  }) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          padding: "8px 4px 6px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative" as const,
        }}
      >
        <div style={{ position: "relative" }}>
          <span
            style={{
              fontSize: "1.4rem",
              filter: active ? "none" : "grayscale(0.5) opacity(0.5)",
              transition: "all 0.2s",
            }}
          >
            {icon}
          </span>
          {badge && badge > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -6,
                background: "#ff5c6c",
                color: "#fff",
                borderRadius: 8,
                padding: "1px 5px",
                fontSize: "0.55rem",
                fontWeight: 700,
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <span
          style={{
            fontSize: "0.58rem",
            fontWeight: active ? 700 : 400,
            color: active ? G.active : G.muted,
            letterSpacing: "0.04em",
            transition: "all 0.2s",
          }}
        >
          {label}
        </span>
        {active && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 24,
              height: 2,
              background: G.active,
              borderRadius: 1,
            }}
          />
        )}
      </button>
    );
  }

  const selectStyle: React.CSSProperties = {
    width: "100%",
    background: G.glass,
    border: `1px solid ${G.glassBorder}`,
    color: G.text,
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: "0.88rem",
    marginBottom: 8,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
  };

  /* ---------- Login screen ---------- */
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
            background: G.glassStrong,
            border: `1px solid ${G.glassBorderStrong}`,
            borderRadius: 20,
            padding: 32,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <h1
            style={{
              fontSize: "1.8rem",
              fontWeight: 700,
              color: G.text,
              marginBottom: 4,
            }}
          >
            Eversweet
          </h1>
          <p style={{ fontSize: "0.85rem", color: G.muted, marginBottom: 24 }}>
            Admin Panel
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
              background: "rgba(96,165,250,0.22)",
              color: G.blue,
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Sign In
          </button>
        </div>
        {showInvoice && <InvoiceModal onClose={() => setShowInvoice(false)} />}
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
        paddingBottom: 80,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: G.navBg,
          borderBottom: `1px solid ${G.navBorder}`,
          padding: "12px 16px",
          position: "sticky" as const,
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: "1rem", fontWeight: 700, color: G.text }}>
              🍡 Eversweet
            </h1>
            {pendingCount > 0 && (
              <span
                style={{
                  background: "#ff5c6c",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "2px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                }}
              >
                {pendingCount} unpaid
              </span>
            )}
            {tvmMet && (
              <span
                style={{
                  background: "rgba(240,176,64,0.2)",
                  color: G.gold,
                  borderRadius: 10,
                  padding: "2px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  border: `1px solid ${G.goldBorder}`,
                }}
              >
                🚂 TVM ready!
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <InvoiceNavBtn onClick={() => setShowInvoice(true)} />
            <QuickCaptureNavBtn onClick={() => setShowQuickCapture(true)} />
            <button
              onClick={load}
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
                color: G.sub,
                padding: "5px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              ↻
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("es_admin");
                setAuthed(false);
              }}
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
                color: G.muted,
                padding: "5px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {msg.text && (
          <div
            style={{
              background: msg.type === "error" ? G.redGlass : G.greenGlass,
              border: `1px solid ${msg.type === "error" ? "rgba(255,92,108,0.3)" : "rgba(52,217,123,0.3)"}`,
              color: msg.type === "error" ? G.red : G.green,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.85rem",
              margin: "14px 14px 0",
              fontWeight: 500,
            }}
          >
            {msg.text}
          </div>
        )}
      </div>

      {/* TAB: Cook */}
      {tab === "cook" && (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <CookTab
            orders={orders}
            boxes={boxes}
            productMap={productMap}
            expandedPorter={expandedPorter}
            onTogglePorter={(id) =>
              setExpandedPorter((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })
            }
            onSendToDelivery={handleSendToDelivery}
            onPorterEmail={handlePorterEmail}
            onDispatch={async (id) => {
              await handleStatusChange(id, "dispatched");
            }}
            onEdit={(order) => setEditingOrder(order)}
            onCancel={handleCancel}
          />
          <div style={{ padding: "0 14px 14px" }}>
            <button
              onClick={() => setShowManualForm((f) => !f)}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 10,
                border: `1px solid rgba(96,165,250,0.35)`,
                background: G.blueGlass,
                color: G.blue,
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {showManualForm ? "✕ Close Form" : "+ Add Order"}
            </button>
            {showManualForm && (
              <div style={{ marginTop: 12 }}>
                <ManualOrderForm
                  boxes={boxes}
                  customers={customers.map((c) => ({
                    name: c.name,
                    phone: c.phone,
                    insta_id: c.insta_id || "",
                    remarks: c.remarks || "",
                  }))}
                  products={products}
                  onSave={() => {
                    load();
                    setShowManualForm(false);
                    flash("Order saved ✓");
                  }}
                  onClose={() => setShowManualForm(false)}
                />
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <BulkOrderImport onImport={handleBulkOrderImport} />
            </div>
          </div>
        </div>
      )}

      {/* TAB: Pending Payment */}
      {tab === "pending_payment" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          <div
            style={{
              background: G.goldGlass,
              border: `1px solid ${G.goldBorder}`,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: G.gold }}>
              💳 Awaiting payment confirmation
            </p>
            <p style={{ fontSize: "0.75rem", color: "#c8860a", marginTop: 4 }}>
              Once paid, click Confirm to move to cook queue
            </p>
          </div>
          {pendingPaymentOrders.length === 0 ? (
            <div
              style={{
                background: G.glass,
                borderRadius: 14,
                padding: 48,
                textAlign: "center" as const,
                border: `1px solid ${G.glassBorder}`,
              }}
            >
              <p style={{ fontSize: "2rem", marginBottom: 8 }}>✓</p>
              <p style={{ color: G.muted }}>No pending payments</p>
            </div>
          ) : (
            pendingPaymentOrders.map((o) => (
              <PendingOrderCard
                key={o.id}
                order={o}
                productMap={productMap}
                onConfirm={(id) => handleStatusChange(id, "confirmed")}
                onCancel={handleCancel}
              />
            ))
          )}
        </div>
      )}

      {/* TAB: Orders */}
      {tab === "orders" && (
        <AllOrdersTab
          orders={orders}
          productMap={productMap}
          boxes={boxes}
          onEdit={(order) => setEditingOrder(order)}
          onCancel={handleCancel}
          onStatusChange={handleStatusChange}
          filterPreset={ordersFilterPreset}
          onFilterPresetConsumed={() => setOrdersFilterPreset(null)}
          dashPeriod={dashPeriod}
          trackingStart={trackingStart}
        />
      )}

      {/* TAB: Customers */}
      {tab === "customers" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          <div style={{ marginBottom: 14 }}>
            <GlassInput
              placeholder="Search name, phone, Instagram..."
              value={customerSearch}
              onChange={setCustomerSearch}
            />
          </div>
          <p style={{ fontSize: "0.72rem", color: G.muted, marginBottom: 14 }}>
            {filteredCustomers.length} customers · ₹
            {customers.reduce((s, c) => s + c.total, 0).toLocaleString()} total
          </p>
          {filteredCustomers.map((c) => (
            <div
              key={c.key}
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 8,
              }}
            >
              {editingCustomer === c.key ? (
                <div>
                  <p
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      marginBottom: 10,
                      color: G.text,
                    }}
                  >
                    Editing: {c.name}
                  </p>
                  <GlassInput
                    placeholder="Instagram ID (without @)"
                    value={editInsta}
                    onChange={setEditInsta}
                  />
                  <textarea
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Remarks / notes"
                    style={{
                      width: "100%",
                      minHeight: 80,
                      background: G.glass,
                      border: `1px solid ${G.glassBorder}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: "0.85rem",
                      color: G.text,
                      fontFamily: "system-ui, sans-serif",
                      resize: "vertical" as const,
                      outline: "none",
                      marginBottom: 10,
                      boxSizing: "border-box" as const,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        for (const o of c.orders)
                          await supabase
                            .from("orders")
                            .update({
                              insta_id: editInsta.trim(),
                              remarks: editRemarks.trim(),
                            })
                            .eq("id", o.id);
                        setEditingCustomer(null);
                        await load();
                        flash("Customer updated ✓");
                      }}
                      style={{
                        padding: "9px 20px",
                        borderRadius: 8,
                        border: "none",
                        background: G.blueGlass,
                        color: G.blue,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "system-ui, sans-serif",
                      }}
                    >
                      Save
                    </button>
                    <GlassBtn onClick={() => setEditingCustomer(null)}>
                      Cancel
                    </GlassBtn>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 4,
                        flexWrap: "wrap" as const,
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: G.text,
                        }}
                      >
                        {c.name}
                      </p>
                      {c.orders.length > 1 && (
                        <span
                          style={{
                            fontSize: "0.6rem",
                            padding: "2px 7px",
                            borderRadius: 8,
                            background: G.blueGlass,
                            color: G.blue,
                            fontWeight: 700,
                          }}
                        >
                          🔄 {c.orders.length}x
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <p
                        style={{
                          fontSize: "0.82rem",
                          color: G.sub,
                          marginBottom: 2,
                        }}
                      >
                        📞 {c.phone}
                      </p>
                    )}
                    {c.insta_id && (
                      <p
                        style={{
                          fontSize: "0.8rem",
                          color: "#f472b6",
                          marginBottom: 2,
                        }}
                      >
                        📸 @{c.insta_id}
                      </p>
                    )}
                    <p style={{ fontSize: "0.8rem", color: G.muted }}>
                      {c.orders.length} order{c.orders.length > 1 ? "s" : ""} ·{" "}
                      <span style={{ color: G.gold, fontWeight: 700 }}>
                        ₹{c.total.toLocaleString()}
                      </span>
                    </p>
                    {c.remarks && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#86efac",
                          fontStyle: "italic" as const,
                          marginTop: 5,
                        }}
                      >
                        💬 {c.remarks}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column" as const,
                      gap: 5,
                      marginLeft: 10,
                    }}
                  >
                    <GlassBtn
                      variant="primary"
                      onClick={() => {
                        setEditingCustomer(c.key);
                        setEditInsta(c.insta_id || "");
                        setEditRemarks(c.remarks || "");
                      }}
                    >
                      Edit
                    </GlassBtn>
                    <GlassBtn
                      variant="danger"
                      onClick={async () => {
                        if (
                          !confirm(
                            `Delete ${c.name} and all ${c.orders.length} order${c.orders.length !== 1 ? "s" : ""}? This cannot be undone.`,
                          )
                        )
                          return;
                        const ids = c.orders.map((o) => o.id);
                        const chunks = [];
                        for (let i = 0; i < ids.length; i += 5)
                          chunks.push(ids.slice(i, i + 5));
                        let hasError = false;
                        for (const chunk of chunks) {
                          const { error } = await supabase
                            .from("orders")
                            .delete()
                            .in("id", chunk);
                          if (error) {
                            hasError = true;
                            break;
                          }
                        }
                        if (hasError) {
                          flash(
                            "Delete failed — check Supabase RLS policy",
                            "error",
                          );
                          return;
                        }
                        await load();
                        flash("Customer deleted ✓");
                      }}
                    >
                      Delete
                    </GlassBtn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB: Dashboard */}
      {tab === "dashboard" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 16,
              overflowX: "auto" as const,
            }}
          >
            {(["from_start", "today", "week", "month", "all"] as const).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setDashPeriod(p)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor:
                      dashPeriod === p ? "rgba(96,165,250,0.5)" : G.glassBorder,
                    background: dashPeriod === p ? G.blueGlass : G.glass,
                    color: dashPeriod === p ? G.blue : G.muted,
                    fontSize: "0.75rem",
                    fontWeight: dashPeriod === p ? 600 : 400,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {p === "from_start"
                    ? "📌 Start"
                    : p === "today"
                      ? "Today"
                      : p === "week"
                        ? "Week"
                        : p === "month"
                          ? "Month"
                          : "All"}
                </button>
              ),
            )}
          </div>
          {dashPeriod === "from_start" && (
            <StartDateEditor
              trackingStart={trackingStart}
              setTrackingStart={setTrackingStart}
            />
          )}
          <ExpenseScanner
            onDataExtracted={async (data) => {
              await handleExpenseImport(JSON.stringify(data));
            }}
          />
          <CostPerMochiPanel
            expenses={expenses}
            orders={orders}
            products={products}
            recipe={productRecipes}
            rates={ingredientRates}
            reload={load}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              onClick={() => {
                setOrdersFilterPreset("period_paid");
                setTab("orders");
              }}
              style={{ cursor: "pointer" }}
            >
              <GlassStatCard
                label="Revenue ↗"
                value={`₹${totalRevenue.toLocaleString()}`}
                sub={`${paidOrders.length} orders · tap to see`}
                color={G.blue}
              />
            </div>
            <GlassStatCard
              label="Expenses"
              value={`₹${totalExpenses.toLocaleString()}`}
              sub={`${periodExpenses.length} entries`}
              color={G.red}
            />
            <div
              onClick={() => {
                setOrdersFilterPreset("period_paid");
                setTab("orders");
              }}
              style={{ cursor: "pointer" }}
            >
              <GlassStatCard
                label="Profit"
                value={`₹${profit.toLocaleString()}`}
                sub={
                  profit >= 0
                    ? "↑ positive · tap to audit"
                    : "↓ negative · tap to audit"
                }
                color={profit >= 0 ? G.green : G.red}
              />
            </div>
            <GlassStatCard
              label="Avg Order"
              value={
                paidOrders.length > 0
                  ? `₹${Math.round(totalRevenue / paidOrders.length)}`
                  : "—"
              }
              sub="per order"
            />
            <GlassStatCard
              label="Cost / Mochi"
              value={totalMochis > 0 ? `₹${costPerMochi}` : "—"}
              sub={`${totalMochis} tracked`}
              color={G.sub}
            />
            <GlassStatCard
              label="Revenue / Mochi"
              value={totalMochis > 0 ? `₹${revenuePerMochi}` : "—"}
              sub={
                totalMochis > 0
                  ? `₹${revenuePerMochi - costPerMochi} margin`
                  : ""
              }
              color={G.green}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              {
                label: "🧪 Ingredients",
                val: ingredientExp,
                color: G.green,
                glass: G.greenGlass,
              },
              {
                label: "📦 Packaging",
                val: packagingExp,
                color: G.blue,
                glass: G.blueGlass,
              },
              {
                label: "🏠 Fixed",
                val: fixedExp,
                color: "#94a3b8",
                glass: "rgba(148,163,184,0.1)",
              },
              {
                label: "📣 Marketing",
                val: marketingExp,
                color: "#f472b6",
                glass: "rgba(244,114,182,0.1)",
              },
            ].map(({ label, val, color, glass }) => (
              <div
                key={label}
                style={{
                  background: glass,
                  border: `1px solid ${color}25`,
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.62rem",
                    color,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                  }}
                >
                  {label}
                </p>
                <p style={{ fontSize: "1.3rem", fontWeight: 700, color }}>
                  ₹{val.toLocaleString()}
                </p>
                <p style={{ fontSize: "0.65rem", color: G.muted }}>
                  {totalExpenses > 0
                    ? Math.round((val / totalExpenses) * 100)
                    : 0}
                  %
                </p>
              </div>
            ))}
          </div>
          <div
            style={{
              background: G.glass,
              border: `1px solid ${G.glassBorder}`,
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
                marginBottom: 14,
                fontWeight: 700,
              }}
            >
              Expense Log
            </p>
            {periodExpenses.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: G.muted }}>
                No expenses this period
              </p>
            ) : (
              periodExpenses.map((e) => {
                const cfg =
                  CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.other;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: `1px solid ${G.glassBorder}`,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: 5, marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: G.glass,
                            color: G.sub,
                          }}
                        >
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          color: G.text,
                        }}
                      >
                        {e.description}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: G.muted }}>
                        {new Date(e.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: G.red,
                        }}
                      >
                        ₹{e.amount}
                      </span>
                      <button
                        onClick={async () => {
                          await supabase
                            .from("expenses")
                            .delete()
                            .eq("id", e.id);
                          load();
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: G.muted,
                          cursor: "pointer",
                          fontSize: "1rem",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${G.glassBorder}`,
              }}
            >
              <p
                style={{
                  fontSize: "0.72rem",
                  color: G.muted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  marginBottom: 10,
                  fontWeight: 700,
                }}
              >
                Add Expense
              </p>
              <GlassInput
                placeholder="Description *"
                value={ne.description}
                onChange={(v) => setNe((e) => ({ ...e, description: v }))}
              />
              <GlassInput
                placeholder="Amount ₹ *"
                type="number"
                value={ne.amount}
                onChange={(v) => setNe((e) => ({ ...e, amount: v }))}
              />
              <GlassInput
                placeholder="Note (optional)"
                value={ne.note}
                onChange={(v) => setNe((e) => ({ ...e, note: v }))}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <select
                  value={ne.category}
                  onChange={(e) =>
                    setNe((n) => ({ ...n, category: e.target.value }))
                  }
                  style={selectStyle}
                >
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k} style={{ background: "#1a2535" }}>
                      {v.icon} {v.label}
                    </option>
                  ))}
                </select>
                <GlassInput
                  type="date"
                  placeholder="Date"
                  value={ne.date}
                  onChange={(v) => setNe((e) => ({ ...e, date: v }))}
                />
              </div>
              <button
                disabled={saving || !ne.description || !ne.amount}
                onClick={async () => {
                  setSaving(true);
                  await supabase.from("expenses").insert({
                    description: ne.description,
                    amount: Number(ne.amount),
                    category: ne.category,
                    date: ne.date,
                    note: ne.note,
                    item_key: ne.item_key || slugify(ne.description),
                  });
                  setNe({
                    description: "",
                    amount: "",
                    category: "ingredient",
                    date: new Date().toISOString().split("T")[0],
                    note: "",
                    item_key: "",
                  });
                  await load();
                  setSaving(false);
                  flash("Expense added ✓");
                }}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 10,
                  border: "none",
                  background:
                    saving || !ne.description || !ne.amount
                      ? G.glass
                      : G.blueGlass,
                  color:
                    saving || !ne.description || !ne.amount ? G.muted : G.blue,
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {saving ? "Adding..." : "Add Expense"}
              </button>
              <ExpenseImporter onImport={handleExpenseImport} />
            </div>
          </div>
          {topFlavours.length > 0 && (
            <div
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
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
                  marginBottom: 14,
                  fontWeight: 700,
                }}
              >
                Top Flavours
              </p>
              {topFlavours.map(([name, count], i) => {
                const c = getFlavourColor(name);
                return (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: c.dot,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: i === 0 ? 700 : 400,
                            color: G.text,
                          }}
                        >
                          {name}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.8rem", color: G.muted }}>
                        {count}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(count / topFlavours[0][1]) * 100}%`,
                          background: c.dot,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {Object.keys(boxRevenue).length > 0 && (
            <div
              style={{
                background: G.glass,
                border: `1px solid ${G.glassBorder}`,
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
                  marginBottom: 14,
                  fontWeight: 700,
                }}
              >
                Sales by Box
              </p>
              {Object.entries(boxRevenue)
                .sort(([, a], [, b]) => b.revenue - a.revenue)
                .map(([label, data]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: `1px solid ${G.glassBorder}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        color: G.text,
                      }}
                    >
                      {label}
                    </span>
                    <div style={{ textAlign: "right" as const }}>
                      <p
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: G.blue,
                        }}
                      >
                        ₹{data.revenue.toLocaleString()}
                      </p>
                      <p style={{ fontSize: "0.68rem", color: G.muted }}>
                        {data.count} orders
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: More (Products / Box Sizes) */}
      {tab === "more" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 16,
              border: `1px solid ${G.glassBorder}`,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {(["products", "boxes"] as MoreTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setMoreTab(t)}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "none",
                  fontFamily: "system-ui, sans-serif",
                  background: moreTab === t ? G.blueGlass : G.glass,
                  color: moreTab === t ? G.blue : G.muted,
                  fontSize: "0.85rem",
                  fontWeight: moreTab === t ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {t === "products" ? "🍡 Products" : "📦 Box Sizes"}
              </button>
            ))}
          </div>

          {/* Products sub-tab */}
          {moreTab === "products" && (
            <div>
              {products.map((prod) => (
                <div
                  key={prod.id}
                  style={{
                    background: G.glass,
                    border: `1px solid ${G.glassBorder}`,
                    borderRadius: 12,
                    marginBottom: 8,
                    overflow: "hidden",
                  }}
                >
                  {editingProduct === prod.id ? (
                    <div style={{ padding: 16 }}>
                      <p
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: G.sub,
                          marginBottom: 12,
                        }}
                      >
                        Editing: {prod.name}
                      </p>
                      <GlassInput
                        placeholder="Name *"
                        value={ep.name}
                        onChange={(v) => setEp((p) => ({ ...p, name: v }))}
                      />
                      <GlassInput
                        placeholder="Description *"
                        value={ne.description}
                        onChange={(v) =>
                          setNe((e) => ({
                            ...e,
                            description: v,
                            item_key: e.item_key || slugify(v),
                          }))
                        }
                      />
                      <GlassInput
                        placeholder="Item key (for cycle tracking, e.g. rice-flour)"
                        value={ne.item_key}
                        onChange={(v) =>
                          setNe((e) => ({ ...e, item_key: slugify(v) }))
                        }
                      />
                      <GlassInput
                        placeholder="Image URL"
                        value={ep.image_url}
                        onChange={(v) => setEp((p) => ({ ...p, image_url: v }))}
                      />
                      {ep.image_url && (
                        <img
                          src={ep.image_url}
                          alt="preview"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: "cover" as const,
                            borderRadius: 8,
                            marginBottom: 10,
                            border: `1px solid ${G.glassBorder}`,
                          }}
                        />
                      )}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: "0.85rem",
                          marginBottom: 14,
                          cursor: "pointer",
                          color: G.sub,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={ep.is_premium}
                          onChange={(e) =>
                            setEp((p) => ({
                              ...p,
                              is_premium: e.target.checked,
                            }))
                          }
                          style={{ width: "auto", accentColor: G.gold }}
                        />
                        Premium
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          disabled={saving}
                          onClick={async () => {
                            setSaving(true);
                            await supabase
                              .from("products")
                              .update({
                                name: ep.name,
                                description: ep.description,
                                is_premium: ep.is_premium,
                                image_url: ep.image_url || null,
                              })
                              .eq("id", prod.id);
                            setEditingProduct(null);
                            await load();
                            setSaving(false);
                            flash(`${ep.name} updated ✓`);
                          }}
                          style={{
                            flex: 1,
                            padding: "10px",
                            borderRadius: 9,
                            border: "none",
                            background: G.blueGlass,
                            color: G.blue,
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "system-ui, sans-serif",
                          }}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <GlassBtn onClick={() => setEditingProduct(null)}>
                          Cancel
                        </GlassBtn>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                      }}
                    >
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            objectFit: "cover" as const,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            background: G.glass,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.4rem",
                            border: `1px solid ${G.glassBorder}`,
                          }}
                        >
                          🍡
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: G.text,
                          }}
                        >
                          {prod.name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.72rem",
                            color: G.muted,
                            lineHeight: 1.4,
                            marginBottom: 2,
                          }}
                        >
                          {prod.description || "No description"}
                        </p>
                        <p style={{ fontSize: "0.72rem" }}>
                          {prod.is_premium ? (
                            <span style={{ color: G.gold, fontWeight: 600 }}>
                              ★ Premium
                            </span>
                          ) : (
                            <span style={{ color: G.muted }}>Regular</span>
                          )}
                          {" · "}
                          <span
                            style={{
                              color: prod.is_available ? G.green : G.red,
                              fontWeight: 600,
                            }}
                          >
                            {prod.is_available ? "Visible" : "Hidden"}
                          </span>
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column" as const,
                          gap: 5,
                        }}
                      >
                        <GlassBtn
                          variant="primary"
                          onClick={() => {
                            setEditingProduct(prod.id);
                            setEp({
                              name: prod.name,
                              description: prod.description || "",
                              is_premium: prod.is_premium,
                              image_url: prod.image_url || "",
                            });
                          }}
                        >
                          Edit
                        </GlassBtn>
                        <GlassBtn
                          onClick={async () => {
                            await supabase
                              .from("products")
                              .update({ is_available: !prod.is_available })
                              .eq("id", prod.id);
                            load();
                          }}
                        >
                          {prod.is_available ? "Hide" : "Show"}
                        </GlassBtn>
                        <GlassBtn
                          variant="danger"
                          onClick={async () => {
                            if (!confirm(`Delete ${prod.name}?`)) return;
                            await supabase
                              .from("products")
                              .delete()
                              .eq("id", prod.id);
                            load();
                          }}
                        >
                          ✕
                        </GlassBtn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div
                style={{
                  background: G.glass,
                  border: `1px solid ${G.glassBorder}`,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: G.muted,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  Add Product
                </p>
                <GlassInput
                  placeholder="Name *"
                  value={np.name}
                  onChange={(v) => setNp((p) => ({ ...p, name: v }))}
                />
                <GlassInput
                  placeholder="Description"
                  value={np.description}
                  onChange={(v) => setNp((p) => ({ ...p, description: v }))}
                />
                <GlassInput
                  placeholder="Image URL"
                  value={np.image_url}
                  onChange={(v) => setNp((p) => ({ ...p, image_url: v }))}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.85rem",
                    marginBottom: 14,
                    cursor: "pointer",
                    color: G.sub,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={np.is_premium}
                    onChange={(e) =>
                      setNp((p) => ({ ...p, is_premium: e.target.checked }))
                    }
                    style={{ width: "auto", accentColor: G.gold }}
                  />
                  Premium
                </label>
                <button
                  disabled={saving || !np.name}
                  onClick={async () => {
                    setSaving(true);
                    await supabase.from("products").insert({
                      name: np.name,
                      description: np.description,
                      price: 0,
                      is_premium: np.is_premium,
                      image_url: np.image_url || null,
                      sort_order: products.length + 1,
                    });
                    setNp({
                      name: "",
                      description: "",
                      is_premium: false,
                      image_url: "",
                    });
                    await load();
                    setSaving(false);
                    flash("Product added ✓");
                  }}
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: 10,
                    border: "none",
                    background: saving || !np.name ? G.glass : G.blueGlass,
                    color: saving || !np.name ? G.muted : G.blue,
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {saving ? "Adding..." : "Add Product"}
                </button>
              </div>
            </div>
          )}

          {/* Box Sizes sub-tab */}
          {moreTab === "boxes" && (
            <div>
              {boxes.map((box) => (
                <BoxSizeRow
                  key={box.id}
                  box={box}
                  onSave={async (updates) => {
                    await supabase
                      .from("box_sizes")
                      .update(updates)
                      .eq("id", box.id);
                    load();
                    flash(`${box.label} updated ✓`);
                  }}
                  onToggle={async () => {
                    await supabase
                      .from("box_sizes")
                      .update({ is_active: !box.is_active })
                      .eq("id", box.id);
                    load();
                  }}
                />
              ))}

              <div
                style={{
                  background: G.glass,
                  border: `1px solid ${G.glassBorder}`,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: G.muted,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  Add Box Size
                </p>
                <GlassInput
                  placeholder="Label (e.g. Box of 20) *"
                  value={nb.label}
                  onChange={(v) => setNb((b) => ({ ...b, label: v }))}
                />
                <GlassInput
                  type="number"
                  placeholder="Pieces *"
                  value={nb.count}
                  onChange={(v) => setNb((b) => ({ ...b, count: v }))}
                />
                <GlassInput
                  type="number"
                  placeholder="Kochi Price ₹ *"
                  value={nb.price}
                  onChange={(v) => setNb((b) => ({ ...b, price: v }))}
                />
                <GlassInput
                  type="number"
                  placeholder="Trivandrum Price ₹ (optional)"
                  value={nb.priceTvm}
                  onChange={(v) => setNb((b) => ({ ...b, priceTvm: v }))}
                />
                <button
                  disabled={saving || !nb.label || !nb.count || !nb.price}
                  onClick={async () => {
                    setSaving(true);
                    await supabase.from("box_sizes").insert({
                      label: nb.label,
                      count: Number(nb.count),
                      price: Number(nb.price),
                      price_trivandrum: nb.priceTvm
                        ? Number(nb.priceTvm)
                        : null,
                      is_active: true,
                      sort_order: boxes.length + 1,
                    });
                    setNb({ label: "", count: "", price: "", priceTvm: "" });
                    await load();
                    setSaving(false);
                    flash("Box size added ✓");
                  }}
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: 10,
                    border: "none",
                    background:
                      saving || !nb.label || !nb.count || !nb.price
                        ? G.glass
                        : "#1976d2",
                    color:
                      saving || !nb.label || !nb.count || !nb.price
                        ? G.muted
                        : "#fff",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {saving ? "Adding..." : "Add Box Size"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Trivandrum */}
      {tab === "trivandrum" && (
        <TrivandrumAdminTab
          tvmOrders={tvmOrders}
          tvmSettings={tvmSettings}
          setTvmSettings={setTvmSettings}
          tvmSettingsId={tvmSettingsId}
          savingTvm={savingTvm}
          setSavingTvm={setSavingTvm}
          tvmFlash={(text: string) => flash(text)}
          load={load}
          supabase={supabase}
          productMap={productMap}
          FlavourPill={FlavourPill}
          GlassInput={GlassInput}
          G={G}
        />
      )}

      {/* Modals */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder}
          products={products}
          boxes={boxes}
          onSave={async () => {
            await load();
            setEditingOrder(null);
            flash("Order updated ✓");
          }}
          onClose={() => setEditingOrder(null)}
          onCancel={async (id) => {
            await handleCancel(id);
            setEditingOrder(null);
          }}
        />
      )}
      {showSmartOrder && (
        <SmartOrderModal
          boxes={boxes}
          products={products}
          customers={customers.map((c) => ({
            name: c.name,
            phone: c.phone,
            insta_id: c.insta_id || "",
            remarks: c.remarks || "",
          }))}
          onClose={() => setShowSmartOrder(false)}
          onSaved={() => {
            load();
            setShowSmartOrder(false);
            flash("Order saved ✓");
          }}
        />
      )}
      {showInvoice && <InvoiceModal onClose={() => setShowInvoice(false)} />}
      {showQuickCapture && (
        <QuickCaptureModal
          onClose={() => setShowQuickCapture(false)}
          onOrderSelected={() => setShowSmartOrder(true)}
          onSaved={() => {
            load();
            flash("Expense saved ✓");
          }}
        />
      )}
      {/* Bottom nav */}
      <div
        style={{
          position: "fixed" as const,
          bottom: 0,
          left: 0,
          right: 0,
          background: G.navBg,
          borderTop: `1px solid ${G.navBorder}`,
          zIndex: 200,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          <NavBtn id="cook" icon="🍡" label="Cook" />
          <NavBtn
            id="pending_payment"
            icon="💳"
            label="Payment"
            badge={pendingCount}
          />
          <NavBtn id="orders" icon="📋" label="Orders" />
          <NavBtn id="customers" icon="👥" label="Customers" />
          <NavBtn id="dashboard" icon="📊" label="Dash" />
          <NavBtn
            id="trivandrum"
            icon="🚂"
            label="TVM"
            badge={tvmPending.length || undefined}
          />
          <NavBtn id="more" icon="⚙️" label="More" />
        </div>
      </div>
    </main>
  );
}
