/**
 * MED JITA V57 · standalone HTTPS-facing Node gateway for the original Worker.
 * GitHub owns source. PostgreSQL owns encrypted records. Neither key nor Craft
 * connector is ever copied into GitHub or into public HTML.
 *
 * Fail-closed: DATABASE_URL and MED_JITA_MASTER_KEY are required to start.
 * Mutations are blocked unless MED_JITA_WRITE_ENABLED=true.
 */
import http from 'node:http';
import { URL } from 'node:url';
import { makeD1PgAdapter, bootstrapSnapshots } from './postgres-d1-adapter.mjs';

const port = Number(process.env.PORT || 10000);
const conn = process.env.DATABASE_URL;
const key = process.env.MED_JITA_MASTER_KEY;
if (!conn || !/^[a-f0-9]{64}$/i.test(key || ''))
  throw Error('Banco e chave da aplicação devem ser configurados antes de iniciar.');
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw Error('Porta inválida.');
const { Pool } = await import('pg');
const pool = new Pool({
  connectionString: conn,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  ...(process.env.PGSSLMODE === 'require' ? { ssl: { rejectUnauthorized: true } } : {}),
});
await bootstrapSnapshots(pool);
const DB = makeD1PgAdapter(pool);
const { default: worker } = await import('../worker/index.js');
const env = {
  DB,
  MED_JITA_MASTER_KEY: key,
  CRAFT_API_BASE: process.env.CRAFT_API_BASE || '',
  CRAFT_SPACE_ID: process.env.CRAFT_SPACE_ID || '',
};
const writeEnabled = process.env.MED_JITA_WRITE_ENABLED === 'true';
const maxBytes = 1600000;
const server = http.createServer(async(req, res) => {
  const pending = [];
  try {
    const host = req.headers.host || 'localhost';
    // Use the public hostname for same-origin protections inside the Worker.
    const scheme = host.startsWith('localhost') ? 'http:' : 'https:';
    const url = new URL(req.url || '/', scheme + '//' + host);
    if (!['GET','HEAD','POST','PUT','OPTIONS'].includes(req.method))
      return endJson(res, 405, { error: 'Método indisponível.' });
    if (!writeEnabled && url.pathname.startsWith('/api/') &&
        ['POST','PUT'].includes(req.method))
      return endJson(res, 503, { error: 'Migração em conferência: gravação desativada.' });
    let bytes = 0;
    const parts = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > maxBytes) return endJson(res, 413, { error: 'Requisição acima do limite.' });
      parts.push(chunk);
    }
    const headers = new Headers();
    for (const [name, val] of Object.entries(req.headers)) {
      if (['host', 'connection', 'transfer-encoding', 'content-length'].includes(name)) continue;
      if (typeof val === 'string') headers.set(name, val);
      if (Array.isArray(val)) for (const v of val) headers.append(name, v);
    }
    const body = ['POST','PUT'].includes(req.method) ? Buffer.concat(parts) : undefined;
    const request = new Request(url, { method: req.method, headers,
      ...(body ? {body} : {}) });
    const context = { waitUntil(job) {
      pending.push(Promise.resolve(job).catch(() => {
        process.stderr.write('Falha assíncrona em operação auxiliar do MED JITA.\\n');
      }));
    }};
    const response = await worker.fetch(request, env, context);
    const responseHeaders = {};
    for (const [name, value] of response.headers) responseHeaders[name] = value;
    responseHeaders['x-content-type-options'] = 'nosniff';
    const data = Buffer.from(await response.arrayBuffer());
    responseHeaders['content-length'] = String(data.length);
    res.writeHead(response.status, responseHeaders);
    res.end(req.method === 'HEAD' ? undefined : data);
    // A Craft mirror may complete after the primary database save.
    if (pending.length) void Promise.allSettled(pending);
  } catch {
    if (!res.headersSent) endJson(res, 500, { error: 'Serviço temporariamente indisponível.' });
    else res.end();
  }
});
function endJson(res, status, payload) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store', 'x-content-type-options':'nosniff' });
  res.end(JSON.stringify(payload));
}
server.listen(port, '0.0.0.0', () =>
  process.stdout.write('MED JITA PostgreSQL gateway listening; writes ' +
    (writeEnabled ? 'explicitly enabled' : 'disabled') + '\\n'));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
});
