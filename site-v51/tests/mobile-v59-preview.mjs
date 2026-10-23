import assert from 'node:assert/strict';
import { readFile,mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url='https://med-jita-v57-canario.jairobfs7.workers.dev/';
const stylesheet=await readFile(new URL('../source/mobile-editorial-v58.css',import.meta.url),'utf8');
const out='outputs/mobile-v59';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
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
   // The V58 production markup is deliberately unmodified during PR preview.
   // Reconstruct only the candidate's new native <details> wrapper in this
   // disposable browser, without changing any calculation or persistence.
   if(process.env.MED_JITA_V59_LIVE!=='1') {
     await page.evaluate(()=>{
       const notice=document.querySelector('#jita-canary-notice');
       if(notice)notice.textContent='Prévia · não use notas reais · PIN 0000';
       const content=document.querySelector('#cabWeightsExplained');
       if(!content.closest('details')) {
         const details=document.createElement('details');
         details.id='cabFormatHelp';
         details.className='advanced-details cab-format-help';
         const summary=document.createElement('summary');
         summary.textContent='Entenda o formato e os pesos';
         content.before(details);
         details.append(summary,content);
       }
     });
   }
   // Navigation must not leave an iPhone stranded halfway through the previous screen.
   await page.evaluate(()=>window.scrollTo({top:900,behavior:'instant'}));
   await page.waitForTimeout(150);
   await page.locator('nav.mobilebar button[data-page="cab"]').click();
   await page.waitForTimeout(120);
   // In preview mode the old V58 HTML is still live; the new behavior is
   // verified only after V59 is deployed. CSS improvements can ship first.
   if(process.env.MED_JITA_V59_LIVE==='1') {
     const afterSwitch=await page.evaluate(()=>scrollY);
     assert.ok(afterSwitch<8,'Bottom navigation must reset scroll immediately, got '+afterSwitch);
   } else {
     await page.waitForFunction(()=>scrollY<8,null,{timeout:3500});
   }
   const cab=await page.evaluate(()=>{
     const box=s=>document.querySelector(s).getBoundingClientRect();
     return {
       hitsTop:box('#cabHits').top,totalTop:box('#cabTotal').top,
       hitsBottom:box('#cabHits').bottom,totalBottom:box('#cabTotal').bottom,
       navTop:box('nav.mobilebar').top,
       headerHeight:box('#page-cab > .page-head').height,
       scrollWidth:document.documentElement.scrollWidth,
       scrollY,
     };
   });
   assert.ok(cab.scrollWidth<=dims.width+2,'CAB horizontal overflow: '+JSON.stringify(cab));
   assert.ok(cab.hitsBottom<cab.navTop-10 && cab.totalBottom<cab.navTop-10,
     'CAB input boxes must be COMPLETELY visible above bottom navigation: '+JSON.stringify(cab));
   assert.equal(await page.locator('#cabFormatHelp summary').isVisible(),true);
   assert.equal(await page.locator('#cabFormatHelp').evaluate(n=>n.open),false);
   if(dims.width===390){
     assert.ok(cab.hitsTop<cab.navTop-25 && cab.totalTop<cab.navTop-25,
       'CAB acertos fields must be visible before the bottom navigation: '+JSON.stringify(cab));
     assert.ok(cab.headerHeight<160,'CAB introduction too tall: '+JSON.stringify(cab));
   }
   await page.screenshot({path:out+'/cab-'+dims.width+'.png'});
   // Progressive disclosure must preserve the full rule text for inspection.
   if(dims.width===320) {
     assert.equal(await page.locator('#cabTheoryHelp').isVisible(),false,
       'In the integrated mode the duplicated CAB explanation wastes narrow space.');
     await page.locator('#cabWith').click();
     await page.waitForTimeout(80);
     assert.equal(await page.locator('#cabTheoryHelp').isVisible(),true,
       'Separate Macro mode must retain its explanatory instructions.');
     await page.locator('#cabWithout').click();
   }
   await page.locator('#cabFormatHelp summary').click();
   assert.equal(await page.locator('#cabFormatHelp').evaluate(n=>n.open),true);
   assert.ok((await page.locator('#cabWeightsExplained').innerText()).trim().length>20);
   await page.locator('#cabFormatHelp summary').click();
   console.log('V59 PREVIEW PASS',JSON.stringify({dims,login,cab}));
 } finally { await context.close(); }
}
assert.deepEqual(errors,[]);
await browser.close();
