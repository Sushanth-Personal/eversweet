const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    { exports, require: (n) => deps[n], console, URL },
  );
  return exports;
}
const draft = load("src/lib/order-draft.ts"),
  box = load("src/lib/admin-boxes.ts", { "./order-draft": draft });
const { buildProduction, productionOrder } = load("src/lib/production.ts", {
  "./admin-boxes": box,
  "./business-date": load("src/lib/business-date.ts"),
  "./order-lifecycle": load("src/lib/order-lifecycle.ts"),
});
const boxes = [4, 5, 6, 8].map((count) => ({
  id: "b" + count,
  count,
  label: "Box of " + count,
}));
function order(id, flavours, size = 4, extra = {}) {
  const plan = [{ box_size_id: "b" + size, flavours }];
  return {
    id,
    customer_name: id,
    flavours,
    box_size_id: "b" + size,
    notes: box.boxValues(plan).notes,
    delivery_date: "2099-01-01",
    delivery_slot: "9–11 AM",
    source: "kochi",
    status: "confirmed",
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}
// Popular flavours spread across unrelated boxes must not outrank a complete box.
const packingOrders = [
  order("first", { mango: 1, chocolate: 1, lemon: 1, biscoff: 1 }),
  order("second", { mango: 1, strawberry: 1, blueberry: 1, nutella: 1 }),
  order("third", { mango: 1, strawberry: 1, hazelnut: 1, kiwi: 1 }),
];
const scheduled = buildProduction(packingOrders, boxes, [], []);
const batches = scheduled.manifest.slice(0,4).map(r => ({city:r.city,flavour_id:r.id,finished:r.required}));
assert.ok(buildProduction(packingOrders,boxes,batches,[]).ready.length >= 1, "first four batches must complete a box, not scatter across orders");
const partlyDone = buildProduction(packingOrders,boxes,[{city:"kochi",flavour_id:"mango",finished:3},{city:"kochi",flavour_id:"chocolate",finished:1},{city:"kochi",flavour_id:"lemon",finished:1}],[]);
assert.equal(partlyDone.manifest[0].id,"biscoff","finish the almost-ready box before starting another");
for (const size of [4, 5, 6, 8]) {
  const r = productionOrder(order("a", { mango: size }, size), boxes);
  assert.equal(r.cups.mango.white, [5, 8].includes(size) ? size : 0);
  assert.equal(r.cups.mango.regular, [4, 6].includes(size) ? size : 0);
}
const mixedPlan = [
  {box_size_id:"b5",flavours:{mango:2,berry:3}},
  {box_size_id:"b5",flavours:{mango:1,berry:4}},
  {box_size_id:"b6",flavours:{mango:2,berry:4}},
];
const mixedOrder = order("mixed-cups",{mango:5,berry:11},5,{notes:box.boxValues(mixedPlan).notes});
const mixedCups = productionOrder(mixedOrder, boxes);
assert.equal(mixedCups.cups.mango.white,3,"Mango in the two boxes of five uses white cups");
assert.equal(mixedCups.cups.mango.regular,2,"Mango in box of six uses regular cups");
const mixedManifest = buildProduction([mixedOrder],boxes,[],[]).manifest.find(r=>r.id==="mango");
assert.equal(mixedManifest.cups.white,3);
assert.equal(mixedManifest.cups.regular,2);
const a = order("a", { mango: 4 }),
  b = order("b", { mango: 4 }, 4, { delivery_slot: "3–5 PM" }),
  t = order("t", { mango: 4 }, 4, { source: "trivandrum" });
let model = buildProduction(
  [b, a, t],
  boxes,
  [{ city: "kochi", flavour_id: "mango", finished: 4 }],
  [],
);
assert.deepEqual(
  Array.from(model.ready),
  ["a"],
  "one stock allocation, early slot first",
);
assert.equal(model.manifest.find((r) => r.city === "kochi").remaining, 4);
assert.equal(model.manifest.find((r) => r.city === "trivandrum").remaining, 4);
const reservation = {
  order_id: "a",
  city: "kochi",
  delivery_date: a.delivery_date,
  flavours: { mango: 4 },
  packed_at: "now",
};
model = buildProduction(
  [a, b],
  boxes,
  [{ city: "kochi", flavour_id: "mango", finished: 4 }],
  [reservation],
);
assert.equal(model.ready.length, 0, "packed inventory is consumed");
assert.ok(model.packed.has("a"));
model = buildProduction(
  [a, b],
  boxes,
  [{ city: "kochi", flavour_id: "mango", finished: 4 }],
  [{ ...reservation, packed_at: null }],
);
assert.deepEqual(
  Array.from(model.ready),
  ["a"],
  "explicitly prepared order retains its exclusive reservation",
);
assert.equal(
  model.packed.size,
  0,
  "prepared must not be sent to Dispatch before packing",
);
const { nextOrderAction } = load("src/lib/production.ts", {
  "./admin-boxes": box,
});
assert.equal(
  nextOrderAction({ status: "confirmed", packed: false, ready: false }).action,
  "prepare_order",
);
assert.equal(
  nextOrderAction({ status: "confirmed", packed: false, ready: true }).action,
  "pack",
);
assert.equal(
  nextOrderAction({ status: "confirmed", packed: true, ready: true }).action,
  "dispatch",
);
assert.equal(
  nextOrderAction({ status: "dispatched", packed: true, ready: true }).action,
  "reset_order",
);
model = buildProduction(
  [
    { ...a, status: " Dispatched " },
    { ...b, production_packed: true },
  ],
  boxes,
  [],
  [],
);
assert.equal(
  model.pending.length,
  0,
  "dispatched and packed orders never leak into Prepare or Pack, including a loading reservation ledger",
);
assert.equal(
  model.manifest[0].remaining,
  0,
  "completed stock is never shown as outstanding during reload",
);
model = buildProduction(
  [{ ...a, status: "dispatched" }, b],
  boxes,
  [{ city: "kochi", flavour_id: "mango", finished: 4 }],
  [],
);
assert.equal(model.ready.length, 0, "legacy dispatch consumes stock");
assert.equal(
  model.manifest[0].remaining,
  4,
  "one dispatched box of four plus one pending box means only four left",
);
model = buildProduction([{ ...a, status: "dispatched" }, b], boxes, [], []);
assert.equal(
  model.manifest[0].remaining,
  4,
  "historical dispatch without preparation record must not be prepared twice",
);
assert.equal(
  model.manifest[0].prepared,
  0,
  "dispatched pieces are consumed, not active prepared work",
);
model = buildProduction(
  [a, { ...b, status: "cancelled" }],
  boxes,
  [{ city: "kochi", flavour_id: "mango", finished: 9 }],
  [],
);
assert.equal(model.manifest[0].prepared, 9);
assert.equal(model.manifest[0].required, 4);
assert.equal(model.inventory["kochi:mango"], 9, "extra stock retained");
const near = order("near", { mango: 3, hazelnut: 1 }),
  far = order("far", { blueberry: 4 });
model = buildProduction(
  [near, far],
  boxes,
  [{ city: "kochi", flavour_id: "mango", finished: 3 }],
  [],
);
assert.equal(
  model.manifest[0].id,
  "hazelnut",
  "one piece unlock beats general demand",
);
model = buildProduction(
  [order("partial", { mango: 3 })],
  boxes,
  [{ city: "kochi", flavour_id: "mango", finished: 10 }],
  [],
);
assert.equal(model.ready.length, 0, "partial box never packable");
const maps = load("src/lib/maps-plus-code.ts");
const contacts = load("src/lib/order-contacts.ts", {
  "./maps-plus-code": maps,
});
assert.equal(
  contacts.instagramUrl("@eversweet"),
  "https://www.instagram.com/eversweet/",
);
assert.equal(contacts.instagramUrl("https://evil.example/user"), "");
const sharedInstagram = "https://www.instagram.com/_sumayyya__?vrfl=MWV1OWViZHRjN3E5eA==";
assert.equal(contacts.instagramUrl(sharedInstagram), "https://www.instagram.com/_sumayyya__/");
assert.equal(contacts.instagramUrl(`[${sharedInstagram}](${sharedInstagram})`), "https://www.instagram.com/_sumayyya__/");
for (const field of ["phone", "instagram", "map"])
  assert.equal(contacts.contactAction(field, {}).focus, field);
assert.equal(
  contacts.contactAction("phone", { phone: "+91 12345" }).href,
  "tel:+9112345",
);
assert.equal(
  contacts.contactAction("instagram", { insta_id: "https://www.instagram.com/eversweet/" }).href,
  "https://ig.me/m/eversweet",
);
assert.ok(
  contacts.contactAction("map", {
    customer_maps_url: "https://maps.google.com/?q=1,2",
  }).href,
);
assert.equal(
  contacts.deliveryText({
    customer_name: "A",
    phone: "B",
    address: "C",
    customer_maps_url: "D",
  }),
  "A\nB\nC\nD",
);
console.log(
  "PASS: cups 4/5/6/8, aggregation, partial counts, deterministic allocation, no double use, reservations, legacy dispatch, city isolation, extra stock, marginal unlock priority and contact actions",
);
