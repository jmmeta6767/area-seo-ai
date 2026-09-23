const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createIntelligence,analyzePage,allowedURL,publicIP,parseRobots,canonicalRelation}=require('../lib/site-intelligence');
const base='https://example.com/';
const good=(title='เช่าไม้แบบ แม่สาย')=>`<!doctype html><html><head><title>${title}</title><meta name='description' content='ข้อมูลบริการที่ตรวจสอบได้'><meta name='viewport' content='width=device-width'><link rel='canonical' href='https://example.com/'></head><body><h1>เช่าไม้แบบ แม่สาย</h1><img src='x' alt='ไม้แบบ'><a href='/contact'>ติดต่อร้าน</a><script type='application/ld+json'>{"@type":"LocalBusiness"}</script></body></html>`;
const response=html=>({status:200,headers:{'content-type':'text/html'},html});
async function main(){
  for(const raw of ['http://example.com','https://evil.com/','https://user:pass@example.com/','javascript:alert(1)'])assert.throws(()=>allowedURL(raw,base));
  assert.equal(allowedURL('/page#part',base),'https://example.com/page');
  for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])assert.equal(publicIP(ip),false,ip);
  assert.equal(publicIP('8.8.8.8'),true);
  const robots=parseRobots('User-agent: *\nDisallow: /\nSitemap: https://example.com/sitemap.xml\nSitemap: https://evil.com/sitemap.xml',base);
  assert.equal(robots.blocksAll,true);assert.deepEqual(robots.sitemaps,['https://example.com/sitemap.xml']);assert.deepEqual(robots.externalSitemaps,['https://evil.com/sitemap.xml']);
  assert.deepEqual(canonicalRelation('https://example.com/a','https://example.com/a'),{absoluteHttps:true,sameOrigin:true,self:true});
  assert.equal(canonicalRelation('https://example.com/a','https://evil.com/a').sameOrigin,false);
  assert.equal(analyzePage(base,response(good())).score,100);
  const damaged=analyzePage(base,response(good().replace("alt='ไม้แบบ'",'').replace('</head>',"<meta name='robots' content='noindex'></head>")));
  assert.equal(damaged.score,75);assert(damaged.issues.some(x=>x.key==='indexable'));
  assert(!analyzePage(base,response(good().replace("alt='ไม้แบบ'","alt=''"))).issues.some(x=>x.key==='alt'));
  assert.equal(analyzePage(base,{error:'timeout'}).score,null);
  assert(analyzePage(base,response(good().replace('{"@type":"LocalBusiness"}','bad'))).issues.some(x=>x.key==='schema'));
  assert(analyzePage(base,response(good().replace("https://example.com/","https://evil.com/"))).issues.some(x=>x.key==='canonical-origin'));
  assert(!analyzePage(base,response(good().replace('</head>',"<!-- <meta name='robots' content='noindex'> --></head>"))).issues.some(x=>x.key==='indexable'));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'seo-history-'));
  try{
    let generation=0,seen=[];
    const fetcher=async url=>{seen.push(url);if(url.endsWith('sitemap.xml'))return response('<urlset><url><loc>https://example.com/page</loc></url><url><loc>https://evil.com/private</loc></url></urlset>');return response(generation?good():good().replace(/<meta name='description'[^>]+>/,''));};
    const service=createIntelligence({dataDir:dir,base,fetcher,cooldownMs:0});
    let first=await service.scan();assert.equal(first.average,90);assert.equal(first.pages.length,2);assert(first.partial);assert(!seen.includes('https://evil.com/private'));assert.equal(first.delta,null);
    generation=1;let second=await service.scan();assert.equal(second.average,100);assert.equal(second.delta,10);assert.equal(second.resolvedCount,2);assert.equal(second.comparedPages,2);assert(second.pages[0].issues.some(x=>x.key==='duplicate-title'));
    const restarted=createIntelligence({dataDir:dir,base,fetcher,cooldownMs:0});assert.equal(restarted.history().length,2);assert.equal(restarted.detail(first.id).average,90);
    const failed=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async()=>{throw Error('offline');}});let failure=await failed.scan();assert.equal(failure.average,null);assert.equal(failure.resolvedCount,0);assert.equal(failure.pages[0].delta,null);
    assert.equal((await restarted.scan()).pages[0].previousScore,100);
    const limited=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async url=>url.endsWith('sitemap.xml')?response('<urlset>'+Array.from({length:120},(_,i)=>`<loc>https://example.com/p${i}</loc>`).join('')+'</urlset>'):response(good())});const capped=await limited.scan();assert.equal(capped.pages.length,100);assert.equal(capped.discovered,121);assert.equal(capped.partial,true);
    const childSeen=[];
    const maps={
      '/sitemap.xml':'<sitemapindex><loc>https://example.com/articles.xml</loc><loc>https://example.com/nested.xml</loc><loc>https://evil.com/map.xml</loc></sitemapindex>',
      '/articles.xml':'<urlset><loc><![CDATA[https://example.com/a?x=1&y=2]]></loc><loc>https://example.com/shared</loc></urlset>',
      '/nested.xml':'<sitemapindex><loc>https://example.com/articles.xml</loc><loc>https://example.com/services.xml</loc></sitemapindex>',
      '/services.xml':'<urlset><loc>https://example.com/shared</loc><loc>https://example.com/service</loc></urlset>'
    };
    const nested=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async url=>{childSeen.push(url);return response(maps[new URL(url).pathname]||good(url));}});
    const nestedResult=await nested.scan();assert.equal(nestedResult.pages.length,4);assert.equal(nestedResult.sitemapsRead,4);assert(nestedResult.partial);
    assert.equal(childSeen.filter(u=>u.endsWith('/articles.xml')).length,1);assert(!childSeen.some(u=>u.includes('evil.com')));
    assert(nestedResult.pages.some(p=>p.url==='https://example.com/a?x=1&y=2'));
    const mapBudget=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async url=>response(url.endsWith('/sitemap.xml')?'<sitemapindex>'+Array.from({length:20},(_,i)=>'<loc>https://example.com/map'+i+'.xml</loc>').join('')+'</sitemapindex>':url.endsWith('.xml')?'<urlset><loc>https://example.com/page</loc></urlset>':good())});
    const budget=await mapBudget.scan();assert.equal(budget.sitemapsRead,10);assert(budget.partial);assert(budget.warnings.some(w=>w.includes('10')));
    const brokenChild=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async url=>{if(url.endsWith('/sitemap.xml'))return response('<sitemapindex><loc>https://example.com/broken.xml</loc></sitemapindex>');if(url.endsWith('.xml'))throw Error('timeout');return response(good());}});
    const brokenResult=await brokenChild.scan();assert(brokenResult.partial);assert.equal(brokenResult.pages.length,1);assert.equal(brokenResult.average,100);
    const complete=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async url=>response(url.endsWith('/sitemap.xml')?'<urlset>'+Array.from({length:35},(_,i)=>'<loc>https://example.com/full'+i+'</loc>').join('')+'</urlset>':good(url))});
    const full=await complete.scan();assert.equal(full.pages.length,36);assert.equal(full.partial,false);
    const robotsAware=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async url=>{if(url.endsWith('/robots.txt'))return response('User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml');if(url.endsWith('/sitemap.xml'))return response('<urlset><loc>https://example.com/page</loc></urlset>');return response(good(url));}});
    const robotsResult=await robotsAware.scan();assert.equal(robotsResult.robots.status,200);assert.equal(robotsResult.robots.declaresRootSitemap,true);assert.equal(robotsResult.siteIssues.length,0);
    const discoveryCap=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async url=>response(url.endsWith('/sitemap.xml')?'<urlset>'+Array.from({length:5001},(_,i)=>'<loc>https://example.com/capped'+i+'</loc>').join('')+'</urlset>':good(url))});
    const cappedDiscovery=await discoveryCap.scan();assert.equal(cappedDiscovery.discovered,5000);assert.equal(cappedDiscovery.discoveryLimited,true);assert.equal(cappedDiscovery.pages.length,100);assert(cappedDiscovery.partial);
    let release;const pending=new Promise(r=>release=r);const busy=createIntelligence({dataDir:dir,base,cooldownMs:0,fetcher:async()=>{await pending;return response(good());}});const work=busy.scan();await assert.rejects(busy.scan(),e=>e.status===409);release();await work;
    const cooldown=createIntelligence({dataDir:dir,base,fetcher});await cooldown.scan();await assert.rejects(cooldown.scan(),e=>e.status===429);
    for(let i=0;i<61;i++)await restarted.scan();assert.equal(restarted.history().length,60);
    fs.writeFileSync(path.join(dir,'site-history.json'),'broken');await assert.rejects(restarted.scan());assert.equal(fs.readFileSync(path.join(dir,'site-history.json'),'utf8'),'broken');
    console.log('PASS: analysis, history persistence, deltas, resolved issues, failure exclusion, crawl limits, concurrency, retention and URL guards');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
