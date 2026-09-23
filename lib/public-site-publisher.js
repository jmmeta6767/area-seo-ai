const {URL}=require("url");

const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const xmlEsc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[m]));
const safeJson=x=>JSON.stringify(x).replace(/</g,"\\u003c");
const stripTags=x=>String(x||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();

function renderInline(text){
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|[^\s)]+\.html(?:#[^\s)]*)?)\)/g,(m,label,href)=>'<a href="'+esc(href)+'">'+label+'</a>');
}

function markdownToArticle(md){
  const lines=String(md||"").replace(/\r/g,"").split("\n");
  const out=[];let i=0;let h1Skipped=false;
  while(i<lines.length){
    let line=lines[i].trim();
    if(!line){i++;continue}
    if(/^#\s+/.test(line)){if(!h1Skipped)h1Skipped=true;else out.push("<h2>"+renderInline(line.replace(/^#\s+/,""))+"</h2>");i++;continue}
    if(/^##\s+/.test(line)){out.push('<section class="articleSection"><h2>'+renderInline(line.replace(/^##\s+/,""))+"</h2>");i++;while(i<lines.length&&!/^##?\s+/.test(lines[i].trim())){const inner=lines[i].trim();if(!inner){i++;continue}
      if(/^###\s+/.test(inner)){out.push("<h3>"+renderInline(inner.replace(/^###\s+/,""))+"</h3>");i++;continue}
      if(/^[-*]\s+/.test(inner)){const items=[];while(i<lines.length&&/^[-*]\s+/.test(lines[i].trim())){items.push("<li>"+renderInline(lines[i].trim().replace(/^[-*]\s+/,""))+"</li>");i++}out.push("<ul>"+items.join("")+"</ul>");continue}
      if(/^\|.*\|$/.test(inner)){const rows=[];while(i<lines.length&&/^\|.*\|$/.test(lines[i].trim())){rows.push(lines[i].trim().split("|").slice(1,-1).map(x=>x.trim()));i++}if(rows.length>=2){const divider=rows[1].every(c=>/^:?-{3,}:?$/.test(c));const head=rows[0],body=divider?rows.slice(2):rows.slice(1);out.push('<div class="tableWrap"><table><thead><tr>'+head.map(c=>"<th>"+renderInline(c)+"</th>").join("")+"</tr></thead><tbody>"+body.map(r=>"<tr>"+r.map(c=>"<td>"+renderInline(c)+"</td>").join("")+"</tr>").join("")+"</tbody></table></div>")}continue}
      out.push("<p>"+renderInline(inner)+"</p>");i++}
      out.push("</section>");continue}
    if(/^###\s+/.test(line)){out.push("<h3>"+renderInline(line.replace(/^###\s+/,""))+"</h3>");i++;continue}
    if(/^[-*]\s+/.test(line)){const items=[];while(i<lines.length&&/^[-*]\s+/.test(lines[i].trim())){items.push("<li>"+renderInline(lines[i].trim().replace(/^[-*]\s+/,""))+"</li>");i++}out.push("<ul>"+items.join("")+"</ul>");continue}
    out.push("<p>"+renderInline(line)+"</p>");i++;
  }
  return out.join("\n");
}

function articleFilename(slug){
  const clean=String(slug||"").toLowerCase().replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"");
  if(!clean)throw Error("Valid English slug required");
  return "article-"+clean+".html";
}

function thaiDate(iso){
  const d=iso?new Date(iso):new Date();
  if(Number.isNaN(d.getTime()))throw Error("Invalid publish date");
  return new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Bangkok"}).format(d);
}

function buildArticle(item,opts={}){
  const base=String(opts.baseUrl||"https://area-maibab-public-site.onrender.com").replace(/\/$/,"");
  const filename=articleFilename(item.slug),canonical=base+"/"+filename;
  const title=String(item.title||"").trim(),meta=String(item.meta||"").trim();
  if(!title||!meta)throw Error("Title and meta are required");
  const published=opts.publishedAt||new Date().toISOString(),dateText=thaiDate(published);
  const category=esc(item.service||"บทความ");
  const hero=item.heroImage?String(item.heroImage).replace(/^\/+/,""):null;
  const heroAbs=hero?base+"/"+hero:null;
  const schema={"@context":"https://schema.org","@type":"BlogPosting",headline:title,description:meta,datePublished:published,dateModified:published,author:{"@type":"Organization",name:"ห้างหุ้นส่วนจำกัด แอเรีย ไม้แบบ",url:base+"/"},publisher:{"@type":"Organization",name:"ห้างหุ้นส่วนจำกัด แอเรีย ไม้แบบ",logo:{"@type":"ImageObject",url:base+"/assets/area-logo-full-yellow.webp"}},mainEntityOfPage:{"@type":"WebPage","@id":canonical},inLanguage:"th-TH"};
  if(heroAbs)schema.image=[heroAbs];
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"หน้าแรก",item:base+"/"},{"@type":"ListItem",position:2,name:"บทความ",item:base+"/articles.html"},{"@type":"ListItem",position:3,name:title,item:canonical}]};
  const ogImage=heroAbs?'<meta property="og:image" content="'+esc(heroAbs)+'">':"";
  const heroHtml=hero?'<figure class="articleHeroImage"><img src="'+esc(hero)+'" alt="'+esc(item.imageAlt||title)+'"></figure>':"";
  const body=markdownToArticle(item.content);
  const cta='<div class="articleCTA"><div><b>สอบถามคิวและรายละเอียดการเช่า</b><span>แจ้งรายการ จำนวน วันที่ใช้ และพื้นที่หน้างานในอำเภอแม่สาย</span></div><div><a class="btn primary contactLink channel-phone" href="tel:0649893124">โทร 064-989-3124</a><a class="btn black contactLink channel-line" href="https://line.me/ti/p/~areamaibab">LINE areamaibab</a></div></div>';
  const html='<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>'+esc(title)+' | AREA Maibab</title><link rel="canonical" href="'+esc(canonical)+'"><meta name="description" content="'+esc(meta)+'"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="article"><meta property="og:locale" content="th_TH"><meta property="og:site_name" content="AREA Maibab"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(meta)+'">'+ogImage+'<meta property="article:published_time" content="'+esc(published)+'"><link rel="stylesheet" href="style.css?v=contact-icons-20260922"><script type="application/ld+json">'+safeJson(schema)+'</script><script type="application/ld+json">'+safeJson(breadcrumb)+'</script></head><body><div class="topline"><div class="wrap"><span><b>แม่สาย</b> • เช่านั่งร้าน ไม้แบบ และเครื่องมือช่าง</span><span class="right">โทร 064-989-3124 • LINE areamaibab</span></div></div><header class="header"><div class="wrap nav"><a class="brand" href="index.html"><span class="mark"></span><span>AREA MAIBAB<small>CONSTRUCTION RENTAL • MAE SAI</small></span></a><nav class="links"><a href="equipment.html">อุปกรณ์ให้เช่า</a><a href="scaffolding.html">นั่งร้าน</a><a href="formwork.html">ไม้แบบ</a><a href="tools.html">เครื่องมือช่าง</a><a href="guides.html">คู่มือ</a><a href="articles.html">บทความ</a><a href="faq.html">FAQ</a></nav></div></header><main><article class="seoArticle"><div class="wrap articlePage"><nav class="breadcrumbs"><a href="index.html">หน้าแรก</a> / <a href="articles.html">บทความ</a> / '+esc(title)+'</nav><div class="kicker">'+category+' • แม่สาย</div><h1>'+esc(title)+'</h1><div class="articleMeta"><span>อัปเดต '+esc(dateText)+'</span><span>AREA Maibab</span></div>'+heroHtml+body+cta+'</div></article></main><footer class="foot"><div class="wrap footGrid"><div><h3>AREA Maibab</h3><p>เช่าไม้แบบ นั่งร้าน และเครื่องมือช่างในแม่สาย</p></div><div><h3>ติดต่อ</h3><p>064-989-3124<br>LINE: areamaibab<br><a href="https://www.facebook.com/share/1JPo4uZxKu/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">Facebook แอเรียไม้แบบ</a></p></div><div><h3>อ่านต่อ</h3><p><a href="articles.html">บทความทั้งหมด</a><br><a href="formwork.html">ไม้แบบ</a></p></div></div></footer><script src="app.js"></script></body></html>';
  return {filename,canonical,html,schema,breadcrumb};
}

