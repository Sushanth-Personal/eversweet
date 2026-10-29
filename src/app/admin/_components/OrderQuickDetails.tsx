"use client";
import { useState } from "react";
import {
  deliveryText,
  instagramUrl,
  type ContactField,
} from "@/lib/order-contacts";
import ContactActions from "./ContactActions";
import FlavourChips from "./FlavourChips";
export default function OrderQuickDetails({
  form,
  products,
  boxes,
  onEdit,
}: {
  form: any;
  products: { id: string; name: string }[];
  boxes: { id: string; label: string }[];
  onEdit: (field?: ContactField) => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied`);
    } catch {
      setMessage("Copy unavailable. Select the text to copy it.");
    }
  }
  async function plus() {
    setBusy(true);
    try {
      const r = await fetch("/api/maps-plus-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: form.customer_maps_url }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      await copy(d.code + (d.context ? ", " + d.context : ""), "Plus Code");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not find Plus Code");
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    ["Name", form.customer_name],
    ["Phone", form.phone],
    ["Address", form.address],
    ["Google Maps link", form.customer_maps_url],
    ["Instagram profile", instagramUrl(form.insta_id)],
    ["Delivery", `${form.delivery_date || "Date pending"} · ${form.delivery_slot || "Time pending"}\n${form.location === "trivandrum" ? "Trivandrum" : form.location === "kozhikode" ? "Kozhikode" : "Kochi"} · ${form.fulfillment_type || "delivery"}`],
    ["Order", `${form.status} · ${form.payment_method || "Admin order"} · ₹${Number(form.total_price || 0).toLocaleString("en-IN")}`],
    ...(form.remarks ? [["Notes", form.remarks]] : []),
  ];
  return (
    <section className="order-quick-details">
      <ContactActions values={form} onEdit={onEdit} />
      <p className="quiet">Tap a detail to copy</p>
      <dl className="production-details">
        {fields.map(([label, value]) => (
          <div key={label}
            className={value ? "copy-detail-box" : undefined}
            role={value ? "button" : undefined}
            tabIndex={value ? 0 : undefined}
            aria-label={value ? `Copy ${label.toLowerCase()}` : undefined}
            onClick={() => value && void copy(value, label)}
            onKeyDown={event => {
              if (value && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault(); void copy(value, label);
              }
            }}>
            <dt>{label}</dt>
            <dd>
              {value ? (
                <span className="copy-detail-value">{value}</span>
              ) : (
                <span className="quiet">Not provided</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <button onClick={() => copy(deliveryText(form), "Delivery details")}>
        Copy delivery details
      </button>
      {form.customer_maps_url && (
        <button disabled={busy} onClick={plus}>
          {busy ? "Finding…" : "Copy Plus Code"}
        </button>
      )}
      <p role="status" className="production-feedback">
        {message}
      </p>
      <div className="production-boxes">
        {form.box_selections?.map((box: any, i: number) => (
          <section key={i}>
            <h3>
              Box {i + 1}{" "}
              <span>
                {boxes.find((b) => b.id === box.box_size_id)?.label ||
                  "Size pending"}
              </span>
            </h3>
            <FlavourChips flavours={box.flavours} products={products} />
          </section>
        ))}
      </div>
    </section>
  );
}
