const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};
const db={from(){let date;const q={select(){return q},eq(k,v){date=v;return q},async maybeSingle(){return {data:date==='2099-01-10'?{date}:null}}};return q}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/delivery-date.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,require:()=>({supabaseAdmin:()=>db})});
(async()=>{
const check=exportsObject.deliveryDateError;
assert.equal(await check('kochi','2099-01-11'),'');
assert.equal(await check('trivandrum','2099-01-10'),'');
assert.ok(await check('trivandrum','2099-01-11'));
assert.equal(await check('trivandrum','2099-01-11',{source:'trivandrum',delivery_date:'2099-01-11'}),'');
assert.equal(await check('trivandrum',''),'');
assert.ok(await check('kochi','2020-01-01'));
console.log('PASS: Kochi dates, available Trivandrum dates, removed-date preservation, optional date and past-date rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
