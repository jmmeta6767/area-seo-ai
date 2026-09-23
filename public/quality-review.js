(() => {
 const el=id=>document.getElementById(id);let result=null,requestId=0;
 const input=()=>Object.fromEntries(['title','meta','cta','primaryKeyword','service'].map(k=>[k,el(k).value]).concat([['content',el('body').value]]));
 window.invalidateQualityReview=()=>{result=null;el('qualityReport').textContent='';el('qualityDownload').disabled=true;el('qualityState').textContent='บทความมีการเปลี่ยนแปลง กรุณารีเช็คอีกครั้ง';};
 for(const id of ['title','meta','body','cta','primaryKeyword','service'])el(id).addEventListener('input',window.invalidateQualityReview);
 el('qualityBtn').onclick=async()=>{
   const data=input(),fingerprint=JSON.stringify(data),id=++requestId;
   if(!data.content.trim()){el('qualityState').textContent='กรุณาใส่เนื้อหาบทความก่อนรีเช็ค';return;}
   result=null;el('qualityReport').textContent='';el('qualityDownload').disabled=true;el('qualityBtn').disabled=true;el('qualityState').textContent='AI กำลังรีเช็ค 5 หมวด…';
   try{const response=await fetch('/api/seo/quality-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),report=await response.json();if(!response.ok)throw Error(report.error||'รีเช็คไม่สำเร็จ');if(id!==requestId||fingerprint!==JSON.stringify(input())){el('qualityState').textContent='บทความเปลี่ยนระหว่างตรวจ กรุณารีเช็คอีกครั้ง';return;}result=report;el('qualityReport').textContent=JSON.stringify(report,null,2);el('qualityDownload').disabled=false;el('qualityState').textContent='รีเช็คเสร็จ '+report.overall_score+'/100 · '+(report.verdict==='needs_revision'?'ควรแก้ไขตามรายการ':'พร้อมให้คนตรวจทาน')+' · ยังไม่อนุมัติเผยแพร่';}
   catch(e){el('qualityState').textContent='รีเช็คไม่สำเร็จ: '+e.message;}finally{el('qualityBtn').disabled=false;}
 };
 el('qualityDownload').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='area-content-quality-'+result.reviewed_at.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
