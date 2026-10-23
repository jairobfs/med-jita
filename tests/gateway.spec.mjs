import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../independente.html", import.meta.url), "utf8");
const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "A entrada independente deve ter seu script principal.");
new Script(script, { filename: "independente-inline.js" });

for (const id of ["pin", "pinConfirm"]) {
  assert.match(html, new RegExp('id="' + id + '"[^>]*type="password"[^>]*inputmode="numeric"'), "PIN seguro com teclado numérico: " + id);
}
for (const id of ["pinPad", "installGate", "installBar", "installGuide", "copyHome", "calculator", "avatars"]) {
  assert.ok(html.includes('id="' + id + '"'), "Controle obrigatório: " + id);
}
assert.match(html, /"1","2","3","4","5","6","7","8","9","erase","0","ok"/);
assert.match(html, /new URL\("\.\/",location\.href\)\.href/, "O link de instalação deve apontar à entrada principal.");
assert.match(html, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
assert.match(html, /@media\(prefers-color-scheme:dark\)/);
assert.match(html, /prefers-reduced-motion:reduce/);

assert.equal(manifest.start_url, "./", "O aplicativo instalado deve abrir o seletor de perfis.");
assert.equal(manifest.scope, "./");
assert.match(worker, /med-jita-github-v18-20261023/);
assert.match(worker, /'\.\/index\.html'/);
assert.match(worker, /'\.\/calculadora\.html'/);

// Uma URL Craft configurada não deve ocultar a confirmação de um PIN ainda não criado.
assert.match(script, /const fresh=!get\(k\(id,"pin"\)\)/);
assert.doesNotMatch(script, /const fresh=!url\(\)&&!get\(k\(id,"pin"\)\)/);
assert.match(script, /if\(!expected\)\{if\(pin!==\$\("pinConfirm"\)\.value\)/);

for (const name of ["jita_autonomo_v1_", "med_jita_state_v3", "med_jita_history_v1"]) {
  assert.ok(script.includes(name), "A correção não pode mudar os dados locais: " + name);
}
for (const name of ["jbfs", "barba", "tay", "igu"]) {
  assert.ok(script.includes('"' + name + '"'), "Perfil preservado: " + name);
}
console.log("Gateway V18: sintaxe, PIN, instalação, cache e contratos de dados aprovados.");
