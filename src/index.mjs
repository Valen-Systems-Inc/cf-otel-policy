const keys=['schemaVersion','events','sampleRate','maxEventsPerInvocation','dailyInvocations','correlation'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const fail=()=>{throw new Error('Invalid policy or event input');};
export function lintPolicy(p) {
 if(!object(p))return {valid:false,issues:['POLICY_OBJECT']};
 const issues=[];
 if(Object.keys(p).some(k=>!keys.includes(k)))issues.push('UNKNOWN_FIELDS');
 if(p.schemaVersion!==1)issues.push('SCHEMA_VERSION');
 if(!Array.isArray(p.events)||p.events.length<1||p.events.length>50||p.events.some(e=>typeof e!=='string'||!/^[a-z][a-z0-9_.-]{0,47}$/.test(e))||new Set(p.events).size!==p.events.length)issues.push('EVENT_LABELS');
 if(typeof p.sampleRate!=='number'||!Number.isFinite(p.sampleRate)||p.sampleRate<0||p.sampleRate>1)issues.push('SAMPLE_RATE');
 if(!int(p.maxEventsPerInvocation,1,100))issues.push('EVENT_CAP');
 if(!int(p.dailyInvocations,0,1000000000))issues.push('DAILY_INVOCATIONS');
 if(!['fresh-random','none'].includes(p.correlation))issues.push('CORRELATION');
 return {valid:issues.length===0,issues};
}
const requirePolicy=p=>{if(!lintPolicy(p).valid)fail();};
export function generatePolicy(spec) {
 if(!object(spec)||Object.keys(spec).some(k=>!keys.slice(1).includes(k)))fail();
 const p={schemaVersion:1,...spec};requirePolicy(p);
 return {schemaVersion:1,events:[...p.events].sort(),sampleRate:p.sampleRate,maxEventsPerInvocation:p.maxEventsPerInvocation,dailyInvocations:p.dailyInvocations,correlation:p.correlation};
}
export function wranglerFragment(p) {
 requirePolicy(p);
 return {observability:{enabled:true,redact_query_string:true,logs:{enabled:true,invocation_logs:false,head_sampling_rate:p.sampleRate},traces:{enabled:false}}};
}
export function estimateBudget(p) {
 requirePolicy(p);
 const sampled=p.dailyInvocations*p.sampleRate;
 return {dailyInvocations:p.dailyInvocations,expectedSampledInvocations:sampled,expectedMaximumAdapterEvents:sampled*p.maxEventsPerInvocation,unsampledMaximumAdapterEvents:p.dailyInvocations*p.maxEventsPerInvocation};
}
function project(p,e,correlationId) {
 if(!object(e))fail();
 return {event:p.events.includes(e.event)?e.event:'other',level:['debug','info','warn','error'].includes(e.level)?e.level:null,status:int(e.status,100,599)?e.status:null,durationMs:int(e.durationMs,0,86400000)?e.durationMs:null,correlationId};
}
export function previewEvents(p,events) {
 requirePolicy(p);
 if(!Array.isArray(events)||events.length>1000||events.some(e=>!object(e)))fail();
 const id=p.correlation==='fresh-random'?'00000000-0000-4000-8000-000000000000':null;
 const output=events.slice(0,p.maxEventsPerInvocation).map(e=>project(p,e,id));
 return {schemaVersion:1,emitted:output.length,dropped:events.length-output.length,events:output};
}
export function createLogger(policy,emit=event=>console.log(event)) {
 requirePolicy(policy);if(typeof emit!=='function')fail();
 const p={...policy,events:[...policy.events]},id=p.correlation==='fresh-random'?crypto.randomUUID():null;
 let count=0;
 return {log(event){
  if(count>=p.maxEventsPerInvocation)return false;
  const safe=project(p,event,id);count++;emit(safe);return true;
 }};
}
