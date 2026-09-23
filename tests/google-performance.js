const assert=require("assert");
const {validatePagePath,parseGaReport,cacheKey,getCached,setCached,clearCache,cacheTtlMs,normalizeProviderError}=require("../lib/google-performance");

assert.equal(validatePagePath("/article-test.html"),"/article-test.html");
for(const bad of ["","//evil.example/x","/x?y=1","/x#frag","/x\\y","/x\n"]){
  assert.throws(()=>validatePagePath(bad),e=>e&&e.status===400);
}
const report=parseGaReport({
  rows:[
    {dimensionValues:[{value:"20260901"}],metricValues:[{value:"5"},{value:"5"}]},
    {dimensionValues:[{value:"20260902"}],metricValues:[{value:"8"},{value:"7"}]}
  ],
  totals:[{metricValues:[{value:"13"},{value:"9"}]}]
});
assert.equal(report.views,13);
assert.equal(report.users,9);
assert.deepEqual(report.daily.map(x=>x.date),["2026-09-01","2026-09-02"]);
console.log("PASS: Google performance path validation and GA aggregate totals");

clearCache();
process.env.GOOGLE_PERFORMANCE_CACHE_TTL_MS="60000";
const key=cacheKey("/article-test.html","2026-09-01","2026-09-30");
setCached(key,{metrics:{views:1}},1000);
assert.deepEqual(getCached(key,2000),{metrics:{views:1}});
assert.equal(getCached(key,61001),null);
process.env.GOOGLE_PERFORMANCE_CACHE_TTL_MS="1";
assert.equal(cacheTtlMs(),60000);
process.env.GOOGLE_PERFORMANCE_CACHE_TTL_MS="99999999";
assert.equal(cacheTtlMs(),3600000);
delete process.env.GOOGLE_PERFORMANCE_CACHE_TTL_MS;
const provider=normalizeProviderError(Object.assign(Error("permission details"),{provider:"google",status:403}));
assert.equal(provider.status,503);
assert.equal(provider.message,"Google performance data is temporarily unavailable");
const local=Error("local validation");
assert.equal(normalizeProviderError(local),local);
