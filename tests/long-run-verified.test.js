const test = require('node:test');
const assert = require('node:assert/strict');
const {createRun, checkpoint, finish, next, DriveDocumentStore} = require('../long-run-verified/controller');
const start = () => createRun({runId:'demo',goal:'Ship',gates:[{id:'test',criterion:'Tests pass'},{id:'review',criterion:'Review passes'}],nextAction:'Run tests'});
test('contract is immutable and cannot finish early',()=>{
 const s=start(); assert.equal(next(s).action,'Run tests'); assert.throws(()=>finish(s),/GATES_PENDING/);
 assert.throws(()=>checkpoint(s,{expectedVersion:1,updates:[{id:'unknown',verdict:'PASS',evidence:'test'}]}),/UNKNOWN_GATE/);
});
test('checkpoint requires evidence for PASS, rejects stale writes and records failures',()=>{
 const s=start(); assert.throws(()=>checkpoint(s,{expectedVersion:1,updates:[{id:'test',verdict:'PASS'}]}),/EVIDENCE_REQUIRED/);
 const f=checkpoint(s,{expectedVersion:1,updates:[{id:'test',verdict:'FAIL',evidence:'CI failed'}],nextAction:'Fix failure'});
 assert.equal(f.version,2); assert.equal(next(f).action,'Fix failure');
 assert.throws(()=>checkpoint(f,{expectedVersion:1}),/VERSION_CONFLICT/);
});
test('all reported gates plus explicit readback permit reported completion only',()=>{
 const s=checkpoint(start(),{expectedVersion:1,updates:[{id:'test',verdict:'PASS',evidence:'CI run 42'},{id:'review',verdict:'PASS',evidence:'review receipt 23'}],nextAction:'Read back'});
 const f=finish(s); assert.equal(f.status,'COMPLETE_REPORTED'); assert.throws(()=>checkpoint(f,{expectedVersion:f.version}),/TERMINAL/);
});
test('drive document uses revision CAS and checks readback',async()=>{
 let doc={revisionId:'r1',body:{content:[{paragraph:{elements:[{textRun:{content:'\n'}}]}}]}};
 const calls=[];
 const store=new DriveDocumentStore({documentId:'allowed',authorizedFetch:async(url,init={})=>{
 calls.push([url,init]); if(init.method==='POST'){const b=JSON.parse(init.body); assert.equal(b.writeControl.requiredRevisionId,'r1'); doc={revisionId:'r2',body:{content:[{paragraph:{elements:[{textRun:{content:b.requests.at(-1).insertText.text+'\n'}}]}}]}};return {response:new Response('{}')};}
 return {response:Response.json(doc)};
 }});
 const state=start(); await store.write(await store.read(),state); assert.deepEqual((await store.read()).state,state);
 assert.ok(calls.every(([u])=>u.includes('/allowed')));
});
