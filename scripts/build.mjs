import {mkdtemp,mkdir,copyFile,readFile,writeFile,utimes,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile as callback} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(callback);
export const ROOT='cf-otel-policy-v0.1.0';
export const FILES=['LICENSE','README.md','package.json','cf-otel-policy.mjs','src/index.mjs','examples/spec.json','examples/policy.json','examples/events.json','examples/worker.mjs','examples/wrangler.jsonc','scripts/build.mjs','test/policy.test.mjs','test/cli.test.mjs','test/package.test.mjs','test/runtime.mjs'].sort();
const source=path.resolve(import.meta.dirname,'..');
export async function buildZip(outDir=path.join(source,'dist')) {
  await mkdir(outDir,{recursive:true});const stage=await mkdtemp(path.join(outDir,'.stage-'));
  try {
    for(const f of FILES) {
      const dest=path.join(stage,ROOT,f);await mkdir(path.dirname(dest),{recursive:true});
      await copyFile(path.join(source,f),dest);await utimes(dest,946684800,946684800);
    }
    const temporary=path.join(stage,'artifact.zip');
    await exec('/usr/bin/zip',['-X','-q',temporary,...FILES.map(f=>ROOT+'/'+f)],{cwd:stage});
    const bytes=await readFile(temporary),sha256=createHash('sha256').update(bytes).digest('hex');
    const archive=path.join(outDir,ROOT+'.zip');await writeFile(archive,bytes);
    await writeFile(archive+'.sha256',`${sha256}  ${ROOT}.zip\n`);
    return {archive,bytes:bytes.length,sha256};
  } finally {await rm(stage,{recursive:true,force:true});}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildZip()));
