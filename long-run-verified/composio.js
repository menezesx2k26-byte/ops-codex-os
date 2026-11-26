'use strict';
function createComposioDocsFetch({apiKey,accountId,userId,documentId,fetchImpl=globalThis.fetch}){
 if(!apiKey||!accountId||!userId||!/^[A-Za-z0-9_-]+$/.test(documentId||''))throw Error('COMPOSIO_CONFIG_REQUIRED');
 const base='https://docs.googleapis.com/v1/documents/'+documentId;
 return async function authorizedFetch(endpoint,init={}){
  const method=init.method||'GET';
  if(!((method==='GET'&&endpoint===base)||(method==='POST'&&endpoint===base+':batchUpdate')))throw Error('PROXY_TARGET_DENIED');
  const payload={endpoint,method,connected_account_id:accountId,user_id:userId};
  if(method==='POST')payload.body=JSON.parse(init.body);
  const outer=await fetchImpl('https://backend.composio.dev/api/v3.1/tools/execute/proxy',{method:'POST',headers:{'content-type':'application/json','x-api-key':apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!outer.ok)throw Error('COMPOSIO_HTTP_'+outer.status);
  const result=await outer.json();
  if(!Number.isInteger(result.status)||result.status<200||result.status>599||!Object.hasOwn(result,'data'))throw Error('COMPOSIO_RESPONSE_INVALID');
  return {response:Response.json(result.data??{},{status:result.status})};
 };
}
module.exports={createComposioDocsFetch};
