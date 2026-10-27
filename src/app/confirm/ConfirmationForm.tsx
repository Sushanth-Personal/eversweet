"use client";
import { useEffect, useMemo, useState } from "react";

import { customerPhone } from "@/lib/customer-phone";
import { indiaToday, deliveryDateOf } from "@/lib/business-date";
import { useDraft } from "./useDraft";

type Product = {
  id: string;
  name: string;
  image_url?: string | null;
  is_available?: boolean;
};
type Box = { id: string; label: string; count: number };
type PlannedBox = {
  key: string;
  box_size_id: string;
  flavours: Record<string, number>;
};
type Form = {
  location: string;
  customer_name: string;
  phone: string;
  address: string;
  customer_maps_url: string;
  delivery_date: string;
  delivery_slot: string;
};
const TIMES = [
  "11 AM–1 PM",
  "1–3 PM",
  "3–5 PM",
  "5–7 PM",
];
const today = indiaToday;
const initial: Form = {
  location: "kochi",
  customer_name: "",
  phone: "",
  address: "",
  customer_maps_url: "",
  delivery_date: today(),
  delivery_slot: "",
};

export default function NewConfirmationPage({ draftId }: { draftId?: string }) {
  const [dateLocked, setDateLocked] = useState(false),
    [dates, setDates] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/delivery-dates")
      .then((r) => r.json())
      .then((d) =>
        setDates((d.dates || []).filter((v: string) => v >= today())),
      )
      .catch(() => setDates([]));
  }, []);
  const [form, setForm] = useState(initial),
    [products, setProducts] = useState<Product[]>([]),
    [boxes, setBoxes] = useState<Box[]>([]),
    [plan, setPlan] = useState<PlannedBox[]>([]);
  const [activeKey, setActiveKey] = useState(""),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [orderId, setOrderId] = useState(""),
    [saving, setSaving] = useState(false),
    [step, setStep] = useState(1);
  const snapshot = JSON.stringify({
    ...form,
    box_selections: plan.map(({ box_size_id, flavours }) => ({
      box_size_id,
      flavours,
    })),
  });
  const draft = useDraft(
    draftId,
    snapshot,
    (data) => {
      setProducts(
        (data.products || []).sort((a: Product, b: Product) =>
          a.name.localeCompare(b.name),
        ),
      );
      setBoxes(data.boxes || []);
      if (data.order) {
        const o = data.order;
        setDateLocked(Boolean(o.delivery_date));
        setForm({
          location:
            o.location || (o.source === "trivandrum" ? "trivandrum" : "kochi"),
          customer_name:
            o.customer_name === "Customer details pending"
              ? ""
              : o.customer_name || "",
          phone: o.phone || "",
          address: o.address || "",
          customer_maps_url: o.customer_maps_url || "",
          delivery_date: deliveryDateOf(o),
          delivery_slot: o.delivery_slot || "",
        });
        setPlan(
          (data.plan || []).map((b: any, i: number) => ({
            ...b,
            key: String(i),
          })),
        );
        setStep(1);
      }
    },
    dateLocked,
  );
  const visible = useMemo(
    () =>
      products
        .filter(
          (p) => p.is_available !== false || plan.some((b) => b.flavours[p.id]),
        )
        .filter((p) =>
          p.name.toLowerCase().includes(search.trim().toLowerCase()),
        ),
    [products, search, plan],
  );
  const groups = useMemo(() => {
    const result: Record<string, Product[]> = {};
    for (const product of [...visible].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const letter = product.name.trim().charAt(0).toUpperCase();
      (result[letter] ||= []).push(product);
    }
    return Object.entries(result).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);
  const [mapPrompt, setMapPrompt] = useState(false);
  const active = plan.find((b) => b.key === activeKey) || plan[0],
    activeSize = boxes.find((b) => b.id === active?.box_size_id);
  const used = (b?: PlannedBox) =>
      b ? Object.values(b.flavours).reduce((a, n) => a + n, 0) : 0,
    activeUsed = used(active);
  const total = plan.reduce((n, b) => n + used(b), 0),
    required = plan.reduce(
      (n, b) => n + (boxes.find((x) => x.id === b.box_size_id)?.count || 0),
      0,
    );
  const update = (key: keyof Form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const moveTo = (n: number) => {
    setError("");
    setStep(n);
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  };
  const addBox = (box: Box) => {
    const key = `${box.id}-${Date.now()}-${plan.length}`;
    setPlan((p) => [...p, { key, box_size_id: box.id, flavours: {} }]);
    setActiveKey(key);
    setSearch("");
  };
  const removeBox = (key: string) =>
    setPlan((current) => {
      const next = current.filter((b) => b.key !== key);
      if (key === activeKey) setActiveKey(next[0]?.key || "");
      return next;
    });
  const changeFlavour = (id: string, delta: number) => {
    if (!active || !activeSize) return;
    setPlan((current) =>
      current.map((box) => {
        if (box.key !== active.key) return box;
        const count = used(box);
        if (delta > 0 && count >= activeSize.count) return box;
        const flavours = { ...box.flavours },
          next = Math.max(0, (flavours[id] || 0) + delta);
        if (next) flavours[id] = next;
        else delete flavours[id];
        return { ...box, flavours };
      }),
    );
  };
  const continueBoxes = async () => {
    setSaving(true);
    if (await draft.save()) moveTo(3);
    setSaving(false);
  };
  const continueDetails = async () => {
    if (!customerPhone(form.phone)) {
      setError("Please enter a complete 10-digit phone number.");
      return;
    }
    setError("");
    setSaving(true);
    if (await draft.create(form.customer_name, form.phone)) {
      setDateLocked(Boolean(form.delivery_date));
      moveTo(2);
    }
    setSaving(false);
  };
  async function finishOrder() {
    if (!customerPhone(form.phone)) {
      setMapPrompt(false);
      moveTo(1);
      setError("Please enter a complete 10-digit phone number.");
      return;
    }
    setMapPrompt(false);
    setSaving(true);
    if (await draft.save()) setOrderId(draft.id);
    setSaving(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 3) return;
    if (!form.customer_maps_url.trim()) {
      setMapPrompt(true);
      return;
    }
    await finishOrder();
  }
  if (!draft.ready)
    return (
      <main className="confirm-page">
        <div className="confirm-card">Opening your order…</div>
      </main>
    );
  if (draft.locked)
    return (
      <main className="confirm-page">
        <div className="confirm-card">
          <p className="eyebrow">EVERSWEET · YOUR ORDER</p>
          <h1>Your personal order link</h1>
          <p>{draft.locked}</p>
          {draft.error && <p role="alert">{draft.error}</p>}
        </div>
      </main>
    );
  if (orderId)
    return (
      <main className="confirm-page">
        <div className="confirm-card confirmation-done">
          <h1>Your details are saved</h1>
          <p>
            Keep this private link to edit this order before its date has
            passed. For a new order, please message us.
          </p>
          <button
            type="button"
            className="confirm-submit"
            onClick={() => {
              setOrderId("");
              moveTo(1);
            }}
          >
            Edit my details
          </button>
          <a
            href="https://instagram.com/byeversweet"
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow @byeversweet on Instagram ↗
          </a>
        </div>
      </main>
    );
  return (
    <main className="confirm-page">
      <form className="confirm-card" onSubmit={submit}>
        <div className="confirm-hero">
          <span>🍡</span>
          <div>
            <p>EVERSWEET · MADE FOR YOU</p>
            <h1>A little box of happiness</h1>
          </div>
        </div>
        <div className="confirm-steps">
          {[
            { n: 1, label: "Details" },
            { n: 2, label: "Boxes" },
            { n: 3, label: "Delivery" },
          ].map((x) => (
            <div
              className={`${step === x.n ? "active" : ""} ${step > x.n ? "done" : ""}`}
              key={x.n}
            >
              <b>{step > x.n ? "✓" : x.n}</b>
              <span>{x.label}</span>
            </div>
          ))}
        </div>
        <p className="confirm-note">
          {step === 1
            ? "Enter your name and phone number to save your order."
            : step === 2
              ? "Choose your boxes and flavours. You can finish later."
              : "Add your delivery time and location."}
        </p>
        {draft.error && (
          <p className="confirm-error" role="alert">
            {draft.error}
          </p>
        )}
        {draft.id && (
          <p role="status">{draft.status} · Changes are saved to this order.</p>
        )}
        {step === 2 && (
          <div className="confirm-step-panel">
            <section className="box-choice-section">
              <h2>Add a box</h2>
              <div className="box-choice-grid">
                {[4, 5, 6, 8].map((size) => {
                  const box = boxes.find(
                    (b) => b.count === size && (b as any).is_active !== false,
                  );
                  return (
                    <button
                      type="button"
                      disabled={!box}
                      key={size}
                      onClick={() => box && addBox(box)}
                    >
                      <b>＋ {size}</b>
                      <small>piece box</small>
                    </button>
                  );
                })}
              </div>
            </section>
            {plan.length > 0 && (
              <section className="box-builder">
                <div className="box-tabs">
                  {plan.map((box, i) => {
                    const size = boxes.find((b) => b.id === box.box_size_id),
                      count = used(box);
                    return (
                      <button
                        type="button"
                        className={box.key === active?.key ? "active" : ""}
                        onClick={() => setActiveKey(box.key)}
                        key={box.key}
                      >
                        <small>BOX {i + 1}</small>
                        <b>{size?.count} pieces</b>
                        <span
                          className={count === size?.count ? "complete" : ""}
                        >
                          {count}/{size?.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {active && activeSize && (
                  <>
                    <div className="active-box-heading">
                      <div>
                        <small>NOW FILLING</small>
                        <h2>
                          Box {plan.indexOf(active) + 1} · {activeSize.count}{" "}
                          pieces
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBox(active.key)}
                      >
                        Remove
                      </button>
                    </div>
                    {activeUsed > 0 && (
                      <div className="selected-flavour-chips chosen-box">
                        <b>IN THIS BOX</b>
                        {products
                          .filter((p) => active.flavours[p.id])
                          .map((p) => (
                            <button
                              type="button"
                              onClick={() => changeFlavour(p.id, -1)}
                              key={p.id}
                            >
                              <strong>{active.flavours[p.id]}×</strong>
                              {p.name}
                              <span>−</span>
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="flavour-tools">
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search flavours…"
                      />
                      <span
                        className={
                          activeUsed === activeSize.count ? "complete" : ""
                        }
                      >
                        {activeUsed}/{activeSize.count}
                      </span>
                    </div>
                    <div className="alphabetical-flavours">
                      {groups.map(([letter, items]) => (
                        <section
                          className="flavour-letter-group"
                          key={letter}
                          aria-label={`Flavours beginning with ${letter}`}
                        >
                          <h3>{letter}</h3>
                          <div className="flavour-grid flavour-quantity-grid">
                            {items.map((p) => {
                              const qty = active.flavours[p.id] || 0;
                              return (
                                <div
                                  className={`flavour-choice text-flavour-card ${qty ? "checked" : ""}`}
                                  key={p.id}
                                >
                                  <span>{p.name}</span>
                                  {p.is_available === false && (
                                    <small>
                                      Previously selected · unavailable
                                    </small>
                                  )}
                                  <div className="flavour-piece-stepper">
                                    <button
                                      type="button"
                                      aria-label={`Remove one ${p.name}`}
                                      disabled={!qty}
                                      onClick={() => changeFlavour(p.id, -1)}
                                    >
                                      −
                                    </button>
                                    <b>{qty}</b>
                                    <button
                                      type="button"
                                      aria-label={`Add one ${p.name}`}
                                      disabled={
                                        p.is_available === false ||
                                        activeUsed >= activeSize.count
                                      }
                                      onClick={() => changeFlavour(p.id, 1)}
                                    >
                                      ＋
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                    {!visible.length && (
                      <p className="no-flavour-results">No matching flavour</p>
                    )}
                  </>
                )}
              </section>
            )}
            {plan.length > 0 && (
              <div className="box-plan-total">
                <b>
                  {plan.length} box{plan.length === 1 ? "" : "es"}
                </b>
                <span>
                  {total}/{required} pieces arranged
                </span>
              </div>
            )}
            {error && <div className="confirm-error">{error}</div>}
            <div className="step-actions">
              <button
                type="button"
                className="step-back"
                onClick={() => moveTo(1)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                className="confirm-submit"
                onClick={continueBoxes}
              >
                Continue
              </button>
            </div>
          </div>
        )}
        {step === 1 && (
          <section>
            <h2>Who is this order for?</h2>
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                value={form.customer_name}
                onChange={(e) => update("customer_name", e.target.value)}
              />
            </label>
            <label>
              <span>Phone number</span>
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </label>
            {dateLocked ? (
              <div className="fixed-order-date">
                <small>YOUR RESERVED DATE</small>
                <strong>
                  {form.delivery_date} ·{" "}
                  {form.location === "trivandrum" ? "Trivandrum" : "Kochi"}
                </strong>
                <p>
                  This date is fixed. Please contact Eversweet to reschedule or
                  place a new order.
                </p>
              </div>
            ) : (
              <>
                <h2>Where and when?</h2>
                <div className="location-toggle">
                  {["kochi", "trivandrum"].map((city) => (
                    <button
                      type="button"
                      key={city}
                      aria-pressed={form.location === city}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          location: city,
                          delivery_date: "",
                        }))
                      }
                    >
                      {city === "kochi" ? "Kochi" : "Trivandrum"}
                    </button>
                  ))}
                </div>
                <label>
                  <span>Order date</span>
                  {form.location === "kochi" ? (
                    <input
                      type="date"
                      min={today()}
                      value={form.delivery_date}
                      onChange={(e) => update("delivery_date", e.target.value)}
                    />
                  ) : (
                    <select
                      value={form.delivery_date}
                      onChange={(e) => update("delivery_date", e.target.value)}
                    >
                      <option value="">Choose an available date</option>
                      {dates.map((date) => (
                        <option key={date} value={date}>
                          {date}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                {form.location === "trivandrum" && !dates.length && (
                  <p>
                    No Trivandrum dates are available. You can finish other
                    details and contact us for a date.
                  </p>
                )}
                <p className="field-help">
                  Once saved, contact us if you need to change the date.
                </p>
              </>
            )}
            <button
              type="button"
              disabled={saving}
              className="confirm-submit"
              onClick={continueDetails}
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          </section>
        )}
        {step === 3 && (
          <div className="confirm-step-panel">
            <section>
              <h2>When and where?</h2>
              <p>
                {form.location === "trivandrum" ? "Trivandrum" : "Kochi"} ·{" "}
                {form.delivery_date || "Date not chosen"}{" "}
                {dateLocked ? (
                  <small> Date fixed · contact us to reschedule</small>
                ) : (
                  <button type="button" onClick={() => moveTo(1)}>
                    Choose date
                  </button>
                )}
              </p>
              <label>
                <span>{form.location === "trivandrum" ? "Delivery" : "Time"}</span>
                {form.location === "trivandrum" ? <p>No time selection needed for Trivandrum.</p> : <>
                <select
                  value={form.delivery_slot}
                  onChange={(e) => update("delivery_slot", e.target.value)}
                >
                  <option value="">Choose a time</option>
                  {TIMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                </>}
              </label>
              <label>
                <span>Address</span>
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="House, street, area and landmark"
                />
              </label>
              <label>
                <span>Google Maps location link</span>
                <input
                  type="url"
                  value={form.customer_maps_url}
                  onChange={(e) => update("customer_maps_url", e.target.value)}
                  placeholder="Paste the shared map link"
                />
              </label>
              <p className="field-help">
                In Google Maps, tap Share → Copy link, then paste it here.
              </p>
            </section>
            {error && <div className="confirm-error">{error}</div>}
            <div className="step-actions">
              <button
                type="button"
                className="step-back"
                onClick={() => moveTo(2)}
              >
                Back
              </button>
              <button className="confirm-submit" disabled={saving}>
                {saving ? "Saving your order…" : "Confirm my order"}
              </button>
            </div>
          </div>
        )}
        {step === 1 && error && (
          <p className="confirm-error" role="alert">
            {error}
          </p>
        )}
        {mapPrompt && (
          <div className="map-confirm-backdrop">
            <section
              className="map-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-confirm-title"
            >
              <h2 id="map-confirm-title">
                Confirm without a Google Maps link?
              </h2>
              <p>
                A map link helps us find your delivery address. You can still
                confirm without one.
              </p>
              <button
                type="button"
                className="confirm-submit"
                onClick={() => {
                  setMapPrompt(false);
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLInputElement>('input[type="url"]')
                      ?.focus(),
                  );
                }}
              >
                Go back — I’ll share the link
              </button>
              <button
                type="button"
                className="step-back"
                disabled={saving}
                onClick={() => void finishOrder()}
              >
                No, confirm without a map link
              </button>
            </section>
          </div>
        )}
      </form>
    </main>
  );
}
