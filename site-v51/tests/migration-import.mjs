import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'med-jita-transfer-test-'));
const script = resolve('migration/import-d1-postgres.mjs');
const backup = JSON.stringify({alg:'AES-256-GCM',iv:'abcdefghijklmnop',ciphertext:'A'.repeat(90)});
const rows = ['jbfs','barba','tay','igu'].map((name, i) => ({
  id:'med-data-v1:'+name,
  revision:i+2,
  payload:backup,
  updated_at:'2026-10-23T10:11:12.000Z',
}));
const test = (...args) => spawnSync(process.execPath,[script,...args],{
  encoding:'utf8', env:{...process.env,DATABASE_URL:''},
});
try {
  const input = join(directory,'example.json');
  await writeFile(input,JSON.stringify({rows}));
  const dry = test('--input',input);
  assert.equal(dry.status,0,dry.stderr);
  assert.match(dry.stdout,/DRY RUN/);
  const hash = JSON.parse(dry.stdout.split('\\n')[0]).sha256;
  assert.match(hash,/^[a-f0-9]{64}$/);
  const wrong = test('--input',input,'--expect','0'.repeat(64),'--apply');
  assert.notEqual(wrong.status,0);
  assert.match(wrong.stderr,/Digest esperado/);
  const noDb = test('--input',input,'--expect',hash,'--apply');
  assert.notEqual(noDb.status,0);
  assert.match(noDb.stderr,/DATABASE_URL/);
  await writeFile(input,JSON.stringify({rows:rows.slice(1)}));
  const missing = test('--input',input);
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/Histórico obrigatório ausente/);
  console.log('D1 import CLI: dry-run, digest gate, complete profiles, missing DB fail-closed OK.');
} finally { await rm(directory,{recursive:true,force:true}); }
