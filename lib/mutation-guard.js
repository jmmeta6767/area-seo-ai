function cleanHeader(value){return String(value||"").split(",")[0].trim()}
function originOf(value){try{return new URL(String(value||"")).origin}catch{return null}}
function expectedOrigin(req,env=process.env){
  if(Object.prototype.hasOwnProperty.call(env,"ADMIN_ORIGIN")){
    const configured=originOf(env.ADMIN_ORIGIN);
    return configured||null;
  }
  const host=cleanHeader(req?.headers?.["x-forwarded-host"]||req?.headers?.host);
  const proto=cleanHeader(req?.headers?.["x-forwarded-proto"]||"https").toLowerCase();
  if(!host||!["http","https"].includes(proto))return null;
  return originOf(proto+"://"+host);
}
function mutationAllowed(req,env=process.env){
  if(!["POST","PUT","PATCH","DELETE"].includes(String(req?.method||"").toUpperCase()))return true;
  const site=String(req?.headers?.["sec-fetch-site"]||"").toLowerCase();
  if(site==="cross-site")return false;
  const expected=expectedOrigin(req,env);
  if(!expected)return false;
  for(const key of ["origin","referer"]){
    const value=req?.headers?.[key];
    if(value&&originOf(value)!==expected)return false;
  }
  return true;
}
module.exports={mutationAllowed,expectedOrigin,originOf};
