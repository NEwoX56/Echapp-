import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5142 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5142');
await page.waitForTimeout(1600);
await page.click('[data-tab="params"]');
await page.waitForTimeout(700);
const n = await page.locator('[data-difficulty]').count();
ok('six niveaux proposés', n === 6, `${n}`);
const labels = await page.locator('[data-difficulty] span').allTextContents();
console.log('    ' + labels.join(' · '));
await page.click('[data-difficulty="legende"]');
await page.waitForTimeout(500);
ok('sélection enregistrée', await page.evaluate(()=>window.__career.save.difficulty) === 'legende');
// conseil adapté au niveau du coureur
await page.evaluate(()=>{ const c=window.__career; c.save.stats={flat:95,climb:95,sprint:95,endurance:95}; c.persist(); window.__menu.render(); });
await page.waitForTimeout(500);
await page.click('[data-tab="params"]');
await page.waitForTimeout(600);
const hint = await page.locator('.diff-row').locator('..').locator('.hint').first().textContent();
ok('conseil adapté au coureur maximal', hint.includes('Expert'), hint.trim().slice(0,90));
// les IA se ravitaillent
await page.click('[data-tab="tours"]');
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(800);
const ravito = await page.evaluate(async () => {
  const r = window.__race; r.countdown = 0;
  const ia = r.riders.filter(x=>!x.isPlayer);
  const avant = ia.reduce((s,x)=>s+x.bidons+x.gels,0);
  for (let i=0;i<20000;i++) { r.player.effort=0.66; r.update(0.02); if (r.isOver) break; }
  const apres = ia.reduce((s,x)=>s+x.bidons+x.gels,0);
  return { avant, apres, riders: ia.length };
});
ok('les IA consomment leur ravitaillement', ravito.apres < ravito.avant,
   `${ravito.avant} → ${ravito.apres} unités pour ${ravito.riders} coureurs`);
console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,2) : 'aucune');
await browser.close(); await server.close();
