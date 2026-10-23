import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const html = read("independente.html");
const overlay = read("gateway-enhance.js");
const css = read("gateway-enhance.css");
const sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));
const originalScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(originalScript, "O código do login deve permanecer.");
new Script(originalScript, { filename: "login-original.js" });
new Script(overlay, { filename: "gateway-enhance.js" });

assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
assert.match(html, /<link rel="stylesheet" href="\.\/gateway-enhance\.css">/);
assert.match(html, /<script src="\.\/gateway-enhance\.js"><\/script>/);
// O login atual usa o teclado nativo do iOS (sem pad paralelo que cobre os campos).
assert.match(html, /<input id="pin" type="password" inputmode="numeric"/);
assert.match(html, /<input id="pinConfirm" type="password" inputmode="numeric"/);
assert.match(overlay, /pin\.setAttribute\("inputmode", "numeric"\)/);
assert.match(overlay, /confirm\.setAttribute\("inputmode", "numeric"\)/);
assert.doesNotMatch(overlay, /jita-pin-pad/, "Não recriar teclado paralelo por engano");
assert.match(overlay, /new URL\("\.\/", window\.location\.href\)\.href/);
assert.match(overlay, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
assert.match(css, /prefers-color-scheme:dark/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(sw, /const CACHE_NAME = 'med-jita-github-[^']+'/);
assert.ok(sw.includes("'./assets/jita-cartola-avatar.svg'"), 'Cartola original disponível offline');
for (const asset of ["gateway-enhance.js", "gateway-enhance.css"]) {
  assert.ok(sw.includes("'./" + asset + "'"), "Recurso precache: " + asset);
}
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
// A camada externa nunca lê/escreve as notas nem o código do Craft.
for (const forbidden of ["jita_autonomo_v1_", "med_jita_state_v3", "med_jita_history_v1", "collections/", "localStorage"]) {
  assert.ok(!overlay.includes(forbidden), "Camada visual deve ser independente: " + forbidden);
}
// A autenticação mais recente é preservada no código principal.
assert.match(originalScript, /const row=await remoteRow\(id\),central=String\(prop\(row,"pin"\)/);
assert.match(originalScript, /if\(pin!==central(?:&&cached!==hash)?\)throw Error\("PIN incorreto no Craft\."\)/);
for (const name of ["jbfs", "barba", "tay", "igu"]) {
  assert.ok(originalScript.includes('"' + name + '"'), "Perfil: " + name);
}
console.log("Overlay V19: sintaxe, recursos, PIN Craft e isolamento de dados aprovados.");
