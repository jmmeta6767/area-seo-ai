const assert=require("assert");
const {validatePagePath,parseGaReport}=require("../lib/google-performance");

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
