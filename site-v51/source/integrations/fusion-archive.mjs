/**
 * MED JITA · reconciliação não destrutiva Sites × Vercel.
 *
 * This module has deliberately no persistence or network side effects. A
 * preview can inspect two exports without modifying either live database.
 * Never use its result for a production write without an explicit review.
 */

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

const signature = value => JSON.stringify(stable(value));

function normalizeBackup(backup, profileId, origin) {
  if (!isObject(backup) || backup.version !== 3 || backup.format !== 'med-jita-backup' ||
      !isObject(backup.data) || !Array.isArray(backup.history)) {
    throw new Error(`Backup ${origin} incompatível; nenhum dado foi alterado.`);
  }
  if (backup.profile && backup.profile !== profileId) {
    throw new Error(`O backup ${origin} pertence a outro perfil; fusão bloqueada.`);
  }
  const snapshots = backup.history.map((item, i) => {
    if (!isObject(item) || !isObject(item.data)) {
      throw new Error(`Histórico ${origin} #${i + 1} incompatível; fusão bloqueada.`);
    }
    return copy(item);
  });
  return { data: copy(backup.data), history: snapshots, avatar:copy(backup.avatar || {kind:'default'}) };
}

/**
 * Audit all versions before selecting any live state. The output is a
 * recoverable plan, NOT a backup ready to overwrite a live account.
 */
export function prepareFusion({profileId, sites, vercel, historyLimit = 60}) {
  if (!/^[a-z][a-z0-9_-]{1,32}$/.test(profileId || '')) {
    throw new Error('Identificador de perfil inválido.');
  }
  if (!Number.isSafeInteger(historyLimit) || historyLimit < 1) {
    throw new Error('Limite de histórico inválido.');
  }
  const left = normalizeBackup(sites,profileId,'Sites');
  const right = normalizeBackup(vercel,profileId,'Vercel');
  const sameLiveState = signature(left.data) === signature(right.data);
  const snapshots = [], seen = new Set(), usedIds = new Set();
  function addSnapshot(entry,origin) {
    const id = String(entry.id || '').slice(0,80);
    const sig = signature(entry.data);
    const fingerprint = `${id}|${sig}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    let uniqueId = id || `${origin.toLowerCase()}-${snapshots.length + 1}`;
    if (usedIds.has(uniqueId)) {
      let suffix=2;
      while (usedIds.has(`${uniqueId}-v${suffix}`)) suffix++;
      uniqueId = `${uniqueId}-v${suffix}`;
    }
    usedIds.add(uniqueId);
    snapshots.push({
      id:uniqueId,
      name:String(entry.name || 'Versão recuperada').slice(0,70),
      savedAt:entry.savedAt || null,
      data:copy(entry.data),
      origin,
    });
  }
  // Keep both current live states explicitly when they differ. The user must
  // choose an active state only after seeing the comparison.
  addSnapshot({id:'fusao-atual-sites',name:'Estado anterior · Sites',data:left.data},'Sites');
  if (!sameLiveState) addSnapshot({id:'fusao-atual-vercel',name:'Estado anterior · Vercel',data:right.data},'Vercel');
  for (const h of left.history) addSnapshot(h,'Sites');
  for (const h of right.history) addSnapshot(h,'Vercel');

  return {
    profileId,
    sameLiveState,
    requiresActiveStateDecision: !sameLiveState,
    needsSeparateArchive:snapshots.length > historyLimit,
    historyLimit,
    totalVersions:snapshots.length,
    snapshots,
    avatars: {sites:left.avatar,vercel:right.avatar},
    // A complete dry-run export is always returned, even above the application's
    // existing 60-item limit. Never silently truncate to satisfy an API.
    completeArchive:copy({profileId,sites,vercel}),
  };
}