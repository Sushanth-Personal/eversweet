const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(path, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports, require:name=>deps[name], console});
  return exports;
}
const helpers = load("src/lib/order-draft.ts");
const boxes = [{id:"four",count:4,price:499},{id:"eight",count:8,price:899}];
const records = new Map();
function from(table) {
  let id, action, values;
  const q = {
    select(){return q}, eq(k,v){if(k==="id")id=v;return q}, neq(){return q},
    upsert(v){if(!records.has(v.id))records.set(v.id,{...v,notes:"",created_at:new Date().toISOString()});return Promise.resolve({error:null})},
    update(v){values=v;action="update";return q},
    single(){if(action==="update")records.set(id,{...records.get(id),...values});return Promise.resolve({data:records.get(id)||null,error:null})},
    then(resolve){resolve({data:table==="box_sizes"?boxes:[],error:null})}
  };return q;
}
const deps={"next/server":{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},"@/lib/supabase":{supabaseAdmin:()=>({from})},"@/lib/order-draft":helpers};
deps["@/lib/delivery-date"]=load("src/lib/delivery-date.ts",deps);
const create=load("src/app/api/order-confirmation/route.ts",deps);
const edit=load("src/app/api/order-confirmation/[id]/route.ts",deps);
const request=body=>({json:async()=>body});
(async()=>{
 const id="11111111-1111-4111-8111-111111111111";
 assert.equal((await create.POST(request({id,customer_name:"Test",phone:"123"}))).status,200);
 assert.equal(records.size,1);
 await create.POST(request({id,customer_name:"Test",phone:"123"}));
 assert.equal(records.size,1,"retry must not duplicate the order");
 const plan=[{box_size_id:"four",flavours:{berry:2}},{box_size_id:"eight",flavours:{mango:8}}];
 const details={customer_name:"Test",phone:"123",box_selections:plan};
 assert.equal((await edit.PATCH(request(details),{params:{id}})).status,200,"unfinished boxes and absent delivery fields must save");
 assert.equal(helpers.layout(records.get(id).notes).length,2);
 assert.equal(records.get(id).flavours.berry,2);
 assert.equal(helpers.completeness(records.get(id),boxes).complete,false);
 plan[0].flavours.berry=4;
 await edit.PATCH(request({...details,delivery_date:"2026-12-01",delivery_slot:"3–5 PM"}),{params:{id}});
 assert.equal(helpers.completeness(records.get(id),boxes).complete,false,"missing address and map are incomplete for admin");
 records.get(id).notes=helpers.replaceNote(records.get(id).notes,"Details status","complete");
 await edit.PATCH(request(details),{params:{id}});
 assert.equal(helpers.completeness(records.get(id),boxes).complete,true,"customer saving must preserve admin override");
 records.get(id).status="dispatched";
 assert.equal((await edit.PATCH(request(details),{params:{id}})).status,409);
 console.log("PASS: draft creation, retry deduplication, partial saves, mixed-box persistence, completeness, admin overrides, dispatched protection");
})().catch(error=>{console.error(error);process.exitCode=1});
