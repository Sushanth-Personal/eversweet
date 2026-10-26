"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExtOrder } from "../_lib/constants";
import type { Product, BoxSize } from "@/lib/types";
import {
  buildProduction,
  cityOf,
  total,
  productionOrder,
  nextOrderAction,
  isDispatched,
  type City,
  type Packing,
  type Progress,
} from "@/lib/production";
import { mapLink, completeness } from "@/lib/order-draft";
import type { ContactField } from "@/lib/order-contacts";
import ContactActions from "./ContactActions";
import FlavourChips from "./FlavourChips";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
const dateLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
type Props = {
  orders: ExtOrder[];
  products: Product[];
  boxes: BoxSize[];
  createdVersion: number;
  onOpen: (o: ExtOrder, focus?: ContactField) => void;
  onNew: () => void;
  onLink: () => void;
  onSettings: () => void;
  onRefresh: () => Promise<void>;
};
export default function ProductionWorkspace({
  orders,
  products,
  boxes,
  createdVersion,
  onOpen: openOrder,
  onNew,
  onLink,
  onSettings,
  onRefresh,
}: Props) {
  const [date, setDate] = useState(today),
    [city, setCity] = useState<"all" | City>("all"),
    [tab, setTab] = useState("prepare"),
    [calendar, setCalendar] = useState(true),
    [month, setMonth] = useState(() => today().slice(0, 7)),
    [scope, setScope] = useState("date");
  const [progress, setProgress] = useState<Progress[]>([]),
    [packing, setPacking] = useState<Packing[]>([]),
    [available, setAvailable] = useState(false),
    [preparationAvailable, setPreparationAvailable] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [full, setFull] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null),
    [count, setCount] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    request = useRef(0);
  useEffect(() => {
    if (createdVersion) {
      setTab("orders");
      setScope("all");
      setCalendar(false);
    }
  }, [createdVersion]);
  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/workflow?date=" + date, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (version !== request.current) return;
      setProgress(data.progress);
      setPacking(data.packing);
      setAvailable(data.available);
      setPreparationAvailable(data.preparationAvailable ?? data.available);
    } catch {
      if (version === request.current) {
        setAvailable(false);
        setMessage("Could not refresh production. Try Refresh.");
      }
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [date]);
  useEffect(() => {
    setProgress([]);
    setPacking([]);
    setAvailable(false);
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      void load();
      void onRefresh();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load, onRefresh]);
  const filtered = useMemo(
      () => orders.filter((o) => city === "all" || cityOf(o) === city),
      [orders, city],
    ),
    daily = useMemo(
      () => filtered.filter((o) => o.delivery_date === date),
      [filtered, date],
    );
  const model = useMemo(
    () =>
      buildProduction(
        daily,
        boxes,
        progress.filter((p) => city === "all" || p.city === city),
        packing.filter((p) => city === "all" || p.city === city),
      ),
    [daily, boxes, progress, packing, city],
  );
  const name = (id: string) =>
    products.find((p) => p.id === id)?.name || "Unavailable flavour";
  const selected = model.manifest.find((r) => r.key === sheet);
  function onOpen(order: ExtOrder, focus?: ContactField) {
    openOrder(
      {
        ...order,
        production_ready: model.ready.includes(order.id),
        production_prepared:
          order.production_prepared || model.preparedOrders.has(order.id),
        production_packed:
          order.production_packed || model.packed.has(order.id),
      },
      focus,
    );
  }
  useEffect(() => {
    if (sheet && !selected) setSheet(null);
  }, [sheet, selected]);
  useEffect(() => {
    if (sheet) dialog.current?.showModal();
    else dialog.current?.close();
  }, [sheet]);
  async function action(actionName: string, id?: string, entries?: Progress[]) {
    setBusy(id || "prepare");
    setMessage("");
    try {
      const response = await fetch("/api/admin/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, id, date, entries }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      await Promise.all([load(), onRefresh()]);
      setSheet(null);
      setMessage(
        actionName === "prepare_order"
          ? "Order prepared — ready to pack"
          : actionName === "unprepare"
            ? "Prepared pieces released"
            : actionName === "prepare"
              ? "Preparation saved"
              : actionName === "pack"
                ? "Order packed"
                : actionName === "unpack"
                  ? "Order returned to packing"
                  : "Order dispatched",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy("");
    }
  }
  function status(o: ExtOrder) {
    return o.status === "cancelled"
      ? "Cancelled"
      : isDispatched(o)
        ? "Dispatched"
        : o.production_packed || model.packed.has(o.id)
          ? "Ready to dispatch"
          : o.production_prepared || (available && model.ready.includes(o.id))
            ? "Ready to pack"
            : "Preparing";
  }
  const ready = model.pending.filter((r) => model.ready.includes(r.order.id)),
    waiting = model.pending.filter((r) => !model.ready.includes(r.order.id));
  function boxDetails(row: (typeof model.rows)[number]) {
    return (
      <div className="pack-box-list">
        {row.plan.map((box, i) => (
          <section key={i}>
            <h3>
              {row.plan.length > 1 ? `Box ${i + 1} · ` : ""}
              {boxes.find((b) => b.id === box.box_size_id)?.label ||
                "Box size pending"}
            </h3>
            <FlavourChips flavours={box.flavours} products={products} />
          </section>
        ))}
      </div>
    );
  }
  function contacts(o: ExtOrder) {
    return (
      <ContactActions
        values={{
          phone: o.phone,
          insta_id: o.insta_id,
          customer_maps_url: mapLink(o.notes),
        }}
        onEdit={(field) => onOpen(o, field)}
      />
    );
  }
  function packSurface(stage: "prepare" | "pack" = "pack") {
    const queue = stage === "prepare" ? waiting : ready,
      next = queue[0];
    return (
      <section className="production-pack">
        <div className="section-heading">
          <h2>{stage === "prepare" ? "Next to prepare" : "Next to pack"}</h2>
          <span>
            {stage === "prepare"
              ? `${waiting.length} remaining`
              : available
                ? `${ready.length} ready`
                : "Awaiting preparation"}
          </span>
        </div>
        {next ? (
          <article className="pack-surface">
            <div className="pack-heading">
              <button onClick={() => onOpen(next.order)}>
                {next.order.customer_name}
              </button>
              <span>
                {next.order.delivery_slot || next.order.batch_label}
                <br />
                {next.city === "kochi" ? "Kochi" : "TVM"}
              </span>
            </div>
            {boxDetails(next)}
            <p
              className={
                available && model.ready.includes(next.order.id)
                  ? "ready-label"
                  : "waiting-label"
              }
            >
              {available && model.ready.includes(next.order.id)
                ? "Ready to pack"
                : !available
                  ? "Preparation tracking pending"
                  : !next.valid
                    ? "Complete box details"
                    : "Waiting for " +
                      Object.keys(model.missing[next.order.id] || {})
                        .map(name)
                        .join(", ")}
            </p>
            <button
              className="production-primary"
              disabled={
                !!busy ||
                loading ||
                !available ||
                !next.valid ||
                (stage === "pack" && !model.ready.includes(next.order.id))
              }
              onClick={() =>
                action(
                  stage === "prepare" ? "prepare_order" : "pack",
                  next.order.id,
                )
              }
            >
              {busy === next.order.id
                ? "Updating…"
                : stage === "prepare"
                  ? "Mark prepared"
                  : "Mark packed"}
            </button>
            {contacts(next.order)}
          </article>
        ) : (
          <p className="production-empty">
            {loading
              ? "Refreshing preparation…"
              : stage === "prepare"
                ? "No orders waiting for preparation."
                : "No orders ready to pack. Update preparation to unlock the next order."}
          </p>
        )}
        {queue.length > 1 && <p className="up-next-label">Up next</p>}
        {queue.slice(1).map((r) => (
          <button
            className="compact-order"
            key={r.order.id}
            onClick={() => onOpen(r.order)}
          >
            <strong>{r.order.customer_name}</strong>
            <span>{r.order.delivery_slot || "Time pending"}</span>
            <em>
              {!r.valid
                ? "Complete boxes / delivery details"
                : model.ready.includes(r.order.id)
                  ? "Ready to pack"
                  : "Waiting for " +
                    Object.keys(model.missing[r.order.id] || {})
                      .map(name)
                      .join(", ")}
            </em>
            <span>›</span>
          </button>
        ))}
      </section>
    );
  }
  const orderList =
    scope === "all"
      ? filtered
      : scope === "undated"
        ? filtered.filter((o) => !o.delivery_date)
        : daily;
  const active = model.rows.length,
    remaining = model.manifest.reduce((sum, r) => sum + r.remaining, 0);
  return (
    <div className="production-workspace">
      <header className="production-header">
        <div>
          <h1>Eversweet</h1>
          <p>Production · {dateLabel(date)}</p>
        </div>
        <label className="production-date">
          <span className="sr-only">Production date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
      </header>
      <div className="production-toolbar">
        <div className="city-filter" aria-label="City">
          {(["all", "kochi", "trivandrum"] as const).map((c) => (
            <button
              key={c}
              aria-pressed={city === c}
              onClick={() => setCity(c)}
            >
              {c === "all" ? "All" : c === "kochi" ? "Kochi" : "TVM"}
            </button>
          ))}
        </div>
        <div>
          <button
            onClick={() => {
              setCalendar(!calendar);
              setMonth(date.slice(0, 7));
            }}
          >
            Calendar
          </button>
          <button aria-label="Settings" onClick={onSettings}>
            Settings
          </button>
          <button
            onClick={() => {
              void load();
              void onRefresh();
            }}
          >
            Refresh
          </button>
        </div>
      </div>
      <nav className="workflow-navigation" aria-label="Production workflow">
        {["orders", "prepare", "pack", "dispatch"].map((t) => (
          <button
            key={t}
            aria-current={t === tab ? "page" : undefined}
            onClick={() => {
              setTab(t);
              setCalendar(false);
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      {message && (
        <p role="status" className="production-feedback">
          {message}
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            ×
          </button>
        </p>
      )}
      {calendar ? (
        <section className="production-calendar">
          <div className="section-heading">
            <button
              aria-label="Previous month"
              onClick={() => {
                const d = new Date(month + "-15");
                d.setMonth(d.getMonth() - 1);
                setMonth(d.toISOString().slice(0, 7));
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="30"
                height="30"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
            <h2>
              {new Date(month + "-15").toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              aria-label="Next month"
              onClick={() => {
                const d = new Date(month + "-15");
                d.setMonth(d.getMonth() + 1);
                setMonth(d.toISOString().slice(0, 7));
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="30"
                height="30"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="calendar-grid">
            {["S", "M", "T", "W", "T", "F", "S"].map((v, i) => (
              <small key={i}>{v}</small>
            ))}
            {Array.from(
              { length: new Date(month + "-01").getDay() },
              (_, i) => (
                <span key={"blank" + i} />
              ),
            )}
            {Array.from(
              {
                length: new Date(
                  Number(month.slice(0, 4)),
                  Number(month.slice(5)),
                  0,
                ).getDate(),
              },
              (_, i) => {
                const day = month + "-" + String(i + 1).padStart(2, "0"),
                  n = filtered.filter(
                    (o) => o.delivery_date === day && o.status !== "cancelled",
                  ).length;
                return (
                  <button
                    key={day}
                    aria-pressed={date === day}
                    onClick={() => {
                      setDate(day);
                      setCalendar(false);
                      setTab("orders");
                      setScope("date");
                    }}
                  >
                    {i + 1}
                    {n > 0 && (
                      <small className="calendar-order-count">
                        {n}
                        <span className="sr-only">
                          {" "}
                          {n === 1 ? "order" : "orders"}
                        </span>
                      </small>
                    )}
                  </button>
                );
              },
            )}
          </div>
          <button
            onClick={() => {
              setDate(today());
              setMonth(today().slice(0, 7));
            }}
          >
            Jump to today
          </button>
        </section>
      ) : (
        <>
          <section className="today-summary">
            <p className="today-title">
              {date === today() ? "Today" : dateLabel(date)}
            </p>
            <div>
              <p>
                <strong>{active}</strong>
                <span>orders</span>
              </p>
              <p>
                <strong>{remaining}</strong>
                <span>
                  remaining
                  <br />
                  to prepare
                </span>
              </p>
              <p>
                <strong className={!available ? "setup-count" : undefined}>
                  {available ? ready.length : "Pending"}
                </strong>
                <span>
                  {available ? "ready" : "tracking"}
                  <br />
                  {available ? "to pack" : "setup"}
                </span>
              </p>
            </div>
            <p className="quiet">
              {model.rows.reduce((n, r) => n + total(r.flavours), 0)} mochi
              total ·{" "}
              {city === "all"
                ? "Both cities"
                : city === "kochi"
                  ? "Kochi"
                  : "Trivandrum"}
            </p>
          </section>
          {(tab === "prepare" || tab === "orders") && (
            <>
              <section className="preparation-manifest">
                <div className="section-heading">
                  <h2>Prepare</h2>
                  <span>
                    {
                      model.manifest.filter((r) => full || r.remaining > 0)
                        .length
                    }{" "}
                    flavours
                  </span>
                </div>
                <div className="manifest-controls">
                  <span>
                    <strong>{remaining}</strong> left to prepare ·{" "}
                    {model.rows.reduce((n, r) => n + total(r.flavours), 0)}{" "}
                    total today
                  </span>
                  <button onClick={() => setFull(!full)}>
                    {full ? "Show remaining" : "Show full counts"}
                  </button>
                </div>
                {!model.manifest.length && (
                  <p className="production-empty">
                    No flavours to prepare for this date.
                  </p>
                )}
                {!full &&
                  model.manifest.length > 0 &&
                  model.manifest.every((r) => r.remaining === 0) && (
                    <p className="production-empty">
                      All flavours prepared. Show full counts to review.
                    </p>
                  )}
                {model.manifest
                  .filter((r) => full || r.remaining > 0)
                  .map((r) => (
                    <button
                      className={`preparation-row ${available && r.remaining === 0 ? "is-ready" : ""}`}
                      key={r.key}
                      disabled={loading}
                      onClick={() => {
                        setCount(r.prepared);
                        setSheet(r.key);
                      }}
                    >
                      <strong>
                        {String(full ? r.required : r.remaining).padStart(
                          2,
                          "0",
                        )}
                      </strong>
                      <span>
                        {name(r.id)}
                        {city === "all" && (
                          <small>{r.city === "kochi" ? "Kochi" : "TVM"}</small>
                        )}
                      </span>
                      <em className={r.remaining ? "shortage" : ""}>
                        {!preparationAvailable
                          ? `${r.remaining} to prepare`
                          : r.remaining
                            ? `+${r.remaining} needed`
                            : "● Ready"}
                      </em>
                    </button>
                  ))}
              </section>
              {tab === "prepare" && packSurface("prepare")}
            </>
          )}
          {tab === "pack" && packSurface()}
          {tab === "orders" && (
            <section>
              <div className="section-heading">
                <h2>Orders</h2>
                <select
                  aria-label="Order scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="date">Selected date</option>
                  <option value="undated">Date pending</option>
                  <option value="all">All orders</option>
                </select>
              </div>
              {!orderList.length && (
                <p className="production-empty">No orders in this view.</p>
              )}
              {orderList.map((o, index) => {
                const production = productionOrder(o, boxes),
                  state = status(o),
                  step = nextOrderAction({
                    status: o.status,
                    packed: !!o.production_packed || model.packed.has(o.id),
                    ready:
                      !!o.production_prepared || model.ready.includes(o.id),
                  });
                return (
                  <article
                    className={`order-ledger-row order-tile ${o.status === "dispatched" ? "tile-dispatched" : o.production_packed ? "tile-packed" : !production.valid ? "tile-incomplete" : "tile-preparing"}`}
                    key={o.id}
                  >
                    <div className="order-tile-heading">
                      <span className="order-number">Order {index + 1}</span>
                      <span className="workflow-state">{state}</span>
                    </div>
                    <div className="order-identity">
                      <button className="order-name" onClick={() => onOpen(o)}>
                        {o.customer_name}
                      </button>
                      <button
                        className="order-details-action"
                        onClick={() => onOpen(o)}
                      >
                        Details ↗
                      </button>
                    </div>
                    <div>
                      {!completeness(o, boxes).complete &&
                        o.status !== "cancelled" && (
                          <span className="incomplete-badge">Incomplete</span>
                        )}
                    </div>
                    <div className="order-appointment">
                      <strong>
                        {o.delivery_slot || o.batch_label || "Time pending"}
                      </strong>
                      <p className="order-date-line">
                        {o.delivery_date
                          ? dateLabel(o.delivery_date)
                          : "Date pending"}{" "}
                        · {cityOf(o) === "kochi" ? "Kochi" : "Trivandrum"}
                      </p>
                    </div>
                    {production.plan.length ? (
                      production.plan.map((box, i) => (
                        <section className="order-tile-box" key={i}>
                          <h3>
                            {production.plan.length > 1
                              ? `Box ${i + 1} · `
                              : ""}
                            {boxes.find((b) => b.id === box.box_size_id)
                              ?.label || "Size pending"}
                            <span>
                              {total(box.flavours)}/
                              {boxes.find((b) => b.id === box.box_size_id)
                                ?.count || "?"}{" "}
                              pieces
                            </span>
                          </h3>
                          <FlavourChips
                            flavours={box.flavours}
                            products={products}
                          />
                        </section>
                      ))
                    ) : (
                      <p className="quiet">
                        Boxes and flavours not selected yet
                      </p>
                    )}
                    <div className="order-stage-actions">
                      <button
                        className="production-primary order-stage-action"
                        disabled={
                          !step.action ||
                          !!busy ||
                          !available ||
                          loading ||
                          !production.valid
                        }
                        onClick={() => step.action && action(step.action, o.id)}
                      >
                        {busy === o.id ? "Updating…" : step.label}
                      </button>
                      {o.production_prepared && !o.production_packed && (
                        <button
                          className="undo-prepared"
                          disabled={!!busy || !available}
                          onClick={() => action("unprepare", o.id)}
                        >
                          Undo prepared
                        </button>
                      )}
                    </div>
                    {contacts(o)}
                  </article>
                );
              })}
            </section>
          )}
          {tab === "dispatch" && (
            <section>
              <div className="section-heading">
                <h2>Dispatch</h2>
                <span>
                  {
                    model.rows.filter(
                      (r) =>
                        model.packed.has(r.order.id) ||
                        r.order.status === "dispatched",
                    ).length
                  }{" "}
                  orders
                </span>
              </div>
              {!model.rows.some(
                (r) =>
                  model.packed.has(r.order.id) ||
                  r.order.status === "dispatched",
              ) && (
                <p className="production-empty">
                  Packed orders appear here automatically.
                </p>
              )}
              {model.rows
                .filter(
                  (r) =>
                    model.packed.has(r.order.id) ||
                    r.order.status === "dispatched",
                )
                .map((r) => (
                  <article className="dispatch-row" key={r.order.id}>
                    <div className="pack-heading">
                      <button onClick={() => onOpen(r.order)}>
                        {r.order.customer_name}
                      </button>
                      <span>
                        {r.order.delivery_slot} ·{" "}
                        {r.city === "kochi" ? "Kochi" : "TVM"}
                      </span>
                    </div>
                    <p>{r.order.phone || "Phone not provided"}</p>
                    <p>{r.order.address || "Address not provided"}</p>
                    {contacts(r.order)}
                    {r.order.status === "dispatched" ? (
                      <p className="ready-label">● Dispatched</p>
                    ) : (
                      <div className="dispatch-actions">
                        <button
                          disabled={!!busy || !available || loading}
                          className="production-primary"
                          onClick={() => action("dispatch", r.order.id)}
                        >
                          Mark dispatched
                        </button>
                        <button
                          disabled={!!busy || !available || loading}
                          onClick={() => {
                            if (
                              confirm(
                                "Unpack this order and release its prepared pieces?",
                              )
                            )
                              void action("unpack", r.order.id);
                          }}
                        >
                          Unpack
                        </button>
                      </div>
                    )}
                  </article>
                ))}
            </section>
          )}
        </>
      )}
      <footer className="production-bottom">
        <button onClick={onLink}>↗ Order link</button>
        <button className="production-primary" onClick={onNew}>
          ＋ New order
        </button>
      </footer>
      <dialog
        ref={dialog}
        className="preparation-dialog"
        onCancel={() => setSheet(null)}
      >
        {selected && (
          <>
            <header>
              <p className="eyebrow">
                {selected.city === "kochi" ? "Kochi" : "Trivandrum"} ·{" "}
                {dateLabel(date)}
              </p>
              <button
                aria-label="Close preparation detail"
                onClick={() => setSheet(null)}
              >
                ×
              </button>
            </header>
            <h2>{name(selected.id)}</h2>
            <dl className="preparation-counts">
              <div>
                <dt>Required</dt>
                <dd>{selected.required}</dd>
              </div>
              <div>
                <dt>Prepared</dt>
                <dd>{selected.prepared}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{selected.remaining}</dd>
              </div>
            </dl>
            <div className="cup-counts">
              <div>
                <span>Regular cups</span>
                <strong>{selected.cups.regular}</strong>
              </div>
              <div>
                <span>White cups</span>
                <strong>{selected.cups.white}</strong>
              </div>
            </div>
            <div className="preparation-count-editor">
              <label htmlFor="prepared-count-input">Prepared pieces</label>
              <div className="production-stepper">
                <button
                  aria-label="Decrease prepared"
                  disabled={count <= selected.reserved}
                  onClick={() =>
                    setCount((n) => Math.max(selected.reserved, n - 1))
                  }
                >
                  −
                </button>
                <input
                  id="prepared-count-input"
                  type="number"
                  aria-label="Prepared pieces"
                  min={selected.reserved}
                  max={100000}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
                <button
                  aria-label="Increase prepared"
                  onClick={() => setCount((n) => Math.min(100000, n + 1))}
                >
                  +
                </button>
              </div>
            </div>
            <p className="quiet">
              {selected.reserved > 0
                ? `${selected.reserved} already packed / dispatched. `
                : ""}
              Extra prepared pieces stay in stock.
            </p>
            <button
              disabled={!!busy || !available}
              className="production-primary"
              onClick={() =>
                action("prepare", undefined, [
                  {
                    city: selected.city,
                    flavour_id: selected.id,
                    finished: Math.max(selected.required, selected.prepared),
                  },
                ])
              }
            >
              {selected.remaining > 0
                ? `Finish remaining ${selected.remaining}`
                : "All prepared"}
            </button>
            <button
              disabled={
                !!busy ||
                !available ||
                !Number.isSafeInteger(count) ||
                count < selected.reserved ||
                count > 100000
              }
              onClick={() =>
                action("prepare", undefined, [
                  {
                    city: selected.city,
                    flavour_id: selected.id,
                    finished: count,
                  },
                ])
              }
            >
              {busy ? "Saving…" : "Save count"}
            </button>
            {!available && (
              <p className="quiet">
                Counts and cups are available to review. Saving preparation will
                be enabled when tracking setup is complete.
              </p>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
