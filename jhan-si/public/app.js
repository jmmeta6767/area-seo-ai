'use strict';
const $=id=>document.getElementById(id);
const select=(q)=>document.querySelectorAll(q);
let model={products:[],posts:[],articles:[],shop:{name:'',description:''},analytics:{clicks:0,clicksByProduct:[]},status:{}};
const labels={overview:['ภาพรวมระบบ','จัดการสินค้า คอนเทนต์ และ SEO จากที่เดียว'],products:['สินค้า Affiliate','บันทึกสินค้าจริงพร้อมตรวจสอบลิงก์ปลายทาง'],content:['AI Content Studio','สร้างโพสต์การตลาดจากข้อมูลที่ตรวจสอบแล้ว'],seo:['SEO / AEO Editor','เขียนบทความ Affiliate และตรวจความถูกต้องก่อนเผยแพร่'],queue:['คิวงานและฉบับร่าง','เนื้อหาที่รอการตรวจสอบ'],analytics:['Analytics','ข้อมูลคลิกจริงโดยไม่ประมาณยอดขาย'],settings:['ตั้งค่าร้าน','ตั้งค่าหน้าร้านและตรวจสถานะระบบ']};
function el(tag,cls,content){const node=document.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=String(content);return node}
function notice(message,fail=false){const n=$('notice');n.className='notice show'+(fail?' error':'');n.textContent=message;clearTimeout(notice.timer);notice.timer=setTimeout(()=>n.className='notice',6000)}
async function api(route,data){const options=data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
 const resp=await fetch('/api/admin/'+route,options);
 let body;try{body=await resp.json()}catch{throw Error('เซิร์ฟเวอร์ส่งข้อมูลผิดรูปแบบ')}
 if(!resp.ok)throw Error(body.error||'HTTP '+resp.status);return body}
