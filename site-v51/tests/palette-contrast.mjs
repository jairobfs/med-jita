import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const html = read('../source/index.html');
const evolution = read('../source/brand-evolution.css');
const motion = read('../source/jita-motion.css');
const identity = html.split('/* JITA / NOVA IDENTIDADE VISUAL')[1]?.split('body{background:')[0];
assert.ok(identity,'A paleta de identidade deve permanecer identificável');

const rules = [...identity.matchAll(/:root((?:\[[^\]]+\])*)\s*\{([^{}]+)\}/g)].map(([,selector,body]) => ({
  selector,
  tokens:Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(([,key,value]) => [key,value])),
}));

function palette(name,mode) {
  const tokens = {};
  for (const {selector,tokens:values} of rules) {
    const target = /\[data-palette=([^\]]+)\]/.exec(selector)?.[1];
    const dark = selector.includes('[data-theme=dark]');
    if ((!target || target===name) && (!dark || mode==='dark')) Object.assign(tokens,values);
  }
  return tokens;
}
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(item => parseInt(item,16)/255)
    .map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
}
function contrast(first,second) {
  const a=luminance(first), b=luminance(second);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

for (const name of ['aurora','mineral','figo','integrado']) {
  for (const mode of ['light','dark']) {
    const t = palette(name,mode);
    const foreground = mode==='dark' ? '#17172E' : '#FFFFFF';
    const pairs = [
      ['texto/cartão',t.ink,t.card],
      ['secundário/cartão',t.secondary,t.card],
      ['discreto/fundo',t.quiet,t.bg],
      ['discreto/cartão suave',t.quiet,t['card-soft']],
      ['marca/cartão',t.brand,t.card],
      ['texto/botão primário',foreground,t.brand],
      ['menu',t.navInk,t.nav],
      ['texto/capa escura A','#FFFFFF',t['cover-a']],
      ['texto/capa escura B','#FFFFFF',t['cover-b']],
    ];
    for (const [label,first,second] of pairs) {
      assert.ok(first && second,`${name}/${mode}: cor indefinida em ${label}`);
      assert.ok(contrast(first,second)>=4.5,`${name}/${mode}: contraste insuficiente em ${label}: ${contrast(first,second).toFixed(2)}:1`);
    }
  }
}
assert.match(evolution,/html\[data-palette-orbit=on\][\s\S]*?transition:--bg 18s/,
  'A alternância gradual de paletas deve permanecer ativa');
assert.match(motion,/\.jita-cover\{[\s\S]*?var\(--cover-a\)/,
  'A capa do Jita deve acompanhar a paleta ativa');
assert.match(motion,/\.gateway-intro\{[\s\S]*?var\(--cover-a\)/,
  'O fundo da recepção deve acompanhar a paleta ativa');
assert.match(motion,/\.profile-gateway\{[\s\S]*?var\(--brand\)/,
  'A aura da recepção deve acompanhar a paleta ativa');
assert.match(evolution,/\.gateway-selection \.profile-choice\[data-protected=true\] small\{color:var\(--brand\)/,
  'Rótulos de senha devem usar a cor de texto com contraste verificado');
console.log('MED JITA: 4 paletas × 2 modos, 72 pares de contraste de texto e cenários dinâmicos OK');
