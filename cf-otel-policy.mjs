#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {generatePolicy,lintPolicy,wranglerFragment,estimateBudget,previewEvents} from './src/index.mjs';
async function readJson(file){
 const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const stat=await handle.stat(),limit=1048576;if(!stat.isFile()||stat.size>limit)throw new Error();
  const b=Buffer.alloc(limit+1);let count=0;
  while(count<b.length){const {bytesRead}=await handle.read(b,count,b.length-count,null);if(!bytesRead)break;count+=bytesRead;}
  if(count>limit)throw new Error();return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,count)));
 }finally{await handle.close();}
}
const [mode,file,events,...extra]=process.argv.slice(2);
if(mode==='--help'&&!file){
 console.log('CF OTel Policy v0.1.0\ngenerate spec.json\ncheck policy.json\nwrangler policy.json\nbudget policy.json\npreview policy.json events.json\nPrefix each command with: node cf-otel-policy.mjs');
}else try{
 if(!['generate','check','wrangler','budget','preview'].includes(mode)||!file||extra.length||(mode==='preview'?!events:!!events))throw new Error();
 const p=await readJson(file);
 const r=mode==='generate'?generatePolicy(p):mode==='check'?lintPolicy(p):mode==='wrangler'?wranglerFragment(p):mode==='budget'?estimateBudget(p):previewEvents(p,await readJson(events));
 console.log(JSON.stringify(r,null,2));if(mode==='check'&&!r.valid)process.exitCode=1;
}catch{console.error('Invalid input or unreadable file.');process.exitCode=64;}
