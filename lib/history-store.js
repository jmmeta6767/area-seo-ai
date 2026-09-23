'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
function validateHistory(data){
 if(!data||data.version!==1||!Array.isArray(data.snapshots))throw Error('Invalid website history; preserve existing data');
 const ids=new Set();for(const s of data.snapshots){if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.site!=='string'||typeof s.scannedAt!=='string'||!Array.isArray(s.pages))throw Error('Invalid website history snapshot');ids.add(s.id);}
 return data;
}
function createHistoryStore({dataDir,persistent}){
 const file=path.join(dataDir,'site-history.json'),configured=!!persistent?.configured;
 let ready=!configured,memory=null,writeError=false,cacheError=false;
 const clone=x=>JSON.parse(JSON.stringify(x));
 function readLocal(){return fs.existsSync(file)?validateHistory(JSON.parse(fs.readFileSync(file,'utf8'))):{version:1,snapshots:[]};}
 function writeLocal(data){fs.mkdirSync(dataDir,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(data),{mode:0o600});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
 function cache(data){try{writeLocal(data);cacheError=false;}catch{cacheError=true;}}
 async function init(){
  if(!configured){readLocal();return;}
  ready=false;
  try{const saved=await persistent.get('site_history',null);const data=saved===null?readLocal():validateHistory(saved);if(saved===null)await persistent.set('site_history',data);memory=clone(data);ready=true;writeError=false;cache(data);}catch{writeError=true;throw Error('Website history database initialization failed');}
 }
 function read(){if(!configured)return readLocal();if(!ready)throw Object.assign(Error('Website history storage is not ready'),{status:503});return clone(memory);}
 async function save(data){validateHistory(data);if(!configured){writeLocal(data);return;}if(!ready)throw Object.assign(Error('Website history storage is not ready'),{status:503});try{await persistent.set('site_history',data);}catch{writeError=true;throw Object.assign(Error('บันทึกประวัติคะแนนลงฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่'),{status:503});}memory=clone(data);writeError=false;cache(data);}
 function status(){return {storageKind:configured?'postgres':'file',storageConfigured:configured||!!process.env.DATA_DIR,storageReady:ready&&!writeError,storageDurable:configured&&ready&&!writeError,storageWriteError:writeError,storageCacheError:cacheError,storageNote:configured?(writeError?'ฐานข้อมูลประวัติคะแนนมีข้อผิดพลาด ผลรอบล่าสุดอาจยังไม่ถูกบันทึก':ready?'บันทึกประวัติคะแนนใน PostgreSQL แล้ว'+(cacheError?' แต่เขียนสำเนาไฟล์ในเครื่องไม่สำเร็จ':''):'กำลังเชื่อมต่อฐานข้อมูลประวัติคะแนน'):process.env.DATA_DIR?'ใช้ DATA_DIR ที่ตั้งค่าไว้ ต้องอยู่บนพื้นที่ถาวรเพื่อเก็บข้อมูลข้าม deploy':'เก็บไฟล์ในเครื่องเซิร์ฟเวอร์: Render แบบไม่มี persistent disk อาจสูญเสียประวัติเมื่อ deploy ใหม่'};}
 return {init,read,save,status};
}
module.exports={createHistoryStore,validateHistory};
