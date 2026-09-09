import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildZip} from '../scripts/build.mjs';
test('ZIP contains only approved source and runs the local policy examples',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'otel-package-'));
 try{
  const r=await buildZip(dir);assert.ok(r?.archive,'Build must return an archive');
  const bytes=await readFile(r.archive);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);
  assert.equal(await readFile(r.archive+'.sha256','utf8'),`${r.sha256}  cf-otel-policy-v0.1.0.zip\n`);
  const files=execFileSync('unzip',['-Z1',r.archive],{encoding:'utf8'}).trim().split('\n').map(f=>f.replace('cf-otel-policy-v0.1.0/',''));
  assert.deepEqual(files.sort(),['LICENSE','README.md','package.json','cf-otel-policy.mjs','src/index.mjs','examples/spec.json','examples/policy.json','examples/events.json','examples/worker.mjs','examples/wrangler.jsonc','scripts/build.mjs','test/policy.test.mjs','test/cli.test.mjs','test/package.test.mjs','test/runtime.mjs'].sort());
  const out=path.join(dir,'unpacked');await mkdir(out);execFileSync('unzip',['-q',r.archive,'-d',out]);const cwd=path.join(out,'cf-otel-policy-v0.1.0');
  const run=(...args)=>JSON.parse(execFileSync(process.execPath,['cf-otel-policy.mjs',...args],{cwd,encoding:'utf8'}));
  assert.deepEqual(run('generate','examples/spec.json'),JSON.parse(await readFile(path.join(cwd,'examples/policy.json'))));
  assert.equal(run('check','examples/policy.json').valid,true);
  assert.equal(run('budget','examples/policy.json').expectedMaximumAdapterEvents,2000);
  const report=run('preview','examples/policy.json','examples/events.json');assert.equal(report.emitted,2);assert.equal(report.dropped,1);assert.ok(!JSON.stringify(report).includes('SYNTHETIC'));
  const config=JSON.parse(await readFile(path.join(cwd,'examples/wrangler.jsonc')));assert.deepEqual(config.observability,run('wrangler','examples/policy.json').observability);
 }finally{await rm(dir,{recursive:true,force:true});}
});
