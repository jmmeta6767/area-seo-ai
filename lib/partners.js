'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=message=>{const e=Error(message);e.status=422;throw e};
function text(x,max=2000){if(typeof x!=='string'||x.length>max)fail('ข้อมูลข้อความไม่ถูกต้อง');return x.trim()}
function url(x){if(!x)return '';let u;try{u=new URL(text(x))}catch{fail('ลิงก์ไม่ถูกต้อง กรุณาใช้ HTTPS')};if(u.protocol!=='https:'||u.username||u.password)fail('ลิงก์ต้องเป็น HTTPS');return u.href}
function createPartners({dataDir,persistent}){
 const file=path.join(dataDir,'partners.json');let state=null,pending=Promise.resolve(),cacheError=false;
 function validate(s){if(s?.version!==1||!Array.isArray(s.partners)||!Array.isArray(s.projects))throw Error('Invalid partner storage');const ids=new Set();for(const p of s.partners){if(!p.id||ids.has(p.id)||!p.name||typeof p.consent!=='boolean')throw Error('Invalid partner');ids.add(p.id)}const projects=new Set();for(const p of s.projects){if(!p.id||projects.has(p.id)||!ids.has(p.partnerId)||!p.title)throw Error('Invalid project');projects.add(p.id)}for(const key of ['links','publications']){if(s[key]!==undefined&&(!Array.isArray(s[key])||s[key].length>2000))throw Error('Invalid partner '+key)}for(const l of s.links||[]){if(!l.id||!ids.has(l.partnerId)||typeof l.source!=='string'||typeof l.target!=='string')throw Error('Invalid partner link')}for(const p of s.publications||[]){if(!ids.has(p.partnerId)||!p.pr?.number)throw Error('Invalid partner publication')}return s}
 function local(){return fs.existsSync(file)?validate(JSON.parse(fs.readFileSync(file,'utf8'))):{version:1,partners:[],projects:[]}}
 function cache(s){fs.mkdirSync(dataDir,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(s),{mode:0o600});fs.renameSync(temp,file)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}}
 async function init(){const saved=persistent?.configured?await persistent.get('partners',null):null;state=validate(saved??local());if(persistent?.configured&&saved===null)await persistent.set('partners',state);if(saved!==null){try{cache(state)}catch{cacheError=true}}}
 function read(){return copy(state??local())}
 function mutate(fn,dryRun=false){const task=pending.then(async()=>{const next=read(),result=fn(next);validate(next);if(dryRun)return copy(result);if(persistent?.configured){if(!state)throw Error('Partner storage not initialized');await persistent.set('partners',next);state=next;try{cache(next);cacheError=false}catch{cacheError=true}}else{cache(next);state=next}return copy(result)});pending=task.catch(()=>{});return task}
 // Restores share the same serialization queue as edits; stale checks run inside it.
 const checksum=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 function restoredState(backup){
  if(!backup||backup.version!==1)fail('ไฟล์สำรองคู่ค้าเวอร์ชันไม่ถูกต้อง');
  const next=copy(backup);
  for(const key of ['partners','projects','links','publications']){
   if(key==='partners'||key==='projects'||next[key]!==undefined){
    if(!Array.isArray(next[key])||next[key].length>2000)fail('รายการสำรองไม่ถูกต้องหรือเกินขีดจำกัด');
   }
  }
  try{validate(next)}catch{fail('ไฟล์สำรองมีรายการซ้ำหรือความสัมพันธ์ไม่ถูกต้อง')}
  for(const p of next.partners){
   text(p.id,100);text(p.name,200);url(p.website);
   for(const key of ['specialty','consentNote'])text(p[key]||'');
   text(p.area||'',200);text(p.contact||'',500);
   if(!['customer','partner','verified'].includes(p.relationship))fail('ประเภทคู่ค้าไม่ถูกต้อง');
   p.consent=false;
  }
  for(const p of next.projects){
   text(p.id,100);text(p.title,300);text(p.area||'',200);text(p.equipment||'');text(p.details||'',10000);
   url(p.imageUrl);text(p.imageAlt||'',500);text(p.disclosure||'',1000);
   p.projectConsent=false;
  }
  const ids=new Set();
  for(const l of next.links||[]){
   text(l.id,100);if(ids.has(l.id))fail('รหัสลิงก์ซ้ำ');ids.add(l.id);
   const {safeURL}=require('./partner-links');safeURL(l.source);safeURL(l.target);text(l.note||'',1000);l.check=null;
  }
  return {version:1,partners:next.partners,projects:next.projects,links:next.links||[],publications:next.publications||[]};
 }
 async function restore(backup,{confirm=false,expectedChecksum,expectedCurrentChecksum}={}){
  const next=restoredState(backup),backupChecksum=checksum(next);
  return mutate(s=>{
   const currentChecksum=checksum(s);
   const summary={dryRun:!confirm,checksum:backupChecksum,currentChecksum,counts:Object.fromEntries(['partners','projects','links','publications'].map(k=>[k,next[k].length])),consentReset:true};
   if(!confirm)return summary;
   if(expectedChecksum!==backupChecksum||expectedCurrentChecksum!==currentChecksum)throw Object.assign(Error('ไฟล์สำรองหรือข้อมูลปัจจุบันเปลี่ยน กรุณาตรวจใหม่ก่อนกู้คืน'),{status:409});
   for(const key of Object.keys(s))delete s[key];Object.assign(s,next);
   return {...summary,restored:true};
  },!confirm);
 }
 function save(kind,input){if(!['partners','projects'].includes(kind)||!input||typeof input!=='object'||Array.isArray(input))fail('ข้อมูลรายการไม่ถูกต้อง');return mutate(s=>{const collection=s[kind],old=input.id?collection.find(x=>x.id===input.id):null;if(input.id&&!old)fail('ไม่พบรายการ');if(collection.length>=2000&&!old)fail('รายการเต็ม กรุณาสำรองข้อมูล');let item;if(kind==='partners'){item={id:old?.id||randomUUID(),name:text(input.name,200),specialty:text(input.specialty||''),area:text(input.area||'',200),contact:text(input.contact||'',500),website:url(input.website),relationship:input.relationship,consent:input.consent===true,consentNote:text(input.consentNote||''),active:input.active!==false};if(!item.name||!['customer','partner','verified'].includes(item.relationship))fail('กรอกชื่อและประเภทความสัมพันธ์');if(item.consent&&!item.consentNote)fail('ระบุหลักฐานหรือวันที่ได้รับความยินยอม')}else{item={id:old?.id||randomUUID(),partnerId:text(input.partnerId,100),title:text(input.title,300),area:text(input.area||'',200),equipment:text(input.equipment||''),details:text(input.details||'',10000),imageUrl:url(input.imageUrl),imageAlt:text(input.imageAlt||'',500),projectConsent:input.projectConsent===true,sponsored:input.sponsored===true,disclosure:text(input.disclosure||'',1000)};if(!item.title||!s.partners.some(x=>x.id===item.partnerId))fail('เลือกผู้รับเหมาและกรอกชื่อโครงการ');if(item.imageUrl&&!item.imageAlt)fail('กรอกคำอธิบายภาพ');if(item.sponsored&&!item.disclosure)fail('ระบุสิทธิประโยชน์หรือค่าตอบแทน')}item.updatedAt=new Date().toISOString();if(old)collection[collection.indexOf(old)]=item;else collection.push(item);return item})}
 function draft(id){const s=read(),project=s.projects.find(x=>x.id===id),partner=s.partners.find(x=>x.id===project?.partnerId);if(!project||!partner)fail('ไม่พบโครงการ');if(!partner.active||!partner.consent||!project.projectConsent)fail('ต้องได้รับความยินยอมผู้รับเหมาและโครงการก่อนสร้างร่าง');const title=project.title+' — '+project.area;return{status:'draft',title,partner:copy(partner),project:copy(project),externalLink:partner.website?{url:partner.website,rel:project.sponsored?'sponsored noopener':'noopener'}:null,content:'# '+title+'\n\nดำเนินงานโดย '+partner.name+'\n\n## ข้อมูลหน้างาน\n'+project.details+'\n\n## อุปกรณ์ที่ใช้จาก AREA ไม้แบบ\n'+project.equipment+'\n\n'+(project.sponsored?'ความสัมพันธ์ทางการค้า: '+project.disclosure+'\n\n':'')+'## ติดต่อ\nผู้รับเหมา: '+partner.contact+'\nAREA ไม้แบบ: สอบถามเช่าอุปกรณ์สำหรับหน้างานแม่สาย',limitations:['ตรวจข้อเท็จจริงและ SEO Audit ก่อนส่ง Approval Queue','การเช่าอุปกรณ์ไม่ใช่การรับรองคุณภาพงาน','ไม่มีการบังคับแลกลิงก์หรือรับประกันอันดับ']}}
 function saveLink(input,base){if(!input||typeof input!=='object')fail('ข้อมูลลิงก์ไม่ถูกต้อง');return mutate(s=>{const {safeURL}=require('./partner-links');if(!s.partners.some(p=>p.id===input.partnerId))fail('ไม่พบคู่ค้า');s.links=s.links||[];if(s.links.length>=2000&&!input.id)fail('รายการลิงก์เต็ม');const old=input.id?s.links.find(l=>l.id===input.id):null;if(input.id&&!old)fail('ไม่พบลิงก์');const source=safeURL(input.source),target=safeURL(input.target);if(new URL(source).origin===new URL(base).origin)fail('บันทึกหน้าของคู่ค้าที่อยู่นอกเว็บไซต์ AREA');if(new URL(target).origin!==new URL(base).origin)fail('ปลายทางต้องเป็นเว็บไซต์ AREA ที่ตั้งค่าไว้');const row={id:old?.id||randomUUID(),partnerId:input.partnerId,source,target,note:text(input.note||'',1000),sponsored:input.sponsored===true,updatedAt:randomUUID(),check:null};if(old)s.links[s.links.indexOf(old)]=row;else s.links.push(row);return row})}
 function recordLinkCheck(id,version,report){return mutate(s=>{const row=(s.links||[]).find(l=>l.id===id);if(!row||row.updatedAt!==version)throw Object.assign(Error('ลิงก์เปลี่ยนระหว่างตรวจ กรุณาลองใหม่'),{status:409});row.check=report;return row})}
 function recordPublication(id,result){return mutate(s=>{if(!s.partners.some(p=>p.id===id))fail('ไม่พบคู่ค้า');s.publications=s.publications||[];s.publications=s.publications.filter(p=>p.partnerId!==id);const entry={partnerId:id,...result,recordedAt:new Date().toISOString()};s.publications.push(entry);return entry})}
 return{init,read,save,draft,restore,recordPublication,saveLink,recordLinkCheck,status:()=>({kind:persistent?.configured?'postgres':'file',cacheError,backupRoute:'/api/partners/backup'})};
}
module.exports={createPartners};
