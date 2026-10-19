const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const rows=new Map();let fail=false;
const db={from(){let date;const q={select(){return q},eq(k,v){date=v;return q},then(resolve){resolve({data:[...rows.values()].filter(r=>r.delivery_date===date),error:fail?{}:null})},async upsert(row){if(fail)return{error:{}};for(const r of (Array.isArray(row)?row:[row]))rows.set([r.delivery_date,r.city,r.flavour_id].join('|'),r);return{error:null}}};return q}};
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/admin/preparation/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api,require:n=>n==='next/server'?{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}}:{supabaseAdmin:()=>db}});
const req=b=>({json:async()=>b});
(async()=>{
const entry={date:'2026-10-13',city:'kochi',flavour_id:'strawberry',finished:5};
assert.equal((await api.PUT(req(entry))).status,200);
await api.PUT(req({...entry,city:'trivandrum',finished:2}));
await api.PUT(req({...entry,date:'2026-10-14',finished:9}));
const saved=await api.GET({nextUrl:new URL('http://localhost?date=2026-10-13')});
assert.equal(saved.body.progress.length,2);assert.equal(saved.body.progress[0].finished,5);
assert.equal((await api.PUT(req({...entry,finished:-1}))).status,400);
assert.equal((await api.PUT(req({...entry,finished:1.5}))).status,400);
const bulk=await api.PUT(req({date:entry.date,entries:[{city:'kochi',flavour_id:'hazelnut',finished:2},{city:'trivandrum',flavour_id:'hazelnut',finished:3}]}));assert.equal(bulk.status,200);assert.equal(rows.get('2026-10-13|trivandrum|hazelnut').finished,3);
fail=true;assert.equal((await api.PUT(req(entry))).status,500);
console.log('PASS: preparation persistence, date/city isolation, quantity validation and save failure');
})().catch(e=>{console.error(e);process.exitCode=1});
