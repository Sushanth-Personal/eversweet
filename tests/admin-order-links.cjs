const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>deps[n],console,Date});return exports}
const records=new Map();
const draft=load("src/lib/order-draft.ts");
const deps={"next/server":{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},"@/lib/order-draft":draft,"@/lib/admin-boxes":load("src/lib/admin-boxes.ts",{"./order-draft":draft}),"@/lib/delivery-date":{deliveryDateError:async()=>""},"@/lib/supabase":{supabaseAdmin:()=>({from:table=>{
 let id,updates;const q={select:()=>q,eq:(key,v)=>{id=v;return q},update:values=>{updates=values;return q},upsert:async values=>{if(!records.has(values.id))records.set(values.id,values);return{error:null}},single:async()=>{if(updates)records.set(id,{...records.get(id),...updates});return {data:records.get(id),error:null}},then:resolve=>resolve({data:[],error:null})};return q;
 }})}};
deps['@/lib/order-contacts']={instagramUrl:value=>value};
const api=load("src/app/api/admin/orders/route.ts",deps),request=body=>({json:async()=>body});
(async()=>{
 const body={id:"11111111-1111-4111-8111-111111111111",delivery_date:"2099-01-01",location:"kochi",box_selections:[]};
 assert.equal((await api.POST(request(body))).status,200,"date-only admin draft allowed");
 assert.equal(records.size,1);
 assert.equal((await api.POST(request({...body,delivery_date:"2099-02-01"}))).status,200);
 assert.equal(records.size,1,"retry must not duplicate");
 assert.equal(records.get(body.id).delivery_date,"2099-01-01","retry cannot overwrite earlier creation");
 const blank={id:"22222222-2222-4222-8222-222222222222"};
 assert.equal((await api.POST(request(blank))).status,200,"empty draft allowed");
 assert.equal(records.get(blank.id).delivery_date,null);
 assert.equal(records.get(blank.id).phone,"");
 assert.equal((await api.POST(request(blank))).status,200);
 assert.equal(records.size,2,"Copy Order retries do not duplicate");
 records.set(blank.id,{...records.get(blank.id),phone:"12345",address:"Original address",notes:"Customer map: https://maps.google.com/?q=1,2"});
 assert.equal((await api.PATCH(request({id:blank.id,insta_id:"https://www.instagram.com/customer/"}))).status,200);
 assert.equal(records.get(blank.id).insta_id,"https://www.instagram.com/customer/");
 assert.equal(records.get(blank.id).phone,"12345","Instagram-only save preserves phone");
 assert.equal(records.get(blank.id).address,"Original address","Instagram-only save preserves address");
 assert.equal((await api.POST(request({...body,id:"invalid"}))).status,400,"stable valid ID mandatory");
 console.log("PASS: admin dated draft, idempotent retry, retry preserves existing order, blank-order creation and UUID");
})().catch(e=>{console.error(e);process.exitCode=1});
