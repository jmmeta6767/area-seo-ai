'use strict';
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const {randomUUID} = require('node:crypto');
const VERSION = 'onpage-1';
const LIMIT = 100;
const SITEMAP_LIMIT = 10;
const DISCOVERY_LIMIT = 5000;
const RETAIN = 60;
const text = s => decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function decode(s) { return String(s).replace(/&(?:amp|lt|gt|quot|apos|#39|#(\d+)|#x([a-f\d]+));/gi,(m,n,h)=>{if(n||h){let cp=parseInt(n||h,h?16:10);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';}return ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"})[m.toLowerCase()]||m;}); }
function attrs(tag) { const a={}; for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) a[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]??''); return a; }
function allowedURL(raw, base) {
  const u = new URL(raw, base), origin = new URL(base).origin;
  if(u.protocol!=='https:' || u.origin!==origin || u.username || u.password) throw Error('URL must stay on the configured HTTPS website');
  u.hash=''; return u.href;
}
function publicIP(ip) {
  if(net.isIP(ip)===6) return /^[23][0-9a-f]{3}:/i.test(ip) && !/^2001:(?:db8|0):/i.test(ip) && !/^2002:/i.test(ip);
  if(net.isIP(ip)!==4) return false;
  const [a,b]=ip.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));
}
function parseRobots(body, base) {
  const groups=[];let current=null;const sitemapRaw=[];
  const ensure=()=>{if(!current){current={agents:[],rules:[],rulesStarted:false};groups.push(current)}return current};
  for(const rawLine of String(body||'').split(/\r?\n/)){
    const line=rawLine.replace(/\s*#.*$/,'').trim();if(!line)continue;
    const i=line.indexOf(':');if(i<0)continue;
    const key=line.slice(0,i).trim().toLowerCase(),value=line.slice(i+1).trim();
    if(key==='sitemap'){if(value)sitemapRaw.push(value);continue}
    if(key==='user-agent'){
      if(!current||current.rulesStarted){current={agents:[],rules:[],rulesStarted:false};groups.push(current)}
      current.agents.push(value.toLowerCase());continue;
    }
    if(key==='allow'||key==='disallow'){const g=ensure();g.rulesStarted=true;g.rules.push({type:key,value});}
  }
  const wildcard=groups.filter(g=>g.agents.includes('*'));
  const blocksAll=wildcard.some(g=>g.rules.some(r=>r.type==='disallow'&&r.value==='/'));
  const sitemaps=[],externalSitemaps=[],invalidSitemaps=[];
  for(const raw of sitemapRaw){
    try{const u=new URL(raw,base);if(u.protocol!=='https:'||u.username||u.password)throw Error('invalid');if(u.origin===new URL(base).origin)sitemaps.push(u.href);else externalSitemaps.push(u.href);}
    catch{invalidSitemaps.push(raw);}
  }
  return {blocksAll,sitemaps:[...new Set(sitemaps)],externalSitemaps:[...new Set(externalSitemaps)],invalidSitemaps:[...new Set(invalidSitemaps)]};
}
function canonicalRelation(pageUrl, canonical) {
  if(!canonical)return {absoluteHttps:false,sameOrigin:false,self:false};
  try{
    const page=new URL(pageUrl),u=new URL(canonical);
    u.hash='';page.hash='';
    const absoluteHttps=u.protocol==='https:'&&!u.username&&!u.password;
    return {absoluteHttps,sameOrigin:absoluteHttps&&u.origin===page.origin,self:absoluteHttps&&u.href===page.href};
  }catch{return {absoluteHttps:false,sameOrigin:false,self:false}}
}
function fetchPage(url, base, redirects=0) {
  url=allowedURL(url,base);
  return new Promise((resolve,reject)=>{
    const start=Date.now();
    const req=https.get(url,{headers:{'User-Agent':'AREA-SEO-AI/1.4 SiteAudit','Accept-Encoding':'identity'},lookup:(hostname,opts,cb)=>{
      dns.lookup(hostname,{all:true},(err,addresses)=>{
        if(err) return cb(err);
        const safe=addresses.filter(a=>publicIP(a.address));
        if(!safe.length) return cb(Error('Private or reserved destination blocked'));
        if(opts.all) cb(null,safe); else cb(null,safe[0].address,safe[0].family);
      });
    }},res=>{
      if([301,302,303,307,308].includes(res.statusCode)) {
        res.resume();
        if(redirects>=3) return reject(Error('Too many redirects'));
        try { resolve(fetchPage(allowedURL(res.headers.location,url),base,redirects+1)); } catch(e){ reject(e); } return;
      }
      let chunks=[],size=0;
      res.on('data',c=>{size+=c.length;if(size>2e6) req.destroy(Error('Page exceeds 2 MB limit'));else chunks.push(c);});
      res.on('error',reject);
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,html:Buffer.concat(chunks).toString('utf8'),url,elapsedMs:Date.now()-start}));
    });
    const deadline=setTimeout(()=>req.destroy(Error('Page timeout')),12000);
    req.on('close',()=>clearTimeout(deadline));req.on('error',reject);
  });
}
function analyzePage(url, response) {
  if(response.error) return {url,title:'',score:null,status:0,error:response.error,checks:[],issues:[{key:'fetch',priority:'high',label:'อ่านหน้าเว็บไม่สำเร็จ',action:'ตรวจว่าเว็บเปิดได้และลองสแกนอีกครั้ง',evidence:response.error}]};
  const html=String(response.html||'');
  const markup=html.replace(/<!--[\s\S]*?-->/g,'');
  const bodyMarkup=markup.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const title=text(bodyMarkup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]).slice(0,500);
  const metas=[...bodyMarkup.matchAll(/<meta\b[^>]*>/gi)].map(m=>attrs(m[0]));
  const meta=name=>metas.find(a=>(a.name||'').toLowerCase()===name)?.content||'';
  const description=meta('description').slice(0,1000);
  const canonical=[...bodyMarkup.matchAll(/<link\b[^>]*>/gi)].map(m=>attrs(m[0])).find(a=>(a.rel||'').toLowerCase().split(/\s+/).includes('canonical'))?.href||'';
  const canonicalState=canonicalRelation(response.url||url,canonical),canonicalOK=canonicalState.absoluteHttps;
  const h1=[...bodyMarkup.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>text(m[1]));
  const images=[...bodyMarkup.matchAll(/<img\b[^>]*>/gi)].map(m=>attrs(m[0]));
  const missingAlt=images.filter(a=>!Object.hasOwn(a,'alt')).length;
  const links=[...bodyMarkup.matchAll(/<a\b[^>]*>/gi)].map(m=>attrs(m[0]).href).filter(Boolean);
  const internal=links.filter(h=>{try{return new URL(h,url).origin===new URL(url).origin&&/^https?:/.test(new URL(h,url).protocol);}catch{return false;}}).length;
  const robots=metas.filter(a=>['robots','googlebot'].includes((a.name||'').toLowerCase())).map(a=>a.content||'').join(',')+','+(response.headers?.['x-robots-tag']||'');
  const visible=text(bodyMarkup.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi,''));
  const scripts=[...markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>(attrs(m[1]).type||'').toLowerCase()==='application/ld+json');
  let schemaErrors=0;for(const m of scripts){try{const j=JSON.parse(m[2]);if(!j||typeof j!=='object')schemaErrors++;}catch{schemaErrors++;}}
  const checks=[];
  const add=(key,ok,weight,priority,label,action,evidence)=>checks.push({key,ok,weight,priority,label,action,evidence});
  add('http',response.status>=200&&response.status<300,20,'high','หน้าเว็บตอบกลับสำเร็จ','แก้ HTTP error หรือ URL ใน sitemap',String(response.status));
  add('indexable',!/(?:^|[\s,:;])(noindex|none)(?:$|[\s,;])/i.test(robots),20,'high','ไม่พบคำสั่ง noindex','ถ้าต้องการให้ค้นพบหน้านี้ ให้ตรวจ meta robots และ X-Robots-Tag',robots.replace(/^,+|,+$/g,'')||'ไม่พบคำสั่งห้ามใน HTML/HTTP');
  add('title',!!title,15,'medium','มีชื่อหน้า','เขียนชื่อหน้าที่อธิบายบริการและตรงกับเนื้อหา',title||'ไม่พบ title');
  add('description',!!description.trim(),10,'medium','มีคำอธิบายหน้า','เพิ่มคำอธิบายเฉพาะหน้านี้และจุดเด่นที่ตรวจสอบได้',description||'ไม่พบ meta description');
  add('heading',h1.some(Boolean),10,'medium','มีหัวเรื่องหลัก','เพิ่มหัวเรื่องหลักที่อ่านเข้าใจได้',`${h1.length} H1`);
  add('canonical',canonicalOK,5,'low','มี canonical URL แบบสมบูรณ์','ตรวจและระบุ URL หลักเพื่อลดความสับสนของหน้าซ้ำ',canonical.slice(0,500)||'ไม่พบ canonical');
  add('alt',missingAlt===0,5,'medium','รูปมีแอตทริบิวต์ ALT','เพิ่มคำอธิบายรูปที่มีสาระ ใช้ alt ว่างกับรูปตกแต่ง',`${missingAlt}/${images.length} รูปขาด ALT`);
  add('links',internal>0,5,'medium','มีลิงก์ภายในที่อ่านจาก HTML ได้','เชื่อมหน้าบริการหรือบทความที่เกี่ยวข้องด้วยลิงก์จริง',`${internal} ลิงก์ (ยังไม่ตรวจปลายทาง)`);
  add('viewport',/width\s*=\s*device-width/i.test(meta('viewport')),5,'low','ตั้ง viewport สำหรับมือถือ','เพิ่ม meta viewport และตรวจการแสดงผลมือถือ',meta('viewport')||'ไม่พบ viewport');
  add('content',!!visible,5,'high','มีข้อความให้อ่านจาก HTML','ตรวจว่าเนื้อหาสำคัญอยู่ใน HTML ที่เซิร์ฟเวอร์ส่งกลับ',`${visible.length} ตัวอักษร ไม่ใช้ความยาวตัดสินอันดับ`);
  const issues=checks.filter(c=>!c.ok).map(({weight,ok,...c})=>c);
  if(schemaErrors)issues.push({key:'schema',priority:'medium',label:'JSON-LD อ่านไม่ได้',action:'แก้รูปแบบ JSON แล้วตรวจด้วย Rich Results Test',evidence:`${schemaErrors} ชุด`});
  if(canonicalOK&&!canonicalState.sameOrigin)issues.push({key:'canonical-origin',priority:'high',label:'Canonical ชี้ออกนอกเว็บไซต์',action:'ยืนยันว่า canonical ชี้ URL หลักของ AREA Maibab ในโดเมนเดียวกัน',evidence:canonical.slice(0,500)});
  else if(canonicalOK&&!canonicalState.self)issues.push({key:'canonical-target',priority:'medium',label:'Canonical ไม่ตรงกับ URL ที่สแกน',action:'ตรวจว่าเป็นการรวมหน้าซ้ำโดยตั้งใจ หรือแก้ canonical ให้ตรงกับ URL หลักของหน้านี้',evidence:canonical.slice(0,500)});
  if(/ส่งทั่วเชียงราย|บริการทั่วเชียงราย|ให้บริการทั่วเชียงราย/.test(visible))issues.push({key:'coverage',priority:'high',label:'ทบทวนคำกล่าวอ้างพื้นที่บริการ',action:'ตรวจให้ตรงกับพื้นที่ที่ยืนยัน โดยเน้นแม่สาย',evidence:'พบข้อความครอบคลุมเชียงรายทั้งจังหวัด'});
  return {url,finalUrl:response.url||url,status:response.status,title,description,canonical:canonical.slice(0,1000),canonicalSameOrigin:canonicalState.sameOrigin,canonicalSelf:canonicalState.self,h1:h1.slice(0,8).map(s=>s.slice(0,300)),imageCount:images.length,missingAlt,internalLinks:internal,schemaCount:scripts.length,schemaErrors,elapsedMs:response.elapsedMs||0,score:checks.reduce((n,c)=>n+(c.ok?c.weight:0),0),checks,issues};
}
function duplicateIssues(pages) {
  for(const field of ['title','description']) {
    const groups=new Map();for(const p of pages){if(!p[field])continue;const key=p[field].toLocaleLowerCase().trim();groups.set(key,[...(groups.get(key)||[]),p]);}
    for(const group of groups.values()) if(group.length>1)for(const p of group)p.issues.push({key:'duplicate-'+field,priority:'medium',label:field==='title'?'ชื่อหน้าซ้ำในชุดสแกน':'คำอธิบายซ้ำในชุดสแกน',action:'เขียนข้อความให้ตรงกับเนื้อหาเฉพาะแต่ละหน้า',evidence:`ซ้ำ ${group.length} หน้าในชุดที่สแกน`});
  }
}
function createIntelligence({dataDir,base,fetcher=fetchPage,cooldownMs=60000,persistent}) {
  base=allowedURL(base,base);let running=false,lastStart=0;
  const storage=require('./history-store').createHistoryStore({dataDir,persistent});
  const read=storage.read,save=storage.save;
  const summaries=()=>read().snapshots.filter(s=>s.site===base).map(({pages,...s})=>({...s,pageCount:pages.length}));
  const previousFor=(history,url)=>history.find(s=>s.site===base&&s.scoringVersion===VERSION&&s.pages.some(p=>p.url===url&&p.score!==null));
  async function scan() {
    if(running)throw Object.assign(Error('กำลังสแกนอยู่ กรุณารอผลรอบปัจจุบัน'),{status:409});
    if(Date.now()-lastStart<cooldownMs)throw Object.assign(Error('กรุณารอ 1 นาทีก่อนสแกนรอบใหม่'),{status:429});
    running=true;lastStart=Date.now();
    try {
      const old=read(),warnings=[],urls=new Set([base]);let discovered=0,discoveryLimited=false;
      const rootMap=new URL('/sitemap.xml',base).href,robotsURL=new URL('/robots.txt',base).href,queue=[rootMap],queued=new Set(queue);
      const siteIssues=[];let robots={url:robotsURL,status:0,readable:false,blocksAll:false,sitemaps:[],externalSitemaps:[],invalidSitemaps:[],declaresRootSitemap:false,error:null};
      try{
        const rr=await fetcher(robotsURL,base);robots.status=Number(rr.status||0);
        if(robots.status===200){
          const parsed=parseRobots(rr.html,base);robots={...robots,...parsed,readable:true,declaresRootSitemap:parsed.sitemaps.includes(rootMap)};
          if(parsed.blocksAll)siteIssues.push({key:'robots-block-all',priority:'high',label:'robots.txt บล็อก crawler ทั้งเว็บไซต์',action:'ตรวจ User-agent: * และ Disallow: / ก่อนเผยแพร่',evidence:'พบ Disallow: / สำหรับ User-agent: *'});
          if(!robots.declaresRootSitemap)siteIssues.push({key:'robots-sitemap',priority:'low',label:'robots.txt ยังไม่ประกาศ sitemap หลัก',action:'เพิ่ม Sitemap: '+rootMap+' เพื่อให้ crawler พบแผนผังเว็บได้ชัดเจน',evidence:parsed.sitemaps.length?parsed.sitemaps.join(' · '):'ไม่พบ Sitemap directive'});
          if(parsed.externalSitemaps.length)siteIssues.push({key:'robots-external-sitemap',priority:'medium',label:'robots.txt ประกาศ sitemap ต่างโดเมน',action:'ตรวจว่า sitemap ต่างโดเมนเป็นของธุรกิจและตั้งค่าโดยตั้งใจ',evidence:parsed.externalSitemaps.join(' · ')});
          if(parsed.invalidSitemaps.length)siteIssues.push({key:'robots-invalid-sitemap',priority:'medium',label:'robots.txt มี Sitemap URL ที่อ่านไม่ได้',action:'แก้ Sitemap directive ให้เป็น HTTPS URL ที่ถูกต้อง',evidence:parsed.invalidSitemaps.join(' · ')});
        }else siteIssues.push({key:'robots-http',priority:'low',label:'ไม่พบ robots.txt ที่ตอบกลับ 200',action:'ตรวจ /robots.txt และกำหนดกติกา crawler ให้ชัดเจนเมื่อจำเป็น',evidence:'HTTP '+robots.status});
      }catch(e){robots.error=e.message;siteIssues.push({key:'robots-fetch',priority:'medium',label:'ตรวจ robots.txt ไม่สำเร็จ',action:'ตรวจว่า /robots.txt เปิดอ่านได้จากภายนอก',evidence:e.message});}
      let sitemapsRead=0;
      while(queue.length){
        const mapURL=queue.shift();sitemapsRead++;
        try {
          const map=await fetcher(mapURL,base);
          if(map.status!==200)throw Error('Sitemap HTTP '+map.status);
          const xml=String(map.html||'').replace(/<!--[\s\S]*?-->/g,'');
          const index=/<sitemapindex\b/i.test(xml);
          if(!index&&!/<urlset\b/i.test(xml)){warnings.push('รูปแบบ sitemap ไม่รองรับ: '+mapURL);continue;}
          for(const m of xml.matchAll(/<loc\b[^>]*>\s*([\s\S]*?)\s*<\/loc>/gi)){
            try {
              const raw=m[1].trim(),cdata=raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
              const u=allowedURL(cdata?cdata[1].trim():decode(raw),base);
              if(index){
                if(u===mapURL){warnings.push('ข้าม sitemap ที่อ้างอิงตัวเอง');continue;}
                if(queued.has(u))continue;
                if(queued.size>=SITEMAP_LIMIT){warnings.push('อ่าน sitemap สูงสุด '+SITEMAP_LIMIT+' ไฟล์ ผลอาจยังไม่ครบ');continue;}
                queued.add(u);queue.push(u);
              }else if(!urls.has(u)){
                if(urls.size>=DISCOVERY_LIMIT){discoveryLimited=true;warnings.push('พบ URL เกินขอบเขต '+DISCOVERY_LIMIT+' รายการ จำนวนที่แสดงเป็นขั้นต่ำ');break;}
                urls.add(u);
              }
            }catch{warnings.push('ข้าม URL ที่อยู่นอกเว็บไซต์หรือรูปแบบไม่ถูกต้อง');}
          }
        }catch(e){warnings.push('อ่าน sitemap ไม่สำเร็จ: '+mapURL+' · '+e.message);}
      }
      discovered=urls.size;const selected=[...urls].slice(0,LIMIT),pages=new Array(selected.length);let cursor=0;
      await Promise.all(Array.from({length:Math.min(3,selected.length)},async()=>{while(cursor<selected.length){const i=cursor++,url=selected[i];try{const response=await fetcher(url,base);if(response.headers?.['content-type']&&!/html/i.test(response.headers['content-type']))throw Error('Response is not HTML');pages[i]=analyzePage(url,response);}catch(e){pages[i]=analyzePage(url,{error:e.message});}}}));
      duplicateIssues(pages);
      for(const p of pages){const priorSnapshot=previousFor(old.snapshots,p.url),prev=priorSnapshot?.pages.find(x=>x.url===p.url);const sameSet=priorSnapshot&&priorSnapshot.pages.length===pages.length&&priorSnapshot.pages.every(x=>x.score!==null&&pages.some(y=>y.url===x.url&&y.score!==null));p.previousScore=prev?.score??null;p.delta=prev&&p.score!==null?p.score-prev.score:null;const prior=new Set((prev?.issues||[]).map(i=>i.key)),now=new Set(p.issues.map(i=>i.key));p.newIssues=prev?p.issues.filter(i=>!prior.has(i.key)).map(i=>i.key):[];p.resolvedIssues=prev&&p.score!==null?(prev.issues||[]).filter(i=>!now.has(i.key)&&(!i.key.startsWith("duplicate-")||sameSet)).map(i=>i.label):[];}
      const scored=pages.filter(p=>p.score!==null),compared=pages.filter(p=>p.delta!==null);
      const snapshot={id:randomUUID(),site:base,scoringVersion:VERSION,scannedAt:new Date().toISOString(),discovered,discoveryLimited,sitemapsRead,sitemapLimit:SITEMAP_LIMIT,limit:LIMIT,robots,siteIssues,partial:discovered>LIMIT||warnings.length>0||pages.some(p=>p.score===null)||Boolean(robots.error),warnings:[...new Set(warnings)],average:scored.length?Math.round(scored.reduce((n,p)=>n+p.score,0)/scored.length):null,delta:compared.length?Math.round(compared.reduce((n,p)=>n+p.delta,0)/compared.length):null,comparedPages:compared.length,failedPages:pages.length-scored.length,issueCount:siteIssues.length+pages.reduce((n,p)=>n+p.issues.length,0),resolvedCount:pages.reduce((n,p)=>n+p.resolvedIssues.length,0),pages};
      old.snapshots.unshift(snapshot);old.snapshots=old.snapshots.slice(0,RETAIN);await save(old);return snapshot;
    } finally {running=false;}
  }
  return {scan,init:storage.init,exportHistory:()=>read(),history:summaries,latest:()=>read().snapshots.find(s=>s.site===base)||null,detail:id=>read().snapshots.find(s=>s.id===id&&s.site===base),status:()=>({running,retention:RETAIN,pageLimit:LIMIT,sitemapLimit:SITEMAP_LIMIT,discoveryLimit:DISCOVERY_LIMIT,scoringVersion:VERSION,...storage.status()})};
}
module.exports={createIntelligence,analyzePage,allowedURL,publicIP,fetchPage,parseRobots,canonicalRelation};

