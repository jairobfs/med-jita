import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../source/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../source/integrations/profiles-ui.js', import.meta.url), 'utf8');

assert.match(html, /<input id="profileUnlockPassword"[^>]*type="password"[^>]*inputmode="numeric"/,
  'A entrada do PIN deve pedir teclado numérico no iPhone.');
assert.match(html, /id="profileKeyboardMode"[^>]*type="button"/,
  'Senhas legadas com letras precisam continuar acessíveis.');
assert.match(script, /function setPinKeyboard\(numeric,refocus=false\)/);
assert.match(script, /input\.inputMode = numeric \? 'numeric' : 'text'/,
  'A troca de teclado deve alterar o modo de entrada, não o valor digitado.');
assert.match(script, /setPinKeyboard\(true\)/,
  'Cada seleção de perfil deve voltar ao teclado numérico.');
assert.match(script, /const likelyProtected = !!profile\.passwordRequired;/,
  'O catálogo deve identificar a etapa de PIN no toque.');
assert.match(script, /passwordStage\(likelyProtected, likelyProtected \? profile : null\)/,
  'O campo protegido deve ficar visível antes da consulta assíncrona.');
const tapStart=script.indexOf('function chooseProfile(profile)');
const tapEnd=script.indexOf('function renderProfiles(profiles)');
assert.ok(tapStart !== -1 && tapEnd > tapStart);
const tap=script.slice(tapStart,tapEnd);
assert.ok(tap.indexOf("$('profileUnlockPassword').focus({ preventScroll:true })") <
  tap.indexOf('void openCandidate(profile,sequence)'),
  'A abertura do teclado deve ocorrer sincronamente no clique do avatar.');
assert.match(script, /profileKeyboardMode'\)\.addEventListener\('click'/);
assert.match(script, /input\.blur\?\.\(\); input\.focus\?\.\(\)/,
  'O iPhone deve atualizar o teclado ao alternar de modo.');
console.log('MED JITA PIN: teclado numérico padrão e fallback alfanumérico preservado.');
