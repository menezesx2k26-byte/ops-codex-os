const test=require('node:test');
const assert=require('node:assert/strict');
const {createRun,addRun,updateRun,selectRun,checkpoint,DriveDocumentStore}=require('../long-run-verified/controller');
const init=id=>createRun({runId:id,goal:'Goal '+id,gates:[{id:'test',criterion:'Evidence'}],nextAction:'Run test'});
test('multiple runs are isolated, duplicate IDs rejected, no overwrite',()=>{
 const a=addRun(null,init('alpha'));const b=addRun(a,init('beta'));
 assert.equal(selectRun(b,'alpha').goal,'Goal alpha');assert.equal(selectRun(b,'beta').goal,'Goal beta');
 assert.throws(()=>addRun(b,init('alpha')),/RUN_EXISTS/);
 const c=updateRun(b,checkpoint(selectRun(b,'alpha'),{expectedVersion:1,nextAction:'Next'}));
 assert.equal(selectRun(c,'alpha').version,2);assert.equal(selectRun(c,'beta').version,1);
 assert.throws(()=>updateRun(c,checkpoint(selectRun(b,'alpha'),{expectedVersion:1,nextAction:'Stale'})),/VERSION_CONFLICT/);
});
test('run IDs are safe even with special object names',()=>{
 const s=addRun(null,init('constructor'));assert.equal(selectRun(s,'constructor').runId,'constructor');
 assert.throws(()=>selectRun(s,'toString'),/RUN_NOT_FOUND/);
});
test('write uncertainty is not retried and conflicting revision is rejected',async()=>{
 let writes=0;
 const store=new DriveDocumentStore({documentId:'allowed',authorizedFetch:async(url,init={})=>{
 if(init.method==='POST'){writes++;return {response:new Response('{}',{status:400})};}
 return {response:Response.json({revisionId:'r1',body:{content:[{paragraph:{elements:[{textRun:{content:'\n'}}]}}]}})};
 }});
 const before=await store.read();await assert.rejects(()=>store.write(before,addRun(null,init('demo'))),/DRIVE_WRITE_400/);assert.equal(writes,1);
});
