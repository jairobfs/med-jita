import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const template = await readFile(join(root, 'worker/runtime.js'), 'utf8');
const rootFiles = [
  'index.html', 'atelier.html', 'brand-evolution.css', 'jita-motion.css', 'sw.js', 'manifest.webmanifest', 'JITA_vetorial.svg',
  'favicon.png', 'apple-touch-icon.png',
];
const images = [
  'assets/med-jita-logo.svg', 'assets/med-jita-brand-v11.svg', 'assets/med-jita-app-icon.svg',
  'assets/completa-organic.svg', 'assets/completa-organic-inversa.svg',
  'assets/wordmark-organic.svg', 'assets/j-cartola.svg', 'assets/jita-cartola-avatar.svg',
  'assets/icon-ajustes.svg', 'assets/icon-ajustes-inverso.svg',
  'assets/icon-exportar.svg', 'assets/icon-exportar-inverso.svg',
  'assets/icon-salvar.svg', 'assets/icon-salvar-inverso.svg',
  'assets/estigma-atlas-principal.svg', 'assets/estigma-atlas-esquina.svg',
  'assets/estigma-atlas-elaces.svg', 'assets/integrado-oficial-2026.png',
];
const iconNamesV11 = [
  'calcular', 'media', 'peso', 'simular', 'meta', 'historico', 'comparar', 'salvar',
  'progresso', 'alerta', 'ajuda', 'ajustes', 'refazer', 'exportar', 'tema', 'integrar',
];
const functionalIconsV11 = ['cor', 'inverso'].flatMap(variant =>
  iconNamesV11.map(name => `assets/jita-v11/${variant}/${name}.svg`));
const icons = [
  'icon-192.png', 'icon-512.png',
  'jita-corpo.svg', 'jita-rosto.svg', 'jita-rc.svg',
  'jita-morfo.svg', 'jita-anatomia.svg', 'jita-tutoria.svg',
  'jita-simulacoes.svg', 'jita-history.svg', 'jita-face.svg',
  'jita-tut.svg', 'jita-sim.svg', 'jita-anato.svg',
];
const files = [
  ...rootFiles, ...images, ...functionalIconsV11, ...icons.map(name => `icons/${name}`),
  'integrations/sync-ui.js', 'integrations/profiles-ui.js', 'integrations/editorial-live.js',
  'integrations/uc-engine.js', 'integrations/brand-v08.js', 'integrations/jita-motion.js',
  'integrations/gateway-motion.js', 'integrations/palette-orbit.js',
];
const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const assets = {};
for (const path of files) {
  const contents = await readFile(join(root, 'source', path));
  assets['/' + path] = {
    mime: mimeByExt[extname(path)] || 'application/octet-stream',
    base64: contents.toString('base64'),
  };
}
if (!template.includes('__MED_JITA_ASSET_TABLE__')) throw Error('Worker asset marker is missing.');
await writeFile(join(root, 'worker/index.js'),
  template.replace('__MED_JITA_ASSET_TABLE__', JSON.stringify(assets)));
console.log(`Bundled ${files.length} MED JITA assets into the server Worker.`);
