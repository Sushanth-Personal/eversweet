"use client";
import { customerOrderLock } from "@/lib/customer-order";
import { googleMapsLink } from "@/lib/maps-plus-code";
import BoxEditor from "./BoxEditor";
import { initialBoxes, boxValues } from "@/lib/admin-boxes";
import OrderQuickDetails from "./OrderQuickDetails";
import { useEffect, useRef, useState } from "react";
import { instagramUrl, type ContactField } from "@/lib/order-contacts";
import { completeness } from "@/lib/order-draft";
import { createSaveQueue } from "@/lib/save-queue";
import type { Product, BoxSize } from "@/lib/types";
import type { ExtOrder } from "../_lib/constants";

const TIMES = [
  "11 AM–1 PM",
  "1–3 PM",
  "3–5 PM",
  "5–7 PM",
];
const mapFromNotes = (notes?: string | null) =>
  notes?.match(/Customer map:\s*(https?:\/\/\S+)/i)?.[1] || "";

function CopyField({
  label,
  value,
  onChange,
  area = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
}) {
  return (
    <label className="copy-field">
      <span>{label}</span>
      {area ? (
        <textarea
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          data-focus-field={
            label === "Phone"
              ? "phone"
              : label === "Google Maps link"
                ? "map"
                : undefined
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export function OrderManagerModal({
  order,
  products,
  boxes,
  password,
  onClose,
  onUpdated,
  onSaved,
  onDeleted,
  focusField,
  linkOnly = false,
}: {
  order: ExtOrder | null;
  products: Product[];
  boxes: BoxSize[];
  password: string;
  onClose: () => void;
  onUpdated?: (order: ExtOrder) => void;
  onSaved: () => void;
  onDeleted: () => void;
  focusField?: ContactField;
  linkOnly?: boolean;
}) {
  const [form, setForm] = useState({
    customer_name: order?.customer_name || "",
    phone: order?.phone || "",
    address: order?.address || "",
    customer_maps_url: mapFromNotes(order?.notes),
    delivery_date: order?.delivery_date || "",
    delivery_slot: order?.delivery_slot || order?.batch_label || "",
    box_size_id: order?.box_size_id || "",
    location: order?.source === "trivandrum" ? "trivandrum" : "kochi",
    fulfillment_type: order?.fulfillment_type || "delivery",
    status: order?.status || "confirmed",
    total_price: String(order?.total_price || ""),
    details_status:
      order?.notes?.match(/Details status: (complete|incomplete)/)?.[1] ||
      "auto",
    flavours: order?.flavours || ({} as Record<string, number>),
  });
  const [creationId] = useState(() => crypto.randomUUID()),
    [created, setCreated] = useState<ExtOrder | null>(null),
    [copied, setCopied] = useState("");
  const [plan, setPlan] = useState(() => initialBoxes(order, boxes));
  const [editing, setEditing] = useState(!order || !!focusField),
    [extraDetails, setExtraDetails] = useState(true);
  const [instagram, setInstagram] = useState(order?.insta_id || ""),
    [remarks, setRemarks] = useState(order?.remarks || "");
  const [target, setTarget] = useState<ContactField | undefined>(focusField),
    modal = useRef<HTMLDivElement>(null);
  const productionLocked = Boolean(
    order?.production_prepared ||
      order?.production_packed ||
      order?.status === "dispatched",
  );
  useEffect(() => {
    if (editing && target) {
      const input = modal.current?.querySelector<HTMLInputElement>(
        `[data-focus-field="${target}"]`,
      );
      input?.focus();
      input?.scrollIntoView({ block: "center" });
    }
  }, [editing, target]);
  function edit(field?: ContactField) {
    setTarget(field);
    setEditing(true);
  }
  function cancel() {
    setEditing(false);
    setTarget(undefined);
    setInstagram(order?.insta_id || "");
    setRemarks(order?.remarks || "");
    setPlan(initialBoxes(order, boxes));
    setForm({
      customer_name: order?.customer_name || "",
      phone: order?.phone || "",
      address: order?.address || "",
      customer_maps_url: mapFromNotes(order?.notes),
      delivery_date: order?.delivery_date || "",
      delivery_slot: order?.delivery_slot || order?.batch_label || "",
      box_size_id: order?.box_size_id || "",
      location: order?.source === "trivandrum" ? "trivandrum" : "kochi",
      fulfillment_type: order?.fulfillment_type || "delivery",
      status: order?.status || "confirmed",
      total_price: String(order?.total_price || ""),
      details_status:
        order?.notes?.match(/Details status: (complete|incomplete)/)?.[1] ||
        "auto",
      flavours: order?.flavours || {},
    });
  }
  const [saving, setSaving] = useState(false),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState("");
  const set = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const draft = {
    ...form,
    ...(!productionLocked ? boxValues(plan) : {}),
    insta_id: instagramUrl(instagram), remarks,
    ...(!productionLocked ? { box_selections: plan } : {}),
  };
  const original = useRef(JSON.parse(JSON.stringify(draft)));
  const persisted = useRef(JSON.parse(JSON.stringify(draft)));
  const sessionFields = useRef(new Set<string>());
  const inFlight = useRef(false);
  const failedDraft = useRef("");
  const historyMarker = useRef(creationId);
  const [saveNote, setSaveNote] = useState("");
  const latestDraft = useRef({ values: draft, rawInstagram: instagram });
  latestDraft.current = { values: draft, rawInstagram: instagram };
  const saveQueue = useRef<ReturnType<typeof createSaveQueue<typeof latestDraft.current>> | null>(null);
  if (!saveQueue.current) saveQueue.current = createSaveQueue(
    latestDraft.current,
    () => JSON.parse(JSON.stringify(latestDraft.current)),
    value => persistSnapshot(value.values, value.rawInstagram),
  );
  const closing = useRef(false);
  const draftKey = JSON.stringify({ ...draft, rawInstagram: instagram });
  const autosave = useRef(save);
  autosave.current = save;
  useEffect(() => {
    const current = latestDraft.current;
    if (!order?.id || !editing || saving || draftKey === failedDraft.current || (JSON.stringify(current.values) === JSON.stringify(persisted.current) && (!current.rawInstagram.trim() || !!instagramUrl(current.rawInstagram)))) return;
    const timer = window.setTimeout(() => { void autosave.current(true); }, 900);
    return () => window.clearTimeout(timer);
  }, [draftKey, editing, saving, order?.id]);
  async function closeEditor() {
    if (closing.current) return;
    closing.current = true;
    if (order && !(await save(true))) { closing.current = false; return; }
    if (window.history.state?.orderModal === historyMarker.current) window.history.back();
    if (order) onSaved(); else onClose();
  }
  const closeRef = useRef(closeEditor);
  closeRef.current = closeEditor;
  useEffect(() => {
    const marker = historyMarker.current;
    if (window.history.state?.orderModal !== marker) window.history.pushState({ ...window.history.state, orderModal: marker }, "");
    const back = () => { void closeRef.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); void closeRef.current(); } };
    window.addEventListener("popstate", back);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("popstate", back);
      window.removeEventListener("keydown", key);
    };
  }, []);
  async function undoSession() {
    if (!order || inFlight.current) return;
    setSaving(true); inFlight.current = true;
    try {
      const changes = Object.fromEntries(Array.from(sessionFields.current).map(k => [k, original.current[k]]));
      const response = await fetch("/api/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, ...changes }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      persisted.current = JSON.parse(JSON.stringify(original.current));
      saveQueue.current?.reset({ values: original.current, rawInstagram: order.insta_id || "" });
      sessionFields.current.clear();
      cancel(); setSaveNote("Session changes undone");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not undo"); }
    finally { inFlight.current = false; setSaving(false); }
  }

  async function invoice() {
    const invoiceFlavours = boxValues(plan).flavours;
    const names =
      products
        .filter((product) => invoiceFlavours[product.id])
        .map((product) => `${invoiceFlavours[product.id]}× ${product.name}`)
        .join(", ") || "Flavours to be confirmed";
    const number = `EVS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${order?.id.slice(0, 6).toUpperCase()}`;
    const canvas = document.createElement("canvas"),
      scale = 2,
      width = 720,
      height = 900;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d")!;
    context.scale(scale, scale);
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#c99545";
    context.fillRect(0, 0, width, 14);
    context.fillStyle = "#3b2114";
    context.textAlign = "center";
    context.font = "bold 42px Georgia";
    context.fillText("EVERSWEET", width / 2, 78);
    context.font = "16px Georgia";
    context.fillText("HAPPINESS IN ONE BITE", width / 2, 108);
    context.strokeStyle = "#d9bd91";
    context.beginPath();
    context.moveTo(55, 140);
    context.lineTo(width - 55, 140);
    context.stroke();
    context.textAlign = "left";
    context.font = "bold 17px system-ui";
    context.fillText("INVOICE", 55, 186);
    context.textAlign = "right";
    context.font = "14px system-ui";
    context.fillText(number, width - 55, 184);
    context.textAlign = "left";
    const rows = [
      ["Customer", form.customer_name],
      ["Phone", form.phone],
      ["Delivery", `${form.delivery_date} · ${form.delivery_slot}`],
      ["Location", form.location === "trivandrum" ? "Trivandrum" : "Kochi"],
      ["Address", form.address || "—"],
      ["Flavours", names],
    ];
    let y = 235;
    for (const [label, value] of rows) {
      context.fillStyle = "#826c60";
      context.font = "13px system-ui";
      context.fillText(label.toUpperCase(), 55, y);
      context.fillStyle = "#3b2114";
      context.font = "16px system-ui";
      const lines = value.match(/.{1,65}(?:\s|$)/g) || [value];
      lines.forEach((line, index) =>
        context.fillText(line.trim(), 190, y + index * 24),
      );
      y += Math.max(52, lines.length * 24 + 20);
    }
    context.strokeStyle = "#d9bd91";
    context.beginPath();
    context.moveTo(55, 620);
    context.lineTo(width - 55, 620);
    context.stroke();
    context.font = "bold 18px system-ui";
    context.fillText("TOTAL", 55, 670);
    context.textAlign = "right";
    context.font = "bold 28px system-ui";
    context.fillText(
      `₹${Number(form.total_price || 0).toLocaleString("en-IN")}`,
      width - 55,
      672,
    );
    context.textAlign = "center";
    context.font = "15px system-ui";
    context.fillStyle = "#826c60";
    context.fillText("Thank you for choosing Eversweet 🍡", width / 2, 790);
    context.fillStyle = "#c99545";
    context.fillRect(0, height - 14, width, 14);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 1),
    );
    if (!blob) return;
    const file = new File([blob], `eversweet-invoice-${number}.png`, {
      type: "image/png",
    });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Eversweet invoice ${number}`,
      });
    } else {
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  }
  async function persistSnapshot(snapshot: typeof draft, rawInstagram: string) {
    if (rawInstagram.trim() && !instagramUrl(rawInstagram)) throw Error("Enter a valid Instagram username or profile link.");
    const changed = (Object.keys(snapshot) as Array<keyof typeof snapshot>).filter(k => JSON.stringify(snapshot[k]) !== JSON.stringify(persisted.current[k]));
    if (order && !changed.length) return;
    const changes = Object.fromEntries(changed.map(k => [k, snapshot[k]]));
      const response = await fetch("/api/admin/orders", {
          method: order ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": password,
          },
          body: JSON.stringify({
            ...(order ? changes : snapshot),
            id: order?.id || creationId,
          }),
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (order && "insta_id" in changes && instagramUrl(data.order?.insta_id) !== snapshot.insta_id) {
        throw Error("Instagram was not saved correctly. Please retry before closing.");
      }
      persisted.current = snapshot;
      failedDraft.current = "";
      changed.forEach(k => sessionFields.current.add(k));
      if (order && data.order) onUpdated?.(data.order);
      if (!order) setCreated(data.order);
  }
  async function save(automatic = false) {
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      if (order) await saveQueue.current!.flush();
      else await persistSnapshot(latestDraft.current.values, latestDraft.current.rawInstagram);
      setSaveNote("All changes saved");
      if (order && !automatic) onSaved();
      return true;
    } catch (caught) {
      failedDraft.current = draftKey;
      setError(
        caught instanceof Error ? caught.message : "Could not save order",
      );
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !order ||
      !window.confirm(
        `Delete ${order.customer_name}'s order?\n\nIt will disappear from the calendar.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/orders", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": password,
          },
          body: JSON.stringify({ id: order.id }),
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onDeleted();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not delete order",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function copyNewOrder() {
    if (saving) return;
    if (!form.delivery_date) {
      setError("Choose the order date before copying the link.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: creationId, delivery_date: form.delivery_date, location: form.location, box_selections: plan }),
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setCreated(data.order);
      try {
        await navigator.clipboard.writeText(
          window.location.origin + "/confirm/" + data.order.id,
        );
        setCopied("Order link copied ✓");
      } catch {
        setCopied(
          "Order created. Use Copy link below, or select the link to copy it.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create order");
    } finally {
      setSaving(false);
    }
  }
  if (linkOnly && !order && !created)
    return (
      <div className="order-modal-backdrop">
        <div
          className="order-modal"
          role="dialog"
          aria-modal="true"
          aria-label="New order link"
        >
          <header>
            <h2>Order link</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
            >
              ✕
            </button>
          </header>
          <p>
            Set the city and date first. These are fixed on the customer’s link;
            choose the boxes below, then your customer can fill in their details
            and flavours.
          </p>
          <fieldset className="order-link-priority">
            <legend>Order city</legend>
            <div className="location-toggle">
              {[["kochi", "Kochi"], ["trivandrum", "Trivandrum"]].map(([value, label]) => (
                <button type="button" key={value} aria-pressed={form.location === value}
                  className={form.location === value ? "active" : ""}
                  disabled={saving} onClick={() => set("location", value)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>Order date</span>
            <input type="date" required disabled={saving} value={form.delivery_date}
              min={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())}
              onChange={e => set("delivery_date", e.target.value)} />
          </label>
          <p><strong>{form.location === "trivandrum" ? "Trivandrum" : "Kochi"}</strong> · {form.delivery_date || "Choose a date"}</p>
          <section className="admin-box-editor" aria-label="Boxes for customer order">
            <h3>Boxes</h3>
            {plan.map((box, index) => (
              <div className="order-modal-grid" key={index}>
                <label>
                  <span>Box {index + 1} size</span>
                  <select disabled={saving} value={box.box_size_id}
                    onChange={e => setPlan(current => current.map((item,i) => i === index ? {...item,box_size_id:e.target.value} : item))}>
                    {boxes.filter(size => size.is_active || size.id === box.box_size_id).sort((a,b)=>a.count-b.count).map(size => <option key={size.id} value={size.id}>{size.label} · {size.count} pieces</option>)}
                  </select>
                </label>
                <button type="button" disabled={saving} aria-label={`Remove box ${index+1}`}
                  onClick={() => setPlan(current => current.filter((_,i)=>i !== index))}>Remove box</button>
              </div>
            ))}
            <button type="button" disabled={saving || plan.length >= 100 || !boxes.some(size=>size.is_active)}
              onClick={() => {
                const size = [...boxes].filter(size=>size.is_active).sort((a,b)=>a.count-b.count)[0];
                if(size) setPlan(current => [...current,{box_size_id:size.id,flavours:{}}]);
              }}>＋ Add box</button>
            <p>{plan.length ? `${plan.length} box${plan.length === 1 ? "" : "es"} · ${plan.reduce((sum,box)=>sum+(boxes.find(size=>size.id===box.box_size_id)?.count||0),0)} pieces. Your customer chooses the flavours.` : "No boxes selected yet. You can also let the customer choose."}</p>
          </section>
          <button
            type="button"
            className="modal-save"
            disabled={saving || !form.delivery_date}
            onClick={copyNewOrder}
          >
            {saving ? "Creating order…" : "Copy Order"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
    );
  if (created)
    return (
      <div className="order-modal-backdrop">
        <div
          className="order-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Order created"
        >
          <h2>Your customer link is ready</h2>
          <p>
            Send this link to your customer. They choose their date, city,
            flavours and delivery details. It always opens this same order.
          </p>
          <label>
            Private customer link
            <input
              readOnly
              value={
                typeof window === "undefined"
                  ? ""
                  : window.location.origin + "/confirm/" + created.id
              }
            />
          </label>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin + "/confirm/" + created.id,
                );
                setCopied("Link copied");
              } catch {
                setCopied("Select and copy the link above");
              }
            }}
          >
            Copy link
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  "Thank you for choosing Eversweet! Choose your date, flavours and delivery details using your personal order link: " +
                    window.location.origin +
                    "/confirm/" +
                    created.id +
                    "\nThis link is for this order only. For a new order or date change, please message us.",
                );
                setCopied("Message copied");
              } catch {
                setCopied("Select and copy the link above");
              }
            }}
          >
            Copy thank-you message
          </button>
          <p role="status">{copied}</p>
          <button className="modal-save" onClick={onSaved}>
            Done
          </button>
        </div>
      </div>
    );
  return (
    <div
      className="order-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) void closeEditor();
      }}
    >
      <div
        className="order-modal"
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit order" : "Order details"}
      >
        <header>
          <div>
            <small>
              {order ? (editing ? "EDIT ORDER" : "ORDER DETAILS") : "NEW ORDER"}
            </small>
            <h2>{order ? order.customer_name : "New order"}</h2>
          </div>
          {order && !editing && <button onClick={() => edit()}>Edit</button>}
          <button className="floating-order-close" onClick={() => void closeEditor()} aria-label="Close order">
            ✕
          </button>
        </header>
        {!editing && (
          <OrderQuickDetails
            form={{
              ...form,
              ...boxValues(plan),
              insta_id: instagram,
              remarks,
              status:
                order?.status === "dispatched"
                  ? "Dispatched"
                  : order?.production_packed
                    ? "Ready to dispatch"
                    : order?.production_prepared || order?.production_ready
                      ? "Ready to pack"
                      : "Preparing",
              payment_method: order?.payment_method,
              box_selections: plan,
            }}
            products={products}
            boxes={boxes}
            onEdit={edit}
          />
        )}
        {order && customerOrderLock(order) && (
          <p className="modal-error">
            Customer editing is closed: {customerOrderLock(order)}
          </p>
        )}
        {!editing && order && !customerOrderLock(order) && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin + "/confirm/" + order.id,
                );
                setError("Customer link copied ✓");
              } catch {
                setError("Could not copy customer link");
              }
            }}
          >
            Copy customer link
          </button>
        )}
        {editing && (
          <>
            {order && (
              <section className="draft-admin-controls">
                <p>
                  {completeness(order, boxes).complete
                    ? "✓ Complete"
                    : "Incomplete — " + completeness(order, boxes).missing}
                </p>
                {!customerOrderLock(order) && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          window.location.origin + "/confirm/" + order.id,
                        );
                        setError("Customer link copied ✓");
                      } catch {
                        setError(
                          "Copy this link: " +
                            window.location.origin +
                            "/confirm/" +
                            order.id,
                        );
                      }
                    }}
                  >
                    Copy customer link
                  </button>
                )}
                <label>
                  <span>Details status</span>
                  <select
                    value={form.details_status}
                    onChange={(e) => set("details_status", e.target.value)}
                  >
                    <option value="auto">Check automatically</option>
                    <option value="complete">Complete — checked by me</option>
                    <option value="incomplete">
                      Incomplete — needs follow-up
                    </option>
                  </select>
                </label>
              </section>
            )}
            <div className="order-modal-grid">
              <CopyField
                label="Name"
                value={form.customer_name}
                onChange={(value) => set("customer_name", value)}
              />
              <CopyField
                label="Phone"
                value={form.phone}
                onChange={(value) => set("phone", value)}
              />
              <label>
                <span>Date</span>
                <input
                  type="date"
                  disabled={productionLocked}
                  value={form.delivery_date}
                  onChange={(event) => set("delivery_date", event.target.value)}
                />
              </label>
              <label>
                <span>Time</span>
                {form.location === "trivandrum" ? <p>No time selection needed for Trivandrum</p> : <select
                  data-focus-field="time"
                  value={form.delivery_slot}
                  onChange={(event) => set("delivery_slot", event.target.value)}
                >
                  <option value="">Choose time</option>
                  {TIMES.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>}
              </label>
            </div>
            <label>
              <span>Instagram profile link</span>
              <input
                data-focus-field="instagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username or profile URL"
              />
            </label>
            <div className="location-toggle">
              {[
                ["kochi", "Kochi"],
                ["trivandrum", "TVM"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  disabled={productionLocked}
                  className={form.location === value ? "active" : ""}
                  key={value}
                  onClick={() => set("location", value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!order && (
              <p className="quiet">
                Add the details you have. Your customer can complete the rest
                using their personal order link.
              </p>
            )}
            {extraDetails && (
              <>
                <div className="location-toggle">
                  {[
                    ["delivery", "🚚 Delivery"],
                    ["pickup", "🏠 Pickup"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      className={
                        form.fulfillment_type === value ? "active" : ""
                      }
                      key={value}
                      onClick={() => set("fulfillment_type", value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <CopyField
                  label="Address"
                  value={form.address}
                  onChange={(value) => set("address", value)}
                  area
                />
                <CopyField
                  label="Google Maps link"
                  value={form.customer_maps_url}
                  onChange={(value) => set("customer_maps_url", value)}
                />
                {Boolean(googleMapsLink(form.customer_maps_url)) && (
                  <a
                    className="quick-call"
                    href={googleMapsLink(form.customer_maps_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Google Maps ↗
                  </a>
                )}
                {productionLocked && (
                  <p className="quiet">
                    Prepared pieces are reserved for this order. Use Undo
                    prepared in Orders, or Unpack in Dispatch, before changing
                    boxes, date or city.
                  </p>
                )}
                <fieldset data-focus-field="flavours" tabIndex={-1}
                  className="production-box-fieldset"
                  disabled={productionLocked}
                >
                  <BoxEditor
                    plan={plan}
                    onChange={setPlan}
                    products={products}
                    boxes={boxes}
                  />
                </fieldset>
              </>
            )}
            <div className="order-modal-grid">
              <label>
                <span>Price</span>
                <input
                  type="number"
                  min="0"
                  value={form.total_price}
                  onChange={(event) => set("total_price", event.target.value)}
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          {order && (
            <button
              type="button"
              className="delete-order-action"
              disabled={deleting || saving}
              onClick={remove}
            >
              {deleting ? "Deleting…" : "Delete order"}
            </button>
          )}
          {order && (
            <button type="button" className="invoice-action" onClick={invoice}>
              Generate invoice
            </button>
          )}
          {editing && order && (
            <button disabled={saving} onClick={undoSession}>
              Undo session changes
            </button>
          )}
          {editing && (
            <button
              type="button"
              className="modal-save"
              disabled={saving || deleting}
              onClick={() => void save()}
            >
              {saving
                ? "Saving…"
                : order
                  ? "Save order"
                  : "Create order & get link"}
            </button>
          )}
        </div>
        {order && <p role="status" className="autosave-status">{saving ? "Saving…" : error ? "Not saved — correct the error above" : JSON.stringify(draft) !== JSON.stringify(persisted.current) || (instagram.trim() && !instagramUrl(instagram)) ? "Changes pending…" : saveNote || "Edits save automatically"}</p>}
      </div>
    </div>
  );
}
