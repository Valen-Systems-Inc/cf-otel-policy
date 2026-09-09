import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generatePolicy,lintPolicy,wranglerFragment,estimateBudget,previewEvents,createLogger} from '../src/index.mjs';
const spec={events:['request.failed','request.completed'],sampleRate:0.1,maxEventsPerInvocation:3,dailyInvocations:10000,correlation:'fresh-random'};
const policy={schemaVersion:1,events:['request.completed','request.failed'],sampleRate:0.1,maxEventsPerInvocation:3,dailyInvocations:10000,correlation:'fresh-random'};
test('generation sorts event labels and sampling budget does not pretend to be a hard cap',()=>{
 assert.deepEqual(generatePolicy(spec),policy);
 assert.deepEqual(estimateBudget(policy),{dailyInvocations:10000,expectedSampledInvocations:1000,expectedMaximumAdapterEvents:3000,unsampledMaximumAdapterEvents:30000});
 assert.deepEqual(wranglerFragment(policy),{observability:{enabled:true,redact_query_string:true,logs:{enabled:true,invocation_logs:false,head_sampling_rate:0.1},traces:{enabled:false}}});
 assert.deepEqual(estimateBudget({...policy,sampleRate:0}),{dailyInvocations:10000,expectedSampledInvocations:0,expectedMaximumAdapterEvents:0,unsampledMaximumAdapterEvents:30000});
});
test('invalid policy fields and arbitrary configuration cannot silently pass',()=>{
 assert.deepEqual(lintPolicy(policy),{valid:true,issues:[]});
 for(const bad of [{...policy,sampleRate:2},{...policy,sampleRate:'0.1'},{...policy,events:['bad@example.invalid']},{...policy,events:['ok','ok']},{...policy,maxEventsPerInvocation:0},{...policy,dailyInvocations:1.5},{...policy,correlation:'incoming-header'},{...policy,authorization:'PRIVATE_TOKEN'},null,{}]){
  const result=lintPolicy(bad);assert.equal(result.valid,false);assert.ok(result.issues.length);assert.ok(!JSON.stringify(result).includes('PRIVATE_TOKEN'));assert.throws(()=>wranglerFragment(bad));
 }
 assert.throws(()=>generatePolicy({...spec,unknown:'secret'}));
});
test('fixtures retain allowed fields only, cap events and report deterministic fresh-ID placeholder',()=>{
 const events=[{event:'request.completed',level:'info',status:200,durationMs:7,headers:{authorization:'PRIVATE_TOKEN'},email:'person@example.invalid',url:'https://example.invalid/?token=PRIVATE_TOKEN',correlationId:'PRIVATE_TOKEN'},{event:'PRIVATE_TOKEN',level:'PRIVATE_TOKEN',status:'200',durationMs:-1},{event:'request.failed',level:'error',status:503,durationMs:50},{}];
 const r=previewEvents(policy,events);
 assert.deepEqual(r,{schemaVersion:1,emitted:3,dropped:1,events:[
  {event:'request.completed',level:'info',status:200,durationMs:7,correlationId:'00000000-0000-4000-8000-000000000000'},
  {event:'other',level:null,status:null,durationMs:null,correlationId:'00000000-0000-4000-8000-000000000000'},
  {event:'request.failed',level:'error',status:503,durationMs:50,correlationId:'00000000-0000-4000-8000-000000000000'}]});
 assert.ok(!JSON.stringify(r).includes('PRIVATE_TOKEN'));assert.deepEqual(previewEvents(policy,events),r);
 assert.equal(previewEvents({...policy,correlation:'none'},[{}]).events[0].correlationId,null);
 assert.throws(()=>previewEvents(policy,Array(1001).fill({})));
});
test('logger owns fresh invocation correlation and snapshots policy before later caller mutation',()=>{
 const input=structuredClone(policy),out=[],logger=createLogger(input,e=>out.push(e));input.events.push('PRIVATE_TOKEN');input.maxEventsPerInvocation=99;
 for(let i=0;i<4;i++)logger.log({event:'PRIVATE_TOKEN',correlationId:'PRIVATE_TOKEN'});
 assert.equal(out.length,3);assert.equal(out[0].event,'other');
 assert.match(out[0].correlationId,/^[a-f0-9-]{36}$/);assert.ok(out.every(e=>e.correlationId===out[0].correlationId));
 const other=[];createLogger(policy,e=>other.push(e)).log({});assert.notEqual(other[0].correlationId,out[0].correlationId);
 assert.ok(!JSON.stringify(out).includes('PRIVATE_TOKEN'));
});
