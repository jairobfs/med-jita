/**
 * Optional MED JITA cloud bridge client (NOT enabled in index.html).
 *
 * This client talks to your own authenticated HTTPS backend. Never pass a
 * Craft connection URL or secret to a browser. The backend must enforce
 * authorization, schema checks, rate limiting and revision conflicts.
 */
export function createMedJitaSyncClient(endpoint, fetcher=fetch) {
  const origin = new URL(endpoint);
  if(origin.protocol!=='https:') throw new Error('O serviço precisa usar HTTPS.');
  const base = origin.href.replace(/\/$/,'');

  async function request(method, payload=null, revision=null) {
    const headers={'Accept':'application/json'};
    if(payload!==null) headers['Content-Type']='application/json';
    if(revision!==null) headers['If-Match']=revision;
    const response = await fetcher(base+'/v1/records',{
      method,credentials:'include',headers,
      ...(payload===null?{}:{body:JSON.stringify(payload)})
    });
    if(response.status===401) throw new Error('Entre em sua conta para sincronizar.');
    if(response.status===409||response.status===412) throw new Error('Conflito entre versões. É preciso reconciliar o histórico.');
    if(!response.ok) throw new Error('Sincronização indisponível ('+response.status+').');
    const data=await response.json();
    if(!data||data.schema!=='med-jita/sync/v1')throw new Error('Resposta de sincronização desconhecida.');
    return data;
  }

  return {
    read:()=>request('GET'),
    write:(envelope,revision)=>request('PUT',envelope,revision)
  };
}
