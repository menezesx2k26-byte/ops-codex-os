const test=require('node:test');
const assert=require('node:assert/strict');
const {DriveDocumentStore,addRun,createRun}=require('../long-run-verified/controller');
const {createComposioDocsFetch}=require('../long-run-verified/composio');
test('Google Docs native section break and UTF-16 indices are supported',async()=>{
 const run=createRun({runId:'a',goal:'Test emoji 🧪',gates:[{id:'test',criterion:'ok'}],nextAction:'verify'});
 const ledger=addRun(null,run);
 let value=JSON.stringify(ledger);let revision='r1';
 const store=new DriveDocumentStore({documentId:'allowed',authorizedFetch:async(url,init={})=>{
 if(init.method==='POST'){const {requests,writeControl}=JSON.parse(init.body);assert.equal(writeControl.requiredRevisionId,'r1');assert.equal(requests[0].deleteContentRange.range.endIndex,value.length+1);value=requests[1].insertText.text;revision='r2';return {response:Response.json({})}}
 return {response:Response.json({revisionId:revision,body:{content:[{endIndex:1,sectionBreak:{}},{startIndex:1,endIndex:value.length+2,paragraph:{elements:[{startIndex:1,endIndex:value.length+2,textRun:{content:value+'\n'}}]}}]}})};
 }});
 assert.deepEqual((await store.read()).state,ledger);await store.write(await store.read(),ledger);
});
test('Composio proxy is restricted to fixed Docs endpoint and exact account; no raw Google token',async()=>{
 let calls=0;const fetcher=createComposioDocsFetch({apiKey:'test-only-key',accountId:'ca_test',userId:'owner',documentId:'allowed',fetchImpl:async(url,init)=>{
 calls++;assert.equal(url,'https://backend.composio.dev/api/v3.1/tools/execute/proxy');assert.equal(init.headers['x-api-key'],'test-only-key');
 const body=JSON.parse(init.body);assert.equal(body.connected_account_id,'ca_test');assert.equal(body.user_id,'owner');assert.equal(body.endpoint,'https://docs.googleapis.com/v1/documents/allowed');assert.equal(body.method,'GET');return Response.json({status:200,data:{revisionId:'r1'}});
 }});
 const {response}=await fetcher('https://docs.googleapis.com/v1/documents/allowed');assert.equal(response.status,200);assert.deepEqual(await response.json(),{revisionId:'r1'});
 await assert.rejects(()=>fetcher('https://docs.googleapis.com/v1/documents/other'),/PROXY_TARGET_DENIED/);
 await assert.rejects(()=>fetcher('https://docs.googleapis.com/v1/documents/allowed',{method:'DELETE'}),/PROXY_TARGET_DENIED/);assert.equal(calls,1);
});
test('Composio upstream write rejection is preserved',async()=>{
 const f=createComposioDocsFetch({apiKey:'x',accountId:'ca_test',userId:'owner',documentId:'allowed',fetchImpl:async()=>Response.json({status:400,data:{error:'revision conflict'}})});
 const {response}=await f('https://docs.googleapis.com/v1/documents/allowed:batchUpdate',{method:'POST',body:'{}'});assert.equal(response.status,400);
});
