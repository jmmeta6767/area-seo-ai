'use strict';
const $=id=>document.getElementById(id);
let state={products:[],posts:[],articles:[],shop:{name:'',description:''},analytics:{clicks:0,clicksByProduct:[]},status:{}};
const views={overview:['ภาพรวมระบบ','จัดการสินค้า คอนเทนต์ และ SEO จากที่เดียว'],products:['สินค้า Affiliate','นำเข้าลิงก์จริง จัดการสินค้า และเลือกแสดงหน้าร้าน'],content:['AI Content Studio','ให้ Gemini ช่วยร่างคอนเทนต์จากข้อมูลสินค้าที่ตรวจแล้ว'],seo:['บทความ SEO / AEO','สร้างฉบับร่างสำหรับค้นหาและ AI Search'],queue:['คิวโพสต์และบทความ','ตรวจงานก่อนเผยแพร่จริง'],analytics:['Affiliate Analytics','ข้อมูลคลิกลิงก์จริง ไม่ใช่ยอดขายสมมติ'],settings:['ตั้งค่าหน้าร้าน','ตั้งชื่อร้านและตรวจสถานะการเชื่อมต่อ']};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n}
function clear(n){n.replaceChildren()}
function notify(msg,error=false){const n=$('notice');n.textContent=msg;n.className='notice show'+(error?' error':'');window.scrollTo({top:0,behavior:'smooth'})}
async function api(url,method='GET',payload){
 const options={method,headers:{}};if(payload!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload)}
 const r=await fetch(url,options);let data;try{data=await r.json()}catch{throw Error('Server returned an unreadable response')}
 if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data;
}
async function perform(fn,success){try{await fn();if(success)notify(success);await refresh()}catch(e){notify(e.message,true)}}
async function refresh(){state=await api('/api/studio');render();}
function selectView(name){if(!views[name])return;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-current',b.dataset.view===name?'page':'false')});document.querySelectorAll('[data-panel]').forEach(p=>p.classList.toggle('active',p.dataset.panel===name));$('pageTitle').textContent=views[name][0];$('pageDesc').textContent=views[name][1];location.hash=name;}
function itemRow(name,description){const n=el('div',null,'stack-row'),d=el('div');d.append(el('strong',name),el('small',description));n.append(d);return n}
function empty(node,msg){node.append(el('div',msg,'empty'))}
function renderProducts(){
 const node=$('productList');clear(node);$('productCount').textContent=state.products.length+' รายการ';
 if(!state.products.length)empty(node,'ยังไม่มีสินค้า เพิ่มสินค้าแรกด้วยลิงก์ Affiliate ที่ใช้งานจริง');
 state.products.forEach(p=>{
 const row=el('div',null,'product-row');const info=el('div');info.append(el('strong',p.title),el('small',p.platform+' · ฿'+Number(p.price).toLocaleString('th-TH')+' · '+(p.clicks||0)+' คลิก'));
 const actions=el('div',null,'product-actions'),badge=el('span',p.published?'แสดงหน้าร้าน':'ฉบับร่าง','badge'+(p.published?'':' off'));
 const toggle=el('button',p.published?'ซ่อน':'แสดงหน้าร้าน');toggle.addEventListener('click',()=>perform(()=>api('/api/studio/products/visibility','POST',{id:p.id,published:!p.published}),'เปลี่ยนสถานะสินค้าแล้ว'));
 const remove=el('button','ลบ','danger');remove.addEventListener('click',()=>{if(confirm('ลบสินค้านี้ออกจากรายการ?'))perform(()=>api('/api/studio/products/remove','POST',{id:p.id}),'ลบสินค้าแล้ว')});
 actions.append(badge,toggle,remove);row.append(info,actions);node.append(row);
 });
 for(const select of document.querySelectorAll('.selectProduct')){const prev=select.value;clear(select);select.append(el('option','เลือกสินค้าก่อน'));select.firstChild.value='';state.products.forEach(p=>{const op=el('option',p.title+' · '+p.platform);op.value=p.id;select.append(op)});if(state.products.some(p=>p.id===prev))select.value=prev}
}
function renderQueue(){
 const posts=$('postList');clear(posts);if(!state.posts.length)empty(posts,'ยังไม่มีร่างโพสต์');
 state.posts.forEach(p=>{const product=state.products.find(x=>x.id===p.productId),label=product?.title||'สินค้าที่ถูกลบ',row=itemRow(label,'สถานะ: ร่าง · ยังไม่โพสต์จริง'+(p.scheduledFor?' · ตั้งใจโพสต์ '+new Date(p.scheduledFor).toLocaleString('th-TH'):''));row.append(el('p',p.caption));posts.append(row)});
 const articles=$('articleList');clear(articles);if(!state.articles.length)empty(articles,'ยังไม่มีบทความฉบับร่าง');
 state.articles.forEach(a=>{const row=itemRow(a.title,'รอตรวจทาน · '+new Date(a.createdAt).toLocaleString('th-TH'));row.append(el('small',a.content.slice(0,200)+'…'));articles.append(row)});
}
function renderConnections(){
 const entries=[['Gemini AI',state.status.aiConfigured?'กำหนดคีย์บน Server แล้ว':'ยังไม่มี GEMINI_API_KEY'],['Marketplace feed','นำเข้าลิงก์เอง · ยังไม่เชื่อม Official API'],['Facebook Auto Post','ยังไม่เชื่อม Meta API / Scheduler'],['ฐานข้อมูล',state.status.durable?'PostgreSQL · durable':'File/Memory · ต้องตรวจความคงทน']];
 const n=$('connections');clear(n);entries.forEach(([key,value])=>{const row=el('div',null,'connection-row');row.append(el('b',key),el('span',value));n.append(row)});
 const d=$('storageDetail');clear(d);entries.forEach(([key,value])=>d.append(itemRow(key,value)));
}
function renderAnalytics(){
 $('analyticsClicks').textContent=Number(state.analytics.clicks||0).toLocaleString('th-TH');
 const list=$('clickList');clear(list);if(!state.analytics.clicksByProduct.length)empty(list,'เริ่มเพิ่มสินค้าก่อนเพื่อดูการคลิก');
 const max=Math.max(1,...state.analytics.clicksByProduct.map(x=>x.clicks||0));
 state.analytics.clicksByProduct.forEach(p=>{const row=itemRow(p.title,(p.clicks||0)+' คลิก'),chart=el('div',null,'clickbar'),bar=el('i');bar.style.width=Math.round((p.clicks||0)/max*100)+'%';chart.append(bar);row.append(chart);list.append(row)})
}
function render(){
 $('metricProducts').textContent=state.products.length;
 $('metricClicks').textContent=Number(state.analytics.clicks||0).toLocaleString('th-TH');
 $('metricArticles').textContent=state.articles.length;
 $('metricPosts').textContent=state.posts.length;
 $('storageStatus').textContent=state.status.durable?'PostgreSQL พร้อมใช้งาน':'Storage ต้องตรวจสอบ';
 const form=$('shopForm');if(document.activeElement!==form.elements.name)form.elements.name.value=state.shop.name;if(document.activeElement!==form.elements.description)form.elements.description.value=state.shop.description;
 renderProducts();renderQueue();renderConnections();renderAnalytics();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.jump)));
