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
const boxes = [{id:"four",count:4,price:499,is_active:true},{id:"eight",count:8,price:899,is_active:true}];
const records = new Map();
function from(table) {
  let id, action, values;
  const q = {
    select(){return q}, is(){return q}, eq(k,v){if(k==="id")id=v;return q}, neq(){return q},
    upsert(v){if(!records.has(v.id))records.set(v.id,{...v,notes:"",created_at:new Date().toISOString()});return Promise.resolve({error:null})},
    update(v){values=v;action="update";return q},
    single(){if(action==="update")records.set(id,{...records.get(id),...values});return Promise.resolve({data:records.get(id)||null,error:null})},
    then(resolve){resolve({data:table==="box_sizes"?boxes:[{id:"berry",is_available:true},{id:"mango",is_available:true},{id:"retired",is_available:false}],error:null})}
  };return q;
}
const deps={"next/server":{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},"@/lib/supabase":{supabaseAdmin:()=>({from})},"@/lib/order-draft":helpers};
deps["@/lib/customer-order"]=load("src/lib/customer-order.ts");
deps["@/lib/delivery-date"]=load("src/lib/delivery-date.ts",deps);
const create=load("src/app/api/order-confirmation/route.ts",deps);
const edit=load("src/app/api/order-confirmation/[id]/route.ts",deps);
const request=body=>({json:async()=>body});
(async()=>{
 const id="11111111-1111-4111-8111-111111111111";
 assert.equal((await create.POST(request({id,customer_name:"Test",phone:"123"}))).status,410);
 records.set(id,{id,customer_name:"Test",phone:"123",source:"kochi",delivery_date:"2099-12-01",status:"confirmed",flavours:{},notes:"",total_price:1000});
 assert.equal(records.size,1);
 await create.POST(request({id,customer_name:"Test",phone:"123"}));
 assert.equal(records.size,1,"retry must not duplicate the order");
 const plan=[{box_size_id:"four",flavours:{berry:2}},{box_size_id:"eight",flavours:{mango:8}}];
 const details={customer_name:"Test",phone:"123",box_selections:plan,location:"kochi",delivery_date:"2099-12-01"};
 assert.equal((await edit.PATCH(request(details),{params:{id}})).status,200,"unfinished boxes and absent delivery fields must save");
 assert.equal(helpers.layout(records.get(id).notes).length,2);
 assert.equal(records.get(id).flavours.berry,2);
 assert.equal(helpers.completeness(records.get(id),boxes).complete,false);
 plan[0].flavours.berry=4;
 await edit.PATCH(request({...details,delivery_date:"2099-12-01",delivery_slot:"3–5 PM"}),{params:{id}});
 assert.equal(helpers.completeness(records.get(id),boxes).complete,false,"missing address and map are incomplete for admin");
 records.get(id).notes=helpers.replaceNote(records.get(id).notes,"Details status","complete");
 await edit.PATCH(request(details),{params:{id}});
 assert.equal(helpers.completeness(records.get(id),boxes).complete,true,"customer saving must preserve admin override");
 assert.equal((await edit.PATCH(request({...details,delivery_date:"2099-12-02"}),{params:{id}})).status,409,"customer cannot change date");
 assert.equal((await edit.PATCH(request({...details,location:"trivandrum"}),{params:{id}})).status,409,"customer cannot change city");
 assert.equal((await edit.PATCH(request({...details,box_selections:[{box_size_id:"four",flavours:{berry:5}}]}),{params:{id}})).status,400,"overfull box rejected");
 assert.equal((await edit.PATCH(request({...details,box_selections:[{box_size_id:"four",flavours:{retired:1}}]}),{params:{id}})).status,400,"retired additions rejected");
 assert.equal(records.get(id).total_price,1000,"customer edits preserve admin quote");
 records.get(id).delivery_date="2000-01-01";
 assert.equal((await edit.PATCH(request({...details,delivery_date:"2000-01-01"}),{params:{id}})).status,409,"past links locked");
 records.get(id).delivery_date="2099-12-01";
 records.get(id).delivery_date=null;
 assert.equal((await edit.PATCH(request({...details,delivery_date:"2099-12-03"}),{params:{id}})).status,200,"customer chooses date on empty draft");
 assert.equal(records.get(id).delivery_date,"2099-12-03");
 assert.equal((await edit.PATCH(request({...details,delivery_date:"2099-12-04"}),{params:{id}})).status,409,"saved date remains fixed");
 records.get(id).status="dispatched";
 assert.equal((await edit.PATCH(request(details),{params:{id}})).status,409);
 console.log("PASS: public creation blocked, fixed date/city, retired flavours, overfilled boxes, expired links, partial saves, mixed-box persistence, completeness, admin overrides, dispatched protection");
})().catch(error=>{console.error(error);process.exitCode=1});
