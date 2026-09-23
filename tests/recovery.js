const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApprovalStore}=require('../lib/approval-store');
const {validateBackup,restore}=require('../lib/recovery');
const clone=x=>JSON.parse(JSON.stringify(x));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'area-recovery-'));
const quality=()=>({version:1,items:[{id:'q1',title:'เช่าไม้แบบ แม่สาย',primaryKeyword:'ไม้แบบ',report:{
  schema_version:'1.0',article_hash:'a'.repeat(64),reviewed_at:'2026-09-23T00:00:00.000Z',overall_score:75,verdict:'pass',
  categories:['on_page_seo','local_seo','conversion_cta','accuracy_value','readability_structure'].map(id=>({id,score:15,findings:[]})),priority_fixes:[]
}}]});
const history=id=>({version:1,snapshots:[{id,site:'https://example.com/',scannedAt:'2026-09-23T00:00:00.000Z',pages:[]}]});
(async()=>{
 try{
  const store=createApprovalStore({dataDir:dir});
  const legacy={schema_version:'2',approvals:[{id:'d1',status:'approved'}],approval_audit:[{at:'2026-09-23T00:00:00Z',event:'draft_approved',draftId:'d1'}]};
  assert.equal(validateBackup(legacy).approvals.length,1);
  assert.throws(()=>validateBackup({...legacy,schema_version:'1'}),/schema_version 2 or 3/);
  assert.throws(()=>validateBackup({...legacy,approvals:[legacy.approvals[0],legacy.approvals[0]]}),/Duplicate/);
  const dry=await restore({backup:legacy,approvalStore:store,persistent:{configured:false},dryRun:true});
  assert.equal(dry.dryRun,true);assert.equal(dry.components.site_history.skipped,true);assert.deepEqual(store.read(),[]);
  const done=await restore({backup:legacy,approvalStore:store,persistent:{configured:false},dryRun:false});
  assert.equal(done.restored,true);assert.equal(store.read()[0].id,'d1');assert.equal(done.components.approvals.count,1);
  assert.equal(store.events()[0].event,'backup_restored');

  let siteState=history('old-site'),qualityState={version:1,items:[]};
  const intelligence={exportHistory:()=>clone(siteState),restoreHistory:async data=>{siteState=clone(data)}};
  const qualityHistory={exportHistory:()=>clone(qualityState),replace:async data=>{qualityState=clone(data)}};
  const full={schema_version:'3',approvals:[{id:'d2',status:'ready_for_review'}],approval_audit:[
    {at:'2026-09-22T00:00:00Z',event:'draft_created',draftId:'d2'},
    {at:'2026-09-23T00:00:00Z',event:'draft_reviewed',draftId:'d2'}
  ],site_history_full:history('restored-site'),quality_history:quality()};
  const preview=await restore({backup:full,approvalStore:store,persistent:{configured:false},intelligence,qualityHistory,dryRun:true});
  assert.equal(preview.components.site_history.count,1);assert.equal(preview.components.quality_history.count,1);
  assert.equal(siteState.snapshots[0].id,'old-site');
  const restored=await restore({backup:full,approvalStore:store,persistent:{configured:false},intelligence,qualityHistory,dryRun:false});
  assert.equal(restored.restored,true);assert.equal(restored.durableTransaction,false);
  assert.equal(store.read()[0].id,'d2');assert.equal(siteState.snapshots[0].id,'restored-site');assert.equal(qualityState.items[0].id,'q1');
  assert.equal(store.allEvents().at(-1).event,'backup_restored');

  const beforeQueue=clone(store.read()),beforeEvents=clone(store.allEvents()),beforeSite=clone(siteState),beforeQuality=clone(qualityState);
  let durable=[];
  const persistent={configured:true,restoreSnapshot:async snapshot=>{durable.push(clone(snapshot));},audit:async()=>{}};
  const failingQuality={exportHistory:()=>clone(beforeQuality),replace:async(data)=>{if(data.items?.[0]?.id==='q-bad')throw Error('disk failure');qualityState=clone(data)}};
  const badQuality=quality();badQuality.items[0].id='q-bad';
  const bad={...full,approvals:[{id:'d3',status:'approved'}],site_history_full:history('new-site'),quality_history:badQuality};
  await assert.rejects(()=>restore({backup:bad,approvalStore:store,persistent,intelligence,qualityHistory:failingQuality,dryRun:false}),/previous state was restored/);
  assert.equal(durable.length,2);assert.equal(durable[1].approvalQueue[0].id,beforeQueue[0].id);
  assert.deepEqual(store.read(),beforeQueue);assert.deepEqual(store.allEvents(),beforeEvents);assert.deepEqual(siteState,beforeSite);assert.deepEqual(qualityState,beforeQuality);

  assert.throws(()=>validateBackup({...full,site_history_full:null}),/requires site_history_full/);
  console.log('PASS: legacy recovery, full v3 backup restore, dry-run checksums and rollback');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exit(1)});
