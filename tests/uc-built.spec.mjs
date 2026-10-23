import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync('_site/calculadora.html','utf8');
for(const f of ['_site/uc-engine.js','_site/uc-native.js','_site/uc-native.css'])
 assert.ok(existsSync(f),f+' not published');
assert.equal((html.match(/<script src="\.\/uc-native\.js"><\/script>/g)||[]).length,1,'exactly one curricular bridge');
assert.ok(html.indexOf('<script src="./uc-engine.js"></script>')<html.indexOf('<script src="./uc-native.js"></script>'),'Engine must load before UI');
assert.ok(html.includes('</body>'),'Calculator HTML preserved');
const source=readFileSync('_site/uc-native.js','utf8');
assert.match(source,/med_jita_state_v3/);
assert.match(source,/ucState\(\)/);
assert.match(source,/persist\(u\)/);
assert.doesNotMatch(source,/profileGateway|\/api\/login/);
console.log('PASS packaged legacy calculator with original V51 UC engine and UI scripts.');
