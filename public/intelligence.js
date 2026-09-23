(() => {
  const el=id=>document.getElementById(id);
  let history=[],selected=null,requestNumber=0;
  const make=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(cls)n.className=cls;return n;};
  const date=s=>new Date(s).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'});
  const delta=n=>n===null?'ยังไม่มีรอบเทียบ':(n>0?'+':'')+n+' คะแนน';
  async function call(url,method='GET'){const r=await fetch(url,{method});const j=await r.json();if(!r.ok)throw Error(j.error||'โหลดข้อมูลไม่สำเร็จ');return j;}
  function draw(){
    const stats=el('insightStats');stats.replaceChildren();
    if(!selected){el('pageScores').replaceChildren(make('p','ยังไม่มีข้อมูล กดสแกนและเก็บคะแนนเพื่อเริ่มต้น','empty'));el('priorityTasks').replaceChildren(make('p','ระบบจะจัดลำดับงานหลังสแกนเว็บไซต์','muted'));el('scanCoverage').textContent='';el('exportSnapshot').disabled=true;return;}
    el('exportSnapshot').disabled=false;
    for(const [label,value,note] of [['คะแนนเฉลี่ย',selected.average===null?'—':selected.average+'/100',delta(selected.delta)],['ตรวจแล้ว',selected.pages.length+' หน้า','เทียบได้ '+selected.comparedPages+' หน้าเดิม'],['จุดปรับปรุง',selected.issueCount,'อ่านไม่ได้ '+selected.failedPages+' หน้า'],['แก้แล้วจากรอบก่อน',selected.resolvedCount,'ตรวจพบว่าปัญหาเดิมหายไป']]){const card=make('article');card.append(make('small',label),make('b',value),make('span',note));stats.append(card);}
    el('scanCoverage').textContent='สแกน '+date(selected.scannedAt)+' · พบ '+(selected.discoveryLimited?'อย่างน้อย ':'')+selected.discovered+' URL · '+(selected.sitemapsRead?'อ่าน sitemap '+selected.sitemapsRead+' ไฟล์ · ':'')+(selected.partial?'ผลบางส่วน':'ครบชุด URL ที่พบ')+' · '+selected.site+(selected.warnings.length?' · '+selected.warnings.join(' · '):'');
    const tasks=selected.pages.flatMap(p=>p.issues.map(i=>({...i,url:p.url,newIssue:p.newIssues.includes(i.key)}))).sort((a,b)=>({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]));
    const taskRoot=el('priorityTasks');taskRoot.replaceChildren();
    if(!tasks.length)taskRoot.append(make('p','ไม่พบปัญหาตามเกณฑ์รอบนี้ ควรตรวจคุณภาพเนื้อหาและข้อมูล Search Console เพิ่มเติม','muted'));
    for(const t of tasks.slice(0,12)){const card=make('div',undefined,'task-card');card.append(make('strong',({high:'สำคัญมาก',medium:'ควรปรับปรุง',low:'ตรวจเพิ่มเติม'}[t.priority])+' · '+t.label+(t.newIssue?' · พบใหม่':''),'priority-'+t.priority),make('p',t.action),make('small',t.url+' · '+t.evidence));taskRoot.append(card);}
    if(tasks.length>12)taskRoot.append(make('p','แสดง 12 งานแรกจาก '+tasks.length+' งาน ดูทั้งหมดในรายละเอียดรายหน้า','muted'));
    const filter=el('pageFilter').value;
    const pages=selected.pages.filter(p=>filter==='all'||filter==='issues'&&p.issues.length||filter==='declined'&&p.delta!==null&&p.delta<0||filter==='failed'&&p.score===null);
    const list=el('pageScores');list.replaceChildren();
    if(!pages.length)list.append(make('p','ไม่มีหน้าที่ตรงกับตัวกรองนี้','empty'));
    for(const p of pages){const card=make('details',undefined,'page-card'),head=make('summary',(p.score===null?'อ่านไม่ได้':p.score+'/100')+' · '+(p.title||p.url)+' · '+delta(p.delta));card.append(head);const link=make('a',p.url);link.href=p.url;link.target='_blank';link.rel='noopener';card.append(link,make('p','HTTP '+p.status+' · '+p.issues.length+' จุดปรับปรุง'));const checks=make('ul');for(const c of p.checks)checks.append(make('li',(c.ok?'✓ ':'• ')+c.label+' · '+c.evidence));card.append(checks);for(const i of p.issues)card.append(make('p',i.label+' — '+i.action,'priority-'+i.priority));if(p.resolvedIssues.length)card.append(make('p','แก้แล้ว: '+p.resolvedIssues.join(' · '),'ok'));list.append(card);}
    for(const b of el('historyTrend').children)b.setAttribute('aria-pressed',String(b.dataset.id===selected.id));
  }
  async function choose(id){const n=++requestNumber;el('insightState').textContent='กำลังโหลดผล…';try{const data=await call('/api/intelligence/snapshot/'+encodeURIComponent(id));if(n!==requestNumber)return;selected=data;el('snapshotSelect').value=id;draw();el('insightState').textContent='โหลดผลแล้ว';}catch(e){if(n===requestNumber)el('insightState').textContent=e.message;}}
  async function load(){const data=await call('/api/intelligence/history');history=data.items;selected=data.latest;el('storageNote').textContent=data.storageNote;const select=el('snapshotSelect');select.replaceChildren();if(!history.length)select.append(make('option','ยังไม่มีข้อมูล'));for(const s of history){const o=make('option',date(s.scannedAt)+' · '+(s.average===null?'อ่านไม่ได้':s.average+'/100')+' · '+s.pageCount+' หน้า');o.value=s.id;select.append(o);}const trend=el('historyTrend');trend.replaceChildren();for(const s of history.slice(0,10).reverse()){const b=make('button');b.type='button';b.dataset.id=s.id;b.append(make('small',new Date(s.scannedAt).toLocaleDateString('th-TH')),make('div',s.average===null?'—':s.average+'/100'));const bar=make('span',undefined,'bar');bar.style.width=(s.average||0)+'%';b.append(bar);b.onclick=()=>choose(s.id);trend.append(b);}draw();}
  el('collectScore').onclick=async()=>{el('collectScore').disabled=true;++requestNumber;el('insightState').textContent='กำลังอ่านเว็บและเก็บคะแนน… อาจใช้เวลาประมาณ 2 นาที';try{await call('/api/intelligence/scan','POST');await load();el('insightState').textContent='บันทึกคะแนนและรายการปรับปรุงแล้ว';}catch(e){el('insightState').textContent='สแกนไม่สำเร็จ: '+e.message;}finally{el('collectScore').disabled=false;}};
  el('snapshotSelect').onchange=()=>{if(el('snapshotSelect').value)choose(el('snapshotSelect').value);};
  el('pageFilter').onchange=draw;
  el('insightsNav').onclick=()=>el('siteInsights').scrollIntoView({behavior:'smooth',block:'start'});
  el('exportSnapshot').onclick=()=>{if(!selected)return;const a=make('a'),url=URL.createObjectURL(new Blob([JSON.stringify(selected,null,2)],{type:'application/json'}));a.href=url;a.download='area-seo-analysis-'+selected.scannedAt.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  load().then(()=>{el('insightState').textContent=history.length?'โหลดประวัติแล้ว':'พร้อมเก็บคะแนนรอบแรก';}).catch(e=>{el('insightState').textContent='โหลดประวัติไม่ได้: '+e.message;});
})();
