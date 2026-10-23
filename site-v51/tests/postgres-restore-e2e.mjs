import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { compareRows, auditRows } from '../migration/snapshot-transfer.mjs';

const baseUrl=process.env.MED_JITA_TEST_DATABASE_URL;
if (!baseUrl || !/^postgres(?:ql)?:\/\/[^/]+\/jita_ci$/.test(baseUrl))
  throw Error('Restauro E2E proibido fora do PostgreSQL isolado jita_ci.');
const destination=baseUrl.replace(/\/jita_ci$/,'/jita_ci_restore');
const admin=new Client({connectionString:baseUrl});
const tmp=await mkdtemp(join(tmpdir(),'jita-pg-restauro-'));
const source=join(tmp,'snapshots-completos.json');
const script=resolve('migration/import-d1-postgres.mjs');
const envelope=JSON.stringify({
 alg:'AES-256-GCM',iv:randomBytes(12).toString('base64url'),
 ciphertext:randomBytes(60).toString('base64url')
});
const now='2026-10-23T08:30:12.123Z';
const ids=['jbfs','barba','tay','igu'];
const rows=[
 ...ids.map((id,idx)=>({id:'med-data-v1:'+id,revision:idx+1,payload:envelope,updated_at:now})),
 ...ids.map((id,idx)=>({id:'med-craft-mirror-v1:'+id,revision:idx+1,payload:'{}',updated_at:now})),
 {id:'med-account-v1:jbfs',revision:4,payload:JSON.stringify({
  v:1,salt:'',hash:'',resetSeen:false,failures:0,blockedUntil:0
 }),updated_at:now},
];
function run(...args){
 return spawnSync(process.execPath,[script,'--input',source,...args],{
  encoding:'utf8',timeout:20000,env:{...process.env,DATABASE_URL:destination}
 });
}
try {
 await writeFile(source,JSON.stringify({rows}),{mode:0o600});
 const dry=run();
 assert.equal(dry.status,0,dry.stderr);
 assert.match(dry.stdout,/DRY RUN/);
 const sha=auditRows(rows,ids).sha256;
 assert.match(dry.stdout,new RegExp(sha));
 const bad=run('--apply','--expect','0'.repeat(64));
 assert.notEqual(bad.status,0);
 assert.match(bad.stderr,/Digest esperado/);
 await admin.connect();
 await admin.query('CREATE DATABASE jita_ci_restore');
 const applied=run('--expect',sha,'--apply');
 assert.equal(applied.status,0,applied.stderr);
 assert.match(applied.stdout,/verified-and-committed/);
 const pool=new Client({connectionString:destination});
 try {
  await pool.connect();
  const result=await pool.query('SELECT id,revision,payload,updated_at FROM snapshots');
  const resultCompare=compareRows(rows,result.rows,ids);
  assert.equal(resultCompare.identical,true);
  assert.deepEqual(resultCompare.missing,[]);
  assert.deepEqual(resultCompare.additional,[]);
  assert.deepEqual(resultCompare.changed,[]);
  assert.equal(result.rows.length,9);
 } finally {await pool.end();}
 const second=run('--expect',sha,'--apply');
 assert.notEqual(second.status,0);
 assert.match(second.stderr,/Destino não está vazio/);
 console.log('REAL PG RESTORE PASS: 9 records, integrity hash, atomic import and overwrite refusal.');
} finally {
 await admin.end().catch(()=>{});
 await rm(tmp,{recursive:true,force:true});
}
