import assert from 'node:assert/strict';

const backup = (score, profile = undefined) => ({
  version: 3, format: 'med-jita-backup',
  ...(profile ? { profile } : {}),
  data: { version: 3, cab: { hits: String(score), total: '27' } },
  history: [{ id: 'history1', name: 'Antes', data: { score } }],
});

const handlers = new Map();
const items = new Map();
for (const id of ['vercelExitFile', 'vercelExitResult', 'vercelExitConfirm',
  'vercelExitConfirmLabel', 'vercelExitDownload']) {
  items.set(id, {
    value: '', checked: false, disabled: false, dataset: {}, textContent: '', files: [],
    addEventListener(event, listener) { handlers.set(`${id}:${event}`, listener); },
  });
}
const root = { dataset: { profileReady: 'yes', activeProfile: 'jbfs' } };
let onMutation, downloadCount = 0, downloadedBlob;
let currentSite = backup(21);
const originalURLCreate = URL.createObjectURL;
const originalURLRevoke = URL.revokeObjectURL;
const originalSetTimeout = globalThis.setTimeout;
URL.createObjectURL = blob => { downloadedBlob = blob; return 'blob:med-jita-test'; };
URL.revokeObjectURL = () => {};
globalThis.setTimeout = () => 0;
globalThis.window = { MED_JITA_BRIDGE: { exportBackup: () => structuredClone(currentSite) } };
globalThis.document = {
  documentElement: root,
  getElementById: id => items.get(id),
  body: { appendChild() {} },
  createElement: () => ({ click() { downloadCount++; }, remove() {} }),
};
globalThis.MutationObserver = class {
  constructor(callback) { onMutation = callback; }
  observe() {}
};

await import('../source/integrations/vercel-exit.js');
const fileInput = items.get('vercelExitFile');
const result = items.get('vercelExitResult');
const confirm = items.get('vercelExitConfirm');
const button = items.get('vercelExitDownload');

async function choose(contents, name = 'med-jita-old.json') {
  fileInput.files = [{ name, size: 230, text: async () => JSON.stringify(contents) }];
  await handlers.get('vercelExitFile:change')();
}

const snapshot = JSON.stringify(currentSite);
await choose(backup(23));
assert.equal(confirm.disabled, false);
assert.equal(button.disabled, true, 'Never download an unconfirmed profile attribution');
assert.match(result.textContent, /diferenças nas notas atuais/i);
assert.match(result.textContent, /sem identificador de perfil/i);
confirm.checked = true;
handlers.get('vercelExitConfirm:change')();
assert.equal(button.disabled, false);
handlers.get('vercelExitDownload:click')();
assert.equal(downloadCount, 1);
const exported = JSON.parse(await downloadedBlob.text());
assert.equal(exported.format, 'med-jita-transition-archive');
assert.equal(exported.profileId, 'jbfs');
assert.equal(exported.review.requiresActiveStateDecision, true);
assert.equal(exported.archive.sites.data.cab.hits, '21');
assert.equal(exported.archive.vercel.data.cab.hits, '23');
assert.equal(exported.attribution, 'confirmed-by-user-only');
assert.equal(JSON.stringify(currentSite), snapshot, 'Review never mutates Sites state');

await choose(backup(19, 'tay'));
assert.equal(button.disabled, true, 'A backup belonging to another person must be rejected');
assert.equal(confirm.disabled, true);
assert.equal(result.dataset.state, 'error');

await choose(backup(24, 'jbfs'));
confirm.checked = true;
handlers.get('vercelExitConfirm:change')();
root.dataset.activeProfile = 'tay';
onMutation();
assert.equal(button.disabled, true, 'A profile switch invalidates a pending archive');

root.dataset.activeProfile = 'jbfs';
await choose(backup(25));
confirm.checked = true;
handlers.get('vercelExitConfirm:change')();
currentSite = backup(26);
handlers.get('vercelExitDownload:click')();
assert.equal(button.disabled, true, 'Changes after comparison require a fresh review');
assert.equal(downloadCount, 1, 'Stale data must not be downloaded');

URL.createObjectURL = originalURLCreate;
URL.revokeObjectURL = originalURLRevoke;
globalThis.setTimeout = originalSetTimeout;
delete globalThis.window;
delete globalThis.document;
delete globalThis.MutationObserver;
console.log('Desmame Vercel: comparação local, confirmação de identidade e exportação reversível OK');
