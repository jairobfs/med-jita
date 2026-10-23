import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import app from '../worker/canary-entry.mjs';

const source = async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [html,quick,guard,css,sw,worker,profiles] = await Promise.all([
 source('source/index.html'),source('source/integrations/quick-nav-v60.js'),
 source('source/integrations/preview-guard-v60.js'),source('source/quick-nav-v60.css'),
 source('source/sw.js'),source('worker/index.js'),source('source/integrations/profiles-ui.js')
]);

assert.match(html,/quick-nav-v60\.css\?v=60\.1/);
assert.match(html,/integrations\/quick-nav-v60\.js\?v=60\.1/);
assert.match(html,/integrations\/preview-guard-v60\.js\?v=60/);
for(const path of [
 '/quick-nav-v60.css','/integrations/quick-nav-v60.js','/integrations/preview-guard-v60.js'
]) assert.ok(worker.includes(JSON.stringify(path)),'V60 resource missing in built Worker: '+path);
for(const path of [
 './quick-nav-v60.css','./integrations/quick-nav-v60.js','./integrations/preview-guard-v60.js'
]) assert.ok(sw.includes("'"+path+"'"),'Offline iPhone missing V60 file: '+path);
for(const page of ['home','uc','cab','tut','sim','history'])
 assert.ok(quick.includes("id:'"+page+"'"),'Nav missing '+page);
for(const action of ['settings','switch','install','export','theme'])
 assert.ok(quick.includes("id:'"+action+"'"),'Action missing '+action);
assert.match(quick,/aria-haspopup','dialog/);
assert.match(quick,/event\.ctrlKey\|\|event\.metaKey/);
assert.match(quick,/event\.key==='ArrowDown'\|\|event\.key==='ArrowUp'/);
assert.match(quick,/dialog\.showModal\(\)/);
assert.match(css,/\.jita-quick-dialog::backdrop/);
assert.match(css,/@media\(max-width:520px\)/);
assert.match(profiles,/window\.MED_JITA_PREVIEW_ISOLATED===true/);
assert.match(profiles,/Teste salvo online/);
assert.match(guard,/new Set\(\['importData','importHistory','vercelExitFile'\]\)/);
assert.match(guard,/accountToggle\.disabled=true/);
const response=await app.fetch(new Request('https://jita-canary.test/'),
 {DB:{prepare(){throw Error('Unexpected D1 access');}}},{});
const served=await response.text();
assert.equal(response.status,200);
assert.match(served,/window\.MED_JITA_PREVIEW_ISOLATED=true/);
assert.match(served,/quick-nav-v60\.css/);
assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
console.log('V60 QA PASS: 11 commands, offline assets, app-only search, sync copy, demo-only import gate and Worker flag.');
