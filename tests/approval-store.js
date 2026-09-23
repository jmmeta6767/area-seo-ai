const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApprovalStore}=require('../lib/approval-store');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'area-approval-'));
try{
 const s=createApprovalStore({dataDir:dir});
 assert.deepEqual(s.read(),[]);
 s.write([{id:'d1',status:'ready_for_review'}]);
 assert.equal(s.read()[0].status,'ready_for_review');
 const a=s.transition('d1','approved',['ready_for_review'],{actor:'test'});
 assert.equal(a.status,'approved');assert.equal(s.read()[0].status,'approved');
 assert.throws(()=>s.transition('d1','approved',['ready_for_review']),/Invalid status transition/);
 s.audit({event:'publish_pr_created',draftId:'d1',from:'approved',to:'publishing',detail:{pr:4}});
 const events=s.events();assert.equal(events.length,2);assert.equal(events[0].event,'publish_pr_created');assert.equal(events[1].event,'status_transition');
 fs.writeFileSync(s.queueFile,'{broken');
 assert.throws(()=>s.read(),/preserve data/);
 console.log('PASS: atomic approval persistence, guarded transitions, audit trail and corrupt-store fail-closed');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
