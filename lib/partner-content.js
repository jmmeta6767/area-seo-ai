'use strict';
const {createHash}=require('node:crypto');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function snapshot(store,id){
  const d=store.draft(id),p=d.partner,j=d.project;
  const publicData={partnerId:p.id,projectId:j.id,name:p.name,specialty:p.specialty,area:p.area,contact:p.contact,website:p.website,title:j.title,projectArea:j.area,equipment:j.equipment,details:j.details,imageUrl:j.imageUrl,imageAlt:j.imageAlt,sponsored:j.sponsored,disclosure:j.disclosure};
  const fingerprint=createHash('sha256').update(JSON.stringify({...publicData,partnerUpdatedAt:p.updatedAt,projectUpdatedAt:j.updatedAt})).digest('hex');
  return {data:publicData,reference:{projectId:j.id,fingerprint}};
}
function resolve(store,reference){
  if(!reference||typeof reference.projectId!=='string'||!reference.projectId||typeof reference.fingerprint!=='string')throw Object.assign(Error('ข้อมูลอ้างอิงโครงการไม่ถูกต้อง'),{status:422});
  const current=snapshot(store,reference.projectId);
  if(current.reference.fingerprint!==reference.fingerprint)throw Object.assign(Error('ข้อมูลคู่ค้าหรือโครงการเปลี่ยนแล้ว กรุณาโหลดร่างใหม่และตรวจอีกครั้ง'),{status:409});
  return current.data;
}
function mentionHtml(p){
 if(!p)return '';
 let website='';if(p.website){const u=new URL(p.website);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid partner website');website='<a href="'+esc(u.href)+'" rel="'+(p.sponsored?'sponsored noopener noreferrer':'noopener noreferrer')+'">'+esc(p.name)+'</a>'}
 return '<section class="articleSection partnerMention"><h2>ผู้รับเหมาในโครงการนี้</h2><p>'+esc(p.name)+'</p><p>'+esc(p.contact)+'</p>'+website+(p.sponsored?'<p>ความสัมพันธ์ทางการค้า: '+esc(p.disclosure)+'</p>':'')+'<p>การใช้บริการเช่าอุปกรณ์ไม่ใช่การรับรองคุณภาพงานก่อสร้าง</p></section>';
}
function document(title,body){return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+esc(title)+'</title><style>body{font-family:system-ui;max-width:900px;margin:auto;padding:24px;line-height:1.7;overflow-wrap:anywhere}img{max-width:100%;height:auto}article{border:1px solid #ccc;border-radius:12px;padding:16px;margin:16px 0}a{color:#805300}</style></head><body><p>ตัวอย่างสำหรับตรวจ — ยังไม่เผยแพร่</p><main><h1>'+esc(title)+'</h1>'+body+'</main></body></html>'}
function projectPreview(store,id){const {data:p}=snapshot(store,id);return document(p.title,'<p>พื้นที่หน้างาน: '+esc(p.projectArea)+'</p><p>'+esc(p.details).replace(/\n/g,'<br>')+'</p><h2>อุปกรณ์ที่เช่าจาก AREA ไม้แบบ</h2><p>'+esc(p.equipment)+'</p>'+(p.imageUrl?'<figure><img referrerpolicy="no-referrer" src="'+esc(p.imageUrl)+'" alt="'+esc(p.imageAlt)+'"><figcaption>'+esc(p.imageAlt)+'</figcaption></figure>':'')+mentionHtml(p)+'<p>สอบถามเช่าอุปกรณ์สำหรับหน้างานแม่สายกับ AREA ไม้แบบ</p>')}
function profilePreview(store,id){const state=store.read(),p=state.partners.find(p=>p.id===id);if(!p?.active||!p.consent)throw Object.assign(Error('คู่ค้ายังไม่อนุญาตเผยแพร่'),{status:422});const projects=state.projects.filter(j=>j.partnerId===id&&j.projectConsent);return document(p.name,'<p>'+esc(p.specialty)+'</p><p>พื้นที่รับงานที่แจ้ง: '+esc(p.area)+'</p><p>'+esc(p.contact)+'</p><h2>ผลงานที่ใช้บริการ AREA ไม้แบบ</h2>'+projects.map(j=>'<article><h3>'+esc(j.title)+'</h3><p>'+esc(j.area)+'</p><p>'+esc(j.equipment)+'</p><a href="/api/partners/projects/'+encodeURIComponent(j.id)+'/preview">ดูผลงาน</a></article>').join('')+'<p>การใช้บริการเช่าอุปกรณ์ไม่ใช่การรับรองคุณภาพงานก่อสร้าง</p>')}
function workspace(store,id){const d=store.draft(id),s=snapshot(store,id);return {title:d.title,meta:'',slug:'project-'+id,content:d.content,service:'ผลงานโครงการ',primaryKeyword:'',imagePrompt:'',imageAlt:d.project.imageAlt,cta:'สอบถามเช่าอุปกรณ์สำหรับหน้างานแม่สาย',schema:{'@context':'https://schema.org','@type':'Article'},partnerReference:s.reference}}
module.exports={snapshot,resolve,mentionHtml,profilePreview,projectPreview,workspace};
