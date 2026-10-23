/* MED JITA · Jita Vivo V32
 * Restore the approved jita-float movement. Sensor, pointer and tap manipulate
 * only independent lighting/gradient layers. Phone orientation requires consent.
 */
(() => {
  'use strict';
  const scenes = [...document.querySelectorAll('.jita-reactive')];
  if (!scenes.length) return;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const instruction = document.getElementById('jitaMotionInstruction');
  const toggle = document.getElementById('gatewayMotionToggle');
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  let sensorRequested = false;
  let sensorEnabled = false;
  let initialPose = null;
  let lastPose = { x:0, y:0 };
  let pendingFrame = 0;
  const activeTimers = new WeakMap();

  function say(message,state='info') {
    if (!instruction) return;
    instruction.textContent = message;
    instruction.dataset.state = state;
  }
  function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
  function setPose(scene,x,y) {
    scene.style.setProperty('--scene-halo-x',(x*8).toFixed(2)+'px');
    scene.style.setProperty('--scene-halo-y',(y*7).toFixed(2)+'px');
    scene.style.setProperty('--scene-light-x',(50+x*30).toFixed(1)+'%');
    scene.style.setProperty('--scene-light-y',(45+y*30).toFixed(1)+'%');
  }
  function updateAll() {
    pendingFrame = 0;
    if (prefersReduced?.matches) return;
    for (const scene of scenes) setPose(scene,lastPose.x,lastPose.y);
  }
  function onOrientation(event) {
    if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
    if (!initialPose) initialPose = { gamma:event.gamma, beta:event.beta };
    lastPose = {
      x:clamp((event.gamma-initialPose.gamma)/25,-1,1),
      y:clamp((event.beta-initialPose.beta)/25,-1,1),
    };
    if (!pendingFrame) pendingFrame = window.requestAnimationFrame(updateAll);
  }
  async function enableSensor() {
    if (sensorRequested || prefersReduced?.matches) return;
    sensorRequested = true;
    const Sensor = window.DeviceOrientationEvent;
    if (!Sensor) {
      sensorRequested = false;
      say('As luzes reagem ao toque e acompanham o cursor.');
      return;
    }
    try {
      if (typeof Sensor.requestPermission === 'function') {
        // iOS requires a direct user tap for this permission request.
        const permission = await Sensor.requestPermission();
        if (permission !== 'granted') throw Error('denied');
      }
      window.addEventListener('deviceorientation',onOrientation,{ passive:true });
      sensorEnabled = true;
      if (toggle) { toggle.setAttribute('aria-pressed','true'); toggle.textContent = 'Movimento ativo · desligar'; }
      say('Luzes ativadas · incline suavemente o celular','active');
    } catch {
      sensorRequested = false;
      if (toggle) { toggle.setAttribute('aria-pressed','false'); toggle.textContent = 'Permissão não concedida · tentar'; }
      say('Sensor não autorizado · os efeitos de toque continuam','denied');
    }
  }
  function disableSensor() {
    sensorEnabled = false;
    sensorRequested = false;
    initialPose = null;
    window.removeEventListener?.('deviceorientation',onOrientation);
    for (const scene of scenes) setPose(scene,0,0);
    if (toggle) { toggle.setAttribute('aria-pressed','false'); toggle.textContent = 'Ativar movimento'; }
    say('Movimento do celular desativado · Jita continua interativo.');
  }
  function burst(scene) {
    if (prefersReduced?.matches) return;
    const colors = ['#82E8D7','#F8C995','#EAC6FA','#BFD5FF','#FFFFFF'];
    for (let i=0;i<12;i++) {
      const particle = document.createElement('span');
      particle.className = 'jita-particle';
      particle.setAttribute('aria-hidden','true');
      const theta = (Math.PI*2*i/12)-Math.PI/2;
      const distance = 58+(i%3)*23;
      particle.style.setProperty('--spark-x',(Math.cos(theta)*distance).toFixed(1)+'px');
      particle.style.setProperty('--spark-y',(Math.sin(theta)*distance).toFixed(1)+'px');
      particle.style.setProperty('--spark-size',(5+(i%3)*2)+'px');
      particle.style.setProperty('--spark-color',colors[i%colors.length]);
      particle.style.setProperty('--spark-delay',(i%4)*24+'ms');
      particle.style.setProperty('--spark-duration',(780+(i%3)*110)+'ms');
      particle.style.setProperty('--spark-radius',i%3===0?'3px':'50%');
      scene.appendChild(particle);
      window.setTimeout(() => particle.remove(),1150);
    }
  }
  function celebrate(scene) {
    const previous = activeTimers.get(scene);
    if (previous) window.clearTimeout(previous);
    scene.classList.remove('is-celebrating');
    // Repeated taps restart the glow/particles, never the Jita's original float.
    void scene.offsetWidth;
    scene.classList.add('is-celebrating');
    burst(scene);
    activeTimers.set(scene,window.setTimeout(() => scene.classList.remove('is-celebrating'),1050));
  }
  if (toggle && coarse && window.DeviceOrientationEvent && !prefersReduced?.matches) {
    toggle.hidden = false;
    toggle.addEventListener('click',() => { if (sensorEnabled) disableSensor(); else void enableSensor(); });
  }
  for (const scene of scenes) {
    scene.addEventListener('pointermove',event => {
      if (prefersReduced?.matches || sensorEnabled) return;
      const rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = clamp(((event.clientX-rect.left)/rect.width-.5)*2,-1,1);
      const y = clamp(((event.clientY-rect.top)/rect.height-.5)*2,-1,1);
      setPose(scene,x,y);
    },{ passive:true });
    scene.addEventListener('pointerleave',() => {
      if (!sensorEnabled) setPose(scene,0,0);
    });
    scene.addEventListener('click',() => celebrate(scene));
    if (scene.getAttribute('role') === 'button') {
      scene.addEventListener('keydown',event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        scene.click();
      });
    }
  }
  prefersReduced?.addEventListener?.('change',event => {
    if (event.matches) {
      if (sensorEnabled) disableSensor();
      if (toggle) toggle.hidden = true;
      for (const scene of scenes) setPose(scene,0,0);
      say('Movimento reduzido · Jita continua interativo.');
    } else if (toggle && coarse && window.DeviceOrientationEvent) toggle.hidden = false;
  });
})();
