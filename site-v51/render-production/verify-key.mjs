/**
 * MED JITA · validate the historical D1 encryption key after a lossless import.
 * Does not print notes, history entries, PINs, encrypted payloads or secrets.
 *
 * Verification against the real database is a required manual release gate.
 * Never run on a temporary Render PostgreSQL containing real student data.
 */
import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const enc = new TextEncoder();
const profilePrefix = 'med-data-v1:';
const hexKey = /^[a-f0-9]{64}$/i;
function urlBytes(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text))
    throw Error('Envelope cifrado inválido.');
  return Buffer.from(text,'base64url');
}
function assertProfile(id) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(id))
    throw Error('Nome de perfil inválido.');
}

export async function verifyHistoryKey(pool, masterHex, requiredProfiles=['jbfs','barba','tay','igu']) {
  if (!pool || typeof pool.query !== 'function') throw Error('Banco indisponível.');
  if (!hexKey.test(masterHex || '')) throw Error('Chave de 256 bits ausente ou inválida.');
  if (!Array.isArray(requiredProfiles) || !requiredProfiles.length)
    throw Error('Informe os perfis obrigatórios.');
  requiredProfiles.forEach(assertProfile);
  const sql = "SELECT id,revision,payload FROM snapshots WHERE id LIKE 'med-data-v1:%' ORDER BY id";
  const rows = (await pool.query(sql)).rows;
  const found = new Map();
  for(const row of rows) {
    if (!row.id.startsWith(profilePrefix)) continue;
    const id = row.id.slice(profilePrefix.length);
    assertProfile(id);
    if (found.has(id)) throw Error('Perfil duplicado no banco: '+id);
    found.set(id,row);
  }
  for (const id of requiredProfiles) if (!found.has(id))
    throw Error('Histórico obrigatório não encontrado: '+id);
  const key = await webcrypto.subtle.importKey('raw',Buffer.from(masterHex,'hex'),
    { name:'AES-GCM' },false,['decrypt']);
  const verified = [];
  for (const [id,row] of found) {
    let box;
    try { box=JSON.parse(row.payload); }
    catch { throw Error('Envelope ilegível para '+id); }
    if (box.alg !== 'AES-256-GCM' || typeof box.iv !== 'string' ||
        box.iv.length !== 16 || typeof box.ciphertext !== 'string' ||
        box.ciphertext.length < 40)
      throw Error('Envelope ausente para '+id);
    const iv = urlBytes(box.iv), encrypted = urlBytes(box.ciphertext);
    if (iv.byteLength !== 12 || encrypted.byteLength < 29)
      throw Error('Envelope danificado para '+id);
    let backup;
    try {
      const decrypted=await webcrypto.subtle.decrypt({
        name:'AES-GCM',iv,additionalData:enc.encode(row.id)
      },key,encrypted);
      backup=JSON.parse(new TextDecoder().decode(decrypted));
    } catch {
      throw Error('Chave incompatível ou histórico danificado para '+id);
    }
    if (backup?.version !== 3 || backup?.format !== 'med-jita-backup' ||
        !backup.data || typeof backup.data !== 'object' ||
        !Array.isArray(backup.history) || backup.history.length > 60)
      throw Error('Histórico em formato incompatível para '+id);
    verified.push({id,revision:row.revision,namedHistories:backup.history.length});
  }
  return { status:'verified', profiles:verified, total:verified.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL || !process.env.MED_JITA_MASTER_KEY)
    throw Error('Conexão e chave devem ser fornecidas por variáveis privadas.');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString:process.env.DATABASE_URL,
    connectionTimeoutMillis:8000,max:2 });
  try {
    const result=await verifyHistoryKey(pool,process.env.MED_JITA_MASTER_KEY);
    process.stdout.write(JSON.stringify(result)+'\n');
  } finally { await pool.end(); }
}
