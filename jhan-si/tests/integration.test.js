'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jhan-si-ci-'));
process.env.NODE_ENV='test';process.env.DATA_DIR=tmp;process.env.ADMIN_USER='owner';process.env.ADMIN_PASSWORD='sample-secret-only-for-tests';
delete process.env.DATABASE_URL;delete process.env.GEMINI_API_KEY;
const {server,init}=require('../server');
const {affiliateUrl}=require('../lib/store');
const credentials='Basic '+Buffer.from('owner:sample-secret-only-for-tests').toString('base64');
test('validate marketplace HTTPS destinations and reject unsafe hosts',()=>{
 assert.match(affiliateUrl('https://shopee.co.th/product/valid','Shopee'),/^https:/);
 assert.match(affiliateUrl('https://lazada.co.th/product/valid','Lazada'),/^https:/);
 for(const [link,platform] of [['http://shopee.co.th/a','Shopee'],['https://evil.com/a','Lazada'],['https://lazada.co.th.evil.com/','Lazada'],['https://u:p@shopee.co.th/p','Shopee'],['javascript:alert(1)','Shopee']]){
  assert.throws(()=>affiliateUrl(link,platform));
 }
});
test('standalone shop admin routes and no invented metrics',async()=>{
 await init();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(path,method='GET',payload,headers={})=>{
  const options={method,headers:{Authorization:credentials,...headers},redirect:'manual'};
  if(payload!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload)}
  const res=await fetch(base+path,options);const type=res.headers.get('content-type')||'';
  const body=type.includes('application/json')?await res.json():await res.text();
  return {status:res.status,body,headers:res.headers};
 };
 try{
  const health=await request('/api/health');assert.equal(health.status,200);assert.equal(health.body.service,'jhan-si');assert.equal(health.body.aiConfigured,false);
  assert.equal((await fetch(base+'/admin')).status,401);
  assert.equal((await fetch(base+'/app.js')).status,401);
  assert.equal((await fetch(base+'/shop')).status,200);
  assert.equal((await fetch(base+'/shop.js')).status,200);
  assert.equal((await fetch(base+'/shop.css')).status,200);
  assert.equal((await request('/admin')).status,200);
  const initial=await request('/api/shop/catalog');assert.deepEqual(initial.body.products,[]);
  let dash=await request('/api/admin/dashboard');
  assert.equal(dash.body.analytics.orders,null);assert.equal(dash.body.analytics.commission,null);
  assert.equal(dash.body.status.facebookConnected,false);
  assert.equal(dash.body.status.marketplaceFeedConnected,false);
  assert.equal((await request('/api/admin/products','POST',{title:'เครื่องชาร์จ',price:200,platform:'Shopee',url:'https://example.com/p'})).status,400);
  assert.equal((await request('/api/admin/products','POST',{title:'เครื่องชาร์จ',price:200,platform:'Shopee',url:'https://shopee.co.th/p'}, {'Sec-Fetch-Site':'cross-site'})).status,403);
  const create=await request('/api/admin/products','POST',{title:'สว่านไร้สาย',price:1200,platform:'Shopee',url:'https://shopee.co.th/product/source',category:'เครื่องมือช่าง',description:'<script>alert(1)</script>',published:true});
  assert.equal(create.status,201);
  const id=create.body.id;assert.match(id,/^[0-9a-f-]{36}$/);
  const catalog=await request('/api/shop/catalog');assert.equal(catalog.body.products.length,1);
  assert.equal(catalog.body.products[0].url,undefined,'Public API never reveals affiliate destination directly');
  const page=await request('/p/'+id);assert.equal(page.status,200);assert(page.body.includes('application/ld+json'));assert(!page.body.includes('<script>alert(1)</script>'));
  const click=await request('/go/'+id);assert.equal(click.status,302);assert.equal(click.headers.get('location'),'https://shopee.co.th/product/source');
  dash=await request('/api/admin/dashboard');assert.equal(dash.body.analytics.clicks,1);
  const draft=await request('/api/admin/posts','POST',{productId:id,caption:'ข้อเสนอข้อมูลสำหรับสินค้า ช่วยพิจารณาก่อนเลือกซื้อ',scheduledFor:new Date(Date.now()+3600000).toISOString()});
  assert.equal(draft.status,201);assert.equal(draft.body.status,'draft_not_connected');
  const article=await request('/api/admin/articles','POST',{productId:id,title:'การเลือกสว่านไร้สาย',content:'รายละเอียดการเลือกสว่านไร้สายให้เหมาะกับงาน บทความนี้เป็นโครงเนื้อหาที่ยังไม่ได้เผยแพร่จริง'});
  assert.equal(article.status,201);assert.equal(article.body.status,'draft_requires_review');
  assert.equal((await request('/api/admin/generate','POST',{productId:id,type:'caption'})).status,503);
  assert.equal((await request('/api/admin/backup')).body.products.length,1);
  assert.equal((await request('/api/admin/products/visibility','POST',{id,published:false})).status,201);
  assert.equal((await request('/api/shop/catalog')).body.products.length,0);
  assert.equal((await request('/p/'+id)).status,404);
  assert.equal((await request('/go/'+id)).status,404);
  assert(fs.existsSync(path.join(tmp,'affiliate-studio.json')),'Development JSON persisted');
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(tmp,{recursive:true,force:true})}
});
