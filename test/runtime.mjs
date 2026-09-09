// Optional local runtime test; set MINIFLARE_MODULE or install Miniflare.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
const {Miniflare,convertV4MiniflareOptions}=await import(process.env.MINIFLARE_MODULE??'miniflare');
const root=path.resolve(import.meta.dirname,'..');
// Wrangler bundles JSON imports; represent that same literal as an ES module here.
const modules=await Promise.all(['examples/worker.mjs','src/index.mjs','examples/policy.json'].map(async file=>({type:'ESModule',path:path.join(root,file),contents:file.endsWith('.json')?`export default ${await readFile(path.join(root,file),'utf8')};`:await readFile(path.join(root,file),'utf8')})));
const options={modules,modulesRoot:root,compatibilityDate:'2026-09-09'};
const mf=new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);
try{
 const request=()=>mf.dispatchFetch('https://example.invalid/?token=SYNTHETIC_SECRET',{headers:{authorization:'Bearer SYNTHETIC_SECRET','x-request-id':'SYNTHETIC_SECRET'}});
 const a=await request();assert.equal(a.status,200);const first=await a.json();
 assert.equal(first.events.length,2);assert.equal(first.overCapAccepted,false);assert.ok(!JSON.stringify(first).includes('SYNTHETIC_SECRET'));
 assert.equal(first.events[0].correlationId,first.events[1].correlationId);
 const second=await (await request()).json();assert.notEqual(second.events[0].correlationId,first.events[0].correlationId);
 console.log('Local Workers runtime: event projection, fresh invocation IDs and per-invocation cap passed.');
}finally{await mf.dispose();}
