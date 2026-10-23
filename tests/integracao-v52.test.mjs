import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareMigration } from '../integrations/fusion-archive.mjs';

const make = (profile, score) => ({
  version: 3,
  format: 'med-jita-backup',
  profile,
  data: { version: 3, cab: { hits: score } },
  history: [{ id: 'registro-original', name: 'Prova', data: { cab: { hits: score } } }],
});

test('GitHub preserva duas notas conflitantes sem importação', () => {
  const current = make('jbfs', 7), incoming = make('jbfs', 9);
  const plan = prepareMigration({
    profileId: 'jbfs', current, incoming,
    currentOrigin: 'GitHub', incomingOrigin: 'Sites',
  });
  assert.equal(plan.sameLiveState, false);
  assert.ok(plan.snapshots.some(x => x.origin === 'GitHub'));
  assert.ok(plan.snapshots.some(x => x.origin === 'Sites'));
  assert.equal(plan.completeArchive.current.backup.data.cab.hits, 7);
  assert.equal(plan.completeArchive.incoming.backup.data.cab.hits, 9);
  assert.equal(current.history[0].id, 'registro-original');
  assert.equal(incoming.history[0].id, 'registro-original');
});

test('Backups de outros perfis são bloqueados', () => {
  assert.throws(
    () => prepareMigration({ profileId: 'jbfs', current: make('jbfs', 7),
      incoming: make('tay', 9) }),
    /outro perfil/,
  );
});

test('Históricos extensos são preservados integralmente', () => {
  const plan = prepareMigration({ profileId: 'jbfs',
    current: make('jbfs', 7), incoming: make('jbfs', 9), historyLimit: 1 });
  assert.equal(plan.needsSeparateArchive, true);
  assert.equal(plan.snapshots.length, plan.totalVersions);
});

test('Arquivos exigidos pelo cache offline realmente existem', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const block = sw.match(/const OFFLINE_FILES\s*=\s*\[([\s\S]*?)\]/)?.[1];
  assert.ok(block, 'Lista de recursos offline ausente');
  const paths = [...block.matchAll(/['"]\.\/([^'"]+)['"]/g)].map(x => x[1]);
  assert.ok(paths.includes('integrations/fusion-archive.mjs'));
  for (const path of paths) {
    assert.ok(existsSync(fileURLToPath(new URL('../' + path, import.meta.url))),
      'Arquivo offline ausente: ' + path);
  }
});

test('Calculadora no iframe mantém o motor validado da V17', () => {
  const main = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const isolated = readFileSync(new URL('../calculadora.html', import.meta.url), 'utf8');
  assert.equal(isolated, main);
});
