const crypto=require("crypto");

function digest(value){return crypto.createHash("sha256").update(String(value||""),"utf8").digest()}
function equal(a,b){return crypto.timingSafeEqual(digest(a),digest(b))}
function decodeBasic(header){
  if(typeof header!=="string"||!header.startsWith("Basic "))return null;
  try{
    const raw=Buffer.from(header.slice(6),"base64").toString("utf8"),i=raw.indexOf(":");
    if(i<0)return null;
    return {user:raw.slice(0,i),password:raw.slice(i+1)};
  }catch{return null}
}
function createAdminAuth(env=process.env){
  const user=String(env.ADMIN_USER||"").trim(),password=String(env.ADMIN_PASSWORD||"");
  const required=String(env.REQUIRE_ADMIN_AUTH||"").toLowerCase()==="true";
  const configured=Boolean(user&&password);
  function check(req){
    if(!required)return {ok:true,reason:"disabled"};
    if(!configured)return {ok:false,status:503,reason:"not_configured"};
    const creds=decodeBasic(req.headers.authorization);
    if(!creds||!equal(creds.user,user)||!equal(creds.password,password))return {ok:false,status:401,reason:"unauthorized"};
    return {ok:true,reason:"authenticated"};
  }
  function reject(res,result){
    const status=result?.status||401;
    const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY"};
    if(status===401)headers["WWW-Authenticate"]='Basic realm="AREA SEO AI", charset="UTF-8"';
    res.writeHead(status,headers);
    res.end(JSON.stringify({error:status===503?"Admin authentication is required but not configured":"Authentication required"}));
  }
  return {required,configured,check,reject};
}
module.exports={createAdminAuth,decodeBasic};
