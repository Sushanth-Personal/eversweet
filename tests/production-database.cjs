// Runs real PostgreSQL semantics in isolated WASM memory. No network or production data.
const { PGlite } = require("@electric-sql/pglite"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create table orders(id uuid primary key,customer_name text,phone text,address text,delivery_date date,delivery_slot text,source text,status text,box_size_id uuid,flavours jsonb,notes text);
 create table box_sizes(id uuid primary key,count integer);
 insert into box_sizes values('00000000-0000-4000-8000-000000000004',4);`);
  await db.exec(
    fs.readFileSync("migrations/20261026_production_workflow.sql", "utf8"),
  );
  const id = "11111111-1111-4111-8111-111111111111",
    second = "22222222-2222-4222-8222-222222222222",
    size = "00000000-0000-4000-8000-000000000004";
  const notes =
    "Box layout: " +
    encodeURIComponent(
      JSON.stringify([{ box_size_id: size, flavours: { mango: 4, kiwi: 0 } }]),
    );
  for (const oid of [id, second])
    await db.query(
      `insert into orders values($1,'Customer','123',null,'2099-01-01','9–11 AM','kochi','confirmed',$2,'{"mango":4}',$3)`,
      [oid, size, notes],
    );
  const action = (name, oid = null, entries = null) =>
    db.query("select production_action($1,$2,$3,$4)", [
      name,
      oid,
      "2099-01-01",
      entries && JSON.stringify(entries),
    ]);
  await assert.rejects(action("pack", id), /inventory changed/i);
  await action("prepare_order", id);
  assert.equal(
    (
      await db.query("select packed_at from order_packing where order_id=$1", [
        id,
      ])
    ).rows[0].packed_at,
    null,
    "prepared is not yet packed",
  );
  assert.equal(
    (
      await db.query(
        "select finished from preparation_progress where city=$1",
        ["kochi"],
      )
    ).rows[0].finished,
    4,
  );
  await action("prepare_order", id);
  assert.equal(
    (
      await db.query(
        "select finished from preparation_progress where city=$1",
        ["kochi"],
      )
    ).rows[0].finished,
    4,
    "repeat prepare does not add stock",
  );
  await assert.rejects(action("dispatch", id), /Pack this order/);
  await assert.rejects(action("pack", second), /inventory changed/i);
  await action("unprepare", id);
  await action("prepare", null, [
    { city: "kochi", flavour_id: "mango", finished: 4 },
  ]);
  await action("pack", id);
  await action("pack", id);
  assert.equal(
    (await db.query("select * from order_packing")).rows.length,
    1,
    "pack retry idempotent",
  );
  await assert.rejects(action("pack", second), /inventory changed/i);
  await assert.rejects(
    action("prepare", null, [
      { city: "kochi", flavour_id: "mango", finished: 3 },
    ]),
    /packed pieces/i,
  );
  await assert.rejects(
    db.query(`update orders set flavours='{"mango":3}' where id=$1`, [id]),
    /Unpack/,
  );
  await db.query("update orders set phone=$1 where id=$2", ["456", id]);
  await action("unpack", id);
  await action("pack", second);
  await action("dispatch", second);
  assert.equal(
    (await db.query("select status from orders where id=$1", [second])).rows[0]
      .status,
    "dispatched",
  );
  await assert.rejects(action("unpack", second), /cannot be unpacked/);
  await assert.rejects(
    db.query(`update orders set status='cancelled' where id=$1`, [second]),
    /Unpack/,
  );
  await action("prepare", null, [
    { city: "trivandrum", flavour_id: "mango", finished: 20 },
  ]);
  await assert.rejects(action("pack", id), /inventory changed/i);
  await action("prepare_order", id);
  assert.equal(
    (
      await db.query(
        "select finished from preparation_progress where city=$1",
        ["kochi"],
      )
    ).rows[0].finished,
    8,
    "only missing additional four produced",
  );
  await action("pack", id);
  assert.equal(
    (
      await db.query(
        "select finished from preparation_progress where city=$1",
        ["kochi"],
      )
    ).rows[0].finished,
    8,
    "packing prepared reservation never consumes twice",
  );
  await action("dispatch", id);
  await db.close();
  console.log(
    "PASS: PostgreSQL migration, URI box layout, atomic packing, retries, no double use, count floor, packed edit guard, contact edit, unpack, dispatch and city isolation",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
