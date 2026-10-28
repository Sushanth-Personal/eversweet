const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/order-contacts.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText, {exports: exportsObject, URL, require: () => ({})});
const {getInstagramDmUrl, contactAction, instagramUrl} = exportsObject;
for (const input of [
  'https://www.instagram.com/_adarsh.t.a?rpxt=abc123',
  'https://www.instagram.com/_adarsh.t.a/',
  'https://instagram.com/_adarsh.t.a',
  'https://instagram.com/_adarsh.t.a/#something',
]) {
  assert.equal(getInstagramDmUrl(input), 'https://ig.me/m/_adarsh.t.a');
  assert.equal(contactAction('instagram', {insta_id: input}).href, 'https://ig.me/m/_adarsh.t.a');
}
for (const input of [undefined, null, '', 'not a URL', 'https://instagram.com/',
  'javascript:alert(1)', 'https://instagram.com.evil.test/name',
  'https://instagram.com/p/postid/', 'https://instagram.com/direct/',
  'https://instagram.com/user/extra', 'https://instagram.com/bad%20name']) {
  assert.equal(getInstagramDmUrl(input), '');
  assert.equal(contactAction('instagram', {insta_id: input}).focus, 'instagram');
}
assert.equal(instagramUrl('https://www.instagram.com/_adarsh.t.a?rpxt=abc123'),
  'https://www.instagram.com/_adarsh.t.a/', 'storage normalization still returns a profile URL');
console.log('PASS: Instagram DM conversion, query/slash/fragment handling, periods/underscores, missing/invalid fallback and unchanged profile storage');
