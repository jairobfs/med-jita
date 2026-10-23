import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../source/index.html');
const sw = read('../source/sw.js');
const runtime = read('../worker/runtime.js');
const identityCss = read('../source/brand-evolution.css');
const jitaMotionCss = read('../source/jita-motion.css');
const inverseLogo = read('../source/assets/completa-organic-inversa.svg');
const logoAdapter = read('../source/integrations/brand-v08.js');
const profileUI = read('../source/integrations/profiles-ui.js');

const cache = /const CACHE_NAME = 'med-jita-v(\d+)-\d+';/.exec(sw);
assert.ok(cache,'Service worker cache must have an explicit release number');
const expected = cache[1];
for (const name of ['sync-ui','profiles-ui','editorial-live','brand-v08','uc-engine','jita-motion','gateway-motion','palette-orbit']) {
  assert.ok(html.includes(`./integrations/${name}.js?v=${expected}`),
    `Script ${name} must carry the same version as the cache`);
}
assert.match(sw,/fetch\(request, \{ cache: 'no-store' \}\)/,
  'The worker must try the latest script before falling back to an offline copy');
assert.doesNotMatch(sw,/const cached = await caches\.match\(request\);\s*if \(cached\) return cached;/,
  'Cache-first script loading can mix incompatible releases');
assert.match(runtime,/Cache-Control.*asset\.mime\.startsWith\('text\/html'\)/s,
  'Runtime must explicitly control HTML caching');
assert.match(runtime,/asset\.mime\.includes\('javascript'\)/,
  'Runtime must avoid stale JavaScript on a new deployment');
assert.ok(html.includes(`./brand-evolution.css?v=${expected}`),
  'The evolved visual identity must be versioned with the release');
assert.ok(sw.includes("'./brand-evolution.css'"),
  'The design layer must remain available in the offline asset set');
assert.match(html,/class="gateway-intro"/,
  'The newer four-profile chooser must retain its own branded entrance layout');
assert.match(html,/id="gatewayMotionToggle"[^>]*hidden/,
  'Device tilt needs explicit consent rather than automatic sensor access');
assert.match(html,/id="profileUnlockName"/,
  'The optional password step must identify the person whose history it unlocks');
assert.match(html,/id="gatewayInstallApp"/,
  'Users should be able to install the app before choosing a profile');
assert.match(html,/gatewayInstallApp'\)\.addEventListener\('click',requestInstall\)/,
  'Install from the entry screen must use the existing native install flow');
assert.match(html,/id="paletteOrbitControls"/,
  'Users need a visible pause control for prolonged color motion');
