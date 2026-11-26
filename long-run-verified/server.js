'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const {McpServer,createMcpHandler}=require('@modelcontextprotocol/server');
const {toNodeHandler}=require('@modelcontextprotocol/node');
const {z}=require('zod');
const {createRun,checkpoint,finish,next,addRun,selectRun,updateRun,DriveDocumentStore}=require('./controller');
const {createDriveTokenProviderFromEnv}=require('../persistd/src/storage/drive-auth');
const {DriveClient}=require('../persistd/src/storage/drive-client');
const {createComposioDocsFetch}=require('./composio');
function createServer({store,tokenDigest}){
 if(!store||!/^[a-f0-9]{64}$/.test(tokenDigest||''))throw Error('SERVER_CONFIG_REQUIRED');
 const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/);
 const t=z.string().min(1).max(4000);
 const rev=z.number().int().positive();
 const handler=createMcpHandler(()=>{
 const server=new McpServer({name:'Long Run Verified',version:'0.1.0'});
 const runId=z.object({runId:id});
 const load=async()=>{const b=await store.read();if(b.state&&b.state.schema!==2)throw Error('LEDGER_SCHEMA_REQUIRED');return b};
 const read=async id=>{const b=await load();return {before:b,run:selectRun(b.state,id)}};
 const save=async(b,run)=>{const result=await store.write(b,updateRun(b.state,run));return selectRun(result,run.runId)};
 const result=async fn=>{try{const v=await fn();return {content:[{type:'text',text:JSON.stringify(v)}],structuredContent:v}}catch(e){return {isError:true,content:[{type:'text',text:/^[A-Z_]+(?:[0-9]+)?$/.test(e.message)?e.message:'OPERATION_FAILED'}]}}};
 const tool=(name,description,inputSchema,fn,readOnlyHint=false)=>server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint}},a=>result(()=>fn(a)));
 tool('run_start','Initialize a new mission in the dedicated Drive ledger. Refuses duplicate ID. All gates are mandatory.',z.object({runId:id,goal:z.string().min(1).max(8000),gates:z.array(z.object({id,criterion:t})).min(1).max(50),nextAction:t}),async a=>{const b=await load();const run=createRun(a);return selectRun(await store.write(b,addRun(b.state,run)),run.runId)});
 tool('run_status','Recover canonical Drive state; revalidate Git and external evidence before acting.',runId,async a=>(await read(a.runId)).run,true);
 tool('run_next','Return the next recorded safe action. Execute it within current authorization, then checkpoint; never loop without progress.',runId,async a=>next((await read(a.runId)).run),true);
 tool('run_checkpoint','Update gate reports with actual evidence references and next action. CAS rejects stale versions. Evidence is reported, not independently verified by MCP.',z.object({runId:id,expectedVersion:rev,updates:z.array(z.object({id,verdict:z.enum(['PASS','FAIL','BLOCKED','PENDING']),evidence:t.optional()})).max(50).optional(),nextAction:t.optional(),blocker:t.optional()}),async a=>{const b=await read(a.runId);return save(b.before,checkpoint(b.run,a))});
 tool('run_verify','Inspect reported gate matrix. Inspect actual evidence independently before deciding completion.',runId,async a=>{const s=(await read(a.runId)).run;return {gates:s.gates,allReportedPass:s.gates.every(g=>g.verdict==='PASS'&&g.evidence),independentlyVerified:false,version:s.version}},true);
 tool('run_finish','Record reported completion only when every mandatory gate has evidence. This cannot independently verify external facts.',z.object({runId:id,expectedVersion:rev}),async a=>{const b=await read(a.runId);if(b.run.version!==a.expectedVersion)throw Error('VERSION_CONFLICT');return save(b.before,finish(b.run))});
 for(const name of ['run_continue','run_handoff','run_compact'])tool(name,'Return canonical bounded state including goal, gates, evidence, version and next action. Does not launch another chat or background job.',runId,async a=>({state:(await read(a.runId)).run,instruction:'Reconcile live Git and external evidence. Continue only if authorized. Do not repeat verified work.'}),true);
 return server;
 },{responseMode:'json'});
 const node=toNodeHandler(handler);
 return http.createServer(async(req,res)=>{res.setHeader('cache-control','no-store');if(req.url!=='/mcp'){res.writeHead(404);return res.end()};const origin=req.headers.origin;if(origin){res.writeHead(403);return res.end()};const header=String(req.headers.authorization||'');const actual=crypto.createHash('sha256').update(header.startsWith('Bearer ')?header.slice(7):'').digest('hex');if(!header.startsWith('Bearer ')||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(tokenDigest))){res.writeHead(401,{'www-authenticate':'Bearer realm="Long Run Verified"'});return res.end()};try{await node(req,res)}catch{if(!res.headersSent)res.writeHead(500);res.end()}});
}
if(require.main===module){
 const documentId=process.env.LRV_DOCUMENT_ID;
 let authorizedFetch;
 if(process.env.LRV_AUTH_MODE==='composio'){
  const keyFile=process.env.COMPOSIO_API_KEY_FILE;
  const apiKey=keyFile?fs.readFileSync(keyFile,'utf8').trim():process.env.COMPOSIO_API_KEY;
  authorizedFetch=createComposioDocsFetch({apiKey,accountId:process.env.LRV_COMPOSIO_ACCOUNT_ID,userId:process.env.LRV_COMPOSIO_USER_ID,documentId});
 }else if(process.env.LRV_AUTH_MODE==='google'){
  const provider=createDriveTokenProviderFromEnv();if(!provider)throw Error('DRIVE_AUTH_REQUIRED');
  const drive=new DriveClient({tokenProvider:()=>provider.getAccess()});authorizedFetch=drive.authorizedFetch.bind(drive);
 }else throw Error('AUTH_MODE_REQUIRED');
 const store=new DriveDocumentStore({documentId,authorizedFetch});
 const server=createServer({store,tokenDigest:process.env.LRV_TOKEN_SHA256});
 const host=process.env.LRV_BIND_HOST||'127.0.0.1';
 if(!['127.0.0.1','0.0.0.0'].includes(host))throw Error('BIND_HOST_INVALID');
 const port=Number(process.env.PORT||3000);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT_INVALID');
 store.read().then(b=>{
  if(b.state&&b.state.schema!==2)throw Error('LEDGER_SCHEMA_REQUIRED');
  server.listen(port,host,()=>console.log('LRV_READY'));
 }).catch(()=>{console.error('LRV_DRIVE_PREFLIGHT_FAILED');process.exitCode=1});
}
module.exports={createServer};
