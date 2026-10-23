import assert from 'node:assert/strict';
import app from '../worker/canary-entry.mjs';

const get = async(path, method = 'GET') =>
  app.fetch(new Request('https://med-jita-v57-canario.example' + path, {method}),
    {DB:{prepare() {throw Error('Canary accessed the real D1 data layer.')}}},{});
let r = await get('/');
assert.equal(r.status,200);
assert.match(await r.text(),/Prévia técnica · Notas e histórico desativados/);
assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
r = await get('/api/health');
assert.equal(r.status,200);
const health = await r.json();
assert.equal(health.store,true);
assert.equal(health.editorial,false);
assert.equal(health.profiles,false);
r = await get('/api/profiles');
assert.deepEqual((await r.json()).profiles.map(p=>p.id),['jbfs','barba','tay','igu']);
r = await get('/api/profile/open','POST');
assert.equal(r.status,503);
r = await get('/api/profile/backup?id=jbfs');
assert.equal(r.status,503);
r = await get('/api/editorial');
assert.equal(r.status,503);
r = await get('/api/snapshot','POST');
assert.equal(r.status,503);
r = await get('/api/snapshot');
assert.equal(r.status,503);
assert.equal((await get('/icons/jita-corpo.svg')).status,200);
console.log('Cloudflare canary gate: full assets, 4 profiles, D1 binding, no personal writes or Craft access OK.');
