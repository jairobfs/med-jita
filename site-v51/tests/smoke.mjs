import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import worker from '../worker/index.js';

const origin = 'https://med-jita.example.test';
const rows = new Map();
const db = {
  prepare(sql) {
    return {
      args: [],
      bind(...args) { this.args = args; return this; },
      async first() {
        const row = rows.get(this.args[0]);
        return row ? { ...row } : null;
      },
      async run() {
        if (sql.startsWith('CREATE TABLE')) return { meta: { changes: 0 } };
        if (sql.startsWith('INSERT')) {
          const [id, payload, time] = this.args;
          if (rows.has(id)) return { meta: { changes: 0 } };
          rows.set(id, { revision: 1, payload, updated_at: time });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith('UPDATE')) {
          const [payload, time, id, revision] = this.args;
          const old = rows.get(id);
          if (!old || old.revision !== revision) return { meta: { changes: 0 } };
          rows.set(id, { revision: revision + 1, payload, updated_at: time });
          return { meta: { changes: 1 } };
        }
        throw Error('Unexpected SQL in smoke test.');
      },
    };
  },
};

async function hit(path, options = {}, env = {}) {
  return worker.fetch(new Request(origin + path, options), env);
}
const main = await hit('/');
assert.equal(main.status, 200);
const mainHtml = await main.text();
assert.match(mainHtml, /MED JITA/);
assert.match(mainHtml, /id="page-uc"/, 'Motor de todas as UCs deve estar disponível');
assert.match(mainHtml, /id="ucQuick"/, 'As UCs do período devem receber atalhos curriculares dinâmicos');
assert.match(mainHtml, /<details class="uc-advanced" id="ucAdvanced">/, 'Matriz e período excepcionais devem começar recolhidos');
assert.match(mainHtml, /id="ucFollowCohort" checked/, 'A progressão semestral deve ficar ativada por padrão');
assert.match(mainHtml, /id="ucNewInstance"/, 'A turma deve poder manter notas de diferentes módulos da mesma UC');
assert.match(mainHtml, /id="cohortHomeLabel"/, 'O painel deve anunciar a fase atual do curso');
assert.doesNotMatch(mainHtml, /Modelos para 2023, 2024 e 2025, do 1º ao 12º período/, 'A apresentação não deve expor a abrangência técnica de matrizes');
assert.match(mainHtml, /href="\.\/atelier\.html"/, 'O Atelier V11.1 deve ser acessível pela calculadora');
assert.equal((mainHtml.match(/data-med-jita-logo src="\.\/assets\/med-jita-brand-v11\.svg"/g) || []).length, 2, 'Ambos os locais da marca devem usar o lettering V11');
assert.match(mainHtml, /\.profile-gateway-card:before\{[^}]+wordmark-organic\.svg/, 'O seletor dos quatro perfis deve exibir a assinatura V08 validada');
assert.match(mainHtml, /\.profile-gateway-mark svg\{width:116px;height:116px/, 'O Jita completo não deve voltar ao selo minúsculo de 49px no login');
assert.match(mainHtml, /class="gateway-intro"/, 'A recepção ilustrada de entrada deve estar presente');
assert.match(mainHtml, /class="gateway-selection"/, 'O seletor de perfis deve ter painel próprio');
assert.match(mainHtml, /max-width:365px/, 'A tela de perfis deve continuar adaptada a iPhones estreitos');
assert.match(mainHtml, /class="profile-gateway-mark jita-reactive"/, 'A entrada deve permitir interação com o mascote');
assert.match(mainHtml, /class="jita-cover-art jita-reactive"/, 'O Jita do painel também deve reagir');
assert.match(mainHtml, /class="nav-v11-icon" src="\.\/assets\/jita-v11\/inverso\/calcular\.svg"/, 'A navegação principal deve ter ícones V11');
assert.match(mainHtml, /src="\.\/integrations\/brand-v08\.js\?v=\d+"/, 'A assinatura V08 deve permanecer ativa');
for (const path of ['/assets/med-jita-brand-v11.svg', '/assets/completa-organic.svg', '/assets/jita-v11/inverso/calcular.svg', '/assets/jita-v11/cor/media.svg']) {
  const asset = await hit(path);
  assert.equal(asset.status, 200, `Ativo visual ausente: ${path}`);
  assert.match(asset.headers.get('content-type') || '', /image\/svg\+xml/, `MIME incorreto: ${path}`);
}
const atelier = await hit('/atelier.html');
const jitaMotion = await hit('/integrations/jita-motion.js');
assert.equal(jitaMotion.status,200, 'O controlador do Jita Vivo deve ser servido');
assert.match(await jitaMotion.text(),/DeviceOrientationEvent/, 'O controlador deve oferecer movimento opcional do aparelho');
const motionCSS = await hit('/jita-motion.css');
assert.equal(motionCSS.status,200, 'Os estilos de movimento devem ser servidos');
assert.match(motionCSS.headers.get('content-type')||'',/text\/css/);
assert.equal(atelier.status, 200, 'O Atelier deve ser servido sem autenticação adicional');
assert.match(atelier.headers.get('content-type') || '', /text\/html/);
const atelierHtml = await atelier.text();
assert.match(atelierHtml, /V11\.1/);
assert.match(atelierHtml, /MED JITA/);
assert.match(atelierHtml, /id="production-grid"/, 'A bancada de produção deve estar presente no Ateliê');
assert.match(atelierHtml, /img\.src='\.\/assets\/jita-v11\/'/, 'A bancada deve referenciar arquivos reais V11 da navegação');
assert.doesNotMatch(atelierHtml, /<script[^>]+src=["']https?:\/\//i, 'O Atelier não depende de script externo');
assert.equal((await hit('/icons/jita-rosto.svg')).headers.get('content-type'), 'image/svg+xml');
assert.equal((await hit('/sw.js')).status, 200);
const editorialClient = await hit('/integrations/editorial-live.js');
assert.equal(editorialClient.status, 200);
const editorialScript = await editorialClient.text();
assert.match(editorialScript, /credentials: 'same-origin'/);
assert.match(editorialScript, /setInterval/);
const ucEngineClient = await hit('/integrations/uc-engine.js');
assert.equal(ucEngineClient.status, 200);
assert.match(await ucEngineClient.text(), /MED_UC_ENGINE/);
assert.equal((await hit('/api/health', {}, { DB: db })).status, 200);
assert.equal((await hit('/api/snapshot')).status, 401);
assert.equal((await hit('/api/editorial')).status, 503);
assert.equal((await hit('/api/snapshot', { method: 'OPTIONS' })).status, 204);
assert.equal((await hit('/missing.svg')).status, 404);

const rawCode = randomBytes(32).toString('base64url');
const bearer = createHash('sha256').update('med-jita:v1:auth:' + rawCode).digest('base64url');
const headers = { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' };
const payload = { alg: 'AES-256-GCM', iv: randomBytes(12).toString('base64url'), ciphertext: randomBytes(64).toString('base64url') };
let response = await hit('/api/snapshot', { method: 'PUT', headers, body: JSON.stringify({ revision: 0, payload }) }, { DB: db });
assert.equal(response.status, 200);
assert.equal((await response.json()).revision, 1);
response = await hit('/api/snapshot', { headers }, { DB: db });
assert.equal((await response.json()).payload.ciphertext, payload.ciphertext);
response = await hit('/api/snapshot', { method: 'PUT', headers, body: JSON.stringify({ revision: 0, payload }) }, { DB: db });
assert.equal(response.status, 409);
response = await hit('/api/snapshot', { method: 'PUT', headers, body: JSON.stringify({ revision: 1, payload }) }, { DB: db });
assert.equal((await response.json()).revision, 2);

const originalFetch = globalThis.fetch;
let connectionSpace = '6606bf28-79b6-7415-c5c5-6d0a79f7f279';
let itemReads = 0;
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/connection'))
    return Response.json({ space: { id: connectionSpace, name: '⌯ MED' } });
  itemReads += 1;
  return Response.json({ items: [
    { title: 'ajuda.privacidade', properties: { contedo: 'Texto publicado no Craft.', estado: 'Revisado' } },
    { title: 'rascunho.interno', properties: { contedo: 'Não pode ser publicado.', estado: 'Rascunho' } },
  ] });
};
try {
  const base = 'https://connect.craft.do/links/testConnection/api/v1';
  const blocked = await hit('/api/editorial', {}, { CRAFT_API_BASE: base });
  assert.equal(blocked.status, 503);
  const ready = { CRAFT_API_BASE: base, CRAFT_SPACE_ID: '6606bf28-79b6-7415-c5c5-6d0a79f7f279' };
  response = await hit('/api/editorial', {}, ready);
  const published = await response.json();
  assert.equal(published.items['ajuda.privacidade'], 'Texto publicado no Craft.');
  assert.equal(published.items['rascunho.interno'], undefined);
  assert.equal(itemReads, 1);

  connectionSpace = '8b335448-6499-3d04-91c1-5f99c399aca8';
  const wrongSpace = await hit('/api/editorial', {}, ready);
  assert.equal(wrongSpace.status, 502);
  assert.equal(itemReads, 1, 'Never fetch a Collection after Craft reports a different space.');
} finally { globalThis.fetch = originalFetch; }

console.log('MED JITA: assets, sync protocol, revision conflicts, Craft space identity and draft filtering OK.');
