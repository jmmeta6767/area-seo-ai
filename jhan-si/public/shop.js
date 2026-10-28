'use strict';
const $=id=>document.getElementById(id);
const el=(name,cls,text)=>{const x=document.createElement(name);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x};
let products=[];
function card(p){
 const item=el('article','product'),thumb=el('div','image','✦'),body=el('div','content'),platform=el('span','platform',p.platform),title=el('h3',null,p.title),desc=el('p','desc',p.description||p.category||'ดูรายละเอียดกับร้านต้นทาง');
 const price=el('strong','price','฿'+Number(p.price).toLocaleString('th-TH'));
 const buttons=el('div','buttons'),buy=el('a','buy','ดูที่ร้านค้า ↗'),details=el('a','details','รายละเอียด');
 buy.href='/go/'+encodeURIComponent(p.id);buy.target='_blank';buy.rel='noopener noreferrer sponsored';
 details.href='/p/'+encodeURIComponent(p.id);
 buttons.append(buy,details);body.append(platform,title,desc,price,buttons);item.append(thumb,body);return item;
}
function render(){
 const q=$('q').value.trim().toLocaleLowerCase('th-TH');const filtered=products.filter(p=>[p.title,p.category,p.platform,p.description].some(x=>String(x||'').toLocaleLowerCase('th-TH').includes(q)));
 const root=$('products');root.replaceChildren();$('count').textContent=filtered.length+' รายการ';
 if(!filtered.length)root.append(el('div','empty',products.length?'ไม่พบสินค้า ลองใช้คำค้นอื่น':'ร้านนี้ยังไม่มีสินค้าที่เปิดแสดง'));
 filtered.forEach(x=>root.append(card(x)));
}
$('q').addEventListener('input',render);
fetch('/api/shop/catalog').then(async r=>{if(!r.ok)throw Error('ไม่สามารถโหลดสินค้า');return r.json()}).then(data=>{
 products=Array.isArray(data.products)?data.products:[];$('shopName').textContent=data.shop?.name||'รวมสินค้าน่าใช้';$('shopDescription').textContent=data.shop?.description||'';$('disclosure').textContent=data.disclosure||'';document.title=$('shopName').textContent+' · ฌานเอสไอ';render();
}).catch(e=>{$('products').replaceChildren(el('p','empty',e.message))});
