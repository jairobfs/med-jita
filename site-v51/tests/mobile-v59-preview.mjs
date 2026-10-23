import assert from 'node:assert/strict';
import { readFile,mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url='https://med-jita-v57-canario.jairobfs7.workers.dev/';
const stylesheet=await readFile(new URL('../source/mobile-editorial-v58.css',import.meta.url),'utf8');
const out='outputs/mobile-v59';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
for(const dims of [{width:390,height:844},{width:320,height:700}]) {
 const context=await browser.newContext({
   viewport:dims,deviceScaleFactor:2,isMobile:true,hasTouch:true,
   colorScheme:'dark',serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(25000);
 try {
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
   await page.locator('#profileChoices .profile-choice').first().waitFor();
   // Preview the candidate CSS against the live FULL app before merging/deploying.
   await page.addStyleTag({content:stylesheet});
   await page.waitForTimeout(400);
   const login=await page.evaluate(()=>{
     const get=s=>document.querySelector(s);
     const rect=s=>get(s).getBoundingClientRect();
     const profileCards=[...document.querySelectorAll('#profileChoices .profile-choice')];
     const intro=rect('.gateway-intro');
     const card=rect('.profile-gateway-card');
     const last=profileCards.at(-1).getBoundingClientRect();
     const buttons=get('.gateway-intro .jita-audio-tools');
     const motion=get('#gatewayMotionToggle');
     return {
       viewportWidth:innerWidth,viewportHeight:innerHeight,
       scrollWidth:document.documentElement.scrollWidth,
       cardHeight:card.height,introHeight:intro.height,
       lastProfileBottom:last.bottom,
       profileCount:profileCards.length,
       allEnabled:profileCards.every(x=>!x.disabled),
       audioButtons:buttons?.querySelectorAll('button').length||0,
       voiceVisible:!!buttons?.querySelector('.jita-voice-button') &&
         getComputedStyle(buttons.querySelector('.jita-voice-button')).display!=='none',
       motionVisible:!!motion&&!motion.hidden,
       audioTop:buttons?.getBoundingClientRect().top,
       motionTop:motion?.getBoundingClientRect().top,
       introBottom:intro.bottom
     };
   });
   assert.equal(login.profileCount,4,'Must show all four real profile choices.');
   assert.equal(login.allEnabled,true,'All four demo profiles need working entry.');
   assert.ok(login.scrollWidth<=dims.width+2,'Login horizontal overflow: '+JSON.stringify(login));
   assert.ok(login.introHeight<=235,'Login still wastes vertical screen space: '+JSON.stringify(login));
   assert.ok(login.audioButtons>=1,'Jita sound control disappeared.');
   if(dims.width===390) {
     assert.ok(login.lastProfileBottom<dims.height-15,
       'All four profile cards must fit first iPhone screen: '+JSON.stringify(login));
     if(login.motionVisible)assert.ok(Math.abs(login.motionTop-login.audioTop)<25,
       'Motion and sound controls should be compact in the same row.');
   }
   await page.screenshot({path:out+'/login-'+dims.width+'.png'});
   await page.locator('#profileChoices .profile-choice[data-profile="barba"]').click();
   await page.waitForFunction(()=>document.documentElement.dataset.profileReady==='yes');
   await page.locator('nav.mobilebar button[data-page="cab"]').click();
   await page.waitForTimeout(250);
   const cab=await page.evaluate(()=>{
     const box=s=>document.querySelector(s).getBoundingClientRect();
     return {
       hitsTop:box('#cabHits').top,totalTop:box('#cabTotal').top,
       navTop:box('nav.mobilebar').top,
       headerHeight:box('#page-cab > .page-head').height,
       scrollWidth:document.documentElement.scrollWidth,
       scrollY,
     };
   });
   assert.ok(cab.scrollWidth<=dims.width+2,'CAB horizontal overflow: '+JSON.stringify(cab));
   if(dims.width===390){
     assert.ok(cab.hitsTop<cab.navTop-25 && cab.totalTop<cab.navTop-25,
       'CAB acertos fields must be visible before the bottom navigation: '+JSON.stringify(cab));
     assert.ok(cab.headerHeight<160,'CAB introduction too tall: '+JSON.stringify(cab));
   }
   await page.screenshot({path:out+'/cab-'+dims.width+'.png'});
   console.log('V59 PREVIEW PASS',JSON.stringify({dims,login,cab}));
 } finally { await context.close(); }
}
assert.deepEqual(errors,[]);
await browser.close();
