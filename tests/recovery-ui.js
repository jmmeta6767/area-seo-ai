'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

async function main(){
  const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  for(const id of ['recoveryCenter','downloadBackup','restoreFile','dryRunRestore','restoreConfirmText','confirmRestore','storageHealth'])assert(html.includes('id="'+id+'"'),id);
  assert(html.includes('<script src="recovery.js"></script>'));

  const elements=new Map();
  const el=id=>{
    if(!elements.has(id))elements.set(id,{id,textContent:'',className:'',disabled:false,value:'',files:[],onclick:null,onchange:null,oninput:null,scrollIntoView(){}});
    return elements.get(id);
  };
  const calls=[];
  const response=data=>({ok:true,json:async()=>data});
  const backup={schema_version:'3',approvals:[],approval_audit:[],site_history_full:{version:1,snapshots:[]},quality_history:{version:1,items:[]}};
  const dry={schema_version:'3',checksum:'bundle123',components:{approvals:{count:0},approval_audit:{count:0},site_history:{count:0},quality_history:{count:0}}};
  const fetch=async(url,opts={})=>{
    calls.push({url,opts});
    if(url==='/api/admin/readiness')return response({blockers:['persistent_storage']});
    if(url==='/api/admin/storage-health')return response({kind:'file',durable:false,ready:false});
    if(url==='/api/admin/backup')return response(backup);
    if(url==='/api/admin/restore'){
      const body=JSON.parse(opts.body||'{}');
      if(body.confirm){assert.equal(body.expectedChecksum,'bundle123');return response({...dry,restored:true});}
      return response(dry);
    }
    throw Error('Unexpected request '+url);
  };
  const document={
    getElementById:el,
    createElement:()=>({href:'',download:'',click(){},remove(){}}),
    body:{appendChild(){}}
  };
  const context=vm.createContext({
    document,window:{loadQueue(){}},fetch,Blob:global.Blob,
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
    setTimeout:fn=>{fn();return 1},clearTimeout(){},console
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/recovery.js'),'utf8'),context);
  await new Promise(r=>setImmediate(r));
  assert.match(el('recoveryReady').textContent,/File storage/);

  const file={size:256,text:async()=>JSON.stringify(backup)};
  el('restoreFile').files=[file];
  await el('restoreFile').onchange({target:el('restoreFile')});
  assert.equal(el('dryRunRestore').disabled,false);
  await el('dryRunRestore').onclick();
  assert.match(el('restorePreview').textContent,/Dry-run ผ่าน/);
  assert.equal(el('restoreConfirmText').disabled,false);

  el('restoreConfirmText').value='RESTORE';
  el('restoreConfirmText').oninput();
  assert.equal(el('confirmRestore').disabled,false);
  await el('confirmRestore').onclick();
  assert.match(el('restoreState').textContent,/กู้คืนสำเร็จ/);
  assert(calls.some(x=>x.url==='/api/admin/restore'&&JSON.parse(x.opts.body||'{}').expectedChecksum==='bundle123'));
  console.log('PASS: recovery console IDs, storage status, dry-run gate and checksum-bound confirm');
}
main().catch(e=>{console.error(e);process.exit(1)});
