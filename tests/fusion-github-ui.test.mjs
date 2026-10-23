import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';

const load = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const html = load('independente.html');
const sw = load('sw.js');

test('scripts embutidos da entrada compilam', () => {
 const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
   .map(m => m[1]).filter(Boolean);
 assert.ok(scripts.length > 0);
 scripts.forEach(source => assert.doesNotThrow(() => new vm.Script(source)));
});

test('componente de fusão pertence ao app existente', () => {
 assert.match(html, /id="mergeDialog"/);
 assert.match(html, /id="openMerge"/);
 assert.match(html, /prepareMigration/);
 assert.match(html, /current!==mergeStaged\.profile/);
 assert.match(html, /Nenhuma nota foi substituída/);
});

test('login descarta respostas antigas ao trocar o perfil', () => {
 assert.match(html, /loginAttempt\+\+;[^}]*selected=id/);
 assert.match(html, /const attempt=\+\+loginAttempt,id=selected/);
 assert.match(html, /if\(attempt!==loginAttempt\|\|selected!==id\)return/);
 assert.match(html, /loginAttempt\+\+;clearTimeout\(timer\)/);
 assert.match(html, /await pull\(id,attempt\)/);
 assert.match(html, /expectedLoginAttempt!==loginAttempt/);
 assert.match(html, /inputmode="numeric"/);
 assert.doesNotMatch(html, /jita-pin-pad/);
});

test('recursos de migração fazem parte do cache offline', () => {
 assert.match(sw, /integrations\/fusion-archive\.mjs/);
 const block = sw.match(/const OFFLINE_FILES\s*=\s*\[([\s\S]*?)\]/)?.[1];
 assert.ok(block);
 const files = [...block.matchAll(/['"]\.\/([^'"]+)['"]/g)].map(m=>m[1]);
 for(const file of files){
  assert.ok(existsSync(new URL('../'+file,import.meta.url)), 'Recurso ausente: '+file);
 }
});

test('UI não depende de servidor da Vercel', () => {
 assert.doesNotMatch(html, /https:\/\/[^\s"'<>]*\.vercel\.app/i);
});
