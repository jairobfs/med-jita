import assert from 'node:assert/strict';
import { makeD1PgAdapter, translateD1Sql, bootstrapSnapshots } from '../render-production/postgres-d1-adapter.mjs';

const found = [];
const pool = {
  async query(sql, params = []) {
    found.push({ sql, params });
    if (/^SELECT/i.test(sql)) return { rows: [{ revision: 7, payload: '{"alg":"AES-256-GCM"}' }], rowCount: 1 };
    if (/^UPDATE/i.test(sql)) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  },
};
const db = makeD1PgAdapter(pool);
await bootstrapSnapshots(pool);
assert.match(found[0].sql, /CREATE TABLE IF NOT EXISTS snapshots/);

const original = 'INSERT OR IGNORE INTO snapshots (id,revision,payload,updated_at) VALUES (?,1,?,?)';
const translated = translateD1Sql(original);
assert.match(translated.sql, /INSERT INTO snapshots/);
assert.match(translated.sql, /VALUES \(\$1,1,\$2,\$3\)/);
assert.match(translated.sql, /ON CONFLICT \(id\) DO NOTHING$/);
assert.equal(translated.parameterCount, 3);
assert.deepEqual(await db.prepare('SELECT revision,payload FROM snapshots WHERE id=?')
  .bind('med-data-v1:jbfs').first(), { revision: 7, payload: '{"alg":"AES-256-GCM"}' });
assert.equal(found[1].params[0], 'med-data-v1:jbfs');
assert.equal((await db.prepare(original).bind('med-data-v1:jbfs','cipher','2026-10-23').run()).meta.changes,1);
assert.equal((await db.prepare('UPDATE snapshots SET revision=revision+1,payload=?,updated_at=? WHERE id=? AND revision=?')
  .bind('other','date','med-data-v1:jbfs',5).run()).meta.changes,0,
'Concurrent update must retain compare-and-swap protection.');
assert.match(translateD1Sql('INSERT INTO snapshots (id,revision,payload,updated_at) VALUES (?,?,?,?) ' +
  'ON CONFLICT(id) DO UPDATE SET revision=max(revision,excluded.revision),payload=excluded.payload,updated_at=excluded.updated_at').sql,
  /GREATEST\(revision, excluded.revision\)/);
assert.match(translateD1Sql('INSERT INTO snapshots (id,revision,payload,updated_at) VALUES (?,1,?,?) ON CONFLICT(id) DO UPDATE SET revision=revision+1,payload=excluded.payload,updated_at=excluded.updated_at').sql, /revision=snapshots.revision\\+1/);
assert.throws(() => db.prepare('SELECT revision FROM snapshots WHERE id=?').bind(), /parâmetros/i);
assert.throws(() => translateD1Sql('DELETE FROM snapshots WHERE id=?'), /esquema/i);
assert.throws(() => translateD1Sql('SELECT * FROM accounts'), /esquema/i);
assert.throws(() => translateD1Sql('SELECT * FROM snapshots; DROP TABLE snapshots'), /esquema/i);
console.log('MED JITA PG bridge: D1 translation, placeholders, concurrency, schema guard OK.');
