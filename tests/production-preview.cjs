// Isolated review server: all API writes stay in a local in-memory PostgreSQL database.
// Built app :3012; review http://localhost:3013/admin?viewport=mobile
const http = require("node:http"),
  fs = require("node:fs"),
  { PGlite } = require("@electric-sql/pglite");
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
}).format(new Date());
const names = [
  "Biscoff",
  "Blueberry",
  "Butterscotch",
  "Coffee Nuts",
  "Dark Chocolate",
  "Green Apple",
  "Hazelnut",
  "Kiwi",
  "Lemon Curd",
  "Mango",
  "Milk Choco Nuts",
  "Nutella",
  "Orange",
  "Pear",
  "Pistachio",
  "Pomegranate",
  "Red Cherry",
  "Strawberry",
];
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const products = names.map((name, i) => ({
    id: uuid(100 + i),
    name,
    is_available: true,
    image_url: null,
    sort_order: i,
  })),
  boxes = [4, 5, 6, 8].map((n) => ({
    id: uuid(n),
    count: n,
    label: "Box of " + n,
    is_active: true,
    price: 499,
  }));
let orders = [];
function layout(plan) {
  return (
    "Box layout: " +
    encodeURIComponent(JSON.stringify(plan)) +
    " | Box quantity: " +
    plan.length
  );
}
function fixture(
  i,
  name,
  flavours,
  size = 4,
  source = "kochi",
  slot = "9–11 AM",
) {
  const plan = [{ box_size_id: uuid(size), flavours }];
  return {
    id: uuid(1000 + i),
    customer_name: name,
    phone: i === 2 ? "" : "0000000000",
    address: "Preview address, Kochi",
    source,
    delivery_date: date,
    delivery_slot: slot,
    created_at: new Date(2026, 0, i + 1).toISOString(),
    status: "confirmed",
    notes:
      layout(plan) +
      " | Customer map: https://maps.google.com/?q=9.9312,76.2673",
    box_size_id: uuid(size),
    flavours,
    insta_id: i === 2 ? "" : "eversweet",
    payment_method: "admin",
    total_price: 499,
  };
}
const flavour = (n) => products.find((p) => p.name === n).id;
orders = [
  fixture(1, "Preview Anila", {
    [flavour("Mango")]: 2,
    [flavour("Hazelnut")]: 2,
  }),
  fixture(
    2,
    "Preview Riya",
    { [flavour("Mango")]: 3, [flavour("Blueberry")]: 2 },
    5,
    "kochi",
    "1–3 PM",
  ),
  fixture(
    3,
    "Preview TVM",
    { [flavour("Strawberry")]: 6 },
    6,
    "trivandrum",
    "3–5 PM",
  ),
];
const db = new PGlite();
async function init() {
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create table orders(id uuid primary key,customer_name text,phone text,address text,delivery_date date,delivery_slot text,source text,status text,box_size_id uuid,flavours jsonb,notes text);create table box_sizes(id uuid primary key,count integer);`,
  );
  await db.exec(
    fs.readFileSync("migrations/20261013_preparation_progress.sql", "utf8"),
  );
  await db.exec(
    fs.readFileSync("migrations/20261026_production_workflow.sql", "utf8"),
  );
  for (const b of boxes)
    await db.query("insert into box_sizes values($1,$2)", [b.id, b.count]);
  for (const o of orders) await insert(o);
  await db.query(
    `insert into preparation_progress values($1,'kochi',$2,2),($1,'kochi',$3,1)`,
    [date, flavour("Mango"), flavour("Hazelnut")],
  );
}
async function insert(o) {
  await db.query(
    "insert into orders values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      o.id,
      o.customer_name,
      o.phone,
      o.address,
      o.delivery_date,
      o.delivery_slot,
      o.source,
      o.status,
      o.box_size_id,
      JSON.stringify(o.flavours),
      o.notes,
    ],
  );
}
function json(res, value, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
async function api(req, res) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/admin/workspace") {
    const packed = (
      await db.query("select order_id,packed_at from order_packing")
    ).rows;
    return json(res, {
      orders: orders.map((o) => ({
        ...o,
        production_packed: packed.some(
          (p) => p.order_id === o.id && p.packed_at,
        ),
        production_prepared: packed.some((p) => p.order_id === o.id),
      })),
      products,
      boxes,
    });
  }
  if (url.pathname === "/api/admin/workflow") {
    if (req.method === "GET")
      return json(res, {
        progress: (
          await db.query(
            "select city,flavour_id,finished from preparation_progress where delivery_date=$1",
            [url.searchParams.get("date")],
          )
        ).rows,
        packing: (
          await db.query(
            "select *,delivery_date::text from order_packing where delivery_date=$1",
            [url.searchParams.get("date")],
          )
        ).rows,
        available: true,
      });
    try {
      await db.query("select production_action($1,$2,$3,$4)", [
        body.action,
        body.id || null,
        body.date,
        body.entries ? JSON.stringify(body.entries) : null,
      ]);
      if (body.action === "dispatch")
        orders = orders.map((o) =>
          o.id === body.id ? { ...o, status: "dispatched" } : o,
        );
      return json(res, { saved: true });
    } catch (e) {
      return json(res, { error: e.message }, 409);
    }
  }
  if (url.pathname === "/api/admin/orders") {
    if (req.method === "DELETE") {
      try {
        await db.query(`update orders set status='cancelled' where id=$1`, [
          body.id,
        ]);
        orders = orders.map((o) =>
          o.id === body.id ? { ...o, status: "cancelled" } : o,
        );
        return json(res, { deleted: true });
      } catch (e) {
        return json(res, { error: e.message }, 409);
      }
    }
    const old = orders.find((o) => o.id === body.id),
      plan = body.box_selections || [],
      flavours = {};
    for (const b of plan)
      for (const [id, n] of Object.entries(b.flavours))
        if (n > 0) flavours[id] = (flavours[id] || 0) + n;
    const o = {
      ...old,
      ...body,
      id: body.id,
      source: body.location || old?.source || "kochi",
      customer_name: body.customer_name || "Customer details pending",
      phone: body.phone || "",
      address: body.address || "",
      delivery_date: body.delivery_date || null,
      delivery_slot: body.delivery_slot || "",
      status: old?.status || "confirmed",
      flavours,
      box_size_id: plan[0]?.box_size_id || null,
      notes:
        layout(plan) +
        (body.customer_maps_url
          ? " | Customer map: " + body.customer_maps_url
          : ""),
      created_at: old?.created_at || new Date().toISOString(),
    };
    try {
      if (old) {
        await db.query(
          "update orders set customer_name=$1,phone=$2,address=$3,delivery_date=$4,delivery_slot=$5,source=$6,box_size_id=$7,flavours=$8,notes=$9 where id=$10",
          [
            o.customer_name,
            o.phone,
            o.address,
            o.delivery_date,
            o.delivery_slot,
            o.source,
            o.box_size_id,
            JSON.stringify(flavours),
            o.notes,
            o.id,
          ],
        );
        orders = orders.map((v) => (v.id === o.id ? o : v));
      } else {
        await insert(o);
        orders.push(o);
      }
      return json(res, { order: o });
    } catch (e) {
      return json(res, { error: e.message }, 409);
    }
  }
  if (url.pathname === "/api/delivery-dates")
    return json(res, { dates: [date] });
  if (url.pathname.startsWith("/api/order-confirmation/")) {
    const o = orders.find((o) => o.id === url.pathname.split("/").pop());
    return o
      ? json(res, { order: o, products, boxes, locked: "" })
      : json(res, { error: "Not found" }, 404);
  }
  return json(res, { error: "Isolated review blocks this API action" }, 404);
}
init()
  .then(() =>
    http
      .createServer((req, res) => {
        if (req.url.startsWith("/api/"))
          return api(req, res).catch((e) =>
            json(res, { error: e.message }, 500),
          );
        if (req.method !== "GET") {
          res.writeHead(405);
          return res.end();
        }
        const upstream = http.request(
          { hostname: "127.0.0.1", port: Number(process.env.PREVIEW_UPSTREAM || 3012), path: req.url, method: "GET" },
          (r) => {
            res.writeHead(r.statusCode, r.headers);
            r.pipe(res);
          },
        );
        upstream.on("error", () => {
          res.writeHead(502);
          res.end("Start app on 3012");
        });
        upstream.end();
      })
      .listen(Number(process.env.PREVIEW_PORT || 3013), "127.0.0.1", () =>
        console.log("Isolated workflow review: http://localhost:3013/admin"),
      ),
  )
  .catch(console.error);
