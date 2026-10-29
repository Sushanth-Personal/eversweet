"use client";
import { useEffect, useState } from "react";
import { DEFAULT_PICKUP_CODES, PICKUP_CITIES, type PickupCodes } from "@/lib/pickup-codes";
export default function PickupCodeSettings() {
  const [codes, setCodes] = useState<PickupCodes>(DEFAULT_PICKUP_CODES);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { let live = true; fetch("/api/admin/pickup-codes", { cache: "no-store" }).then(async r => {
    const d = await r.json(); if (!r.ok) throw Error(d.error); if (live) { setCodes(d.codes); setReady(true); }
  }).catch(e => { if (live) setMessage(e.message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/admin/pickup-codes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes: Object.fromEntries(Object.entries(codes).map(([k,v]) => [k,v.trim()])) }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error); setCodes(d.codes);
      window.dispatchEvent(new CustomEvent("pickup-codes-updated", { detail: d.codes })); setMessage("Pickup codes saved. Copy buttons are up to date.");
    } catch(e) { setMessage(e instanceof Error ? e.message : "Could not save pickup codes"); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="pickup-settings"><h2>Pickup locations</h2><p>Set the Plus Code copied by each city button at the top of Production. Changes apply across devices.</p>
    <fieldset disabled={!ready || loading || busy}>{PICKUP_CITIES.map(city => <label key={city.id}><strong>{city.name}</strong><input aria-label={`${city.name} pickup Plus Code`} value={codes[city.id] || ""} onChange={e => setCodes(c => ({ ...c, [city.id]: e.target.value }))} placeholder="Enter pickup Plus Code" maxLength={200}/>{city.id === "kozhikode" && !codes[city.id] && <small>Add the exact pickup code to enable copying for Kozhikode.</small>}</label>)}
    <button type="submit" className="settings-save">{busy ? "Saving…" : loading ? "Loading…" : "Save pickup codes"}</button></fieldset>{message && <p role="status">{message}</p>}
  </form>;
}
