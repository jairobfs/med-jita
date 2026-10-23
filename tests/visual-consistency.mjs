import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const html = read('../source/index.html');
const motion = read('../source/jita-motion.css');
const visual = read('../source/brand-evolution.css');
const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
const tokenBlocks = [...style.matchAll(/:root((?:\[[^\]]+\])*)\s*\{([^}]+)\}/g)];

function tokens(palette,dark) {
  const values={};
  for(const [,selector,body] of tokenBlocks) {
    const matchPalette=selector.match(/\[data-palette=([^\]]+)\]/)?.[1];
    const matchTheme=selector.match(/\[data-theme=([^\]]+)\]/)?.[1];
    if(matchPalette && matchPalette!==palette) continue;
    if(matchTheme && matchTheme!==(dark?'dark':'light')) continue;
    for(const [,name,value] of body.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6})\b/g)) values[name]=value;
  }
  return values;
}
const luminance=hex=>[1,3,5]
  .map(index=>parseInt(hex.slice(index,index+2),16)/255)
  .map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
  .reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
function contrast(a,b) {
  assert.ok(a&&b,'Ambas as cores de contraste devem existir');
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

for(const palette of ['aurora','mineral','figo','integrado']) {
  for(const dark of [false,true]) {
    const color=tokens(palette,dark);
    for(const token of ['ink','secondary','quiet','brand']) {
      const ratio=contrast(color[token],color.card);
      assert.ok(ratio>=4.5,`${palette} ${dark?'dark':'light'} ${token}: contraste ${ratio.toFixed(2)}:1`);
    }
    for(const token of ['cover-a','cover-b']) {
      assert.ok(contrast(color[token],'#FFFFFF')>=4.5,`${palette} ${token} não sustenta texto branco`);
    }
  }
}
assert.match(motion,/var\(--cover-glow\)/,'Cena deve acompanhar a paleta');
assert.match(motion,/var\(--cover-a\)/,'Gradiente deve acompanhar a paleta');
assert.match(motion,/\.jita-optical-center\{[^}]*transform:none/,'Mascote deve estar centrado');
assert.match(motion,/@media\(min-width:741px\)\{\s*\.gateway-intro \.profile-gateway-mark\{[^}]*align-self:center;margin-inline:auto/,
  'No login desktop o selo do Jita deve ficar no eixo central de seu painel');
assert.match(visual,/\.profile-unlock-back,\.profile-password-reveal\{color:var\(--brand\)/,
  'Ações da senha devem ter cor contrastante');
assert.match(html,/const orbiting=document\.documentElement\.dataset\.paletteOrbit==='on'/,
  'Mudança de tema deve detectar ciclo ativo');
assert.match(html,/orbiting&&!options\.resetPalette&&validPalettes\.includes\(currentPalette\)\?currentPalette:savedPalette/,
  'Redesenho de tema não deve reiniciar paleta animada');
assert.match(html,/state\.palette=el\.dataset\.paletteChoice;theme\(\{resetPalette:true\}\)/,
  'Escolha explícita da paleta deve prevalecer');
console.log('Auditoria visual MED JITA: 8 paletas/temas, contraste, personagem e ciclo cromático OK');
