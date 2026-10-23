import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('_site/index.html', 'utf8');
const hat = readFileSync('_site/assets/jita-cartola-avatar.svg', 'utf8');
assert.match(hat, /<svg[\s>]/i, 'A cartola vetorial precisa estar publicada.');
assert.match(html, /\.face::before\s*\{[^}]*jita-cartola-avatar\.svg/s, 'Cada perfil precisa compartilhar a cartola original.');
assert.match(html, /b\.dataset\.profile=id/, 'As cores precisam seguir o perfil, não uma marca fixa.');
assert.match(html, /name\.trim\(\)\.charAt\(0\)\.toLocaleUpperCase/, 'A letra precisa corresponder ao perfil.');
assert.match(html, /const P=\[\["jbfs","JBFS"\],\["barba","Barba"\],\["tay","Tay"\],\["igu","Igu"\]\]/, 'Os quatro perfis precisam permanecer.');
assert.match(html, /id="pin"[^>]+inputmode="numeric"/, 'O PIN deve pedir teclado numérico no iPhone.');
assert.match(html, /id="pinConfirm"[^>]+inputmode="numeric"/, 'A confirmação deve pedir teclado numérico.');
assert.match(html, /\$\("pin"\)\.focus\(\)/, 'Seleção de pessoa deve focar o PIN.');
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  new vm.Script(match[1], { filename:'independente.html' });
}
console.log('MED JITA: shell independente, perfis, cartola, PIN e JS válidos.');
