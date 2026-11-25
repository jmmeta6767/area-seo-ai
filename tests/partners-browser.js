'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit}=require('playwright');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'partner-browser-'));
process.env.REQUIRE_ADMIN_AUTH='true';process.env.ADMIN_USER='qa';process.env.ADMIN_PASSWORD='qa';process.env.PUBLIC_SITE_URL='https://areamaibab.com';delete process.env.DATABASE_URL;delete process.env.GA4_PROPERTY_ID;delete process.env.SEARCH_CONSOLE_SITE_URL;delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const {server,initPersistence}=require('../server');
(async()=>{let browser;try{
 await initPersistence();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;process.env.ADMIN_ORIGIN=base;
 const engine=process.env.AREA_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch({...(process.env.CHROMIUM_PATH&&engine===chromium?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true});
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
  const context=await browser.newContext({viewport,httpCredentials:{username:'qa',password:'qa'}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/partners.html');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('โครงการ'));
  await page.locator('#partnerForm [name=name]').fill('ทีมทดสอบ '+viewport.width);
  await page.locator('#partnerForm [name=consent]').check();await page.locator('#partnerForm [name=consentNote]').fill('ยินยอมทดสอบ');
  await page.locator('#partnerForm button').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='บันทึกแล้ว');
  const partnerId=await page.locator('#partnerEdit option').last().getAttribute('value');
  await page.locator('#partnerEdit').selectOption(partnerId);
  await page.locator('#projectForm [name=partnerId]').selectOption(partnerId);
  await page.locator('#projectForm [name=title]').fill('หน้างานแม่สาย '+viewport.width);
  await page.locator('#projectForm [name=equipment]').fill('ไม้แบบเสา 30 ซม.');
  await page.locator('#projectForm [name=projectConsent]').check();
  const save=page.waitForResponse(r=>r.url().endsWith('/api/partners/projects')&&r.request().method()==='POST');
  await page.locator('#projectForm button').click();await save;await page.waitForFunction(()=>document.getElementById('projectEdit').options.length>1);
  const projectId=await page.locator('#projectEdit option').last().getAttribute('value');await page.locator('#projectEdit').selectOption(projectId);
  await page.locator('#draft').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);
  assert((await page.locator('#preview').textContent()).includes('30 ซม.'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('button',{name:'รีเฟรชคู่ค้าและลิงก์'}).click();
  await page.locator('#linkForm [name=partnerId]').selectOption(partnerId);
  await page.locator('#linkForm [name=source]').fill('https://example.com/work-'+viewport.width);
  await page.locator('#linkForm button').click();await page.waitForFunction(()=>document.getElementById('linkInventory').textContent.includes('ยังไม่ตรวจ'));
  await page.locator('#loadPerformance').click();await page.waitForFunction(()=>document.getElementById('performanceReport').textContent.includes('เชื่อม'));

  const popupPromise=page.waitForEvent('popup');await page.locator('#profilePreview').click();const popup=await popupPromise;await popup.waitForLoadState();assert((await popup.locator('h1').textContent()).includes('ทีมทดสอบ'));await popup.close();
  await page.locator('#openWorkspace').click();await page.waitForFunction(()=>document.getElementById('body')?.value.includes('30 ซม.'));
  assert((await page.locator('#slug').inputValue()).includes(projectId));assert.deepEqual(errors,[]);
  await context.close();console.log('Partner browser workflow PASS '+viewport.width+'px');
 }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
