/**
 * MED JITA V57 · D1-compatible SQL adapter for managed PostgreSQL.
 * Use only with the original Worker and a separately configured database.
 * No user data or credentials are bundled in this module.
 */
const TABLE = /\bsnapshots\b/i;

export function translateD1Sql(input) {
  if (typeof input !== 'string' || !TABLE.test(input) ||
      !/^\s*(?:SELECT|INSERT|UPDATE|CREATE\s+TABLE)\b/i.test(input) ||
      input.includes(';') || /\b(?:DROP|DELETE|TRUNCATE|ALTER|ATTACH|PRAGMA)\b/i.test(input))
    throw new Error('Consulta fora do esquema de históricos autorizado.');
  let sql = input.trim()
    .replace(/^INSERT\s+OR\s+IGNORE\s+INTO\s+snapshots\b/i, 'INSERT INTO snapshots')
    .replace(/\bmax\s*\(\s*revision\s*,\s*excluded\.revision\s*\)/gi,
      'GREATEST(snapshots.revision, excluded.revision)')
    .replace(/\\brevision\\s*=\\s*revision\\s*\\+\\s*1\\b/gi,
      'revision=snapshots.revision+1');
  if (/^INSERT\s+INTO\s+snapshots\b/i.test(sql) &&
      /^INSERT\s+OR\s+IGNORE\s+INTO\s+snapshots\b/i.test(input.trim()))
    sql += ' ON CONFLICT (id) DO NOTHING';
  let number = 0;
  sql = sql.replace(/\?/g, () => '$' + (++number));
  return { sql, parameterCount: number };
}

export function makeD1PgAdapter(pool) {
  if (!pool || typeof pool.query !== 'function')
    throw new TypeError('A conexão PostgreSQL não está configurada.');
  return Object.freeze({
    prepare(sql) {
      const query = translateD1Sql(sql);
      return Object.freeze({
        bind(...params) {
          if (params.length !== query.parameterCount)
            throw new Error('Quantidade incorreta de parâmetros SQL.');
          const execute = () => pool.query(query.sql, params);
          return Object.freeze({
            async first() {
              const result = await execute();
              return result.rows?.[0] ?? null;
            },
            async run() {
              const result = await execute();
              return { meta: { changes: result.rowCount || 0 } };
            },
          });
        },
        async first() {
          if (query.parameterCount !== 0) throw new Error('Parâmetros ausentes.');
          const result = await pool.query(query.sql);
          return result.rows?.[0] ?? null;
        },
        async run() {
          if (query.parameterCount !== 0) throw new Error('Parâmetros ausentes.');
          const result = await pool.query(query.sql);
          return { meta: { changes: result.rowCount || 0 } };
        },
      });
    },
  });
}

export async function bootstrapSnapshots(pool) {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS snapshots (' +
    'id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK (revision >= 1), ' +
    'payload TEXT NOT NULL, updated_at TEXT NOT NULL)'
  );
}
