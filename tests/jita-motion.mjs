import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../source/integrations/jita-motion.js',import.meta.url),'utf8');
const css = readFileSync(new URL('../source/jita-motion.css',import.meta.url),'utf8');
const html = readFileSync(new URL('../source/index.html',import.meta.url),'utf8');
assert.match(css,/\.jita-motion-core svg[^{}]*\{[^{}]*animation:jita-float 5s/, 'O movimento original do Jita deve ser preservado');
assert.doesNotMatch(css,/jita-upright-breathe|jita-tap-pop/, 'A animação substituta não pode disputar movimento com o Jita');
assert.doesNotMatch(css,/rotate[XY]\(/, 'O sensor não pode torcer ou inclinar o personagem');
assert.match(css,/\.gateway-intro\{[^{}]*animation:jita-gradient-drift/s, 'A recepção deve ter degradê animado');
assert.match(css,/\.jita-cover\{[^{}]*animation:jita-gradient-drift/s, 'O painel deve ter degradê animado');
assert.match(html,/@keyframes jita-float\{0%,100%\{transform:translateY\(0\) rotate\(-2deg\)\}50%\{transform:translateY\(-9px\) rotate\(1deg\)\}/, 'O balanço original aprovado deve permanecer intacto');
const callbacks = new Map(), raf = [];
let permissionRequests = 0;
const media = { matches:false, addEventListener(name,callback) { callbacks.set('media:'+name,callback); } };
function scene(role='') {
  const listeners = new Map(), styles = new Map(), classes = new Set();
  return {
    listeners,styles,children:[],offsetWidth:100,
    style:{ setProperty(key,value) { styles.set(key,value); } },
    classList:{ add(key) { classes.add(key); }, remove(key) { classes.delete(key); }, contains(key) { return classes.has(key); } },
    getAttribute(key) { return key==='role'?role:null; },
    getBoundingClientRect() { return {left:0,top:0,width:200,height:200}; },
    addEventListener(name,callback) { listeners.set(name,callback); },
    appendChild(child) { this.children.push(child); },
    click() { listeners.get('click')(); },
  };
}
const gateway=scene(), cover=scene('button');
const instruction={ textContent:'',dataset:{} };
const toggle={ hidden:true, textContent:'Ativar movimento', listeners:new Map(), attrs:new Map(),
  addEventListener(name,callback){this.listeners.set(name,callback);},
  setAttribute(name,value){this.attrs.set(name,value);} };
const context={
  window:{
    matchMedia:query=>query.includes('pointer: coarse')?{matches:true}:media,
    DeviceOrientationEvent:{ requestPermission:async () => { permissionRequests++; return 'granted'; } },
    addEventListener(name,callback) { callbacks.set(name,callback); },
    removeEventListener(name) { callbacks.delete(name); },
    requestAnimationFrame(callback) { raf.push(callback); return raf.length; },
    setTimeout:()=>1,clearTimeout(){},
  },
  document:{
    querySelectorAll:()=>[gateway,cover],
    getElementById:id=>id==='gatewayMotionToggle'?toggle:instruction,
    createElement:()=>({
      className:'',style:{setProperty(){}},setAttribute(){},remove(){},
    }),
  },
};
vm.runInNewContext(code,context);
assert.equal(permissionRequests,0,'Orientation permission should never be asked at load');
assert.equal(toggle.hidden,false,'The mobile-only orientation toggle should be available');
gateway.listeners.get('pointermove')({clientX:190,clientY:10});
assert.ok(parseFloat(gateway.styles.get('--scene-halo-x'))>0,'Pointer tracking should move the light behind Jita');
assert.equal(gateway.styles.has('--jita-x'),false,'Pointer tracking must not move the mascot itself');
gateway.listeners.get('pointerleave')();
assert.equal(gateway.styles.get('--scene-halo-x'),'0.00px','Pointer exit should re-center the glow');
gateway.click();
for(let i=0;i<5;i++)await Promise.resolve();
assert.equal(permissionRequests,0,'Mascot tap should celebrate without requesting sensor permission');
assert.equal(gateway.children.length,12,'Click should trigger a twelve-particle light celebration');
toggle.listeners.get('click')();
for(let i=0;i<5;i++)await Promise.resolve();
assert.equal(permissionRequests,1,'Only the explicit user sensor toggle can request permission');
assert.equal(instruction.dataset.state,'active');
callbacks.get('deviceorientation')({gamma:0,beta:0});
callbacks.get('deviceorientation')({gamma:20,beta:15});
while(raf.length)raf.shift()();
assert.ok(parseFloat(cover.styles.get('--scene-halo-x'))>0,'Mobile tilt should move the dashboard glow');
assert.equal(cover.styles.has('--jita-x'),false,'Mobile tilt must not tilt the mascot');
let prevented=false;
cover.listeners.get('keydown')({key:' ',preventDefault(){ prevented=true; }});
assert.equal(prevented,true,'Keyboard activation should be supported');
assert.equal(cover.children.length,12,'Keyboard activation should also celebrate');
toggle.listeners.get('click')();
assert.equal(toggle.attrs.get('aria-pressed'),'false','The user can switch off phone motion');
media.matches=true;
callbacks.get('media:change')({matches:true});
assert.equal(cover.styles.get('--scene-halo-x'),'0.00px','Reduced motion should center the light');
console.log('Jita Vivo: original float, moving gradients, glow, pointer, click, keyboard, sensor and reduced motion OK');