$('productForm').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);const p=Object.fromEntries(f);p.price=Number(p.price);p.published=p.published==='true';perform(async()=>{await api('/api/studio/products','POST',p);event.target.reset()},'เพิ่มสินค้าสำเร็จ')});
$('shopForm').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);perform(()=>api('/api/studio/shop','POST',Object.fromEntries(f)),'บันทึกข้อมูลร้านแล้ว')});
$('generateCaption').addEventListener('click',()=>{const productId=$('captionProduct').value;if(!productId)return notify('กรุณาเลือกสินค้า',true);perform(async()=>{const out=await api('/api/studio/generate','POST',{type:'caption',productId});$('captionText').value=out.caption||''},'AI ร่างแคปชั่นแล้ว กรุณาตรวจทาน')});
$('savePost').addEventListener('click',()=>{const productId=$('captionProduct').value,caption=$('captionText').value,scheduledFor=$('postDate').value?new Date($('postDate').value).toISOString():null;if(!productId)return notify('กรุณาเลือกสินค้า',true);perform(()=>api('/api/studio/posts','POST',{productId,caption,scheduledFor}),'บันทึกเป็นร่างเท่านั้น ยังไม่ได้โพสต์ Facebook')});
$('generateArticle').addEventListener('click',()=>{const productId=$('articleProduct').value;if(!productId)return notify('กรุณาเลือกสินค้า',true);perform(async()=>{const out=await api('/api/studio/generate','POST',{type:'article',productId});$('articleTitle').value=out.title||'';$('articleContent').value=out.content||''},'AI ร่างบทความแล้ว กรุณาตรวจข้อเท็จจริง')});
$('saveArticle').addEventListener('click',()=>{const productId=$('articleProduct').value,title=$('articleTitle').value,content=$('articleContent').value;if(!productId)return notify('กรุณาเลือกสินค้า',true);perform(()=>api('/api/studio/articles','POST',{productId,title,content}),'บันทึกร่างบทความ รอตรวจ ไม่ได้เผยแพร่จริง')});
refresh().catch(e=>notify('โหลดข้อมูลระบบไม่สำเร็จ: '+e.message,true));
selectView(location.hash.slice(1)in views?location.hash.slice(1):'overview');