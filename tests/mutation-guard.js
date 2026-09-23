const assert=require("node:assert/strict");
const {mutationAllowed,expectedOrigin}=require("../lib/mutation-guard");

function req(method,headers){return {method,headers:{host:"area-seo-ai.onrender.com","x-forwarded-proto":"https",...headers}}}

assert.equal(expectedOrigin(req("POST",{}),{}),"https://area-seo-ai.onrender.com");
assert.equal(mutationAllowed(req("GET",{"origin":"https://evil.example"}),{}),true);
assert.equal(mutationAllowed(req("POST",{"origin":"https://area-seo-ai.onrender.com","sec-fetch-site":"same-origin"}),{}),true);
assert.equal(mutationAllowed(req("POST",{"referer":"https://area-seo-ai.onrender.com/dashboard","sec-fetch-site":"same-origin"}),{}),true);
assert.equal(mutationAllowed(req("POST",{"origin":"https://evil.example"}),{}),false);
assert.equal(mutationAllowed(req("POST",{"sec-fetch-site":"cross-site"}),{}),false);
assert.equal(mutationAllowed(req("POST",{"origin":"https://admin.example"}),{ADMIN_ORIGIN:"https://admin.example/path"}),true);
assert.equal(mutationAllowed(req("POST",{"origin":"https://area-seo-ai.onrender.com"}),{ADMIN_ORIGIN:"https://admin.example"}),false);
assert.equal(mutationAllowed(req("POST",{}),{ADMIN_ORIGIN:"not a url"}),false);

console.log("PASS: mutation guard defaults to admin same-origin and rejects cross-site requests");
