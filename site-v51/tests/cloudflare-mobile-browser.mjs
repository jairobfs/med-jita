import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url='https://med-jita-v57-canario.jairobfs7.workers.dev/';
const out='outputs/mobile-v58';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:2,
  isMobile:true,hasTouch:true,colorScheme:'dark',
  serviceWorkers:'block',
});
const page=await context.newPage();
page.setDefaultTimeout(25000);
const errors=[];
page.on('pageerror',error=>errors.push(String(error.message).slice(0,250)));
const ready=async(name)=>{
  await page.waitForFunction(()=>document.documentElement.dataset.profileReady==='yes',
    null,{timeout:25000});
  assert.equal((await page.locator('#profileActiveName').textContent())?.trim(),name);
};
async function choose(id) {
  const button=page.locator('#profileChoices .profile-choice[data-profile="'+id+'"]');
  await button.waitFor({state:'visible'});
  assert.equal(await button.isDisabled(),false,'Profile '+id+' must be enabled');
  await button.click();
}
async function switchPerson() {
  await page.locator('#profileSwitch').click();
  await page.waitForFunction(()=>document.documentElement.dataset.profileReady!=='yes');
}
try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
  await page.locator('#profileChoices .profile-choice[data-profile="barba"]').waitFor();
  await page.screenshot({path:out+'/01-login-dark.png',fullPage:false});
  const all=await page.locator('#profileChoices .profile-choice').count();
  assert.equal(all,4,'Four profiles must be visible on mobile.');
  await choose('barba');
  await ready('Barba');
  await page.screenshot({path:out+'/02-home-barba-dark.png',fullPage:false});

  await page.locator('nav.mobilebar button[data-page="cab"]').click();
  await page.locator('#cabHits').fill('21');
  await page.locator('#cabTotal').fill('40');
  await page.locator('#cabTotal').blur();
  await page.waitForFunction(async()=>{
    try{
      const r=await fetch('/api/profile/backup?id=barba',{credentials:'same-origin'});
      if(!r.ok)return false;
      const data=await r.json();
      return String(data.backup?.data?.cab?.hits)==='21' &&
        String(data.backup?.data?.cab?.total)==='40';
    }catch{return false;}
  },null,{timeout:28000,polling:700});
  await page.screenshot({path:out+'/03-cab-barba-dark.png',fullPage:false});

  await page.reload({waitUntil:'domcontentloaded'});
  await choose('barba');
  await ready('Barba');
  await page.locator('nav.mobilebar button[data-page="cab"]').click();
  assert.equal(await page.locator('#cabHits').inputValue(),'21');
  assert.equal(await page.locator('#cabTotal').inputValue(),'40');

  await switchPerson();
  await choose('tay');
  await ready('Tay');
  await page.locator('nav.mobilebar button[data-page="cab"]').click();
  assert.notEqual(await page.locator('#cabHits').inputValue(),'21',
    'Barba must never leak into Tay profile.');
  await switchPerson();
  await choose('jbfs');
  await page.locator('#profileUnlockPassword').waitFor({state:'visible'});
  assert.equal(await page.locator('#profileUnlockPassword').getAttribute('inputmode'),'numeric');
  await page.screenshot({path:out+'/04-jbfs-pin-dark.png',fullPage:false});
  await page.locator('#profileUnlockPassword').fill('0000');
  await page.locator('#profileUnlockButton').click();
  await ready('JBFS');

  const mobileMetrics=await page.evaluate(()=>({
    width:window.innerWidth,
    docWidth:document.documentElement.scrollWidth,
    profileReady:document.documentElement.dataset.profileReady,
    bodyClass:document.body.className
  }));
  assert.ok(mobileMetrics.docWidth<=mobileMetrics.width+6,
    'Unexpected horizontal scrolling on iPhone-sized viewport: '+JSON.stringify(mobileMetrics));
  await page.screenshot({path:out+'/05-jbfs-home-dark.png',fullPage:false});
  assert.deepEqual(errors,[],'Browser console JS errors must be addressed.');
  console.log('LIVE MOBILE BROWSER PASS: original Jita, 4 profiles, Barba persistence, profile switch, Tay isolation, numeric JBFS PIN, iPhone width, dark mode.');
} finally {
  await browser.close();
}
