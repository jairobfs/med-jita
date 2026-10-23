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
assert.match(html, /id="profilePinPad"[^>]*role="group"/);
const keys = [...html.matchAll(/data-pin-key="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(keys, ['1','2','3','4','5','6','7','8','9','erase','0','enter']);
assert.match(css, /\.profile-pin-pad\[hidden\]\{display:none!important\}/);
assert.match(css, /prefers-reduced-motion:reduce/);

const nodes = new Map();
const input = {
  value:'',selectionStart:0,selectionEnd:0,placeholder:'',focusCalls:0,events:[],
  setAttribute(name,value) { this[name] = value; },
  focus() { this.focusCalls++; },
  setRangeText(text,start,end) {
    this.value = this.value.slice(0,start) + text + this.value.slice(end);
    this.selectionStart = this.selectionEnd = start + text.length;
  },
  dispatchEvent(event) { this.events.push(event.type); },
};
nodes.set('profileUnlockPassword',input);
nodes.set('profilePinPad',{hidden:false});
nodes.set('profileKeyboardMode',{
  textContent:'',setAttribute(name,value) { this[name] = value; },
});
const $ = id => nodes.get(id);
const modeSource = script.match(/  function setUnlockKeyboardMode\(useLetters=false,focusInput=false\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(modeSource,'Keyboard mode function missing');
const setMode = runInNewContext('(' + modeSource.trim() + ')',{ $ });
setMode(false);
assert.equal(input.inputmode,'numeric');
assert.equal(nodes.get('profilePinPad').hidden,false);
setMode(true,true);
assert.equal(input.inputmode,'text');
assert.equal(nodes.get('profilePinPad').hidden,true);
assert.equal(nodes.get('profileKeyboardMode')['aria-pressed'],'true');
assert.equal(input.focusCalls,1);
setMode(false);
assert.equal(input.inputmode,'numeric');
assert.equal(nodes.get('profilePinPad').hidden,false);

const handlerSource = script.match(/  \$\('profilePinPad'\)\.addEventListener\('click',event => \{([\s\S]*?)\n  \}\);/)?.[1];
assert.ok(handlerSource,'Touch keyboard listener missing');
let submits = 0;
const onTap = runInNewContext('(event => {' + handlerSource + '\n})',{
  $, Event: class { constructor(type) { this.type = type; } },
  unlockCandidate() { submits++; },
});
const tap = key => {
  const button = { dataset: { pinKey:key } };
  onTap({ target:{ closest() { return button; } },
    currentTarget:{ contains(value) { return value === button; } } });
};
tap('1'); tap('2'); tap('3'); tap('erase'); tap('4');
assert.equal(input.value,'124','Digits and erase must work on a masked input');
assert.equal(input.focusCalls,1,'Tapping the pad must not force native keyboard open');
assert.equal(input.events.length,5,'PIN edits must emit input events');
tap('enter');
assert.equal(submits,1);
assert.equal(input.value,'124','Submitting must not mutate the PIN');
assert.match(script,/setUnlockKeyboardMode\(false\);\s*\$\('profileUnlockPassword'\)\.type/,'Profile switch must reset PIN mode');
console.log('Mobile PIN: numeric iPhone keyboard, touch pad and alphanumeric fallback OK');
