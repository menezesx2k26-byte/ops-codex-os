'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createContextGateway}=require('../modules/context-gateway/src');

const scope='project/example/repo';
function evidence(){
  const content='A confirmed architectural decision';
  return {
    evidence_id:'ev1',scope,source:'git',authority:'git',
    source_ref:'example/repo@abc123',source_revision:'abc123',
    observed_at:'2026-11-17T12:00:00Z',generation_id:'gen1',
    content,content_sha256:'sha256:'+createHash('sha256').update(content).digest('hex'),
    retrieval_method:'bm25'
  };
}

test('controlled agent gets host-scoped project evidence before producing an answer',async()=>{
  const order=[];
  const gateway=createContextGateway({
    resolveProjectScope:async()=>scope,
    executionPlaneClient:{retrieve:async request=>{
      order.push('recall');
      assert.equal(request.scope,scope);
      assert.deepEqual(request.filters,{source_types:['git']});
      return {status:'ok',evidence:[evidence()],revision:'abc123',generation_id:'gen1'};
    }},
  });
  const result=await gateway.answerWithContext({
    userIntent:{kind:'recall',domain:'project',projectScope:scope,text:'What did we decide?'},
    answerProducer:async ({evidence:found,memoryStatus})=>{
      order.push('answer');assert.equal(memoryStatus,'ok');assert.equal(found[0].scope,scope);return 'cited answer';
    }
  });
  assert.deepEqual(order,['recall','answer']);
  assert.equal(result.receipt.status,'ok');
  assert.equal(result.answer,'cited answer');
});

test('foreign scope requested by a model cannot activate cross-project recall',async()=>{
  let fetched=0,answered=0;
  const gateway=createContextGateway({
    resolveProjectScope:async()=>scope,
    executionPlaneClient:{retrieve:async()=>{fetched++;throw new Error('SHOULD_NOT_FETCH');}}
  });
  const result=await gateway.answerWithContext({
    userIntent:{kind:'recall',domain:'project',projectScope:'project/other/private',text:'Previous decision'},
    answerProducer:async()=>{answered++;return 'unsafe';}
  });
  assert.equal(fetched,0);assert.equal(answered,0);
  assert.equal(result.answer,null);assert.equal(result.receipt.status,'unavailable');
});

test('unavailable retrieval never creates a guessed answer',async()=>{
  let answered=0;
  const gateway=createContextGateway({
    resolveProjectScope:async()=>scope,
    executionPlaneClient:{retrieve:async()=>({status:'unavailable'})}
  });
  const result=await gateway.answerWithContext({
    userIntent:{kind:'recall',domain:'project',projectScope:scope,text:'Last decision'},
    answerProducer:async()=>{answered++;return 'guess';}
  });
  assert.equal(answered,0);assert.equal(result.answer,null);
  assert.notEqual(result.receipt.status,'ok');
});

test('ordinary non-contextual queries do not require an unavailable RAG',async()=>{
  let fetched=0;
  const gateway=createContextGateway({
    resolveProjectScope:async()=>scope,
    executionPlaneClient:{retrieve:async()=>{fetched++;throw Error('SHOULD_NOT_FETCH');}}
  });
  const result=await gateway.answerWithContext({
    userIntent:{domain:'project',text:'What is 2 + 2?'},
    answerProducer:async()=>4
  });
  assert.equal(fetched,0);assert.equal(result.answer,4);assert.equal(result.receipt.status,'not_required');
});
