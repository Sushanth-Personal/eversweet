"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Product = { id: string; name: string };
type Box = { id: string; label: string; count: number };
type Form = {
  customer_name: string;
  phone: string;
  address: string;
  customer_maps_url: string;
  box_size_id: string;
  delivery_date: string;
  delivery_slot: string;
  flavours: Record<string, number>;
};

const TIMES = ["9–11 AM", "11 AM–1 PM", "1–3 PM", "3–5 PM", "5–7 PM", "7–9 PM", "9–11 PM"];
const emptyForm: Form = { customer_name: "", phone: "", address: "", customer_maps_url: "", box_size_id: "", delivery_date: "", delivery_slot: "", flavours: {} };

export default function ConfirmationPage() {
  const id = useParams()?.id as string;
  const [form, setForm] = useState<Form>(emptyForm);
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/order-confirmation/${id}`)
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; })
      .then(({ order, products, boxes }) => {
        setProducts(products); setBoxes(boxes);
        setForm({
          customer_name: order.customer_name || "", phone: order.phone || "", address: order.address || "",
          customer_maps_url: order.customer_maps_url || "", box_size_id: order.box_size_id || "",
          delivery_date: order.delivery_date || "", delivery_slot: order.delivery_slot || order.batch_label || "",
          flavours: order.flavours || {},
        });
      })
      .catch((e) => setError(e.message || "Order not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const pieces = useMemo(() => Object.values(form.flavours).reduce((a, b) => a + b, 0), [form.flavours]);
  const update = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const changeQty = (productId: string, delta: number) => setForm((f) => {
    const next = Math.max(0, (f.flavours[productId] || 0) + delta);
    const flavours = { ...f.flavours };
    if (next) flavours[productId] = next; else delete flavours[productId];
    return { ...f, flavours };
  });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSaved(false);
    if (!form.customer_name.trim() || !form.delivery_date || !form.delivery_slot) {
      setError("Please enter your name, delivery date and time."); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/order-confirmation/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setSaved(true); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your details"); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="confirm-page"><div className="confirm-card">Preparing your order form…</div></main>;
  if (error && !form.customer_name) return <main className="confirm-page"><div className="confirm-card"><h1>We couldn’t open this order</h1><p>{error}</p></div></main>;

  return (
    <main className="confirm-page">
      <form className="confirm-card" onSubmit={save}>
        <div className="confirm-hero"><span>🍡</span><div><p>Order confirmation</p><h1>{saved ? "Your details are saved!" : "A few details, then you’re done"}</h1></div></div>
        {saved && <div className="confirm-success">✓ Thank you! You can reopen this link anytime to make changes.</div>}
        <p className="confirm-note">Only fields marked <b>*</b> are required. Everything else can be added now or later.</p>

        <section><h2>When should we prepare it?</h2><div className="confirm-grid">
          <label><span>Name *</span><input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} placeholder="Your name" /></label>
          <label><span>Phone number</span><input inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Optional" /></label>
          <label><span>Date *</span><input type="date" value={form.delivery_date} onChange={(e) => update("delivery_date", e.target.value)} /></label>
          <label><span>Time *</span><select value={form.delivery_slot} onChange={(e) => update("delivery_slot", e.target.value)}><option value="">Choose a time</option>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div></section>

        <section><h2>Where should it go?</h2><label><span>Address</span><textarea value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="House, street, area and landmark" rows={3} /></label>
          <label><span>Google Maps location link</span><input type="url" value={form.customer_maps_url} onChange={(e) => update("customer_maps_url", e.target.value)} placeholder="Paste the shared map link" /></label>
          <p className="field-help">In Google Maps, tap Share → Copy link, then paste it here.</p>
        </section>

        <section><h2>What’s in your box?</h2><label><span>Box size</span><select value={form.box_size_id} onChange={(e) => update("box_size_id", e.target.value)}><option value="">Choose later</option>{boxes.map((b) => <option value={b.id} key={b.id}>{b.label}</option>)}</select></label>
          <div className="flavour-heading"><span>Flavours</span><b>{pieces} piece{pieces === 1 ? "" : "s"} selected</b></div>
          <div className="flavour-grid">{products.map((p, i) => { const qty = form.flavours[p.id] || 0; return <div className={`flavour-choice tone-${i % 5}`} key={p.id}><span>{p.name}</span><div><button type="button" onClick={() => changeQty(p.id, -1)} disabled={!qty}>−</button><b>{qty}</b><button type="button" onClick={() => changeQty(p.id, 1)}>+</button></div></div>; })}</div>
        </section>
        {error && <div className="confirm-error">{error}</div>}
        <button className="confirm-submit" disabled={saving}>{saving ? "Saving…" : saved ? "Save changes" : "Confirm my order"}</button>
        <p className="confirm-footer">Need help? Message Eversweet on WhatsApp.</p>
      </form>
    </main>
  );
}
