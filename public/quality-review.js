(() => {
 const el=id=>document.getElementById(id);let result=null,requestId=0,historyRequestId=0;
 const input=()=>Object.fromEntries(['title','meta','cta','primaryKeyword','service'].map(k=>[k,el(k).value]).concat([['content',el('body').value]]));
 function clear(){result=null;el('qualityReport').textContent='';el('qualityDownload').disabled=true;}
 function show(report){result=report;el('qualityReport').textContent=JSON.stringify(report,null,2);el('qualityDownload').disabled=false;}
 window.invalidateQualityReview=()=>{requestId++;clear();el('qualityState').textContent='บทความมีการเปลี่ยนแปลง กรุณารีเช็คอีกครั้ง';};
 for(const id of ['title','meta','body','cta','primaryKeyword','service'])el(id).addEventListener('input',window.invalidateQualityReview);
 async function loadHistory(){
   const id=++historyRequestId,select=el('qualityHistory'),selected=select.value;
   el('qualityHistoryOpen').disabled=true;
   try{
     const response=await fetch('/api/seo/quality-history'),data=await response.json();
     if(id!==historyRequestId)return;
     if(!response.ok)throw Error(data.error||'โหลดประวัติไม่สำเร็จ');
     select.replaceChildren();
     const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=data.items.length?'เลือกผลตรวจย้อนหลัง':'ยังไม่มีประวัติผลตรวจ';select.appendChild(placeholder);
     for(const item of data.items){const option=document.createElement('option');option.value=item.id;option.textContent=new Date(item.reviewed_at).toLocaleString('th-TH')+' · '+item.overall_score+'/100 · '+(item.title||item.primaryKeyword||'บทความไม่ระบุชื่อ')+' · จุดแก้ไข '+item.priority_fix_count;select.appendChild(option);}
     select.value=data.items.some(item=>item.id===selected)?selected:'';
     el('qualityHistoryOpen').disabled=!select.value;el('qualityStorage').textContent=data.storageNote;
   }catch(e){if(id!==historyRequestId)return;select.replaceChildren();el('qualityStorage').textContent='อ่านประวัติไม่ได้: '+e.message;}
 }
 el('qualityHistory').onchange=()=>{el('qualityHistoryOpen').disabled=!el('qualityHistory').value;};
 el('qualityHistoryRefresh').onclick=loadHistory;
 el('qualityHistoryOpen').onclick=async()=>{
   const selected=el('qualityHistory').value;if(!selected)return;
   const id=++requestId;clear();el('qualityState').textContent='กำลังอ่านผลตรวจย้อนหลัง…';
   try{
     const response=await fetch('/api/seo/quality-history/'+encodeURIComponent(selected)),data=await response.json();
     if(id!==requestId)return;
     if(!response.ok)throw Error(data.error||'เปิดผลตรวจไม่ได้');
     show(data.report);el('qualityState').textContent='ผลย้อนหลัง · '+(data.title||data.primaryKeyword||'บทความไม่ระบุชื่อ')+' · '+new Date(data.report.reviewed_at).toLocaleString('th-TH')+' · '+data.report.overall_score+'/100 · ไม่ใช่ผลตรวจฉบับที่กำลังแก้ไข';
   }catch(e){if(id===requestId)el('qualityState').textContent='เปิดผลตรวจไม่ได้: '+e.message;}
 };
 el('qualityBtn').onclick=async()=>{
   const data=input(),fingerprint=JSON.stringify(data),id=++requestId;
   if(!data.content.trim()){el('qualityState').textContent='กรุณาใส่เนื้อหาบทความก่อนรีเช็ค';return;}
   clear();el('qualityBtn').disabled=true;el('qualityState').textContent='AI กำลังรีเช็ค 5 หมวด…';
   try{
     const response=await fetch('/api/seo/quality-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),report=await response.json();
     if(!response.ok)throw Error(report.error||'รีเช็คไม่สำเร็จ');
     loadHistory();
     if(id!==requestId)return;
     if(fingerprint!==JSON.stringify(input())){el('qualityState').textContent='บทความเปลี่ยนระหว่างตรวจ กรุณารีเช็คอีกครั้ง';return;}
     show(report);el('qualityState').textContent='รีเช็คเสร็จ '+report.overall_score+'/100 · '+(report.verdict==='needs_revision'?'ควรแก้ไขตามรายการ':'พร้อมให้คนตรวจทาน')+' · ยังไม่อนุมัติเผยแพร่ · '+(report.history?.saved?'บันทึกประวัติแล้ว':report.history?.error||'ยังไม่ได้บันทึกประวัติ กรุณาดาวน์โหลด JSON');
   }catch(e){if(id===requestId)el('qualityState').textContent='รีเช็คไม่สำเร็จ: '+e.message;}finally{el('qualityBtn').disabled=false;}
 };
 el('qualityDownload').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='area-content-quality-'+result.reviewed_at.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 loadHistory();
})();
