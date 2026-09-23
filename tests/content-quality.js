const assert=require('node:assert/strict');
const {inputArticle,measurements,reviewArticle,validateResult,CATEGORIES,promptFor}=require('../lib/content-quality');
const article=inputArticle({title:'เช่าไม้แบบ แม่สาย',meta:'บริการเช่าไม้แบบสำหรับช่าง',content:'# เช่าไม้แบบ แม่สาย\n### เลือกอย่างไร\n- เช่าไม้แบบให้เหมาะกับงาน\n| แบบ | งาน |\n| --- | --- |\n| ก | ข |',cta:'โทร 064-989-3124 24 ชั่วโมง',primaryKeyword:'เช่าไม้แบบ'});
const fixture=()=>({summary:'มีจุดที่ควรปรับ',categories:CATEGORIES.map(([id])=>({id,score:18,findings:[]}))});
(async()=>{
 assert.throws(()=>inputArticle(null),e=>e.status===400);assert.throws(()=>inputArticle({content:1}),e=>e.status===400);assert.throws(()=>inputArticle({content:' '}),e=>e.status===400);assert.throws(()=>inputArticle({content:'ก'.repeat(50001)}),e=>e.status===400);
 const m=measurements(article);assert.equal(m.keyword_occurrences,2);assert.equal(m.verified_phone_in_body_or_cta,true);assert(m.heading_level_skipped);assert(m.has_bullets);assert(m.has_comparison_table);assert(m.local_mentions.mae_sai);assert(!m.local_mentions.mae_chan);
 assert(measurements({...article,cta:'โทร +66 64 989 3124'}).verified_phone_in_body_or_cta);assert(!measurements({...article,cta:'โทร 064-989-3125'}).verified_phone_in_body_or_cta);assert.equal(measurements({...article,primaryKeyword:''}).keyword_occurrences_per_100_words,null);
 const prompt=promptFor(article,m);assert(prompt.includes('แม่จัน'));assert(prompt.includes('ห้ามบังคับใส่แม่จัน'));assert(prompt.includes('ไม่กำหนดเปอร์เซ็นต์ตายตัว'));
 let raw=fixture();raw.categories[0].findings=[{field:'content',severity:'high',issue:'ข้ามหัวข้อ',evidence:'### เลือกอย่างไร',fix:'เพิ่ม H2 ก่อน H3 หรือปรับหัวข้อนี้เป็น H2'}];
 const r=await reviewArticle(article,async()=>raw);assert.equal(r.overall_score,90);assert.equal(r.verdict,'needs_revision');assert.equal(r.priority_fixes[0].severity,'high');assert.equal(r.categories.length,5);assert.equal(r.article_hash.length,64);
 assert.equal(validateResult(fixture(),article).verdict,'ready_for_human_review');
 for(const corrupt of [x=>x.categories.pop(),x=>x.categories[0].score=25,x=>x.categories[0].id=x.categories[1].id,x=>x.categories[0].score='18',x=>x.categories[0].findings=[{field:'content',severity:'high',issue:'ปัญหา',evidence:'ข้อความแต่งขึ้น',fix:'แก้'}]]){const f=fixture();corrupt(f);assert.throws(()=>validateResult(f,article),e=>e.status===502);}
 console.log('PASS: five-category contract, real evidence, computed scores, phone formats, Thai keyword metrics, local-area rules and validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
