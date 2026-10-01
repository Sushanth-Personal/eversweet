"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string };
type Box = { id: string; label: string; count: number };
type Form = { customer_name: string; phone: string; address: string; customer_maps_url: string; delivery_date: string; delivery_slot: string; box_size_id: string; box_quantity: number; flavours: Record<string, number> };
const TIMES = ["9–11 AM", "11 AM–1 PM", "1–3 PM", "3–5 PM", "5–7 PM", "7–9 PM", "9–11 PM"];
const FALLBACK_FLAVOURS: Product[] = [
  "Mango", "Strawberry", "Blueberry", "Red Cherry", "Lemon Curd", "Kiwi",
  "Green Apple", "Orange", "Pear", "Nutella", "Milk Choco Nuts", "Coffee Nuts",
  "Biscoff", "Dark Chocolate", "Pistachio", "Hazelnut",
].map((name) => ({ id: name.toLowerCase().replace(/\s+/g, "-"), name }));
const initial: Form = { customer_name: "", phone: "", address: "", customer_maps_url: "", delivery_date: "", delivery_slot: "", box_size_id: "", box_quantity: 1, flavours: {} };

export default function NewConfirmationPage() {
  const [form, setForm] = useState<Form>(initial);
  const [products, setProducts] = useState<Product[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [showFlavours, setShowFlavours] = useState(false);
  const [flavourSearch, setFlavourSearch] = useState("");

  useEffect(() => {
    fetch("/api/order-confirmation").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then((d) => { setProducts(d.products?.length ? d.products : FALLBACK_FLAVOURS); setBoxes(d.boxes || []); })
      .catch(() => setError("Box sizes and flavours could not be loaded. You can still send your name, date and time."));
  }, []);

  const pieces = useMemo(() => Object.values(form.flavours).reduce((a, b) => a + b, 0), [form.flavours]);
  const selectedBox = boxes.find((b) => b.id === form.box_size_id);
  const requiredPieces = (selectedBox?.count || 0) * form.box_quantity;
  const visibleProducts = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(flavourSearch.trim().toLowerCase())).sort((a,b)=>Number(Boolean(form.flavours[b.id]))-Number(Boolean(form.flavours[a.id]))), [products, flavourSearch, form.flavours]);
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
    <section className="box-choice-section"><h2>Choose box size</h2><div className="box-choice-grid">{[4,5,6,8].map(size=>{const box=boxes.find(b=>b.count===size),active=box?.id===form.box_size_id;return <button type="button" disabled={!box} className={active?"active":""} key={size} onClick={()=>box&&setForm(f=>({...f,box_size_id:box.id,box_quantity:1,flavours:{}}))}><b>{size}</b><small>pieces</small></button>})}</div>{selectedBox&&<div className="box-quantity"><div className="selected-box-name"><small>SELECTED</small><strong>{selectedBox.label}</strong><span>{requiredPieces} pieces total</span></div><div className="quantity-stepper"><button type="button" disabled={form.box_quantity===1} onClick={()=>setForm(f=>({...f,box_quantity:Math.max(1,f.box_quantity-1)}))}>−</button><b>{form.box_quantity}</b><button type="button" onClick={()=>setForm(f=>({...f,box_quantity:f.box_quantity+1}))}>＋</button></div></div>}</section>
    {selectedBox&&<section className="flavour-collapsible"><button type="button" className="flavour-opener" onClick={()=>setShowFlavours(v=>!v)}><span><b>Choose flavours</b><small>{pieces} of {requiredPieces} selected</small></span><i>{showFlavours?"−":"+"}</i></button>{pieces>0&&<div className="selected-flavour-chips chosen-box"><b>Your box</b>{products.filter(p=>form.flavours[p.id]).map(p=><button type="button" onClick={()=>toggleFlavour(p.id)} key={p.id}>{p.name}<span>×</span></button>)}</div>}{showFlavours&&<><div className="flavour-tools"><input type="search" value={flavourSearch} onChange={e=>setFlavourSearch(e.target.value)} placeholder="Search flavours…"/><span className={pieces===requiredPieces?"complete":""}>{pieces}/{requiredPieces}</span></div><div className="flavour-grid tick-grid">{visibleProducts.map((p, i) => { const checked = Boolean(form.flavours[p.id]), full=pieces>=requiredPieces&&!checked; return <label className={`flavour-choice flavour-tick tone-${i % 5} ${checked ? "checked" : ""} ${full?"disabled":""}`} key={p.id}><input type="checkbox" disabled={full} checked={checked} onChange={() => toggleFlavour(p.id)} /><span className="tick-mark">{checked ? "✓" : ""}</span><span>{p.name}</span></label>; })}</div>{visibleProducts.length===0&&<p className="no-flavour-results">No matching flavour</p>}</>}</section>}
    {error && <div className="confirm-error">{error}</div>}<button className="confirm-submit" disabled={saving}>{saving ? "Saving your order…" : "Confirm my order"}</button>
  </form></main>;
}
