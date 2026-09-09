import {createLogger} from '../src/index.mjs';
import policy from './policy.json';
// Local demonstration: return the projected events so you can inspect them.
// In your own handler, createLogger(policy) sends objects to console.log.
export default {
 async fetch(request){
  const events=[],logger=createLogger(policy,event=>events.push(event));
  logger.log({event:'request.completed',level:'info',status:200,durationMs:0,url:request.url,headers:Object.fromEntries(request.headers),correlationId:request.headers.get('x-request-id')});
  logger.log({event:'request.completed',level:'debug',status:200,durationMs:1});
  const overCapAccepted=logger.log({event:'request.failed',level:'error',status:503});
  return Response.json({events,overCapAccepted});
 }
};
