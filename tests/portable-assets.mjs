import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';

const sw = readFileSync(new URL('../source/sw.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../source/index.html', import.meta.url), 'utf8');
const list = sw.split('const OFFLINE_FILES = [')[1]?.split('].map(')[0];
assert.ok(list, 'Lista de arquivos offline deve existir.');
const expected = new Set(
  [...list.matchAll(/'\.\/([^']*)'/g)].map(m => '/' + (m[1] || ''))
);
for (const m of html.matchAll(/(?:href|src)="\.\/([^"#?]+)(?:\?[^"]*)?"/g)) expected.add('/' + m[1]);
assert.ok(expected.size > 40, 'O teste deve conferir recursos reais da experiência.');
for (const path of expected) {
  const response = await worker.fetch(new Request('https://med-jita-portable.test' + path), {}, {});
  assert.equal(response.status, 200, 'Arquivo obrigatório ausente do Worker: ' + path);
}
const transitions = await worker.fetch(new Request('https://med-jita-portable.test/navigation-motion.css'), {}, {});
assert.match(transitions.headers.get('Content-Type') || '', /text\/css/);
assert.match(await transitions.text(), /transition|animation|@keyframes/,
  'As animações de navegação devem fazer parte da publicação.');
console.log('MED JITA portátil: ' + expected.size + ' arquivos essenciais servidos, incluindo as transições.');
