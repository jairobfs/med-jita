import assert from 'node:assert/strict';

const raw = process.env.MED_JITA_CANARY_URL || '';
let base;
try { base = new URL(raw); } catch { throw new Error('URL de canário ausente ou inválida.'); }
if (base.protocol !== 'https:' || !base.hostname.endsWith('.workers.dev') ||
    base.username || base.password || base.search || base.hash) {
  throw new Error('O smoke test aceita somente o domínio canário workers.dev, via HTTPS.');
}
async function get(path) {
  const response = await fetch(new URL(path, base), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  assert.equal(response.status, 200, path + ' retornou HTTP ' + response.status);
  return response.json();
}
const health = await get('/api/health');
assert.equal(health.ok, true);
assert.equal(health.store, true, 'D1 não está vinculado ao Worker');
assert.equal(health.editorial, true, 'Configuração de conexão Craft ausente');
assert.equal(health.profiles, true, 'Chave de perfis ausente');
const catalog = await get('/api/profiles');
assert.ok(Array.isArray(catalog.profiles), 'Catálogo de perfis indisponível');
console.log('Smoke read-only aprovado: serviço, D1, configuração Craft e catálogo de perfis.');