function updateSitemap(xml,canonical,date){
  const src=String(xml||"");
  if(src.includes("<loc>"+canonical+"</loc>"))return src;
  if(!src.includes("</urlset>"))throw Error("Invalid sitemap.xml: missing </urlset>");
  const d=String(date||new Date().toISOString()).slice(0,10);
  const row='  <url><loc>'+xmlEsc(canonical)+'</loc><lastmod>'+xmlEsc(d)+'</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n';
  return src.replace("</urlset>",row+"</urlset>");
}

function findJsonLdBlocks(html){
  const out=[];const re=/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;let m;
  while((m=re.exec(html)))out.push({full:m[0],json:m[1],index:m.index});
  return out;
}

function updateArticleListing(html,item,opts={}){
  let src=String(html||"");const base=String(opts.baseUrl||"https://area-maibab-public-site.onrender.com").replace(/\/$/,""),filename=articleFilename(item.slug),url=base+"/"+filename;
  if(src.includes('href="'+filename+'"')||src.includes('"url":"'+url+'"'))throw Error("Article already exists in listing");
  const blocks=findJsonLdBlocks(src);const block=blocks.find(b=>{try{const x=JSON.parse(b.json);return x&&x["@type"]==="ItemList"}catch{return false}});
  if(!block)throw Error("articles.html ItemList JSON-LD not found");
  const data=JSON.parse(block.json);const arr=Array.isArray(data.itemListElement)?data.itemListElement:[];
  arr.push({"@type":"ListItem",position:arr.length+1,name:String(item.title||"").trim(),url});data.itemListElement=arr;
  src=src.replace(block.full,'<script type="application/ld+json">'+safeJson(data)+"</script>");
  const endMarker='</div></div></section></main>';const pos=src.lastIndexOf(endMarker);
  if(pos<0||src.lastIndexOf('<div class="seoArticleGrid">')<0)throw Error("articles.html grid marker not found");
  const hero=item.heroImage?String(item.heroImage).replace(/^\/+/,""):null;
  const image=hero?'<a class="seoArticleImage" href="'+esc(filename)+'"><img src="'+esc(hero)+'" alt="'+esc(item.imageAlt||item.title)+'" loading="lazy"></a>':"";
  const summary=esc(item.summary||stripTags(item.meta).slice(0,180));
  const card='\n<article class="seoArticleCard">'+image+'<div class="seoArticleBody"><span class="seoArticleCategory">'+esc(item.service||"บทความ")+'</span><h2><a href="'+esc(filename)+'">'+esc(item.title)+'</a></h2><p>'+summary+'</p><div class="seoArticleMeta">อัปเดต '+esc(thaiDate(opts.publishedAt||new Date().toISOString()))+' • แม่สาย</div><a class="seoArticleRead" href="'+esc(filename)+'">อ่านบทความ →</a></div></article>\n';
  return src.slice(0,pos)+card+src.slice(pos);
}

function buildPublishPackage(item,source,opts={}){
  if(!source||typeof source.articlesHtml!=="string"||typeof source.sitemapXml!=="string")throw Error("Public source files are required");
  const article=buildArticle(item,opts),articlesHtml=updateArticleListing(source.articlesHtml,item,opts),sitemapXml=updateSitemap(source.sitemapXml,article.canonical,opts.publishedAt);
  return {article,files:[{path:article.filename,content:article.html},{path:"articles.html",content:articlesHtml},{path:"sitemap.xml",content:sitemapXml}],checks:{articlePath:article.filename,canonical:article.canonical,listingIncludes:articlesHtml.includes(article.filename),sitemapIncludes:sitemapXml.includes(article.canonical)}};
}

module.exports={articleFilename,markdownToArticle,buildArticle,updateSitemap,updateArticleListing,buildPublishPackage};
