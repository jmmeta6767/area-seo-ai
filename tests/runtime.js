const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const vm = require('node:vm');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'area-seo-test-'));
process.env.PUBLIC_SITE_URL = 'https://example.com/';
delete process.env.GEMINI_API_KEY;
process.env.REQUIRE_ADMIN_AUTH = 'true';
process.env.ADMIN_USER = 'test-admin';
process.env.ADMIN_PASSWORD = 'test-secret';
const {server, localAudit, articleDocument} = require('../server');
const draft = {
  title: 'ก'.repeat(50), meta: 'ข'.repeat(130), slug: 'mae-sai-formwork',
  content: '# แม่สาย\n## วางแผน\n- รายการ\n| แบบ | งาน |\n| --- | --- |\n| ก | ข |\n## ตรวจสอบ\n' + 'ก'.repeat(2600),
  imagePrompt: 'Construction formwork', imageAlt: 'ไม้แบบ', cta: 'ติดต่อร้าน',
  schema: {'@context': 'https://schema.org', '@type': 'Article'},
};
async function main() {
  assert.equal(localAudit(draft).score, 100);
  assert.equal(localAudit(draft).passed, true);
  assert.equal(localAudit({...draft, content: draft.content.replaceAll('|', '')}).checks.find(x=>x.label==='Comparison table present').ok, false);
  for (const change of [{slug: ''}, {schema: '{}'}, {content: draft.content+'\nส่งทั่วเชียงราย'}, {content: draft.content.replace('# แม่สาย', 'แม่สาย')}]) {
    assert.equal(localAudit({...draft, ...change}).passed, false);
  }
  await new Promise(resolve=>server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  const auth = 'Basic '+Buffer.from('test-admin:test-secret').toString('base64');
  async function request(route, data) {
    const options=data===undefined?{headers:{Authorization:auth}}:{method:'POST', headers:{'Content-Type':'application/json',Authorization:auth}, body:JSON.stringify(data)};
    const res = await fetch(base+route, options);
    return {status:res.status, data:await res.json()};
  }
  assert.equal((await fetch(base+'/api/health')).status, 200);
  assert.equal((await request('/api/health')).data.version, '1.8.0');
  assert.equal((await request('/api/health')).data.authRequired, true);
  assert.equal((await request('/api/health')).data.authConfigured, true);
  assert.equal((await fetch(base+'/')).status, 401);
  assert.equal((await fetch(base+'/api/approval')).status, 401);
  assert.equal((await request('/api/business-profile')).data.schema['@id'], 'https://example.com/#organization');
  assert.equal((await fetch(base+'/',{headers:{Authorization:auth}})).status, 200);
  assert.deepEqual((await request('/api/intelligence/history')).data.items, []);
  assert.equal((await request('/api/intelligence/snapshot/missing')).status, 404);
  assert.equal((await fetch(base+'/intelligence.js',{headers:{Authorization:auth}})).status, 200);
  assert.equal((await request('/api/seo/audit', draft)).data.score, 100);
  assert.equal((await request('/api/approval', {...draft, slug:''})).status, 422);
  const created = await request('/api/approval', {...draft, content:draft.content+'\n<script>alert(1)</script>'});
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(created.data.status, 'ready_for_review');
  assert.equal((await request('/api/approval')).data.items.length, 1);
  const backup=(await request('/api/admin/backup')).data;
  assert.equal(backup.schema_version,'1');
  assert.equal(backup.approvals.length,1);
  const preview = await (await fetch(base+'/api/approval/'+id+'/preview',{headers:{Authorization:auth}})).text();
  assert(!preview.includes('<script>'));
  assert(preview.includes('&lt;script&gt;'));
  assert.equal((await request('/api/approval/'+id+'/approve', {})).data.status, 'approved');
  assert.equal((await request('/api/approval/'+id+'/reject', {})).data.status, 'needs_changes');
  assert.equal((await request('/api/content/generate', {})).status, 503);
  assert.equal((await request('/api/seo/quality-review', {})).status, 400);
  assert.equal((await request('/api/seo/quality-review', {content:'บทความแม่สาย'})).status, 503);
  // Mock only the remote Gemini transport: exercise the real HTTP fix handler.
  const https = require('node:https');
  const original = https.request;
  let prompt;
  let modelResult={title:draft.title};
  process.env.GEMINI_API_KEY = 'test-only';
  https.request = (options, callback) => {
    const req = new EventEmitter();
    req.setTimeout = ()=>req;
    req.end = payload=>{
      prompt = JSON.parse(payload).contents[0].parts[0].text;
      const res = new EventEmitter(); res.statusCode=200; callback(res);
      res.emit('data', JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(modelResult)}]}}]}));
      res.emit('end');
    };
    return req;
  };
  try {
    const fixed = await request('/api/seo/fix', draft);
    assert.equal(fixed.status, 200);
    assert.equal(fixed.data.slug, draft.slug);
    assert.deepEqual(fixed.data.schema, draft.schema);
    assert.equal(fixed.data.audit.score, 100);
    assert(prompt.includes(draft.slug));
    modelResult={summary:'ควรเพิ่มเบอร์ติดต่อ',categories:require('../lib/content-quality').CATEGORIES.map(([id])=>({id,score:15,findings:[]}))};
    const reviewed=await request('/api/seo/quality-review',{content:'บทความแม่สาย',primaryKeyword:'แม่สาย'});
    assert.equal(reviewed.status,200);assert.equal(reviewed.data.overall_score,75);assert.equal(reviewed.data.categories.length,5);
    modelResult={summary:'invalid',categories:[]};
    assert.equal((await request('/api/seo/quality-review',{content:'บทความแม่สาย'})).status,502);
  } finally { https.request = original; }
  const html = articleDocument({...draft, title:'<script>x</script>'}).html;
  assert(!html.includes('<title><script>'));
  // Execute the real browser script with a small DOM harness to verify Auto Fix wiring.
  const elements = new Map();
  const el = id=>{
    if(!elements.has(id)) elements.set(id,{value:'',textContent:'',className:'',replaceChildren(){},appendChild(){}});
    return elements.get(id);
  };
  let sent;
  const context = vm.createContext({document:{getElementById:el}, window:{}, fetch:async(url, opts)=>{
    let data={};
    if(url==='/api/health') data={version:'1.8.0'};
    if(url==='/api/approval') data={items:[]};
    if(url==='/api/seo/fix') {sent=JSON.parse(opts.body); data={...sent,slug:'fixed-slug',schema:draft.schema};}
    if(url==='/api/seo/audit') data={score:100,passed:true,checks:[]};
    return {ok:true,json:async()=>data};
  }});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),context);
  for(const [key,value] of Object.entries(draft)) el(key==='content'?'body':key).value=typeof value==='string'?value:JSON.stringify(value);
  await el('fixBtn').onclick();
  assert.equal(sent.slug,draft.slug);
  assert.equal(sent.imageAlt,draft.imageAlt);
  assert.equal(el('slug').value,'fixed-slug');
  assert.deepEqual(JSON.parse(el('schema').value),draft.schema);
  console.log('PASS: real server startup, audit gates, approval lifecycle, escaped preview, Gemini failure/fix, and browser Auto Fix wiring');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  await new Promise(resolve=>server.close(resolve));
  fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});
});
