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
  await page.locator('#headerProfileMark').click();
  await page.waitForFunction(()=>document.documentElement.dataset.profileReady!=='yes');
}
try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
  await page.locator('#profileChoices .profile-choice[data-profile="barba"]').waitFor();
  const gatewayBrand = await page.locator('.profile-gateway-card').evaluate(
    node => getComputedStyle(node,'::before').backgroundImage);
  assert.match(gatewayBrand,/completa-organic-inversa\.svg/,
    'Login must use the original transparent inverse MED JITA logo.');
  assert.equal(await page.locator('#jita-gateway-canary').isVisible(),true,
    'Login must show the safe demo notice inside the layout.');
  await page.screenshot({path:out+'/01-login-dark.png',fullPage:false});
  const all=await page.locator('#profileChoices .profile-choice').count();
  assert.equal(all,4,'Four profiles must be visible on mobile.');
  await choose('barba');
  await ready('Barba');
  const mobileLayout=await page.evaluate(()=>{
    const nav=document.querySelector('nav.mobilebar').getBoundingClientRect();
    const alert=document.querySelector('#jita-canary-notice');
    const box=alert.getBoundingClientRect();
    const profile=document.querySelector('#profileControls');
    const logo=document.querySelector('.jita-cover .med-jita-logo-wrap');
    const header=document.querySelector('#headerProfileMark');
    return {navTop:nav.top,noticeBottom:box.bottom,
      noticePosition:getComputedStyle(alert).position,
      floatingProfileDisplay:getComputedStyle(profile).display,
      logoBackground:getComputedStyle(logo).backgroundColor,
      headerTag:header.tagName,headerLabel:header.getAttribute('aria-label'),
      visibleHeight:window.innerHeight};
  });
  assert.equal(mobileLayout.noticePosition,'relative',
    'Demo label must participate in layout and never overlay bottom tabs.');
  assert.ok(mobileLayout.noticeBottom<mobileLayout.navTop-10,
    'Demo warning overlaps bottom navigation: '+JSON.stringify(mobileLayout));
  assert.equal(mobileLayout.floatingProfileDisplay,'none',
    'Floating switch overlaps grade inputs on iPhone.');
  assert.equal(mobileLayout.logoBackground,'rgba(0, 0, 0, 0)',
    'The white/lavender plaque must not cover the brand on dark backgrounds.');
  assert.equal(mobileLayout.headerTag,'BUTTON');
  assert.equal(mobileLayout.headerLabel,'Trocar pessoa');
  assert.equal((await page.locator('#headerProfileMark').textContent())?.trim(),'B',
    'Barba initial must be visible below the Jita hat.');
  const markStyle=await page.locator('#headerProfileMark').evaluate(node=>({
    fontSize:parseFloat(getComputedStyle(node).fontSize),
    fontWeight:getComputedStyle(node).fontWeight,
    color:getComputedStyle(node).color
  }));
  assert.ok(markStyle.fontSize>=17,'Mobile profile letter is too small: '+JSON.stringify(markStyle));

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
  console.log('LIVE MOBILE POST-POLISH PASS: inverse SVG, no white logo plaque, no fixed overlay on bottom tabs/inputs, switch by hat button, 4 profiles, CAB autosave, iPhone dark mode.');
} finally {
  await browser.close();
}
