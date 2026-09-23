'use strict';
const crypto=require('node:crypto');

function validateBackup(input){
  if(!input||input.schema_version!=='2')throw Object.assign(Error('Backup schema_version 2 required'),{status:400});
  if(!Array.isArray(input.approvals)||!Array.isArray(input.approval_audit))throw Object.assign(Error('Backup approvals and approval_audit must be arrays'),{status:400});
  const ids=new Set();
  for(const d of input.approvals){if(!d||typeof d.id!=='string'||!d.id)throw Object.assign(Error('Every approval needs an id'),{status:400});if(ids.has(d.id))throw Object.assign(Error('Duplicate approval id in backup'),{status:400});ids.add(d.id)}
  return {approvals:input.approvals,events:input.approval_audit};
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}
async function restore({backup,approvalStore,persistent,dryRun=true}){
  const clean=validateBackup(backup),summary={approvals:clean.approvals.length,auditEvents:clean.events.length,checksum:digest(clean.approvals),dryRun:Boolean(dryRun)};
  if(dryRun)return summary;
  approvalStore.write(clean.approvals);
  if(persistent.configured){await persistent.set('approval_queue',clean.approvals);for(const e of clean.events)await persistent.audit({...e,event:e.event||'restored_event'})}
  approvalStore.audit({event:'backup_restored',detail:summary});
  return {...summary,restored:true};
}
module.exports={validateBackup,digest,restore};
