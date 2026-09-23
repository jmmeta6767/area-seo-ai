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
  if(method==="GET"&&path.includes("/contents/")){const e=Error("Not Found");e.statusCode=404;throw e}
  if(method==="PUT"&&path.includes("/contents/"))return {status:201,data:{commit:{sha:"c"+calls.length}}};
  if(method==="GET"&&path.includes("/pulls?"))return {status:200,data:[]};
  if(method==="POST"&&path.endsWith("/pulls"))return {status:201,data:{number:8,html_url:"https://github.com/example/pr/8",title:body.title}};
  throw Error("Unexpected mock call "+method+" "+path);
}
const client=createClient({token:"test",repo:"jmmeta6767/area-maibab-public-site",baseBranch:"main",request});
const item={status:"approved",slug:"plastic-formwork-maesai",title:"บทความทดสอบ"};
const pkg={article:{filename:"article-plastic-formwork-maesai.html"},files:[
  {path:"article-plastic-formwork-maesai.html",content:"<html>article</html>"},
  {path:"articles.html",content:"<html>listing</html>"},
  {path:"sitemap.xml",content:"<urlset></urlset>"}
]};
client.createPublishPR(item,pkg).then(out=>{
  assert.equal(out.pr.number,8);assert.equal(out.merged,false);assert.equal(out.files.length,3);
  assert(calls.some(x=>x.method==="POST"&&x.path.endsWith("/git/refs")));
  assert.equal(calls.filter(x=>x.method==="PUT"&&x.path.includes("/contents/")).length,3);
  assert(calls.some(x=>x.method==="POST"&&x.path.endsWith("/pulls")));
  return assert.rejects(()=>client.createPublishPR({status:"ready_for_review",slug:"x"},pkg),/approved/);
}).then(()=>{
  const bad={...pkg,files:[...pkg.files,{path:"index.html",content:"bad"}]};
  return assert.rejects(()=>client.createPublishPR(item,bad),/unexpected path/);
}).then(()=>console.log("PASS: guarded GitHub PR publisher branch/files/PR/no-merge")).catch(e=>{console.error(e);process.exit(1)});
