'use strict';
const crypto=require('node:crypto');
const {validateHistory}=require('./history-store');
const {validate:validateQualityHistory}=require('./quality-history');

const clone=x=>JSON.parse(JSON.stringify(x));
function normalizeAudit(events){
  if(!Array.isArray(events))throw Object.assign(Error('Backup approval_audit must be an array'),{status:400});
  return events.map((e,i)=>{
    if(!e||typeof e!=='object'||typeof e.event!=='string'||!e.event.trim())throw Object.assign(Error('Invalid approval audit event at index '+i),{status:400});
    if(e.at&&!Number.isFinite(Date.parse(e.at)))throw Object.assign(Error('Invalid approval audit timestamp at index '+i),{status:400});
    return {at:e.at?new Date(e.at).toISOString():new Date(0).toISOString(),event:e.event,draftId:e.draftId||null,from:e.from||null,to:e.to||null,detail:e.detail??null};
  }).sort((a,b)=>a.at.localeCompare(b.at));
}
function validateApprovals(items){
  if(!Array.isArray(items))throw Object.assign(Error('Backup approvals must be an array'),{status:400});
  const ids=new Set();
  for(const d of items){
    if(!d||typeof d.id!=='string'||!d.id)throw Object.assign(Error('Every approval needs an id'),{status:400});
    if(ids.has(d.id))throw Object.assign(Error('Duplicate approval id in backup'),{status:400});
    ids.add(d.id);
  }
  return items;
}
function validateBackup(input){
  const version=String(input?.schema_version||'');
  if(!['2','3'].includes(version))throw Object.assign(Error('Backup schema_version 2 or 3 required'),{status:400});
  const approvals=validateApprovals(input.approvals),events=normalizeAudit(input.approval_audit);
  let siteHistory=null,qualityHistory=null;
  if(input.site_history_full!==undefined&&input.site_history_full!==null)siteHistory=validateHistory(input.site_history_full);
  if(input.quality_history!==undefined&&input.quality_history!==null)qualityHistory=validateQualityHistory(input.quality_history);
  if(version==='3'&&(!siteHistory||!qualityHistory))throw Object.assign(Error('Backup schema_version 3 requires site_history_full and quality_history'),{status:400});
  return {version,approvals,events,siteHistory,qualityHistory};
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}
function summaryOf(clean,dryRun){
  const components={
    approvals:{count:clean.approvals.length,checksum:digest(clean.approvals)},
    approval_audit:{count:clean.events.length,checksum:digest(clean.events)},
    site_history:clean.siteHistory?{count:clean.siteHistory.snapshots.length,checksum:digest(clean.siteHistory)}:{skipped:true},
    quality_history:clean.qualityHistory?{count:clean.qualityHistory.items.length,checksum:digest(clean.qualityHistory)}:{skipped:true}
  };
  return {schema_version:clean.version,dryRun:Boolean(dryRun),components,checksum:digest({approvals:clean.approvals,events:clean.events,siteHistory:clean.siteHistory,qualityHistory:clean.qualityHistory})};
}
async function applyLocal({clean,approvalStore,intelligence,qualityHistory}){
  approvalStore.write(clean.approvals);
  approvalStore.replaceAudit(clean.events);
  if(clean.siteHistory){
    if(!intelligence?.restoreHistory)throw Error('Website history restore is unavailable');
    await intelligence.restoreHistory(clean.siteHistory,{skipPersistent:true});
  }
  if(clean.qualityHistory){
    if(!qualityHistory?.replace)throw Error('Quality history restore is unavailable');
    await qualityHistory.replace(clean.qualityHistory,{skipPersistent:true});
  }
}
async function restore({backup,approvalStore,persistent,intelligence,qualityHistory,dryRun=true,expectedChecksum=null}){
  const clean=validateBackup(backup),summary=summaryOf(clean,dryRun);
  if(expectedChecksum&&expectedChecksum!==summary.checksum)throw Object.assign(Error('Backup checksum changed after dry-run; run validation again'),{status:409});
  if(dryRun)return summary;
  const previous={
    approvals:clone(approvalStore.read()),
    events:clone(approvalStore.allEvents()),
    siteHistory:clean.siteHistory?clone(intelligence.exportHistory()):null,
    qualityHistory:clean.qualityHistory?clone(qualityHistory.exportHistory()):null
  };
  const fullDurable=Boolean(persistent?.configured&&clean.siteHistory&&clean.qualityHistory&&typeof persistent.restoreSnapshot==='function');
  let durableCommitted=false;
  try{
    if(fullDurable){
      await persistent.restoreSnapshot({approvalQueue:clean.approvals,siteHistory:clean.siteHistory,qualityHistory:clean.qualityHistory,auditEvents:clean.events});
      durableCommitted=true;
    }else if(persistent?.configured){
      await persistent.set('approval_queue',clean.approvals);
      for(const e of clean.events)await persistent.audit(e);
    }
    await applyLocal({clean,approvalStore,intelligence,qualityHistory});
  }catch(e){
    let rollbackOk=true;
    try{
      if(durableCommitted)await persistent.restoreSnapshot({approvalQueue:previous.approvals,siteHistory:previous.siteHistory,qualityHistory:previous.qualityHistory,auditEvents:previous.events});
      approvalStore.write(previous.approvals);approvalStore.replaceAudit(previous.events);
      if(previous.siteHistory)await intelligence.restoreHistory(previous.siteHistory,{skipPersistent:true});
      if(previous.qualityHistory)await qualityHistory.replace(previous.qualityHistory,{skipPersistent:true});
    }catch{rollbackOk=false}
    throw Object.assign(Error(rollbackOk?'Restore failed; previous state was restored':'Restore failed and rollback could not be fully completed'),{status:500});
  }
  const event={event:'backup_restored',detail:{...summary,dryRun:false}};
  approvalStore.audit(event);
  if(persistent?.configured)await persistent.audit(event);
  return {...summary,dryRun:false,restored:true,durableTransaction:fullDurable};
}
module.exports={validateBackup,digest,normalizeAudit,restore};
