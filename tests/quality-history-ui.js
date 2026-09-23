const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map();
const el=id=>{
 if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,children:[],listeners:{},
  addEventListener(name,fn){this.listeners[name]=fn;},replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);}});
 return elements.get(id);
};
const report={reviewed_at:'2026-09-23T00:00:00Z',overall_score:75,verdict:'needs_revision'};
let requests=[],downloaded=false;
const context=vm.createContext({document:{getElementById:el,createElement:tag=>({click(){if(tag==='a')downloaded=true;}})},
 window:{},Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:fn=>fn(),
 fetch:async url=>{
  if(url==='/api/seo/quality-history')return {ok:true,json:async()=>({items:[{id:'old',title:'<script>unsafe</script>',reviewed_at:report.reviewed_at,overall_score:75,priority_fix_count:2}],storageNote:'ไฟล์ชั่วคราว'})};
  return new Promise(resolve=>requests.push({url,resolve}));
 }});
vm.runInContext(fs.readFileSync(require.resolve('../public/quality-review.js'),'utf8'),context);
async function main(){
 await new Promise(setImmediate);
 assert.equal(el('qualityHistory').children[1].textContent.includes('<script>unsafe</script>'),true);
 assert.equal(el('qualityStorage').textContent,'ไฟล์ชั่วคราว');
 el('body').value='ฉบับปัจจุบัน';el('qualityHistory').value='old';el('qualityHistory').onchange();
 const opening=el('qualityHistoryOpen').onclick();
 requests.shift().resolve({ok:true,json:async()=>({title:'ฉบับก่อน',report})});await opening;
 assert.equal(el('body').value,'ฉบับปัจจุบัน');
 assert(el('qualityState').textContent.includes('ไม่ใช่ผลตรวจฉบับที่กำลังแก้ไข'));
 const stale=el('qualityHistoryOpen').onclick();
 el('body').listeners.input();
 requests.shift().resolve({ok:true,json:async()=>({title:'ฉบับก่อน',report})});await stale;
 assert.equal(el('qualityReport').textContent,'');
 assert.equal(el('qualityDownload').disabled,true);
 const reviewing=el('qualityBtn').onclick();
 requests.shift().resolve({ok:true,json:async()=>({...report,history:{saved:false,error:'บันทึกไม่ได้ ดาวน์โหลด JSON'}})});await reviewing;
 assert(el('qualityState').textContent.includes('บันทึกไม่ได้'));
 assert.equal(el('qualityDownload').disabled,false);
 el('qualityDownload').onclick();assert.equal(downloaded,true);
 console.log('PASS: historical report labels, safe text, unchanged draft, stale responses and unsaved JSON download');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
