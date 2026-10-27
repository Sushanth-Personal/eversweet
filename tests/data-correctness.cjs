const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
function load(file, deps = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => deps[name], console, ...globals });
  return exports;
}
const dates = load('src/lib/business-date.ts');
const order = { id:'affected', delivery_date:'2026-10-27', source:'kochi', status:'confirmed', created_at:'2026-10-26T23:59:59Z', order_date:'2026-10-28' };
const rows = [order, {...order,id:'oct31',delivery_date:'2026-10-31'}, {...order,id:'nov1',delivery_date:'2026-11-01'}, {...order,id:'tvm',source:'trivandrum'}, {...order,id:'cancelled',status:'cancelled'}];
assert.equal(dates.ordersOnDate(rows,'2026-10-27','kochi').length,1);
assert.equal(dates.ordersOnDate(rows,'2026-10-26').length,0);
assert.equal(dates.ordersOnDate(rows,'2026-10-28').length,0);
assert.equal(dates.ordersOnDate(rows,'2026-10-27').length,2);
assert.equal(dates.ordersOnDate(rows,'2026-10-27','trivandrum').length,1);
assert.equal(dates.calendarMonth('2026-10').days.at(-1),'2026-10-31');
assert.equal(dates.calendarMonth('2026-11').days[0],'2026-11-01');
assert.equal(dates.calendarMonth('2026-10').leading,4);
assert.equal(dates.shiftBusinessMonth('2026-12',1),'2027-01');
assert.equal(dates.deliveryDateOf({order_date:'2026-10-27',created_at:'2026-10-27'}),'');
for(const zone of ['UTC','Asia/Kolkata','America/Los_Angeles','Pacific/Kiritimati']) {
  const code = `const vm=require('node:vm'),ts=require('typescript'),fs=require('node:fs');const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/business-date.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});console.log(JSON.stringify([exports.calendarMonth('2026-10'),exports.businessDateLabel('2026-10-27')]));`;
  const result = JSON.parse(execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:zone},encoding:'utf8'}));
  assert.equal(result[0].leading,4,zone);
  assert.equal(result[0].days[26],'2026-10-27',zone);
  assert.equal(result[1],'Tue, 27 Oct',zone);
}
const { createSaveQueue } = load('src/lib/save-queue.ts');
const deferred = () => { let resolve; const promise = new Promise(r=>resolve=r); return {promise,resolve}; };
(async()=>{
  // Model Next 14's persistent fetch cache and execute the actual SDK factory.
  let database = [{id:'existing',insta_id:''}], cached;
  const calls=[];
  const fakeFetch=async(_url,init={})=>{
    calls.push(init);
    if(init.cache!=='no-store' && cached) return {json:async()=>structuredClone(cached)};
    const result=structuredClone(database);
    if(init.cache!=='no-store') cached=result;
    return {json:async()=>result};
  };
  const createClient=(_url,_key,options={})=>({read:async()=> (await (options.global?.fetch||fakeFetch)('https://test.invalid/orders')).json()});
  const sdk=load('src/lib/supabase.ts',{'@supabase/supabase-js':{createClient}},{fetch:fakeFetch,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'}}});
  const db=sdk.supabaseAdmin();
  assert.equal((await db.read()).length,1);
  database.push(order);
  database[0].insta_id='https://www.instagram.com/_sumayyya__/';
  const fresh=await db.read();
  assert.equal(fresh.length,2,'new reservation must not disappear behind cached SDK reads');
  assert.equal(fresh[0].insta_id,database[0].insta_id,'saved Instagram must survive refetch');
  assert.ok(calls.every(c=>c.cache==='no-store'),'server SDK always bypasses persistent fetch cache');

  let latest={url:''}, persisted={url:''}, closed=false, writes=[];
  const gate=deferred();
  const queue=createSaveQueue(latest,()=>({...latest}),async value=>{writes.push(value.url);if(writes.length===1)await gate.promise;persisted=value;});
  latest={url:'https://instagram.com/first/'};
  const pending=queue.flush();
  latest={url:'https://instagram.com/second/'};
  const navigating=queue.flush().then(()=>{closed=true;});
  assert.equal(closed,false,'navigation waits for active database write');
  gate.resolve(); await Promise.all([pending,navigating]);
  assert.equal(closed,true);
  assert.equal(persisted.url,latest.url,'flush drains latest edit, not stale closure');
  assert.deepEqual(writes,['https://instagram.com/first/','https://instagram.com/second/']);
  latest={url:''};await queue.flush();assert.equal(persisted.url,'','clearing persists');
  let fail=true, ack=false;
  const failed=createSaveQueue('',()=> 'new',async()=>{if(fail)throw Error('database unavailable');ack=true;});
  await assert.rejects(failed.flush(),/database unavailable/);
  assert.equal(ack,false,'failed persistence never acknowledged as saved');
  fail=false;await failed.flush();assert.equal(ack,true,'failed draft remains dirty and retryable');
  console.log('PASS: canonical delivery dates in four timezones, month boundaries/city filters, uncached Supabase reads, Instagram refetch, serialized latest autosave, clear/failure/retry and navigation flush');
})().catch(e=>{console.error(e);process.exitCode=1});
