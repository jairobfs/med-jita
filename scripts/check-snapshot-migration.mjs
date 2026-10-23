#!/usr/bin/env node
/* MED JITA — auditoria D1 somente leitura. Nenhum PIN ou nota é exportado por este script. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const PROFILE_IDS=['jbfs','barba','tay','igu'];
const KNOWN_PREFIXES=['med-data-v1:','med-account-v1:','med-craft-mirror-v1:'];
function rowsFrom(value){
  if(Array.isArray(value)){
    if(value.length===1&&value[0]&&Array.isArray(value[0].results)){
      if(value[0].success===false)throw Error('Consulta D1 falhou.');
      return value[0].results;
    }
    if(value.every(x=>x&&typeof x==='object'&&'id' in x))return value;
  }
  if(value&&typeof value==='object'&&Array.isArray(value.results)){
    if(value.success===false)throw Error('Consulta D1 falhou.');
    return value.results;
  }
  throw Error('Formato incompatível. Use JSON da consulta SELECT id,revision,payload,updated_at FROM snapshots.');
}
function audit(value){
  const rows=rowsFrom(value),byId=new Map();
  for(const row of rows){
    if(!row||typeof row.id!=='string'||!row.id||row.id.length>160||
       !Number.isSafeInteger(row.revision)||row.revision<0||
       typeof row.payload!=='string'||typeof row.updated_at!=='string'||
       !Number.isFinite(Date.parse(row.updated_at)))
       throw Error('Registro inválido ou incompleto no export.');
    if(byId.has(row.id))throw Error('Export com IDs duplicados.');
    let parsed;
    try{parsed=JSON.parse(row.payload)}catch{throw Error('Payload JSON inválido.')}
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Payload inesperado.');
    if(row.id.startsWith('med-data-v1:')&&
       (parsed.alg!=='AES-256-GCM'||!/^[A-Za-z0-9_-]{16}$/.test(parsed.iv||'')||
        !/^[A-Za-z0-9_-]{41,1500000}$/.test(parsed.ciphertext||'')))
       throw Error('Histórico cifrado com formato inesperado.');
    byId.set(row.id,{revision:row.revision,
      digest:createHash('sha256').update(row.payload,'utf8').digest('hex'),
      updatedAt:row.updated_at});
  }
  const profiles=Object.fromEntries(PROFILE_IDS.map(id=>[id,byId.has('med-data-v1:'+id)]));
  const unexpectedCount=[...byId.keys()].filter(id=>!KNOWN_PREFIXES.some(prefix=>id.startsWith(prefix))).length;
  return{byId,profiles,unexpectedCount};
}
function compare(source,destination){
  let missing=0,changed=0;
  for(const [id,entry] of source.byId){
    const copy=destination.byId.get(id);
    if(!copy)missing++;
    else if(entry.digest!==copy.digest||entry.revision!==copy.revision||entry.updatedAt!==copy.updatedAt)changed++;
  }
  return{missing,changed,passed:!missing&&!changed};
}
export{audit,compare,rowsFrom};
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const[sourcePath,destinationPath]=process.argv.slice(2);
  if(!sourcePath||process.argv.length>4){
    console.error('Uso: node scripts/check-snapshot-migration.mjs origem.json [destino.json]');
    process.exitCode=2;
  }else{
    try{
      const source=audit(JSON.parse(await readFile(sourcePath,'utf8')));
      console.log('Origem: '+source.byId.size+' registros; históricos: '+
        PROFILE_IDS.map(id=>id.toUpperCase()+'='+(source.profiles[id]?'presente':'sem registro')).join(', ')+
        '; IDs complementares='+source.unexpectedCount+'.');
      if(destinationPath){
        const destination=audit(JSON.parse(await readFile(destinationPath,'utf8')));
        const result=compare(source,destination);
        console.log('Destino: '+destination.byId.size+' registros; '+(result.passed?'CÓPIA FIEL':
          'FALHA ('+result.missing+' ausentes, '+result.changed+' divergentes)')+'.');
        if(!result.passed)process.exitCode=1;
      }else console.log('Destino ainda não verificado; nenhuma migração foi efetuada.');
      console.log('Auditoria somente leitura. A chave e dados locais do iPhone exigem validação separada.');
    }catch(error){
      console.error('Auditoria interrompida: '+error.message);
      process.exitCode=1;
    }
  }
}