const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>deps[n],console,Date,URL});return exports;}
const lifecycle=load('src/lib/order-lifecycle.ts'),dates=load('src/lib/business-date.ts'),draft=load('src/lib/order-draft.ts'),box=load('src/lib/admin-boxes.ts',{'./order-draft':draft});
const production=load('src/lib/production.ts',{'./business-date':dates,'./order-lifecycle':lifecycle,'./admin-boxes':box});
const sizes=[{id:'four',count:4,is_active:true}],now=Date.parse('2026-10-27T12:00:00Z');
const row=(id,date,source='kochi',status='confirmed')=>({id,delivery_date:date,source,status,customer_name:id,phone:'9876543210',created_at:'2026-10-27T12:00:00',delivery_slot:'3–5 PM',box_size_id:'four',flavours:{mango:4},notes:box.boxValues([{box_size_id:'four',flavours:{mango:4}}]).notes});
const records=[row('a','2026-10-27'),row('b','2026-10-28'),row('tvm','2026-10-28','trivandrum'),row('future','2026-11-01'),row('done','2026-10-28','kochi','dispatched'),row('draft','2026-10-28','kochi','draft'),row('expired','2026-10-28','kochi','expired')];
for(const [city,ids] of [['all',['b','tvm']],['kochi',['b']],['trivandrum',['tvm']]]){
 const active=production.activeOrdersForDate(records,sizes,'2026-10-28',city);
 assert.deepEqual(Array.from(active,o=>o.id),ids);
 const model=production.buildProduction(dates.ordersOnDate(production.historicalProductionOrders(records,sizes),'2026-10-28',city),sizes,[],[]);
 assert.equal(model.rows.length,active.length,'summary and base Orders list agree');
 assert.ok(model.pending.every(r=>r.order.delivery_date==='2026-10-28'));
 assert.ok(model.rows.every(r=>lifecycle.isActiveOrder(r.order)));
}
assert.deepEqual(Array.from(production.activeOrdersForDate(records,sizes,'2026-10-27'),o=>o.id),['a']);
assert.equal(production.historicalProductionOrders(records,sizes).filter(o=>o.id==='done').length,1,'calendar history retains completed order');
const temporary=row('link','2026-10-28','kochi','draft');
assert.equal(lifecycle.isExpiredLink(temporary,now+299999),false);
assert.equal(lifecycle.isExpiredLink(temporary,now+300000),true);
assert.equal(lifecycle.isActiveOrder(temporary),false,'even unexpired draft is never production');
assert.equal(production.buildProduction([temporary],sizes,[],[]).manifest.length,0);
assert.ok(!production.historicalProductionOrders(records,sizes).some(o=>['draft','expired'].includes(o.id)),'drafts never enter calendar counts');
const completedModel=production.buildProduction([row('completed-only','2026-10-28','kochi','dispatched')],sizes,[{city:'kochi',flavour_id:'mango',finished:4}],[]);
assert.equal(completedModel.rows.length,0);
assert.equal(completedModel.pending.length,0);
assert.equal(completedModel.manifest.length,0,'completed work adds no active flavour requirements');
assert.equal(lifecycle.isExpiredLink({...temporary,status:'confirmed'},now+9999999),false);
const storage=new Map();
function from(table){let predicates=[],updates=null;const q={select(){return q},order(){return q},eq(k,v){predicates.push(o=>o[k]===v);return q},neq(k,v){predicates.push(o=>o[k]!==v);return q},is(k,v){return q.eq(k,v)},gt(k,v){predicates.push(o=>Date.parse(o[k])>Date.parse(v));return q},update(value){updates=value;return q},single:async()=>{const old=[...storage.values()].find(o=>predicates.every(p=>p(o)));if(!old)return {data:null,error:{message:'not found'}};if(updates)storage.set(old.id,{...old,...updates});return {data:storage.get(old.id),error:null}},then(resolve){if(updates)for(const o of storage.values())if(predicates.every(p=>p(o)))storage.set(o.id,{...o,...updates});resolve({data:table==='box_sizes'?sizes:[{id:'mango',is_available:true}],error:null})}};return q;}
const deps={'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'@/lib/supabase':{supabaseAdmin:()=>({from})},'@/lib/delivery-date':{deliveryDateError:async()=>''},'@/lib/customer-order':load('src/lib/customer-order.ts'),'@/lib/order-lifecycle':lifecycle,'@/lib/order-draft':draft};
const api=load('src/app/api/order-confirmation/[id]/route.ts',deps),req=body=>({json:async()=>body});
(async()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 storage.set(id,{...row(id,'2099-10-28','kochi','draft'),created_at:new Date().toISOString()});
 const body={customer_name:'Customer',phone:'9876543210',location:'kochi',delivery_date:'2099-10-28',delivery_slot:'3–5 PM',box_selections:[{box_size_id:'four',flavours:{mango:4}}]};
 assert.equal((await api.PATCH(req(body),{params:{id}})).status,200);
 assert.equal(storage.get(id).status,'draft','autosave must not confirm a link');
 assert.equal((await api.PATCH(req({...body,submit:true,box_selections:[]}),{params:{id}})).status,400,'final confirmation requires meaningful box/flavour data');
 assert.equal(storage.get(id).status,'draft');
 assert.equal((await api.PATCH(req({...body,submit:true}),{params:{id}})).status,200);
 assert.equal(storage.get(id).status,'confirmed','only explicit final submission confirms');
 storage.set(id,{...storage.get(id),created_at:'2020-01-01T00:00:00'});
 assert.equal((await api.PATCH(req(body),{params:{id}})).status,200,'confirmed order survives draft expiry window');
 storage.set(id,{...storage.get(id),status:'draft'});
 const expired=await api.GET({}, {params:{id}});
 assert.match(expired.body.locked,/expired/);
 assert.equal(storage.get(id).status,'expired','server GET persists expiry');
 assert.equal((await api.PATCH(req({...body,submit:true}),{params:{id}})).status,410,'expired link cannot resurrect');
 console.log('PASS: shared active/date/city selectors, history, counter consistency, five-minute server expiry, explicit confirmation, autosave remains draft and expired link cannot resurrect');
})().catch(e=>{console.error(e);process.exitCode=1});
