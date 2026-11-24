'use strict';
(()=>{
 const $=id=>document.getElementById(id);let state={partners:[],projects:[]},draft=null;
 const status=x=>{$('status').textContent=x};
 async function api(route,data){const r=await fetch('/api/partners'+route,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),x=await r.json();if(!r.ok)throw Error(x.error||'Request failed');return x}
 function options(select,items,label,empty){select.replaceChildren(new Option(empty,''),...items.map(x=>new Option(label(x),x.id)))}
 async function refresh(){state=await api('');options($('partnerEdit'),state.partners,x=>x.name,'เพิ่มคู่ค้าใหม่');options($('projectEdit'),state.projects,x=>x.title,'เพิ่มโครงการใหม่');options($('projectForm').elements.partnerId,state.partners,x=>x.name,'เลือกผู้รับเหมา');status('คู่ค้า '+state.partners.length+' ราย · โครงการ '+state.projects.length+' งาน · '+state.storage.kind+(state.storage.kind==='file'?' — ต้องสำรองข้อมูลก่อน redeploy':state.storage.cacheError?' — สำเนาไฟล์ภายในมีข้อผิดพลาด':''))}
 function clearDraft(){draft=null;$('preview').textContent='';$('download').disabled=true}
 for(const kind of ['partner','project']){const form=$(kind+'Form');form.addEventListener('input',clearDraft);$(kind+'Edit').onchange=()=>{clearDraft();form.reset();form.elements.id.value='';const item=state[kind==='partner'?'partners':'projects'].find(x=>x.id===$(kind+'Edit').value);if(item)for(const [key,value]of Object.entries(item)){const field=form.elements.namedItem(key);if(field){if(field.type==='checkbox')field.checked=value;else field.value=value}}};form.onsubmit=async e=>{e.preventDefault();clearDraft();const x=Object.fromEntries(new FormData(form));for(const f of form.querySelectorAll('[type=checkbox]'))x[f.name]=f.checked;try{await api('/'+(kind==='partner'?'partners':'projects'),x);await refresh();form.reset();form.elements.id.value='';status('บันทึกแล้ว')}catch(e){status(e.message)}}}
 function download(value,name){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
 $('backup').onclick=async()=>{try{download(await api('/backup'),'area-partners-backup.json')}catch(e){status(e.message)}};
 $('draft').onclick=async()=>{clearDraft();const id=$('projectEdit').value;if(!id)return status('เลือกโครงการที่บันทึกแล้วก่อน');try{draft=await api('/projects/'+encodeURIComponent(id)+'/draft');$('preview').textContent=draft.content+'\n\n'+draft.limitations.join('\n');$('download').disabled=false}catch(e){status(e.message)}};
 $('download').onclick=()=>{if(draft)download(draft,'area-project-draft.json')};refresh().catch(e=>status(e.message));
})();
