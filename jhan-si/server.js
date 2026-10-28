'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createStudio}=require('./lib/store');
const root=path.join(__dirname,'public');
const port=Number(process.env.PORT||3000);
const dataDir=process.env.DATA_DIR||path.join(__dirname,'.data');
const adminUser=process.env.ADMIN_USER||'';
const adminPassword=process.env.ADMIN_PASSWORD||'';
const authReady=Boolean(adminUser&&adminPassword);
const aiConfigured=Boolean(process.env.GEMINI_API_KEY);
const production=process.env.NODE_ENV==='production';
const storageConfigured=Boolean(process.env.DATABASE_URL);
const writable=storageConfigured||!production;
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const publicHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const htmlHeaders={'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'",...noStore};
const json=(res,status,body,headers=noStore)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(body))};
const error=(status,message)=>Object.assign(new Error(message),{status});
const secretMatch=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(),crypto.createHash('sha256').update(String(b)).digest());
function authorized(req){
 if(!authReady)return false;
 const value=req.headers.authorization||'';
 if(!value.startsWith('Basic '))return false;
 try{const data=Buffer.from(value.slice(6),'base64').toString('utf8'),split=data.indexOf(':');
 return split>0&&secretMatch(data.slice(0,split),adminUser)&&secretMatch(data.slice(split+1),adminPassword)}catch{return false}
}
function requireAdmin(req,res){
 if(!authReady){json(res,503,{error:'ADMIN_USER and ADMIN_PASSWORD must be configured before admin access'});return false}
 if(authorized(req))return true;
 json(res,401,{error:'Admin authentication required'},{...noStore,'WWW-Authenticate':'Basic realm="Jhan SI Admin", charset="UTF-8"'});return false;
}
function mutationAllowed(req){
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return true;
 if(String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')return false;
 const host=req.headers['x-forwarded-host']||req.headers.host;
 if(!host)return false;
 const protocol=(req.headers['x-forwarded-proto']||'http').split(',')[0].trim();
 const expected=protocol+'://'+host;
 const origin=req.headers.origin,referer=req.headers.referer;
 try{return (!origin||new URL(origin).origin===expected)&&(!referer||new URL(referer).origin===expected)}catch{return false}
}
function requestBody(req){
 return new Promise((resolve,reject)=>{
   let bytes=0,text='';
   req.on('data',chunk=>{bytes+=chunk.length;if(bytes>100000){reject(error(413,'Request too large'));req.destroy();return}text+=chunk});
   req.on('end',()=>{try{resolve(text?JSON.parse(text):{})}catch{reject(error(400,'Invalid JSON'))}});
   req.on('error',reject);
 });
}
function createPersistence(){
 if(!storageConfigured)return {configured:false,init:async()=>{},get:async()=>null,set:async()=>{}};
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:3,connectionTimeoutMillis:8000});
 return {configured:true,
  init:async()=>{await pool.query("CREATE TABLE IF NOT EXISTS jhan_si_state (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())")},
  get:async(key,fallback)=>{const r=await pool.query('SELECT value FROM jhan_si_state WHERE key=$1',[key]);return r.rows[0]?.value??fallback},
  set:async(key,value)=>{await pool.query('INSERT INTO jhan_si_state(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[key,JSON.stringify(value)])},
  close:()=>pool.end()};
}
const persistence=createPersistence();
const studio=createStudio({dataDir,persistent:persistence});
let ready=false,initError='';
async function init(){await persistence.init();await studio.init();ready=true}
let aiRequests=[];
async function generate(x){
 const now=Date.now();aiRequests=aiRequests.filter(t=>t>now-60000);
 if(aiRequests.length>=8)throw error(429,'กรุณารอก่อนเรียก AI อีกครั้ง');
 aiRequests.push(now);
 if(!aiConfigured)throw error(503,'Gemini API ยังไม่ได้เชื่อม');
 const p=studio.getProduct(String(x.productId||''));
 if(!p)throw error(404,'ไม่พบสินค้า');
 const type=x.type;
 if(!['caption','article'].includes(type))throw error(400,'Unsupported generation type');
 const facts={name:p.title,price:p.price,currency:'THB',platform:p.platform,description:p.description,link:'/go/'+p.id};
 const instruction=type==='caption'?'Return a JSON object with a string key "caption". Write concise Facebook Thai copy with clear affiliate disclosure.':'Return JSON object with string keys "title" and "content". Write a useful Thai SEO article in Markdown with H1, H2, FAQ, and an affiliate disclosure.';
 const prompt='You are an ethical Thai affiliate content assistant. Use only supplied facts. Never fabricate reviews, actual testing, stock, discounts, delivery, warranty, sales or urgency. '+instruction+' Facts: '+JSON.stringify(facts);
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
 try{
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  if(!/^[a-zA-Z0-9._-]+$/.test(model))throw error(500,'Invalid model');
  const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}}),signal:ctrl.signal});
  if(!res.ok)throw error(res.status===429?429:502,'Gemini ไม่พร้อมใช้งานในขณะนี้');
  const response=await res.json(),content=response.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!content)throw error(502,'Gemini response was empty');
  let out;try{out=JSON.parse(content)}catch{throw error(502,'Gemini returned invalid JSON')}
  if(typeof out!=='object'||!out)throw error(502,'Invalid AI response');
  if(type==='caption'&&typeof out.caption!=='string')throw error(502,'Caption missing');
  if(type==='article'&&(typeof out.title!=='string'||typeof out.content!=='string'))throw error(502,'Article incomplete');
  return {title:String(out.title||'').slice(0,180),caption:String(out.caption||'').slice(0,5000),content:String(out.content||'').slice(0,30000),generatedBy:'gemini',requiresHumanReview:true};
 }catch(e){if(e.name==='AbortError')throw error(504,'Gemini timeout');throw e}finally{clearTimeout(timer)}
}
async function handler(req,res){
 const u=new URL(req.url||'/','http://localhost'),p=u.pathname;
 try{
  if(req.method==='GET'&&p==='/api/health')return json(res,ready?200:503,{ok:ready,service:'jhan-si',version:'1.0.0',database:storageConfigured&&ready?'connected':storageConfigured?'unavailable':'not-configured',durable:storageConfigured&&ready,adminConfigured:authReady,aiConfigured},publicHeaders);
  if(!ready)throw error(503,initError||'System not ready');
  if(req.method==='GET'&&p==='/api/shop/catalog')return json(res,200,studio.publicCatalog(),publicHeaders);
  if(req.method==='GET'&&/^\/go\/[0-9a-f-]{36}$/.test(p)){
   const target=await studio.click(p.split('/')[2]);res.writeHead(302,{'Location':target,...publicHeaders});res.end();return;
  }
  const adminRoute=p==='/admin'||p==='/app.js'||p.startsWith('/api/admin/');
  if(adminRoute&&!requireAdmin(req,res))return;
  if(p.startsWith('/api/admin/')&&!mutationAllowed(req))throw error(403,'Cross-site request rejected');
  if(p.startsWith('/api/admin/')&&req.method==='POST'&&!writable)throw error(503,'Persistent database required before production changes');
  if(req.method==='GET'&&p==='/api/admin/dashboard')return json(res,200,studio.dashboard());
  if(req.method==='GET'&&p==='/api/admin/backup')return json(res,200,{exportedAt:new Date().toISOString(),...studio.dashboard()});
  const actions={
    '/api/admin/shop':x=>studio.setShop(x),
    '/api/admin/products':x=>studio.addProduct(x),
    '/api/admin/products/visibility':x=>studio.toggleProduct(x),
    '/api/admin/products/remove':x=>studio.removeProduct(x),
    '/api/admin/posts':x=>studio.addPost(x),
    '/api/admin/articles':x=>studio.addArticle(x),
    '/api/admin/generate':x=>generate(x)};
  if(req.method==='POST'&&actions[p])return json(res,201,await actions[p](await requestBody(req)));
  if(p.startsWith('/api/'))throw error(404,'API not found');
  if(req.method!=='GET'&&req.method!=='HEAD')throw error(405,'Method not allowed');
  const files={'/':'shop.html','/shop':'shop.html','/admin':'index.html','/app.js':'app.js','/style.css':'style.css','/shop.js':'shop.js'};
  const name=files[p];if(!name)throw error(404,'Not found');
  const ext=path.extname(name),mime=ext==='.js'?'text/javascript; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':'text/html; charset=utf-8';
  const data=fs.readFileSync(path.join(root,name));
  res.writeHead(200,{'Content-Type':mime,...(ext==='.html'?htmlHeaders:{...publicHeaders})});return res.end(req.method==='HEAD'?undefined:data);
 }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Server error'});else res.end()}
}
const server=http.createServer((req,res)=>void handler(req,res));
if(require.main===module)init().then(()=>server.listen(port,'0.0.0.0',()=>console.log('Jhan SI standalone service listening on '+port))).catch(e=>{initError=e.message;console.error('Startup error: '+e.message);process.exitCode=1});
module.exports={server,init,studio,authorized,mutationAllowed};
