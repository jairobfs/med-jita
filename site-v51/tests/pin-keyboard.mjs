import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../source/index.html');
const script = read('../source/integrations/profiles-ui.js');
const css = read('../source/brand-evolution.css');
assert.doesNotThrow(() => new Script(script));

const password = html.match(/<input id="profileUnlockPassword"[^>]*>/)?.[0] || '';
assert.match(password, /type="password"/);
assert.match(password, /inputmode="numeric"/);
assert.match(password, /enterkeyhint="go"/);
assert.match(html, /id="profileKeyboardMode"[^>]*type="button"/);
assert.doesNotMatch(html, /id="profilePinPad"|data-pin-key=/,
  'A entrada não deve criar teclado HTML que dispute espaço com o Safari');
assert.doesNotMatch(script, /profilePinPad|setRangeText/,
  'Autenticação deve usar somente o campo nativo do navegador');
assert.doesNotMatch(css, /\.profile-pin-pad/, 'Não deixar grade virtual no CSS');
assert.match(css, /\.profile-keyboard-mode:focus-visible/);

const nodes = new Map();
const input = {
  value:'PIN-PRESERVADO',placeholder:'',focusCalls:0,
  setAttribute(name,value) { this[name] = value; },
  focus() { this.focusCalls++; },
};
nodes.set('profileUnlockPassword',input);
nodes.set('profileKeyboardMode',{
  dataset:{},textContent:'',
  setAttribute(name,value) { this[name] = value; },
});
const $ = id => nodes.get(id);
const modeSource = script.match(/  function setUnlockKeyboardMode\(useLetters=false,focusInput=false\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(modeSource,'Keyboard mode helper missing');
const setMode = runInNewContext('(' + modeSource.trim() + ')',{ $ });
setMode(false);
assert.equal(input.inputmode,'numeric');
assert.equal(nodes.get('profileKeyboardMode').dataset.keyboard,'numeric');
assert.equal(input.focusCalls,0);
setMode(true,true);
assert.equal(input.inputmode,'text');
assert.equal(nodes.get('profileKeyboardMode').dataset.keyboard,'letters');
assert.equal(nodes.get('profileKeyboardMode')['aria-pressed'],'true');
assert.equal(input.focusCalls,1,'A troca manual deve focar o campo nativo');
setMode(false);
assert.equal(input.inputmode,'numeric');
assert.equal(input.value,'PIN-PRESERVADO','Alternar teclado não modifica credenciais');
assert.match(script,/setUnlockKeyboardMode\(false\);\s*\$\('profileUnlockPassword'\)\.type/,
  'Trocar de perfil deve voltar ao modo PIN sem abrir outro histórico');
console.log('PIN iPhone: teclado nativo numérico, modo alfanumérico e senha preservada OK');
