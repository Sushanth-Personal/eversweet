const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
let call,
  fail = false;
let orderStatus = "confirmed";
const lifecycle = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/order-lifecycle.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:lifecycle});
const db = {
  from: () => { const q={select:()=>q,eq:()=>q,single:async()=>({data:{status:orderStatus},error:null})};return q; },
  rpc: async (name, args) => {
    call = { name, args };
    return {
      data: { saved: true },
      error: fail ? { message: "Inventory changed" } : null,
    };
  },
};
const api = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync("src/app/api/admin/workflow/route.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  {
    exports: api,
    require: (n) =>
      n === "next/server"
        ? {
            NextResponse: {
              json: (body, o) => ({ body, status: o?.status || 200 }),
            },
          }
        : n === "@/lib/order-lifecycle" ? lifecycle : { supabaseAdmin: () => db },
  },
);
const req = (body) => ({ json: async () => body });
(async () => {
  const body = {
    action: "prepare",
    date: "2026-10-26",
    entries: [{ city: "kochi", flavour_id: "mango", finished: 5 }],
  };
  assert.equal((await api.POST(req(body))).status, 200);
  assert.equal(call.name, "production_action");
  assert.equal(call.args.p_entries[0].finished, 5);
  orderStatus="cancelled";
  assert.equal((await api.POST(req({action:"prepare_order",id:"11111111-1111-4111-8111-111111111111"}))).status,409,"cancelled order cannot enter workflow RPC");
  orderStatus="dispatched";
  assert.equal((await api.POST(req({action:"pack",id:"11111111-1111-4111-8111-111111111111"}))).status,409,"completed order cannot re-enter active packing");
  orderStatus="confirmed";
  for (const finished of [-1, 1.5, 100001])
    assert.equal(
      (
        await api.POST(
          req({ ...body, entries: [{ ...body.entries[0], finished }] }),
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await api.POST(
        req({ ...body, entries: [...body.entries, ...body.entries] }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await api.POST(req({ action: "pack", id: "bad" }))).status,
    400,
  );
  fail = true;
  assert.equal((await api.POST(req(body))).status, 409);
  console.log(
    "PASS: preparation API validation, duplicate cities, transactional RPC and conflict response",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
