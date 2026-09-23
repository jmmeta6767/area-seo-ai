const assert=require("node:assert/strict");
const {createClient,safeBranch,parseRepo}=require("../lib/github-pr-publisher");

assert.deepEqual(parseRepo("jmmeta6767/area-maibab-public-site"),{owner:"jmmeta6767",repo:"area-maibab-public-site"});
assert.throws(()=>parseRepo("bad"),/owner\/repo/);
assert.equal(safeBranch("plastic-formwork-maesai"),"area-seo/article-plastic-formwork-maesai");
assert.throws(()=>createClient({baseBranch:"develop",token:"x"}),/must be main/);

const calls=[];
async function request(method,path,body){
  calls.push({method,path,body});
  if(method==="GET"&&path.includes("/git/ref/heads/main"))return {status:200,data:{object:{sha:"base123"}}};
  if(method==="GET"&&path.includes("/git/ref/heads/area-seo")){const e=Error("Not Found");e.statusCode=404;throw e}
  if(method==="POST"&&path.endsWith("/git/refs"))return {status:201,data:{ref:body.ref}};
  if(method==="GET"&&path.includes("/contents/articles.html")&&path.includes("ref=main"))return {status:200,data:{sha:"a1",content:Buffer.from("<html>listing</html>").toString("base64")}};
  if(method==="GET"&&path.includes("/contents/sitemap.xml")&&path.includes("ref=main"))return {status:200,data:{sha:"s1",content:Buffer.from("<urlset></urlset>").toString("base64")}};
  if(method==="GET"&&path.includes("/contents/")){const e=Error("Not Found");e.statusCode=404;throw e}
  if(method==="PUT"&&path.includes("/contents/"))return {status:201,data:{commit:{sha:"c"+calls.length}}};
  if(method==="GET"&&path.includes("/pulls?"))return {status:200,data:[]};
  if(method==="POST"&&path.endsWith("/pulls"))return {status:201,data:{number:body.title.startsWith("Revert")?9:8,html_url:"https://github.com/example/pr/"+(body.title.startsWith("Revert")?9:8),title:body.title}};
  if(method==="GET"&&path.endsWith("/pulls/8"))return {status:200,data:{number:8,html_url:"https://github.com/example/pr/8",title:"SEO",state:"closed",merged:true,merge_commit_sha:"merge8",mergeable:true,head:{ref:"area-seo/article-plastic-formwork-maesai",sha:"head8"},base:{ref:"main"},updated_at:"2026-09-23T00:00:00Z"}};
  if(method==="GET"&&path.endsWith("/git/commits/merge8"))return {status:200,data:{parents:[{sha:"before8"}],tree:{sha:"tree-merge"}}};
  if(method==="GET"&&path.endsWith("/git/commits/before8"))return {status:200,data:{tree:{sha:"tree-before"}}};
  if(method==="GET"&&path.endsWith("/git/commits/base123"))return {status:200,data:{tree:{sha:"tree-current"}}};
  if(method==="GET"&&path.includes("/git/trees/tree-before"))return {status:200,data:{tree:[
    {path:"articles.html",type:"blob",mode:"100644",sha:"a0"},
    {path:"sitemap.xml",type:"blob",mode:"100644",sha:"s0"},
    {path:"index.html",type:"blob",mode:"100644",sha:"i0"}
  ]}};
  if(method==="GET"&&path.includes("/git/trees/tree-merge"))return {status:200,data:{tree:[
    {path:"article-plastic-formwork-maesai.html",type:"blob",mode:"100644",sha:"art1"},
    {path:"articles.html",type:"blob",mode:"100644",sha:"a1"},
    {path:"sitemap.xml",type:"blob",mode:"100644",sha:"s1"},
    {path:"index.html",type:"blob",mode:"100644",sha:"i0"}
  ]}};
  if(method==="GET"&&path.includes("/git/trees/tree-current"))return {status:200,data:{tree:[
    {path:"article-plastic-formwork-maesai.html",type:"blob",mode:"100644",sha:"art1"},
    {path:"articles.html",type:"blob",mode:"100644",sha:"a1"},
    {path:"sitemap.xml",type:"blob",mode:"100644",sha:"s1"},
    {path:"index.html",type:"blob",mode:"100644",sha:"i-later"}
  ]}};
  if(method==="POST"&&path.endsWith("/git/trees"))return {status:201,data:{sha:"tree-targeted"}};
  if(method==="POST"&&path.endsWith("/git/commits"))return {status:201,data:{sha:"revert-commit"}};
  if(method==="PATCH"&&path.includes("/git/refs/heads/"))return {status:200,data:{object:{sha:body.sha}}};
  if(method==="PATCH"&&path.endsWith("/pulls/8"))return {status:200,data:{number:8,html_url:"https://github.com/example/pr/8",state:"closed"}};
  if(method==="GET"&&path.endsWith("/commits/head8/status"))return {status:200,data:{state:"success",statuses:[{context:"CI",state:"success",description:"passed",target_url:"https://github.com/example/actions"}]}};
  throw Error("Unexpected mock call "+method+" "+path);
}
const client=createClient({token:"test",repo:"jmmeta6767/area-maibab-public-site",baseBranch:"main",request});
const item={status:"approved",slug:"plastic-formwork-maesai",title:"บทความทดสอบ"};
const pkg={article:{filename:"article-plastic-formwork-maesai.html"},files:[
  {path:"article-plastic-formwork-maesai.html",content:"<html>article</html>"},
  {path:"articles.html",content:"<html>listing</html>"},
  {path:"sitemap.xml",content:"<urlset></urlset>"}
]};

