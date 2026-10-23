import assert from 'node:assert/strict';
import { readFile,mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const BASE='https://med-jita-v57-canario.jairobfs7.workers.dev/';
const quick=await readFile(new URL('../source/integrations/quick-nav-v60.js',import.meta.url),'utf8');
const guard=await readFile(new URL('../source/integrations/preview-guard-v60.js',import.meta.url),'utf8');
const style=await readFile(new URL('../source/quick-nav-v60.css',import.meta.url),'utf8');
await mkdir('outputs/quick-v60',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
const widths=[320,390,768];
try {
  for(const width of widths) {
    const context=await browser.newContext({
      viewport:{width,height:width===320?700:844},
      deviceScaleFactor:2,isMobile:width<=390,hasTouch:width<=390,
      colorScheme:'dark',serviceWorkers:'block'
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.setDefaultTimeout(18000);
    try {
      await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:35000});
      await page.locator('#profileChoices .profile-choice[data-profile="barba"]').click();
      await page.waitForFunction(()=>document.documentElement.dataset.profileReady==='yes');
      // PR preview: inject only new controls/style against already deployed V59.
      if(process.env.MED_JITA_V60_LIVE==='1') {
        assert.equal(await page.evaluate(()=>window.MED_JITA_PREVIEW_ISOLATED),true,
          'Live Cloudflare must identify isolated preview before initializing profiles.');
      } else {
        // PR-only preview: test new assets against full live V59 before deploying.
        await page.evaluate(()=>{window.MED_JITA_PREVIEW_ISOLATED=true;});
        await page.addStyleTag({content:style});
        await page.addScriptTag({content:quick});
        await page.addScriptTag({content:guard});
      }
      const btn=page.locator('#jitaQuickOpen');
      await btn.waitFor({state:'visible'});
      const metrics=await page.evaluate(()=>({
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        launcher:document.querySelector('#jitaQuickOpen').getBoundingClientRect().toJSON()
      }));
      assert.ok(metrics.scrollWidth<=width+2,'Toolbar overflow: '+JSON.stringify(metrics));
      await btn.click();
      await page.locator('#jitaQuickDialog').waitFor({state:'visible'});
      await page.screenshot({path:'outputs/quick-v60/search-'+width+'.png'});
      await page.locator('#jitaQuickSearch').fill('histórico');
      await page.locator('#jitaQuickSearch').press('Enter');
      await page.locator('#page-history.active').waitFor();
      assert.equal(await page.locator('#jitaQuickDialog').isVisible(),false);
      assert.equal(await page.locator('#jitaPreviewSafetyNote').isVisible(),true);
      for(const id of ['importData','importHistory','vercelExitFile','accountPasswordToggle']) {
        const input=page.locator('#'+id);
        assert.equal(await input.isDisabled(),true,'Preview safety missing: '+id);
      }
      await page.keyboard.press('Control+k');
      await page.locator('#jitaQuickDialog').waitFor({state:'visible'});
      await page.locator('#jitaQuickSearch').fill('cab');
      await page.locator('#jitaQuickSearch').press('Enter');
      await page.locator('#page-cab.active').waitFor();
      await page.locator('#cabHits').focus();
      await page.keyboard.press('/');
      assert.equal(await page.locator('#jitaQuickDialog').isVisible(),false,
        'Slash cannot hijack active grade field.');
      await page.locator('#cabHits').blur();
      await page.keyboard.press('/');
      assert.equal(await page.locator('#jitaQuickDialog').isVisible(),true);
      await page.locator('#jitaQuickSearch').fill('nota inexistente xyz123');
      assert.match(await page.locator('#jitaQuickList').innerText(),/Nenhum resultado/);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#jitaQuickDialog').isVisible(),false);
      // Actual status text, not a pretend success animation.
      await page.locator('#accountSyncStatus').evaluate(node=>{
        node.dataset.status='error';
        node.textContent='Falha de conexão de demonstração';
      });
      await page.waitForFunction(()=>document.getElementById('jitaQuickOpen').dataset.syncState==='error');
      assert.equal(await btn.getAttribute('data-sync-state'),'error');
      await page.locator('#accountSyncStatus').evaluate(node=>{
        node.dataset.status='success';node.textContent='Salvo online';
      });
      await page.waitForFunction(()=>document.getElementById('jitaQuickOpen').dataset.syncState==='saved');
      await btn.click();
      await page.locator('#jitaQuickSearch').fill('trocar pessoa');
      await page.locator('#jitaQuickSearch').press('Enter');
      await page.waitForFunction(()=>document.documentElement.dataset.profileReady==='no');
      await page.screenshot({path:'outputs/quick-v60/login-'+width+'.png'});
      assert.deepEqual(errors,[],'Uncaught JS errors');
      console.log((process.env.MED_JITA_V60_LIVE==='1'?'V60 CLOUDFLARE LIVE PASS ':'V60 QUICK-NAV BROWSER PASS ')+JSON.stringify({
        width,overflow:false,history:true,cab:true,shortcuts:true,
        previewImportBlocked:true,statusIndicator:true,profileSwitch:true
      }));
    } finally { await context.close(); }
  }
} finally {await browser.close();}
