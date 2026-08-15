import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5174 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5174');
await page.waitForTimeout(2200);

const av = await page.evaluate(() => window.__game.assets.sky.available);
ok('panoramas chargés', av);

// étape de plaine
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(1200);
const st = await page.evaluate(() => {
  const s = window.__race.scene;
  return {
    isTexture: !!s.background?.isTexture,
    hasEnv: !!s.environment,
    rot: s.backgroundRotation.y,
    fog: s.fog?.color.getHexString()
  };
});
ok('fond = photo équirectangulaire', st.isTexture);
ok('environnement pour les reflets', st.hasEnv);
ok('brume assortie', !!st.fog, '#' + st.fog);

// dérive
const r0 = await page.evaluate(() => window.__race.scene.backgroundRotation.y);
await page.evaluate(() => { for (let i=0;i<600;i++) window.__race.update(0.05); });
const r1 = await page.evaluate(() => window.__race.scene.backgroundRotation.y);
const deg = (r1-r0)*180/Math.PI;
ok('les nuages dérivent', r1 > r0, `${deg.toFixed(2)}° en 30 s simulées`);
ok('dérive discrète', deg > 1 && deg < 3, `${deg.toFixed(2)}°/30 s, soit ${(deg*8).toFixed(0)}° sur une étape de 4 min`);

await page.evaluate(() => { const r=window.__race; r.countdown=0; r.player.dist=r.track.length*0.3; for(let i=0;i<150;i++) r.update(0.02); });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'sky-plaine.png' });

// étape de montagne : autre ciel
await page.evaluate(() => { const r=window.__race; r.player.dist=r.track.length-6; for(let i=0;i<400;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.click('[data-action="continue"]');
await page.waitForTimeout(500);
await page.evaluate(() => { const c=window.__career; c.save.tour.currentStage=3; c.persist(); window.__menu.render(); });
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(1400);
await page.evaluate(() => { const r=window.__race; r.countdown=0; r.player.dist=r.track.length*0.55; for(let i=0;i<150;i++) r.update(0.02); });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'sky-montagne.png' });
const diff = await page.evaluate(() => window.__race.scene.background.source.data.currentSrc || window.__race.scene.background.image?.currentSrc || '');
console.log('    ciel de montagne :', diff.split('/').pop());

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,2) : 'aucune');
await browser.close(); await server.close();
