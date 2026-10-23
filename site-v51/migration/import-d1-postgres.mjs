/**
 * MED JITA · lossless D1 snapshot import, only from a full trusted JSON export.
 * Defaults to read-only. No public endpoint, no overwrite, no secret output.
 *
 * node migration/import-d1-postgres.mjs --input /private/export.json
 * node migration/import-d1-postgres.mjs --input /private/export.json \
 *   --expect <sha256-from-dry-run> --apply
 */
import { readFile } from 'node:fs/promises';
import { auditRows, compareRows } from './snapshot-transfer.mjs';

const args = process.argv.slice(2);
const arg = key => {
  const at = args.indexOf(key);
  return at >= 0 ? args[at + 1] : undefined;
};
const allowed = new Set(['--input', '--expect', '--apply']);
for (let i = 0; i < args.length; i++) {
  if (!allowed.has(args[i])) throw Error('Argumento desconhecido: ' + args[i]);
  if (args[i] !== '--apply') {
    if (!args[i+1] || args[i+1].startsWith('--')) throw Error('Valor de parâmetro ausente.');
    i++;
  }
}
const file = arg('--input');
if (!file) throw Error('Informe o arquivo de exportação integral, fora do repositório.');
const obj = JSON.parse(await readFile(file, 'utf8'));
const rows = Array.isArray(obj) ? obj : obj?.rows;
const profiles = ['jbfs', 'barba', 'tay', 'igu'];
const report = auditRows(rows, profiles);
process.stdout.write(JSON.stringify({ phase: 'preflight', rowCount: report.rowCount,
  profiles: report.profiles, counts: report.counts, sha256: report.sha256 }) + '\\n');
if (!args.includes('--apply')) {
  process.stdout.write('DRY RUN: nenhuma conexão, gravação ou alteração realizada.\\n');
  process.exit(0);
}
const expected = arg('--expect');
if (!expected || !/^[a-f0-9]{64}$/.test(expected) || expected !== report.sha256)
  throw Error('Digest esperado não confere com a exportação. Escrita bloqueada.');
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL não configurada.');
const { Client } = await import('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.PGSSLMODE === 'require' ? { ssl: { rejectUnauthorized: true } } : {}),
  connectionTimeoutMillis: 8000,
});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('CREATE TABLE IF NOT EXISTS snapshots (' +
    'id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK (revision >= 1), ' +
    'payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const count = await client.query('SELECT COUNT(*)::int AS total FROM snapshots');
  if (count.rows[0].total !== 0)
    throw Error('Destino não está vazio. Importação recusada para evitar sobregravação.');
  for (const row of rows) {
    await client.query(
      'INSERT INTO snapshots (id,revision,payload,updated_at) VALUES ($1,$2,$3,$4)',
      [row.id,row.revision,row.payload,row.updated_at]
    );
  }
  const after = await client.query('SELECT id,revision,payload,updated_at FROM snapshots');
  const compare = compareRows(rows, after.rows, profiles);
  if (!compare.identical || compare.missing.length || compare.changed.length ||
      compare.additional.length)
    throw Error('Validação pós-gravação falhou. Transação cancelada.');
  await client.query('COMMIT');
  process.stdout.write(JSON.stringify({
    phase:'verified-and-committed', rowCount:report.rowCount, sha256:compare.target.sha256
  }) + '\\n');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
