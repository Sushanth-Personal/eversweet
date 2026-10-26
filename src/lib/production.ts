import { initialBoxes } from "./admin-boxes";
import type { ExtOrder } from "@/app/admin/_lib/constants";
import type { BoxSize } from "./types";

export type City = "kochi" | "trivandrum";
export type Progress = { city: City; flavour_id: string; finished: number };
export type Packing = {
  order_id: string;
  delivery_date: string;
  city: City;
  flavours: Record<string, number>;
  packed_at: string | null;
  dispatched_at?: string | null;
};
export const cityOf = (o: { source?: string }): City =>
  o.source === "trivandrum" ? "trivandrum" : "kochi";
export const isDispatched = (o: { status: string }) =>
  o.status.trim().toLowerCase() === "dispatched";
export const stockKey = (city: City, id: string) => `${city}:${id}`;
export const total = (values: Record<string, number>) =>
  Object.values(values).reduce((a, n) => a + Math.max(0, Number(n) || 0), 0);
export function nextOrderAction(state: {
  status: string;
  packed: boolean;
  ready: boolean;
}) {
  if (state.status.trim().toLowerCase() === "cancelled")
    return { action: null, label: "Cancelled" };
  if (isDispatched(state)) return { action: "reset_order", label: "Dispatched · reset" };
  if (state.packed) return { action: "dispatch", label: "Mark dispatched" };
  if (state.ready) return { action: "pack", label: "Mark packed" };
  return { action: "prepare_order", label: "Mark prepared" };
}
export function slotMinutes(slot?: string | null) {
  const match = slot?.match(/^(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return 1440;
  let hour = Number(match[1]);
  const meridiem =
    match[3]?.toUpperCase() || slot?.match(/(AM|PM)/i)?.[1]?.toUpperCase();
  if (meridiem === "PM" && hour < 12 && (hour !== 11 || !!match[3])) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + Number(match[2] || 0);
}
export function productionOrder(o: ExtOrder, boxes: BoxSize[]) {
  const plan = initialBoxes(o, boxes);
  const flavours: Record<string, number> = {};
  const cups: Record<string, { white: number; regular: number }> = {};
  let valid = plan.length > 0;
  for (const box of plan) {
    const size = boxes.find((b) => b.id === box.box_size_id)?.count;
    if (!size || total(box.flavours) !== size) valid = false;
    for (const [id, n] of Object.entries(box.flavours)) {
      if (!Number.isSafeInteger(n) || n < 0) {
        valid = false;
        continue;
      }
      if (!n) continue;
      flavours[id] = (flavours[id] || 0) + n;
      cups[id] ||= { white: 0, regular: 0 };
      if (size === 8) cups[id].white += n;
      else if (size === 4 || size === 5 || size === 6) cups[id].regular += n;
    }
  }
  return {
    order: o,
    city: cityOf(o),
    plan,
    flavours,
    cups,
    valid: valid && !!o.delivery_date && !!(o.delivery_slot || o.batch_label),
  };
}
export function buildProduction(
  orders: ExtOrder[],
  boxes: BoxSize[],
  progress: Progress[],
  packing: Packing[],
) {
  const active = orders.filter(
    (o) => o.status.trim().toLowerCase() !== "cancelled",
  );
  const rows = active
    .map((o) => productionOrder(o, boxes))
    .sort(
      (a, b) =>
        slotMinutes(a.order.delivery_slot || a.order.batch_label) -
          slotMinutes(b.order.delivery_slot || b.order.batch_label) ||
        a.order.created_at.localeCompare(b.order.created_at) ||
        a.order.id.localeCompare(b.order.id),
    );
  const required: Record<string, number> = {},
    prepared: Record<string, number> = {},
    reserved: Record<string, number> = {},
    cups: Record<string, { white: number; regular: number }> = {};
  for (const p of progress)
    prepared[stockKey(p.city, p.flavour_id)] = p.finished;
  const packed = new Map(
    packing.filter((p) => p.packed_at).map((p) => [p.order_id, p]),
  );
  const preparedOrders = new Map(
    packing.filter((p) => !p.packed_at).map((p) => [p.order_id, p]),
  );
  for (const row of rows)
    for (const [id, n] of Object.entries(row.flavours)) {
      const k = stockKey(row.city, id);
      required[k] = (required[k] || 0) + n;
      cups[k] ||= { white: 0, regular: 0 };
      cups[k].white += row.cups[id].white;
      cups[k].regular += row.cups[id].regular;
      // Historical dispatched orders predate the reservation ledger, but their stock is still consumed.
      if (
        (isDispatched(row.order) ||
          row.order.production_packed ||
          row.order.production_prepared) &&
        !packing.some((p) => p.order_id === row.order.id)
      )
        reserved[k] = (reserved[k] || 0) + n;
    }
  for (const p of packing)
    for (const [id, n] of Object.entries(p.flavours)) {
      const k = stockKey(p.city, id);
      reserved[k] = (reserved[k] || 0) + n;
    }
  // Packed/dispatched pieces necessarily already exist, including historical orders
  // created before preparation tracking. Do not ask the kitchen to make them again.
  for (const k of Object.keys(reserved))
    prepared[k] = Math.max(prepared[k] || 0, reserved[k]);
  const inventory: Record<string, number> = {};
  for (const k of Array.from(
    new Set([...Object.keys(prepared), ...Object.keys(reserved)]),
  ))
    inventory[k] = Math.max(0, (prepared[k] || 0) - (reserved[k] || 0));
  const pending = rows.filter(
    (r) =>
      !packed.has(r.order.id) &&
      !r.order.production_packed &&
      !isDispatched(r.order),
  );
  function allocate(stock: Record<string, number>) {
    const left = { ...stock };
    const ready: string[] = [];
    const missing: Record<string, Record<string, number>> = {};
    for (const r of pending) {
      if (preparedOrders.has(r.order.id) || r.order.production_prepared) {
        ready.push(r.order.id);
        missing[r.order.id] = {};
        continue;
      }
      const need: Record<string, number> = {};
      for (const [id, n] of Object.entries(r.flavours)) {
        const shortage = Math.max(0, n - (left[stockKey(r.city, id)] || 0));
        if (shortage) need[id] = shortage;
      }
      missing[r.order.id] = need;
      if (r.valid && !Object.keys(need).length) {
        ready.push(r.order.id);
        for (const [id, n] of Object.entries(r.flavours))
          left[stockKey(r.city, id)] = (left[stockKey(r.city, id)] || 0) - n;
      }
    }
    return { ready, missing, left };
  }
  const allocation = allocate(inventory);
  // Schedule whole boxes, rather than independently ranking popular flavours.
  // Each chosen flavour represents its remaining daily batch. Keep the flavours
  // for the cheapest-to-finish box together before moving to another box.
  const simulatedStock = { ...allocation.left };
  const candidates = pending
    .filter(r => r.valid && !allocation.ready.includes(r.order.id))
    .flatMap(r => r.plan.map(box => ({ city: r.city, flavours: box.flavours })));
  const batchRank = new Map<string, number>();
  while (candidates.length) {
    const needs = (box: typeof candidates[number]) => Object.entries(box.flavours)
      .map(([id, n]) => ({ key: stockKey(box.city, id), n: Math.max(0, n - (simulatedStock[stockKey(box.city, id)] || 0)) }))
      .filter(x => x.n > 0);
    let best = 0;
    for (let i = 1; i < candidates.length; i++) {
      const a = needs(candidates[i]), b = needs(candidates[best]);
      if (a.length < b.length || (a.length === b.length && a.reduce((s,x)=>s+x.n,0) < b.reduce((s,x)=>s+x.n,0))) best = i;
    }
    const box = candidates.splice(best, 1)[0];
    for (const need of needs(box)) {
      if (!batchRank.has(need.key)) {
        batchRank.set(need.key, batchRank.size);
        simulatedStock[need.key] = (simulatedStock[need.key] || 0) + Math.max(0, required[need.key] - (prepared[need.key] || 0));
      }
    }
    for (const [id,n] of Object.entries(box.flavours)) {
      const key = stockKey(box.city,id);
      simulatedStock[key] = Math.max(0, (simulatedStock[key] || 0) - n);
    }
  }
  const manifest = Object.keys(required)
    .map((k) => {
      const split = k.indexOf(":");
      const city = k.slice(0, split) as City,
        id = k.slice(split + 1);
      const simulated = allocate({
        ...inventory,
        [k]: (inventory[k] || 0) + 1,
      });
      let near = 0,
        dependents = 0;
      for (const r of pending) {
        const missing = allocation.missing[r.order.id];
        if (r.valid && r.city === city && missing[id]) {
          near += 1 / Math.max(1, total(missing));
          dependents++;
        }
      }
      const gain = simulated.ready.length - allocation.ready.length;
      return {
        key: k,
        city,
        id,
        required: required[k],
        prepared: prepared[k] || 0,
        reserved: reserved[k] || 0,
        remaining: Math.max(0, required[k] - (prepared[k] || 0)),
        cups: cups[k],
        score: gain * 100000 + near * 100 + dependents,
      };
    })
    .sort(
      (a, b) =>
        (batchRank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (batchRank.get(b.key) ?? Number.MAX_SAFE_INTEGER) ||
        b.score - a.score ||
        b.remaining - a.remaining ||
        a.key.localeCompare(b.key),
    );
  return {
    rows,
    pending,
    manifest,
    ready: allocation.ready,
    missing: allocation.missing,
    packed,
    preparedOrders,
    inventory,
  };
}
