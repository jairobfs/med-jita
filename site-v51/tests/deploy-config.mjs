import assert from 'node:assert/strict';
import { makeCloudflareConfig } from '../scripts/generate-cloudflare-config.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const cfg = makeCloudflareConfig(id);
assert.equal(cfg.name, 'med-jita-v51-canary');
assert.equal(cfg.main, 'worker/index.js');
assert.equal(cfg.d1_databases[0].binding, 'DB');
assert.equal(cfg.d1_databases[0].database_id, id);
assert.equal(cfg.vars.CRAFT_SPACE_ID, '6606bf28-79b6-7415-c5c5-6d0a79f7f279');
assert.equal(cfg.workers_dev, true);
assert.ok(!JSON.stringify(cfg).includes('CRAFT_API_BASE'));
assert.ok(!JSON.stringify(cfg).includes('MED_JITA_MASTER_KEY'));
for (const bad of ['', 'undefined', 'a'.repeat(36), '0'.repeat(64), '../other-db']) {
  assert.throws(() => makeCloudflareConfig(bad), /inválido/);
}
console.log('Cloudflare canary: configuração válida, isolada e sem credenciais.');
