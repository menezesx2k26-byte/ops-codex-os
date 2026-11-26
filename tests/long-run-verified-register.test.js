const test=require('node:test');
const assert=require('node:assert/strict');
const {register}=require('../long-run-verified/register-composio');
test('custom toolkit registration refuses shared user and insecure endpoint',async()=>{
 const never=async()=>{throw Error('unexpected request')};
 await assert.rejects(()=>register({apiKey:'test',userId:'all',mcpUrl:'https://mcp.example.org/lrv/mcp',fetchImpl:never}),/PRIVATE_PROJECT_CONFIG_REQUIRED/);
 await assert.rejects(()=>register({apiKey:'test',userId:'owner',mcpUrl:'http://mcp.example.org/lrv/mcp',fetchImpl:never}),/FINAL_HTTPS_MCP_REQUIRED/);
});
test('register uses documented v3.1 private auth scheme and does not retry',async()=>{
 let requests=0;
 const r=await register({apiKey:'test',userId:'owner',mcpUrl:'https://mcp.example.org/lrv/mcp',fetchImpl:async(url,init)=>{
 requests++;assert.equal(url,'https://backend.composio.dev/api/v3.1/custom/toolkits');assert.equal(init.method,'POST');
 const b=JSON.parse(init.body);assert.equal(b.user_id,'owner');assert.equal(b.auth_schemes[0].headers.Authorization,'Bearer {{generic_api_key}}');
 return Response.json({slug:'CUSTOM_TEST'});
 }});
 assert.equal(r.slug,'CUSTOM_TEST');assert.equal(requests,1);
});
