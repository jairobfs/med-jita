import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sw = read('../source/sw.js');
const html = read('../source/index.html');
assert.doesNotThrow(() => new Script(sw), 'Service worker must have valid JavaScript syntax');
assert.match(sw, /med-jita-v51-2026102302/, 'A new offline cache must replace the previous cache');

const precached = new Set([...sw.matchAll(/'(\.\/[^']+)'/g)].map(match => match[1]));
for (const entry of precached) {
  if (entry === './') continue;
  assert.ok(existsSync(new URL('../source/' + entry.slice(2), import.meta.url)),
    `Precached asset missing from source: ${entry}`);
}
const criticalAssets = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["'](\.\/[^"']+)["']/g)]
  .map(match => match[1].split('?')[0])
  .filter(path => /\.(?:css|js|webmanifest|png|svg)$/.test(path));
for (const path of new Set(criticalAssets)) {
  assert.ok(precached.has(path), `Page references asset absent from offline package: ${path}`);
}
assert.ok(precached.has('./jita-curricular.css'));
assert.ok(precached.has('./integrations/med-brand-system.js'));
assert.match(sw, /request\.method !== 'GET'/, 'Never cache POST/PATCH/DELETE');
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/, 'Never intercept profile, history or Craft APIs');

// Simulate an iPhone opening the curricular interface offline for the first time
// after install, when index.html refers to versioned URLs but only bare assets
// have been precached by cache.addAll().
const origin = 'https://med-jita.example';
const handlers = new Map();
const visited = [];
const cachedPayloads = new Map([
  ['/jita-curricular.css', '/* CSS AVAILABLE OFFLINE */'],
  ['/integrations/med-brand-system.js', '/* JITA JS AVAILABLE OFFLINE */'],
  ['/index.html', '<h1>MED JITA</h1>'],
]);
const offlineCache = {
  async addAll() {},
  async put() {},
  async match(request, options = {}) {
    const address = new URL(typeof request === 'string' ? request : request.url);
    visited.push({ pathname: address.pathname, ignoreSearch: options.ignoreSearch === true });
    const key = options.ignoreSearch ? address.pathname : address.pathname + address.search;
    const content = cachedPayloads.get(key);
    return content === undefined ? undefined : new Response(content, { status: 200 });
  },
};
runInNewContext(sw, {
  URL, Response,
  self: {
    registration: { scope: origin + '/' },
    location: { origin },
    addEventListener(type, handler) { handlers.set(type, handler); },
  },
  caches: { async open() { return offlineCache; } },
  fetch: async () => { throw new Error('Offline'); },
});
async function requestOffline(path) {
  let responsePromise;
  handlers.get('fetch')({
    request: { method: 'GET', url: origin + path, mode: 'cors' },
    respondWith(value) { responsePromise = Promise.resolve(value); },
  });
  assert.ok(responsePromise, `Service worker did not handle ${path}`);
  const response = await responsePromise;
  assert.equal(response.status, 200);
  return response.text();
}
assert.match(await requestOffline('/jita-curricular.css?v=52'), /CSS AVAILABLE OFFLINE/);
assert.match(await requestOffline('/integrations/med-brand-system.js?v=52'), /JITA JS AVAILABLE OFFLINE/);
assert.ok(visited.some(value => value.pathname === '/jita-curricular.css' && value.ignoreSearch));
assert.ok(visited.some(value => value.pathname === '/integrations/med-brand-system.js' && value.ignoreSearch));
console.log(`Offline JITA assets: ${precached.size} verified; versioned CSS/JS fallback passed.`);
