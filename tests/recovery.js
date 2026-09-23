const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApprovalStore}=require('../lib/approval-store');
const {validateBackup,digest,restore}=require('../lib/recovery');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'area-recovery-'));
(async()=>{
 try{
  const store=createApprovalStore({dataDir:dir});
  const backup={schema_version:'2',approvals:[{id:'d1',status:'approved'}],approval_audit:[{event:'draft_approved',draftId:'d1'}]};
  assert.equal(validateBackup(backup).approvals.length,1);
  assert.throws(()=>validateBackup({...backup,schema_version:'1'}),/schema_version 2/);
  assert.throws(()=>validateBackup({...backup,approvals:[backup.approvals[0],backup.approvals[0]]}),/Duplicate/);
  const dry=await restore({backup,approvalStore:store,persistent:{configured:false},dryRun:true});
  assert.equal(dry.dryRun,true);assert.deepEqual(store.read(),[]);
  const done=await restore({backup,approvalStore:store,persistent:{configured:false},dryRun:false});
  assert.equal(done.restored,true);assert.equal(store.read()[0].id,'d1');assert.equal(done.checksum,digest(backup.approvals));
  assert.equal(store.events()[0].event,'backup_restored');
  console.log('PASS: recovery validation, checksum, dry-run and confirmed restore');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exit(1)});
