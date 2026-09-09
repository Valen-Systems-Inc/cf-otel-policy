import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const cli=path.resolve(import.meta.dirname,'../cf-otel-policy.mjs');
const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:5000});
test('CLI generates, checks and previews a policy without dependencies',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'otel-cli-'));
 try{
  const file=path.join(dir,'policy.json'),events=path.join(dir,'events.json');
  await writeFile(file,JSON.stringify({events:['request.completed'],sampleRate:0.2,maxEventsPerInvocation:2,dailyInvocations:100,correlation:'none'}));
  let r=run('generate',file);assert.equal(r.status,0,r.stderr);const policy=JSON.parse(r.stdout);assert.equal(policy.schemaVersion,1);await writeFile(file,JSON.stringify(policy));
  assert.deepEqual(JSON.parse(run('check',file).stdout),{valid:true,issues:[]});
  assert.equal(JSON.parse(run('budget',file).stdout).expectedMaximumAdapterEvents,40);
  assert.equal(JSON.parse(run('wrangler',file).stdout).observability.logs.head_sampling_rate,0.2);
  await writeFile(events,'[{"event":"request.completed","token":"PRIVATE_TOKEN"}]');r=run('preview',file,events);assert.equal(r.status,0);assert.ok(!r.stdout.includes('PRIVATE_TOKEN'));assert.equal(JSON.parse(r.stdout).emitted,1);
  await writeFile(file,'{}');r=run('check',file);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).valid,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('CLI fails boundedly without input or path echo',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'otel-private-path-'));
 try{
  const file=path.join(dir,'PRIVATE_PATH');for(const text of ['PRIVATE_SECRET',' '.repeat(1048577)]){await writeFile(file,text);const r=run('check',file);assert.equal(r.status,64);assert.equal(r.stdout,'');assert.equal(r.stderr,'Invalid input or unreadable file.\n');}
  for(const args of [['check',dir],['check',file,'extra'],['preview',file],['check',path.join(dir,'missing')]]){const r=run(...args);assert.equal(r.status,64);assert.ok(!r.stderr.includes(dir));}
 }finally{await rm(dir,{recursive:true,force:true});}
});
