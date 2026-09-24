(() => {
  const byId=id=>document.getElementById(id);
  let candidate=null,dryRun=null;

  async function call(url,opts={}){
    const res=await fetch(url,{headers:{"Content-Type":"application/json"},...opts});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||"Request failed");
    return data;
  }
  const count=(x,key)=>x?.components?.[key]?.count??"—";
  function summaryText(x){
    if(!x)return"";
    return [
      "Schema: v"+(x.schema_version||"?"),
      "Approval: "+count(x,"approvals"),
      "Audit events: "+count(x,"approval_audit"),
      "Website snapshots: "+count(x,"site_history"),
      "Quality reports: "+count(x,"quality_history"),
      "Bundle checksum: "+(x.checksum||"—")
    ].join("\n");
  }
  function resetValidation(message="เลือกไฟล์แล้วกด Dry-run"){
    dryRun=null;
    byId("dryRunRestore").disabled=!candidate;
    byId("restoreConfirmText").value="";
    byId("restoreConfirmText").disabled=true;
    byId("confirmRestore").disabled=true;
    byId("restorePreview").textContent=message;
    byId("restoreState").textContent="ยังไม่พร้อมกู้คืน";
  }
  async function loadStorage(){
    const badge=byId("recoveryReady"),health=byId("storageHealth");
    badge.textContent="Checking storage…";badge.className="pill";
    try{
      const [ready,storage]=await Promise.all([call("/api/admin/readiness"),call("/api/admin/storage-health")]);
      const durable=storage.durable===true&&storage.ready===true&&storage.state?.complete===true;
      badge.textContent=durable?"● PostgreSQL durable":"● "+(storage.kind==="postgres"?"PostgreSQL ยังไม่ครบ":"File storage · ยังไม่ถาวร");
      badge.className="pill "+(durable?"ok":"");
      const blockers=(ready.blockers||[]).join(", ")||"ไม่มี";
      const present=(storage.state?.present||[]).join(", ")||"ไม่มี",missing=(storage.state?.missing||[]).join(", ")||"ไม่มี";
      health.textContent=[
        "ชนิด: "+(storage.kind||"unknown"),
        "Durable: "+(durable?"พร้อม":"ยังไม่พร้อม"),
        storage.database?"Database: "+storage.database:"",
        storage.version?"PostgreSQL: "+storage.version:"",
        storage.stateRows!==undefined?"State rows: "+storage.stateRows:"",
        storage.auditRows!==undefined?"Audit rows: "+storage.auditRows:"",
        "State keys พร้อม: "+present,
        "State keys ขาด: "+missing,
        "Readiness blockers: "+blockers
      ].filter(Boolean).join("\n");
    }catch(e){
      badge.textContent="● Storage check failed";
      health.textContent=e.message;
    }
  }
  byId("recoveryNav").onclick=()=>byId("recoveryCenter").scrollIntoView({behavior:"smooth",block:"start"});
  byId("refreshStorage").onclick=loadStorage;
  byId("downloadBackup").onclick=async()=>{
    const state=byId("backupState"),btn=byId("downloadBackup");btn.disabled=true;state.textContent="กำลังสร้าง Backup…";
    try{
      const backup=await call("/api/admin/backup");
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="area-seo-ai-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      state.textContent="ดาวน์โหลด Backup schema v"+backup.schema_version+" แล้ว · Approval "+(backup.approvals?.length||0)+" · Website snapshots "+(backup.site_history_full?.snapshots?.length||0)+" · Quality "+(backup.quality_history?.items?.length||0);
    }catch(e){state.textContent="ดาวน์โหลดไม่สำเร็จ: "+e.message}
    finally{btn.disabled=false}
  };
  byId("restoreFile").onchange=async e=>{
    candidate=null;resetValidation("กำลังอ่านไฟล์…");
    const file=e.target.files?.[0];
    if(!file){resetValidation("ยังไม่ได้เลือกไฟล์");return}
    if(file.size>16*1024*1024){resetValidation("ไฟล์ใหญ่เกิน 16 MB");return}
    try{
      const parsed=JSON.parse(await file.text());
      if(!["2","3"].includes(String(parsed.schema_version||"")))throw Error("รองรับ Backup schema v2 หรือ v3 เท่านั้น");
      candidate=parsed;resetValidation("อ่านไฟล์แล้ว · schema v"+parsed.schema_version+" · กด Dry-run เพื่อตรวจทุกส่วนก่อนกู้คืน");
    }catch(err){candidate=null;resetValidation("อ่านไฟล์ไม่ได้: "+err.message)}
  };
  byId("dryRunRestore").onclick=async()=>{
    if(!candidate)return;
    const btn=byId("dryRunRestore");btn.disabled=true;byId("restorePreview").textContent="กำลังตรวจ Backup โดยไม่แก้ข้อมูล…";
    try{
      dryRun=await call("/api/admin/restore",{method:"POST",body:JSON.stringify({backup:candidate})});
      byId("restorePreview").textContent="Dry-run ผ่าน\n"+summaryText(dryRun);
      byId("restoreConfirmText").disabled=false;
      byId("restoreState").textContent="Dry-run ผ่านแล้ว · ตรวจจำนวนและ checksum ก่อนพิมพ์ RESTORE";
    }catch(e){dryRun=null;byId("restorePreview").textContent="Dry-run ไม่ผ่าน: "+e.message;byId("restoreConfirmText").disabled=true;byId("restoreState").textContent="ไม่อนุญาตให้กู้คืนไฟล์นี้"}
    finally{btn.disabled=!candidate}
  };
  byId("restoreConfirmText").oninput=()=>{
    byId("confirmRestore").disabled=!(candidate&&dryRun&&byId("restoreConfirmText").value.trim()==="RESTORE");
  };
  byId("confirmRestore").onclick=async()=>{
    if(!(candidate&&dryRun&&byId("restoreConfirmText").value.trim()==="RESTORE"))return;
    const btn=byId("confirmRestore");btn.disabled=true;byId("restoreState").textContent="กำลังกู้คืนข้อมูลที่ผ่าน Dry-run…";
    try{
      const result=await call("/api/admin/restore",{method:"POST",body:JSON.stringify({backup:candidate,confirm:true,expectedChecksum:dryRun.checksum})});
      if(result.checksum!==dryRun.checksum)throw Error("Checksum เปลี่ยนระหว่าง Dry-run และ Restore");
      byId("restoreState").textContent="กู้คืนสำเร็จ · "+summaryText(result).replaceAll("\n"," · ");
      candidate=null;dryRun=null;byId("restoreFile").value="";byId("restoreConfirmText").value="";byId("restoreConfirmText").disabled=true;byId("dryRunRestore").disabled=true;
      await loadStorage();
      if(typeof window.loadQueue==="function")window.loadQueue();
    }catch(e){byId("restoreState").textContent="กู้คืนไม่สำเร็จ: "+e.message;byId("confirmRestore").disabled=false}
  };
  loadStorage();
})();