async function main(){
  const base=await client.getPublishBase(item.slug);
  assert.equal(base.baseSha,"base123");assert.equal(base.articleExists,false);assert.equal(base.articlesHtml.content,"<html>listing</html>");
  const out=await client.createPublishPR(item,pkg,{expectedBaseSha:base.baseSha});
  assert.equal(out.pr.number,8);assert.equal(out.merged,false);assert.equal(out.files.length,3);
  assert(calls.some(x=>x.method==="POST"&&x.path.endsWith("/git/refs")));
  assert.equal(calls.filter(x=>x.method==="PUT"&&x.path.includes("/contents/")).length,3);
  await assert.rejects(()=>client.createPublishPR({status:"ready_for_review",slug:"x"},pkg),/approved/);
  const bad={...pkg,files:[...pkg.files,{path:"index.html",content:"bad"}]};
  await assert.rejects(()=>client.createPublishPR(item,bad),/unexpected path/);
  await assert.rejects(()=>client.createPublishPR(item,pkg,{expectedBaseSha:"old"}),/main changed/);
  const status=await client.getPublishStatus(8);
  assert.equal(status.ci.state,"success");assert.equal(status.merged,true);
  const revert=await client.createRevertPR(8,{slug:item.slug});
  assert.equal(revert.mode,"revert-pull-request");assert.equal(revert.sourcePr,8);assert.equal(revert.pr.number,9);
  assert.deepEqual(new Set(revert.files),new Set(["article-plastic-formwork-maesai.html","articles.html","sitemap.xml"]));
  const treeCall=calls.find(x=>x.method==="POST"&&x.path.endsWith("/git/trees"));
  assert(treeCall);
  const byPath=new Map(treeCall.body.tree.map(x=>[x.path,x]));
  assert.equal(byPath.get("article-plastic-formwork-maesai.html").sha,null);
  assert.equal(byPath.get("articles.html").sha,"a0");
  assert.equal(byPath.get("sitemap.xml").sha,"s0");
  assert.equal(byPath.has("index.html"),false);
  const commitCall=calls.find(x=>x.method==="POST"&&x.path.endsWith("/git/commits"));
  assert.equal(commitCall.body.tree,"tree-targeted");
  assert.deepEqual(commitCall.body.parents,["base123"]);

  const conflictClient=createClient({token:"test",repo:"jmmeta6767/area-maibab-public-site",baseBranch:"main",request:async(method,path,body)=>{
    if(method==="GET"&&path.includes("/git/ref/heads/main"))return {status:200,data:{object:{sha:"base123"}}};
    if(method==="GET"&&path.includes("/pulls?"))return {status:200,data:[]};
    if(method==="GET"&&path.endsWith("/pulls/8"))return request(method,path,body);
    if(method==="GET"&&path.endsWith("/git/commits/merge8"))return request(method,path,body);
    if(method==="GET"&&path.endsWith("/git/commits/before8"))return request(method,path,body);
    if(method==="GET"&&path.endsWith("/git/commits/base123"))return request(method,path,body);
    if(method==="GET"&&path.includes("/git/trees/tree-before"))return request(method,path,body);
    if(method==="GET"&&path.includes("/git/trees/tree-merge"))return request(method,path,body);
    if(method==="GET"&&path.includes("/git/trees/tree-current"))return {status:200,data:{tree:[
      {path:"article-plastic-formwork-maesai.html",type:"blob",mode:"100644",sha:"art1"},
      {path:"articles.html",type:"blob",mode:"100644",sha:"a1"},
      {path:"sitemap.xml",type:"blob",mode:"100644",sha:"s-later"}
    ]}};
    if(method==="GET"&&path.includes("/git/ref/heads/area-seo")){const e=Error("Not Found");e.statusCode=404;throw e}
    throw Error("Unexpected conflict mock "+method+" "+path);
  }});
  await assert.rejects(()=>conflictClient.createRevertPR(8,{slug:item.slug}),/changed after publisher PR/);
  console.log("PASS: guarded publisher PR flow and targeted conflict-safe revert");
}
main().catch(e=>{console.error(e);process.exit(1)});
