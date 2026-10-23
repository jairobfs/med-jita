import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../source/index.html');
const css=read('../source/mobile-editorial-v58.css');
const ui=read('../source/integrations/profiles-ui.js');
const canary=read('../worker/canary-entry.mjs');
const sw=read('../source/sw.js');
const built=read('../worker/index.js');

assert.match(html,/<button id="headerProfileMark"[^>]*aria-label="Trocar pessoa"[^>]*><\/button>/,
  'The mobile Jita profile badge must be an accessible button.');
assert.match(ui,/\$\('headerProfileMark'\)\?\.addEventListener\('click'/,
  'The profile badge must switch accounts on click.');
assert.match(css,/@media\s*\(max-width:760px\)[\s\S]*?\.profile-controls\s*\{\s*display:none\s*!important/,
  'Obstructing floating profile switch must disappear on mobile.');
assert.match(css,/\.profile-gateway-card::before[\s\S]*?completa-organic-inversa\.svg/,
  'The gateway must use the approved transparent inverse mark.');
assert.match(css,/\.jita-cover \.med-jita-logo-wrap[\s\S]*?background:transparent !important/,
  'The brand must have no pastel blocking rectangle on dark background.');
assert.match(canary,/<header class="topbar">/,
  'The demo notice must be inserted inside app flow below the header.');
assert.match(canary,/position:relative;/,
  'The demo notice must not be fixed over bottom navigation.');
assert.doesNotMatch(canary,/#jita-canary-notice\{position:fixed/,
  'Fixed test banner obscures iPhone bottom navigation.');
assert.match(canary,/jita-gateway-canary/,
  'Login needs non-obstructive demonstration disclaimer.');
assert.ok(html.includes('mobile-editorial-v58.css?v=59'));
assert.ok(sw.includes("'./mobile-editorial-v58.css'"));
assert.ok(built.includes('"/mobile-editorial-v58.css"'));
console.log('Mobile editorial V58: accessible profile switching, zero obstructing overlays, brand transparency, canary labels and offline assets OK.');