function simpleEmpty(parent,message){parent.replaceChildren(el('div','empty',message))}
function h2(parent,txt,sub){const text=el('div');text.append(el('strong',null,txt));if(sub)text.append(el('small',null,sub));parent.append(text)}
function goView(id){select('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));select('.panelview').forEach(p=>p.classList.toggle('active',p.dataset.panel===id));$('pageTitle').textContent=labels[id][0];$('pageDesc').textContent=labels[id][1];window.scrollTo({top:0,behavior:'instant'})}
function rowAction(label,handler,cls){const b=el('button',cls,label);b.type='button';b.addEventListener('click',handler);return b}
function renderOptions(){
 select('.selectProduct').forEach(s=>{const old=s.value;s.replaceChildren();
 s.append(new Option(model.products.length?'เลือกสินค้า':'ยังไม่มีสินค้า',''));
 model.products.forEach(p=>s.append(new Option(p.title,p.id)));
 if([...s.options].some(o=>o.value===old))s.value=old;
 });
}
function connectionRow(parent,label,connected,readyText,pendingText){const r=el('div','connection-row');r.append(el('b',null,label),el('span',null,connected?readyText:pendingText));parent.append(r)}
function renderDashboard(){
 $('metricProducts').textContent=model.products.length;
 $('metricClicks').textContent=model.analytics.clicks||0;
 $('metricArticles').textContent=model.articles.length;
 $('metricPosts').textContent=model.posts.length;
 $('analyticsClicks').textContent=model.analytics.clicks||0;
 const status=model.status||{},kind=status.durable?'PostgreSQL พร้อมใช้งาน':'ไฟล์ภายในเซิร์ฟเวอร์ (ไม่รับประกันถาวร)';
 $('storageStatus').textContent=status.durable?'ฐานข้อมูลพร้อมใช้งาน':'ยังไม่ยืนยันฐานข้อมูลถาวร';
 const connections=$('connections');connections.replaceChildren();
 connectionRow(connections,'สินค้าจาก Marketplace',status.marketplaceFeedConnected,'เชื่อมต่อแล้ว','นำเข้าลิงก์ด้วยตนเอง');
 connectionRow(connections,'Gemini AI',status.aiConfigured,'พร้อมใช้งาน','ยังไม่ตั้ง API Key');
 connectionRow(connections,'Facebook Page',status.facebookConnected,'เชื่อมต่อแล้ว','ยังไม่เชื่อม Meta API');
 connectionRow(connections,'ฐานข้อมูลถาวร',status.durable,'พร้อมใช้งาน','ยังไม่ยืนยัน');
 const details=$('storageDetail');details.replaceChildren();
 h2(details,'แยกระบบและฐานข้อมูลแล้ว','ไม่มีการอ้างอิงข้อมูล AREA ไม้แบบ');
 h2(details,'การจัดเก็บ',kind);
 h2(details,'โหมด Facebook', 'บันทึกเป็นร่างเท่านั้น ไม่ได้โพสต์อัตโนมัติ');
 h2(details,'ข้อมูลยอดขาย','ไม่เชื่อมระบบคำสั่งซื้อ จึงไม่สร้างยอดขายสมมติ');
 $('shopForm').elements.name.value=model.shop.name||'';
 $('shopForm').elements.description.value=model.shop.description||'';
}
function renderProducts(){
 $('productCount').textContent=model.products.length+' รายการ';
 const list=$('productList');list.replaceChildren();
 if(!model.products.length){simpleEmpty(list,'ยังไม่มีสินค้า · เริ่มโดยเพิ่มสินค้าที่มีลิงก์ Affiliate จริง');return}
 model.products.forEach(p=>{
  const row=el('div','product-row'),left=el('div');
  h2(left,p.title,p.platform+' · ฿'+Number(p.price).toLocaleString('th-TH')+' · '+(p.clicks||0)+' คลิก');
  left.append(el('span','badge'+(p.published?'':' off'),p.published?'แสดงบนร้าน':'ฉบับร่าง'));
  const actions=el('div','product-actions');
  actions.append(rowAction(p.published?'ซ่อนสินค้า':'แสดงบนร้าน',async()=>{try{await api('products/visibility',{id:p.id,published:!p.published});await load()}catch(e){notice(e.message,true)}}));
  if(p.published){const a=el('a','secondary','เปิดลิงก์ ↗');a.href='/go/'+encodeURIComponent(p.id);a.target='_blank';a.rel='noopener noreferrer';actions.append(a)}
  actions.append(rowAction('นำออก',async()=>{if(!confirm('นำสินค้า "'+p.title+'" ออกจากร้าน?'))return;try{await api('products/remove',{id:p.id});await load()}catch(e){notice(e.message,true)}},'danger'));
  row.append(left,actions);list.append(row);
 });
}
function renderQueues(){
 const posts=$('postList');posts.replaceChildren();
 if(!model.posts.length)simpleEmpty(posts,'ยังไม่มีร่างโพสต์');
 else model.posts.forEach(x=>{const item=el('div','stack-row');h2(item,x.caption.slice(0,85)+(x.caption.length>85?'…':''),'ร่างเท่านั้น · '+(x.scheduledFor?new Date(x.scheduledFor).toLocaleString('th-TH'):'ไม่กำหนดวัน'));item.append(el('span','pill warning','ยังไม่โพสต์ Facebook'));posts.append(item)});
 const articles=$('articleList');articles.replaceChildren();
 if(!model.articles.length)simpleEmpty(articles,'ยังไม่มีร่างบทความ');
 else model.articles.forEach(x=>{const item=el('div','stack-row');h2(item,x.title,'บันทึกเมื่อ '+new Date(x.createdAt).toLocaleString('th-TH'));item.append(el('span','pill','รอตรวจเนื้อหา'));articles.append(item)});
}
function renderAnalytics(){
 const list=$('clickList');list.replaceChildren();
 const data=model.analytics.clicksByProduct||[];
 if(!data.length){simpleEmpty(list,'ยังไม่มีข้อมูลคลิกจากหน้าร้าน');return}
 const max=Math.max(1,...data.map(p=>p.clicks||0));
 data.forEach(x=>{const r=el('div','stack-row'),left=el('div');h2(left,x.title,(x.clicks||0)+' คลิก');
 const graph=el('div','clickbar'),bar=el('i');bar.style.width=Math.round((x.clicks||0)/max*100)+'%';graph.append(bar);r.append(left,graph);list.append(r)});
}
async function load(){model=await api('dashboard');renderDashboard();renderProducts();renderOptions();renderQueues();renderAnalytics()}
function showError(e){notice(e.message||String(e),true)}
select('#nav button').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
select('[data-jump]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.jump)));
$('productForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,data=Object.fromEntries(new FormData(f));data.price=Number(data.price);data.published=data.published==='true';try{await api('products',data);f.reset();await load();notice('บันทึกสินค้าแล้ว')}catch(err){showError(err)}});
$('shopForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{await api('shop',Object.fromEntries(new FormData(f)));await load();notice('บันทึกข้อมูลร้านแล้ว')}catch(err){showError(err)}});
$('generateCaption').addEventListener('click',async()=>{
 const productId=$('captionProduct').value;if(!productId)return notice('กรุณาเลือกสินค้า',true);
 const b=$('generateCaption');b.disabled=true;b.textContent='กำลังให้ Gemini ร่าง…';
 try{const out=await api('generate',{type:'caption',productId});$('captionText').value=out.caption;notice('สร้างร่างแคปชั่นแล้ว โปรดตรวจสอบก่อนใช้')}catch(e){showError(e)}finally{b.disabled=false;b.textContent='✦ ให้ Gemini ร่างแคปชั่น'}
});
$('savePost').addEventListener('click',async()=>{
 const productId=$('captionProduct').value,caption=$('captionText').value;
 const date=$('postDate').value;
 const scheduledFor=date?new Date(date).toISOString():null;
 try{await api('posts',{productId,caption,scheduledFor});await load();notice('บันทึกเข้าคิวร่างแล้ว ยังไม่ได้โพสต์จริง')}catch(e){showError(e)}
});
$('generateArticle').addEventListener('click',async()=>{
 const productId=$('articleProduct').value;if(!productId)return notice('กรุณาเลือกสินค้า',true);
 const b=$('generateArticle');b.disabled=true;b.textContent='กำลังให้ Gemini ร่าง…';
 try{const out=await api('generate',{type:'article',productId});$('articleTitle').value=out.title;$('articleContent').value=out.content;notice('บทความพร้อมให้ตรวจทานแล้ว')}catch(e){showError(e)}finally{b.disabled=false;b.textContent='✦ ให้ Gemini สร้างบทความ'}
});
$('saveArticle').addEventListener('click',async()=>{
 try{await api('articles',{productId:$('articleProduct').value,title:$('articleTitle').value,content:$('articleContent').value});await load();notice('บันทึกบทความฉบับร่างแล้ว')}catch(e){showError(e)}
});
load().catch(showError);
