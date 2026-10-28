'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const HOSTS={Shopee:['shopee.co.th','shope.ee'],Lazada:['lazada.co.th','lzd.co']};
function clean(v,max=200){return String(v??'').trim().slice(0,max)}
function httpError(status,message){const e=new Error(message);e.status=status;return e}
function affiliateUrl(raw,platform){
  if(!HOSTS[platform])throw httpError(400,'Choose Shopee or Lazada');
  let u;try{u=new URL(String(raw))}catch{throw httpError(400,'Invalid affiliate URL')}
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw httpError(400,'Affiliate URL must be secure HTTPS');
  const host=u.hostname.toLowerCase();
  if(!HOSTS[platform].some(h=>host===h||host.endsWith('.'+h)))throw httpError(400,'Affiliate URL host does not match selected platform');
  return u.toString();
}
function asNumber(v,min,max){const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function safeState(raw){
  const x=raw&&typeof raw==='object'?raw:{};
  return {version:1,shop:{name:clean(x.shop?.name||'ร้านรวมของน่าใช้',90),description:clean(x.shop?.description||'เลือกสินค้าพร้อมลิงก์ร้านต้นทาง',240)},products:Array.isArray(x.products)?x.products:[],posts:Array.isArray(x.posts)?x.posts:[],articles:Array.isArray(x.articles)?x.articles:[],clicks:Array.isArray(x.clicks)?x.clicks:[]};
}
function createStudio({dataDir,persistent}){
  const file=path.join(dataDir,'affiliate-studio.json');
  let state=safeState(null),serial=Promise.resolve(),storage='memory';
  async function init(){
    if(persistent.configured){state=safeState(await persistent.get('affiliate_studio_v1',null));await persistent.set('affiliate_studio_v1',state);storage='postgres';return}
    if(fs.existsSync(file))state=safeState(JSON.parse(fs.readFileSync(file,'utf8')));
    storage='file'; // Non-durable on ephemeral Render disks: surface this in status.
  }
  async function write(){
    if(persistent.configured){await persistent.set('affiliate_studio_v1',state);return}
    fs.mkdirSync(dataDir,{recursive:true});
    const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state),'utf8');fs.renameSync(tmp,file);
  }
  function mutate(action){
    const task=serial.then(async()=>{const before=structuredClone(state);try{const result=action(state);await write();return result}catch(e){state=before;throw e}});
    serial=task.catch(()=>{});return task;
  }
  function id(){return crypto.randomUUID()}
  function product(input){
    const title=clean(input.title,150),platform=clean(input.platform,20),url=affiliateUrl(input.url,platform);
    const price=asNumber(input.price,0,10000000);
    if(title.length<3||price===null)throw httpError(400,'Product needs a title and valid THB price');
    return {id:id(),title,platform,url,price,category:clean(input.category,70),description:clean(input.description,600),published:input.published===true,addedAt:new Date().toISOString(),clicks:0};
  }
  function publicCatalog(){return {shop:{...state.shop},products:state.products.filter(p=>p.published).map(({url,...p})=>p),disclosure:'ลิงก์บางรายการอาจเป็นลิงก์ Affiliate ร้านอาจได้รับค่าคอมมิชชั่นเมื่อมีการซื้อสินค้า ราคาต้องตรวจสอบกับร้านต้นทาง'}}
  function dashboard(){return {shop:state.shop,products:state.products,posts:state.posts,articles:state.articles,analytics:{clicks:state.clicks.length,clicksByProduct:state.products.map(p=>({id:p.id,title:p.title,clicks:p.clicks||0})),orders:null,commission:null},status:{storage,durable:storage==='postgres',facebookConnected:false,marketplaceFeedConnected:false,schedulerConnected:false,aiConfigured:Boolean(process.env.GEMINI_API_KEY)}}}
  return {
    init,dashboard,publicCatalog,
    getProduct:pid=>state.products.find(p=>p.id===pid),
    setShop:x=>mutate(s=>{s.shop={name:clean(x.name,90)||s.shop.name,description:clean(x.description,240)};return s.shop}),
    addProduct:x=>{const p=product(x);return mutate(s=>{if(s.products.length>=500)throw httpError(409,'Product limit reached');s.products.unshift(p);return p})},
    toggleProduct:x=>mutate(s=>{const p=s.products.find(p=>p.id===x.id);if(!p)throw httpError(404,'Product not found');p.published=x.published===true;return p}),
    removeProduct:x=>mutate(s=>{const i=s.products.findIndex(p=>p.id===x.id);if(i<0)throw httpError(404,'Product not found');return s.products.splice(i,1)[0]}),
    addPost:x=>mutate(s=>{const product=s.products.find(p=>p.id===x.productId);if(!product)throw httpError(404,'Product not found');const caption=clean(x.caption,5000);if(caption.length<5)throw httpError(400,'Caption required');let scheduledFor=null;if(x.scheduledFor){const dt=new Date(x.scheduledFor);if(!Number.isFinite(dt.getTime())||dt.getTime()<Date.now())throw httpError(400,'Choose a future time');scheduledFor=dt.toISOString()}
      const item={id:id(),productId:product.id,caption,scheduledFor,status:'draft_not_connected',createdAt:new Date().toISOString()};s.posts.unshift(item);return item}),
    addArticle:x=>mutate(s=>{const product=s.products.find(p=>p.id===x.productId);if(!product)throw httpError(404,'Product not found');const title=clean(x.title,180),content=clean(x.content,30000);if(title.length<5||content.length<40)throw httpError(400,'Article requires title and content');const item={id:id(),productId:product.id,title,content,status:'draft_requires_review',createdAt:new Date().toISOString()};s.articles.unshift(item);return item}),
    click:pid=>mutate(s=>{const p=s.products.find(x=>x.id===pid&&x.published);if(!p)throw httpError(404,'Product unavailable');const url=affiliateUrl(p.url,p.platform);p.clicks=(p.clicks||0)+1;s.clicks.push({productId:pid,at:new Date().toISOString()});if(s.clicks.length>10000)s.clicks=s.clicks.slice(-10000);return url})
  };
}
module.exports={createStudio,affiliateUrl,safeState};