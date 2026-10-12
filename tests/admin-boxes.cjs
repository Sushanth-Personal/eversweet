const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,deps={}){const result={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:result,require:n=>deps[n]});return result}
const notes=load('src/lib/order-draft.ts'),{initialBoxes,boxValues}=load('src/lib/admin-boxes.ts',{'./order-draft':notes});
const sizes=[{id:'four',count:4},{id:'eight',count:8}];
const plan=[{box_size_id:'four',flavours:{berry:4}},{box_size_id:'eight',flavours:{mango:5,berry:3}}];
const saved=boxValues(plan,'Details status: complete | Customer map: https://maps.google.com');
assert.equal(saved.flavours.berry,7);assert.equal(saved.flavours.mango,5);
assert.equal(JSON.stringify(initialBoxes(saved,sizes)),JSON.stringify(plan));
assert.ok(saved.notes.includes('Details status: complete'));
assert.ok(saved.notes.includes('Customer map:'));
const legacy=initialBoxes({box_size_id:'four',flavours:{berry:9},notes:'Box quantity: 2'},sizes);
assert.equal(legacy.length,2);assert.equal(boxValues(legacy).flavours.berry,9);
assert.equal(boxValues([]).box_size_id,null);
console.log('PASS: mixed boxes round-trip, aggregate counts, metadata and legacy quantities preserved, removing all boxes');
