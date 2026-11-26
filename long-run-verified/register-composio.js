'use strict';
const fs=require('node:fs');
async function register({apiKey,userId,mcpUrl,fetchImpl=globalThis.fetch}){
 if(!apiKey||!userId||['all','default'].includes(userId.trim().toLowerCase()))throw Error('PRIVATE_PROJECT_CONFIG_REQUIRED');
 const url=new URL(mcpUrl);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/mcp'))throw Error('FINAL_HTTPS_MCP_REQUIRED');
 const root='https://backend.composio.dev/api/v3.1';
 const request=async(path,init={})=>fetchImpl(root+path,{...init,headers:{'x-api-key':apiKey,'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
 const result=await request('/custom/toolkits',{method:'POST',body:JSON.stringify({name:'Long Run Verified',mcp_url:url.href,user_id:userId,auth_schemes:[{mode:'API_KEY',headers:{Authorization:'Bearer {{generic_api_key}}'}}]})});
 if(!result.ok)throw Error('REGISTRATION_HTTP_'+result.status);
 const body=await result.json();
 if(typeof body.slug!=='string'||!body.slug.startsWith('CUSTOM_'))throw Error('REGISTRATION_RESULT_UNCERTAIN');
 return body;
}
if(require.main===module){
 if(process.argv[2]!=='--apply')throw Error('EXPLICIT_APPLY_REQUIRED');
 const file=process.env.COMPOSIO_ADMIN_API_KEY_FILE;
 const apiKey=file?fs.readFileSync(file,'utf8').trim():process.env.COMPOSIO_ADMIN_API_KEY;
 register({apiKey,userId:process.env.LRV_COMPOSIO_USER_ID,mcpUrl:process.env.LRV_PUBLIC_URL}).then(r=>console.log(JSON.stringify({slug:r.slug,connect_link:r.connect_link||null}))).catch(e=>{console.error(e.message);process.exitCode=1});
}
module.exports={register};
