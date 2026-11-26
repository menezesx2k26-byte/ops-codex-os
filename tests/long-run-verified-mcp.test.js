const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createServer}=require('../long-run-verified/server');
test('MCP authenticates, lists nine tools and enforces lifecycle',async()=>{
 let state=null;
 const store={read:async()=>({state}),write:async(b,s)=>{state=s;return s}};
 const token='test-only-secret';
 const server=createServer({store,tokenDigest:crypto.createHash('sha256').update(token).digest('hex')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=new URL('http://127.0.0.1:'+server.address().port+'/mcp');
 try{
 assert.equal((await fetch(url,{method:'POST'})).status,401);
 const {Client,StreamableHTTPClientTransport}=await import('@modelcontextprotocol/client');
 const client=new Client({name:'lrv-test',version:'1.0.0'});
 await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:'Bearer '+token}}}));
 try{
 assert.equal((await client.listTools()).tools.length,9);
 const call=(name,args)=>client.callTool({name,arguments:args});
 assert.equal((await call('run_start',{runId:'demo',goal:'ship',gates:[{id:'test',criterion:'tests pass'}],nextAction:'test'})).isError,undefined);
 assert.equal((await call('run_finish',{runId:'demo',expectedVersion:1})).isError,true);
 assert.equal((await call('run_checkpoint',{runId:'demo',expectedVersion:1,updates:[{id:'test',verdict:'PASS',evidence:'test output'}]})).isError,undefined);
 assert.equal((await call('run_checkpoint',{runId:'demo',expectedVersion:1})).isError,true);
 assert.equal((await call('run_finish',{runId:'demo',expectedVersion:2})).isError,undefined);
 assert.equal(state.runs[0].status,'COMPLETE_REPORTED');
 assert.equal((await call('run_start',{runId:'second',goal:'next',gates:[{id:'test',criterion:'pass'}],nextAction:'test'})).isError,undefined);
 assert.equal(state.runs.length,2);
 }finally{await client.close()}
 }finally{await new Promise(r=>server.close(r))}
});
