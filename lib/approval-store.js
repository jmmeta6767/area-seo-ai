'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');

function createApprovalStore({dataDir}){
  const queueFile=path.join(dataDir,'approval.json'),auditFile=path.join(dataDir,'approval-audit.jsonl');
  fs.mkdirSync(dataDir,{recursive:true});
  if(!fs.existsSync(queueFile))atomicWrite([]);
  function read(){
    try{const x=JSON.parse(fs.readFileSync(queueFile,'utf8'));if(!Array.isArray(x))throw Error('Approval store must be an array');return x}
    catch(e){e.message='Cannot read approval store; preserve data and restore a valid backup: '+e.message;throw e}
  }
  function atomicWrite(value){
    fs.mkdirSync(dataDir,{recursive:true});const tmp=queueFile+'.'+randomUUID()+'.tmp';
    try{fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,queueFile)}
    finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
  }
  function audit(event){
    const clean={at:new Date().toISOString(),event:String(event.event||''),draftId:event.draftId||null,from:event.from||null,to:event.to||null,detail:event.detail||null};
    fs.appendFileSync(auditFile,JSON.stringify(clean)+'\n',{mode:0o600});return clean;
  }
  function transition(id,to,allowed,detail){
    const q=read(),i=q.findIndex(x=>x.id===id);if(i<0){const e=Error('Draft not found');e.status=404;throw e}
    const from=q[i].status;if(!allowed.includes(from)){const e=Error('Invalid status transition: '+from+' -> '+to);e.status=409;throw e}
    q[i].status=to;q[i].updatedAt=new Date().toISOString();atomicWrite(q);audit({event:'status_transition',draftId:id,from,to,detail});return q[i];
  }
  function events(limit=100){if(!fs.existsSync(auditFile))return[];return fs.readFileSync(auditFile,'utf8').split('\n').filter(Boolean).slice(-Math.max(1,Math.min(Number(limit)||100,500))).map(line=>JSON.parse(line)).reverse()}
  return {read,write:atomicWrite,audit,transition,events,queueFile,auditFile};
}
module.exports={createApprovalStore};
