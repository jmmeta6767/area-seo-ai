const assert=require("node:assert/strict");
const p=require("../lib/public-site-publisher");

const item={
  title:"เช่าไม้แบบพลาสติกแม่สาย วางแผนจำนวนก่อนเริ่มงานให้พอดี",
  meta:"แนวทางเตรียมข้อมูลก่อนเช่าไม้แบบพลาสติกในแม่สาย เพื่อให้ช่างและผู้รับเหมาส่งขนาด จำนวน วันใช้งาน และพื้นที่หน้างานได้ครบก่อนเช็กคิว",
  slug:"plastic-formwork-planning-maesai",
  service:"ไม้แบบพลาสติก",
  imageAlt:"เช่าไม้แบบพลาสติกแม่สาย",
  content:"# เช่าไม้แบบพลาสติกแม่สาย วางแผนจำนวนก่อนเริ่มงานให้พอดี\n## เตรียมข้อมูลก่อนเช่า\nก่อนเช่าควรเตรียมขนาด จำนวน และวันใช้งาน\n- ระบุชนิดงาน\n- ระบุจำนวน\n| ข้อมูล | ตัวอย่าง |\n| --- | --- |\n| ขนาด | กว้าง x ยาว |\n## เช็กคิวก่อนเริ่มงาน\nส่งรายละเอียดให้ร้านตรวจคิวก่อนใช้งานจริง"
};
const articles='<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","name":"บทความ AREA Maibab","itemListElement":[{"@type":"ListItem","position":1,"name":"เดิม","url":"https://area-maibab-public-site.onrender.com/article-old.html"}]}</script></head><body><main><section><div><div class="seoArticleGrid"><article class="seoArticleCard"><div class="seoArticleBody">เดิม</div></article></div></div></section></main></body></html>';
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://area-maibab-public-site.onrender.com/</loc></url>\n</urlset>\n';

const a=p.buildArticle(item,{publishedAt:"2026-09-23T04:00:00Z"});
assert.equal(a.filename,"article-plastic-formwork-planning-maesai.html");
assert(a.html.includes('<link rel="canonical" href="'+a.canonical+'">'));
assert(a.html.includes('"@type":"BlogPosting"'));
assert(a.html.includes('"@type":"BreadcrumbList"'));
assert.equal((a.html.match(/<h1>/g)||[]).length,1);
assert(!a.html.includes("<h1>เช่าไม้แบบพลาสติกแม่สาย วางแผนจำนวนก่อนเริ่มงานให้พอดี</h1>\n<h1>"));
assert(a.html.includes("<table>"));
assert(!a.html.includes("<script>alert"));

const updated=p.updateArticleListing(articles,item,{publishedAt:"2026-09-23T04:00:00Z"});
assert(updated.includes(a.filename));
assert(updated.includes('"position":2'));
assert(updated.includes("seoArticleCard"));
assert.throws(()=>p.updateArticleListing(updated,item),/already exists/);

const sm=p.updateSitemap(sitemap,a.canonical,"2026-09-23T04:00:00Z");
assert(sm.includes("<lastmod>2026-09-23</lastmod>"));
assert.equal(p.updateSitemap(sm,a.canonical),sm);
assert.throws(()=>p.updateSitemap("<xml></xml>",a.canonical),/missing/);

const pkg=p.buildPublishPackage(item,{articlesHtml:articles,sitemapXml:sitemap},{publishedAt:"2026-09-23T04:00:00Z"});
assert.equal(pkg.files.length,3);
assert.equal(pkg.checks.listingIncludes,true);
assert.equal(pkg.checks.sitemapIncludes,true);
assert.equal(pkg.files[0].path,a.filename);

assert.throws(()=>p.articleFilename("ไทยล้วน"),/English slug/);
console.log("PASS: public-site article template, listing ItemList/card, sitemap and idempotency");
