"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string };
type Form = { customer_name: string; phone: string; address: string; customer_maps_url: string; delivery_date: string; delivery_slot: string; flavours: Record<string, number> };
const TIMES = ["9–11 AM", "11 AM–1 PM", "1–3 PM", "3–5 PM", "5–7 PM", "7–9 PM", "9–11 PM"];
const FALLBACK_FLAVOURS: Product[] = [
  "Mango", "Strawberry", "Blueberry", "Red Cherry", "Lemon Curd", "Kiwi",
  "Green Apple", "Orange", "Pear", "Nutella", "Milk Choco Nuts", "Coffee Nuts",
  "Biscoff", "Dark Chocolate", "Pistachio", "Hazelnut",
].map((name) => ({ id: name.toLowerCase().replace(/\s+/g, "-"), name }));
const initial: Form = { customer_name: "", phone: "", address: "", customer_maps_url: "", delivery_date: "", delivery_slot: "", flavours: {} };

export default function NewConfirmationPage() {
  const [form, setForm] = useState<Form>(initial);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [showFlavours, setShowFlavours] = useState(false);

  useEffect(() => {
    fetch("/api/order-confirmation").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then((d) => { setProducts(d.products?.length ? d.products : FALLBACK_FLAVOURS); })
      .catch(() => setError("Box sizes and flavours could not be loaded. You can still send your name, date and time."));
  }, []);

  const pieces = useMemo(() => Object.values(form.flavours).reduce((a, b) => a + b, 0), [form.flavours]);
  const update = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const toggleFlavour = (id: string) => setForm((f) => { const flavours = { ...f.flavours }; if (flavours[id]) delete flavours[id]; else flavours[id] = 1; return { ...f, flavours }; });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!form.customer_name.trim() || !form.phone.trim() || !form.delivery_date || !form.delivery_slot) {
      const message = "Please enter your name, phone number, delivery date and time.";
      setError(message); window.alert(message); return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/order-confirmation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setOrderId(data.id); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your details"); }
    finally { setSaving(false); }
  }

  if (orderId) {
    const editPath = `/confirm/${orderId}`;
    return <main className="confirm-page"><div className="confirm-card confirmation-done"><div className="done-icon">✓</div><p className="section-label">ORDER RECEIVED</p><h1>Thank you, {form.customer_name.split(" ")[0]}!</h1><p>Your details are now on Eversweet’s calendar. Keep the button below if you need to change anything later.</p><a className="confirm-submit edit-link" href={editPath}>View or edit my details</a><p className="confirm-footer">You can safely close this page after saving the link.</p></div></main>;
  }

  return <main className="confirm-page"><form className="confirm-card" onSubmit={submit}>
    <div className="confirm-hero"><span>🍡</span><div><p>Payment complete?</p><h1>Confirm your order details</h1></div></div>
    <p className="confirm-note">Thank you for your payment! Tell us when and where you would like your order.</p>
    <section><h2>When should we prepare it?</h2><div className="confirm-grid">
      <label><span>Name</span><input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} placeholder="Your name" /></label>
      <label><span>Phone number</span><input inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Your phone number" /></label>
      <label><span>Date</span><input type="date" value={form.delivery_date} onChange={(e) => update("delivery_date", e.target.value)} /></label>
      <label><span>Time</span><select value={form.delivery_slot} onChange={(e) => update("delivery_slot", e.target.value)}><option value="">Choose a time</option>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></label>
    </div></section>
    <section><h2>Where should it go?</h2><label><span>Address</span><textarea rows={3} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="House, street, area and landmark" /></label><label><span>Google Maps location link</span><input type="url" value={form.customer_maps_url} onChange={(e) => update("customer_maps_url", e.target.value)} placeholder="Paste the shared map link" /></label><p className="field-help">In Google Maps, tap Share → Copy link, then paste it here.</p></section>
    <section className="flavour-collapsible"><button type="button" className="flavour-opener" onClick={()=>setShowFlavours(v=>!v)}><span><b>Choose flavours</b><small>{pieces?`${pieces} selected`:"Tap to select"}</small></span><i>{showFlavours?"−":"+"}</i></button>{pieces>0&&!showFlavours&&<div className="selected-flavour-chips">{products.filter(p=>form.flavours[p.id]).map(p=><span key={p.id}>{p.name}</span>)}</div>}{showFlavours&&<div className="flavour-grid tick-grid">{products.map((p, i) => { const checked = Boolean(form.flavours[p.id]); return <label className={`flavour-choice flavour-tick tone-${i % 5} ${checked ? "checked" : ""}`} key={p.id}><input type="checkbox" checked={checked} onChange={() => toggleFlavour(p.id)} /><span className="tick-mark">{checked ? "✓" : ""}</span><span>{p.name}</span></label>; })}</div>}</section>
    {error && <div className="confirm-error">{error}</div>}<button className="confirm-submit" disabled={saving}>{saving ? "Saving your order…" : "Confirm my order"}</button>
  </form></main>;
}