assert.match(identityCss,/@property --brand\{/,
  'The changing palettes should interpolate registered color tokens');
assert.match(identityCss,/prefers-reduced-motion:reduce/,
  'Reduced-motion preferences must remain respected');
assert.match(jitaMotionCss,/\.jita-motion-core svg\{[^}]*animation:jita-float 5s/,
  'The mascot must retain its single approved floating animation');
assert.match(jitaMotionCss,/\.gateway-intro \.profile-gateway-mark\.jita-reactive\{transform:none/,
  'The gateway mascot must remain optically centered without being tilted');
assert.match(identityCss,/\.gateway-selection \.profile-choice\[aria-pressed=true\]/,
  'Choosing a profile must give obvious visual confirmation');
assert.match(jitaMotionCss,/@keyframes jita-gradient-drift/,
  'The color system must gently move its ambient gradient independently');
assert.ok(sw.includes("'./integrations/palette-orbit.js'") && sw.includes("'./integrations/gateway-motion.js'"),
  'The new motion behaviors must work offline');
assert.doesNotMatch(html,/navigator\.share\(/,
  'The generic Web Share sheet must not masquerade as Safari Add to Home Screen');
assert.match(html,/id="installShare"[^>]*role="note"/,
  'The Safari sharing icon must be informational, not a nonfunctional install button');
assert.match(html,/id="installSteps"/,
  'iPhone visitors must see explicit Safari Add to Home Screen steps');
assert.match(html,/if\(deferredInstall\).*?event\.prompt\(\)/s,
  'Browsers that offer a real install prompt should retain it');
assert.match(html,/id="installCopy"/, 'Embedded browsers need a copy-to-Safari alternative');
assert.match(html,/appStandalone\(\)/, 'Installed iOS web apps should not show install actions');
assert.match(identityCss,/\.jita-cover\{/,
  'The main calculator must retain its Jita brand hero');
assert.doesNotMatch(inverseLogo,/<rect[^>]+fill="#151426"/,
  'Inverse lettering must preserve a truly transparent SVG background');
assert.match(logoAdapter,/closest\('\.wordmark, \.jita-cover'\)/,
  'The dark navigation and the dark hero require the legible inverse logo');
assert.ok(sw.includes("'./assets/jita-cartola-avatar.svg'"),
  'The original Jita hat is included in offline assets');
assert.match(html,/jita-cartola-avatar\.svg/,
  'The personal initials use the original vector hat');
assert.match(html,/id="headerProfileMark"[^>]*data-personal-mark[^>]*data-neutral="true"/,
  'The navigation logo must start neutral before profile selection');
assert.match(html,/id="settingsProfileMark"[^>]*data-personal-mark/,
  'The settings logo must also follow the selected person');
assert.match(profileUI,/function refreshPersonalMarks\(profile=active\)/,
  'Profile marks must derive from the active person, not a fixed J');
assert.match(profileUI,/mark\.textContent = letter/,
  'Personal monograms must change their letter after profile changes');
assert.match(profileUI,/document\.body\.classList\.remove\('account-mode'\);\s*refreshPersonalMarks\(\)/,
  'Leaving a profile must restore a neutral logo');
assert.doesNotMatch(html,/\.location:before\{[^}]*j-cartola\.svg/,
  'A fixed J-with-hat must not be used in the navigation');
assert.match(profileUI,/\['jita-classico','Jita original','\.\/JITA_vetorial\.svg'\]/,
  'The curated profile bank must show the original Jita, not feature shortcuts');
assert.match(profileUI,/const LEGACY_PRESETS = \['ajuda'/,
  'Explicitly chosen older avatars must remain readable after the redesign');
assert.doesNotMatch(profileUI,/if\s*\(returning\)\s*chooseProfile\(/,
  'A remembered profile must not bypass the explicit person chooser');
assert.match(profileUI,/opened\.id !== profile\.id/,
  'The server must not be able to bind a history belonging to a different selected person');
assert.match(html,/kind:x\.kind==='points'\?'points':'score'/,
  'User-defined assessments must preserve points-vs-score interpretation across reloads');
assert.match(profileUI,/LEGACY_PRESETS\.includes\(avatar\.id\)\) return \{ kind:'default' \}/,
  'Legacy feature icons must render as personal initials without rewriting saved avatars');

assert.ok(!html.includes('id="profileAccessCode"'),
  'A mandatory access code must not return to the simple four-profile chooser');
assert.ok(html.includes('id="profilePasswordSection"'),
  'The optional history-password step must remain available');
assert.match(html,/Seus dados · espaço pessoal/,
  'History must not claim the user has no personal account');
assert.doesNotMatch(html,/Seus dados · sem conta|versão\(ões\) nomeada\(s\) neste aparelho/,
  'Account-backed history must not present itself as device-only');
assert.match(html,/renderBanner\(\)\{d\('guideBanner'\)\.hidden=hasGrades\(\)\|\|active!=='home';\}/,
  'The first-use hint should only appear on the home screen');
assert.match(html,/function switchPage\(page\).*?renderBanner\(\)/,
  'Navigation must recompute whether the first-use hint is visible');
for (const [index, match] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()) {
  if (match[1].trim()) assert.doesNotThrow(() => new Script(match[1]),
    `Inline application script ${index} must parse`);
}
console.log('Release gates: versioned assets, fresh scripts, personal history, simple profile, optional password and syntax OK');
