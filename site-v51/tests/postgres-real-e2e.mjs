import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import worker from '../worker/index.js';
import { bootstrapSnapshots, makeD1PgAdapter } from '../render-production/postgres-d1-adapter.mjs';

const url = process.env.MED_JITA_TEST_DATABASE_URL;
if (!url || !/^postgres(?:ql)?:\/\/[^/]+\/jita_ci$/.test(url))
  throw Error('Teste de PostgreSQL permitido somente no banco isolado jita_ci.');
const pool = new Pool({ connectionString: url, max: 5 });
const craftBase = 'https://connect.craft.do/links/mockJitaCi/api/v1';
const names = ['jbfs', 'barba', 'tay', 'igu'];
const items = names.map((id, i) => ({
  id: 'mock-' + id,
  title: id === 'jbfs' ? 'JBFS' : id[0].toUpperCase() + id.slice(1),
  properties: { identificador: id, ativo: true, acesso: 'Ativo',
    papel: i === 0 ? 'Administrador' : 'Participante',
    codigo: 'c'.repeat(24), senhahistorico: i === 0 ? '0000' : '',
    sincronizacao: false, redefinirsenha: false }
}));
const previousFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const destination = String(url);
  if (destination === craftBase + '/connection')
    return Response.json({ space: {id:'6606bf28-79b6-7415-c5c5-6d0a79f7f279'} });
  if (destination.includes('/collections/c4a350de-9e9d-4e29-6f0c-ec31cc6b4ba7/items'))
    return Response.json({ items });
  throw Error('Acesso externo inesperado no teste PostgreSQL: ' + destination);
};
const master = randomBytes(32).toString('hex');
const env = { DB: makeD1PgAdapter(pool), MED_JITA_MASTER_KEY: master,
  CRAFT_API_BASE: craftBase, CRAFT_SPACE_ID: '6606bf28-79b6-7415-c5c5-6d0a79f7f279' };
const backup = (hits) => ({ format: 'med-jita-backup', version: 3,
  data: { version: 3, cab: { hits } }, history: [] });
async function api(path, method = 'GET', data = null, pin = '') {
  const request = new Request('https://jita-ci.test' + path, {
    method,
    headers: { ...(pin ? {'X-Med-History-Password': pin} : {}),
      ...(data ? {'Content-Type': 'application/json'} : {}) },
    ...(data ? {body: JSON.stringify(data)} : {})
  });
  const response = await worker.fetch(request, env);
  return { status: response.status, json: await response.json() };
}
try {
  await bootstrapSnapshots(pool);
  const initial = await pool.query('SELECT COUNT(*)::int AS n FROM snapshots');
  assert.equal(initial.rows[0].n, 0, 'Integration DB must start empty.');
  let r = await api('/api/profiles');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.profiles.map(p => p.id), names);
  assert.equal(r.json.profiles[0].passwordRequired, true);
  r = await api('/api/profile/open','POST',{id:'jbfs'});
  assert.equal(r.status, 200);
  assert.equal(r.json.passwordRequired, true);
  assert.equal((await api('/api/profile/backup?id=jbfs')).status, 423);
  assert.equal((await api('/api/profile/backup?id=jbfs', 'GET', null, 'bad')).status, 423);
  assert.equal((await api('/api/profile/backup?id=jbfs','GET',null,'0000')).json.revision,0);
  r = await api('/api/profile/backup','PUT',{id:'jbfs',revision:0,backup:backup('21')},'0000');
  assert.equal(r.status,200,JSON.stringify(r.json));
  assert.equal(r.json.revision,1);
  let stored = await pool.query('SELECT revision,payload FROM snapshots WHERE id=$1',['med-data-v1:jbfs']);
  assert.equal(stored.rows[0].revision,1);
  assert.equal(stored.rows[0].payload.includes('"hits"'),false, 'Real PG stores only encrypted backup.');
  r = await api('/api/profile/backup?id=jbfs','GET',null,'0000');
  assert.equal(r.json.backup.data.cab.hits,'21');
  assert.equal((await api('/api/profile/backup','PUT',
    {id:'jbfs',revision:0,backup:backup('22')},'0000')).status,409);
  r = await api('/api/profile/backup','PUT',
    {id:'jbfs',revision:1,backup:backup('22')},'0000');
  assert.equal(r.status,200);
  assert.equal(r.json.revision,2);
  r = await api('/api/profile/backup','PUT',
    {id:'barba',revision:0,backup:backup('17')});
  assert.equal(r.status,200);
  assert.equal((await api('/api/profile/backup?id=barba')).json.backup.data.cab.hits,'17');
  assert.equal((await api('/api/profile/backup?id=jbfs','GET',null,'0000')).json.backup.data.cab.hits,'22');
  assert.equal((await api('/api/profile/backup?id=tay')).json.revision,0);
  assert.equal((await api('/api/profile/backup?id=igu')).json.revision,0);
  // Reconnect to PostgreSQL with a fresh pool; simulated process restart.
  const reopened = new Pool({ connectionString: url, max: 1 });
  try {
    const row = await reopened.query('SELECT revision,payload FROM snapshots WHERE id=$1',['med-data-v1:jbfs']);
    assert.equal(row.rows[0].revision,2);
    assert.equal(row.rows[0].payload.includes('"hits"'),false);
    assert.equal((await reopened.query('SELECT COUNT(*)::int AS n FROM snapshots WHERE id LIKE $1',
      ['med-data-v1:%'])).rows[0].n,2);
  } finally { await reopened.end(); }
  console.log('REAL PG E2E PASS: four profiles, PIN, AES-GCM, isolation, conflicts, persistence after reconnect.');
} finally {
  globalThis.fetch = previousFetch;
  await pool.end();
}
