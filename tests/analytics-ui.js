const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
const context2d = new Proxy({}, {get: () => () => {}});
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: '', textContent: '', innerHTML: '', clientWidth: 900, clientHeight: 280,
    getContext: () => context2d, replaceChildren() {}, appendChild() {},
  });
  return elements.get(id);
}
const requests = [];
const context = vm.createContext({
  document: {getElementById: element, createElement: () => ({})},
  window: {addEventListener() {}}, devicePixelRatio: 1,
  api: async url => {
    if (url === '/api/content/performance') return {items: [], analyticsConfigured: false};
    return new Promise((resolve, reject) => requests.push({url, resolve, reject}));
  },
});
vm.runInContext(fs.readFileSync(require.resolve('../public/analytics.js'), 'utf8'), context);
async function main() {
  await Promise.resolve();
  assert.equal(element('totalViews').textContent, '—');
  element('analyticsArticle').value = '/article-a.html';
  const first = element('analyticsArticle').onchange();
  requests[0].resolve({metrics: {views: 30, clicks: 0}, keywords: [{query: 'A', position: 2}]});
  await first;
  assert.equal(element('totalViews').textContent, '30');
  assert.equal(element('totalClicks').textContent, '0');
  element('analyticsArticle').value = '/article-b.html';
  const second = element('analyticsArticle').onchange();
  assert.equal(element('totalViews').textContent, '—');
  assert(!element('rankTableBody').innerHTML.includes('>A<'));
  element('analyticsArticle').value = '/article-c.html';
  const third = element('analyticsArticle').onchange();
  requests[2].resolve({metrics: {views: 90, clicks: 9}});
  await third;
  requests[1].resolve({metrics: {views: 20, clicks: 2}});
  await second;
  assert.equal(element('totalViews').textContent, '90');
  const fourth = element('refreshAnalytics').onclick();
  requests[3].reject(Error('Provider unavailable'));
  await fourth;
  assert.equal(element('totalViews').textContent, '—');
  assert(element('analyticsState').textContent.includes('Provider unavailable'));
  console.log('PASS: analytics unknown values, real zero, clearing and out-of-order responses');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
