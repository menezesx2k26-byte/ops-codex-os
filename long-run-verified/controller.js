'use strict';
const assertText=(v,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('INVALID_TEXT');return v.trim()};
const ident=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(v))throw Error('INVALID_ID');return v};
const stamp=()=>new Date().toISOString();
function createRun({runId,goal,gates,nextAction}){
 if(!Array.isArray(gates)||!gates.length||gates.length>50)throw Error('INVALID_GATES');
 const seen=new Set();
 const entries=gates.map(g=>{const id=ident(g.id);if(seen.has(id))throw Error('DUPLICATE_GATE');seen.add(id);return {id,criterion:assertText(g.criterion),verdict:'PENDING',evidence:null}});
 return {schema:1,runId:ident(runId),goal:assertText(goal,8000),gates:entries,version:1,status:'RUNNING',nextAction:assertText(nextAction),updatedAt:stamp()};
}
function checkpoint(s,{expectedVersion,updates=[],nextAction,blocker}){
 if(s.status==='COMPLETE_REPORTED')throw Error('TERMINAL');
 if(s.version!==expectedVersion)throw Error('VERSION_CONFLICT');
 if(!Array.isArray(updates)||updates.length>50)throw Error('INVALID_UPDATES');
 const map=new Map();for(const u of updates){if(!s.gates.some(g=>g.id===u.id))throw Error('UNKNOWN_GATE');if(map.has(u.id))throw Error('DUPLICATE_GATE');if(!['PASS','FAIL','BLOCKED','PENDING'].includes(u.verdict))throw Error('INVALID_VERDICT');if(u.verdict!=='PENDING'&&(!u.evidence||typeof u.evidence!=='string'||!u.evidence.trim()))throw Error('EVIDENCE_REQUIRED');map.set(u.id,{verdict:u.verdict,evidence:u.verdict==='PENDING'?null:assertText(u.evidence)});}
 const gates=s.gates.map(g=>({...g,...map.get(g.id)}));
 return {...s,version:s.version+1,gates,status:blocker?'BLOCKED':'RUNNING',blocker:blocker?assertText(blocker):null,nextAction:nextAction===undefined?s.nextAction:assertText(nextAction),updatedAt:stamp()};
}
function next(s){return {status:s.status,action:s.status==='COMPLETE_REPORTED'||s.status==='BLOCKED'?null:s.nextAction,pending:s.gates.filter(g=>g.verdict!=='PASS').map(g=>g.id),blocker:s.blocker||null,version:s.version};}
function finish(s){if(s.status!=='RUNNING'||s.gates.some(g=>g.verdict!=='PASS'||!g.evidence))throw Error('GATES_PENDING');return {...s,version:s.version+1,status:'COMPLETE_REPORTED',nextAction:null,updatedAt:stamp()};}
function selectRun(ledger,id){ident(id);const run=ledger?.runs?.find(r=>r.runId===id);if(!run)throw Error('RUN_NOT_FOUND');return run;}
function addRun(ledger,run){
 const runs=ledger?.runs||[];if(runs.some(r=>r.runId===run.runId))throw Error('RUN_EXISTS');if(runs.length>=100)throw Error('LEDGER_CAPACITY');
 return {schema:2,runs:[...runs,run]};
}
function updateRun(ledger,run){
 const previous=selectRun(ledger,run.runId);if(run.version!==previous.version+1)throw Error('VERSION_CONFLICT');
 return {...ledger,runs:ledger.runs.map(r=>r.runId===run.runId?run:r)};
}
class DriveDocumentStore {
 constructor({documentId,authorizedFetch}){if(!/^[A-Za-z0-9_-]+$/.test(documentId||'')||typeof authorizedFetch!=='function')throw Error('DRIVE_CONFIG_REQUIRED');this.url='https://docs.googleapis.com/v1/documents/'+documentId;this.fetch=authorizedFetch;}
 async read(){const {response}=await this.fetch(this.url);if(!response.ok)throw Error('DRIVE_READ_'+response.status);const d=await response.json();if(!d.revisionId||!d.body?.content)throw Error('DRIVE_REVISION_REQUIRED');
 const raw=d.body.content.map((p,i)=>{if(i===0&&p.sectionBreak&&p.endIndex===1)return '';if(!p.paragraph||!Array.isArray(p.paragraph.elements)||p.paragraph.elements.some(e=>typeof e.textRun?.content!=='string'))throw Error('DRIVE_DOCUMENT_NOT_PLAIN');return p.paragraph.elements.map(e=>e.textRun.content).join('')}).join('');
 if(!raw.endsWith('\n'))throw Error('DRIVE_DOCUMENT_NOT_PLAIN');
 const value=raw.trim()?JSON.parse(raw):null;
 const validRun=r=>r&&typeof r.runId==='string'&&r.schema===1&&Number.isSafeInteger(r.version)&&Array.isArray(r.gates);
 if(value&&!(validRun(value)||(value.schema===2&&Array.isArray(value.runs)&&value.runs.length<=100&&value.runs.every(validRun)&&new Set(value.runs.map(r=>r.runId)).size===value.runs.length)))throw Error('INVALID_EXISTING_STATE');
 return {revision:d.revisionId,raw,state:value};}
 async write(before,state){const serialized=JSON.stringify(state);if(serialized.length>180000)throw Error('STATE_TOO_LARGE');const requests=[];if(before.raw.length>1)requests.push({deleteContentRange:{range:{startIndex:1,endIndex:before.raw.length}}});requests.push({insertText:{location:{index:1},text:serialized}});
 const {response}=await this.fetch(this.url+':batchUpdate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({writeControl:{requiredRevisionId:before.revision},requests})});if(!response.ok)throw Error('DRIVE_WRITE_'+response.status);const after=await this.read();if(JSON.stringify(after.state)!==serialized)throw Error('READBACK_MISMATCH');return after.state;}
}
module.exports={createRun,checkpoint,finish,next,addRun,selectRun,updateRun,DriveDocumentStore};
