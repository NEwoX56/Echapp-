import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5159 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5159');
await page.waitForTimeout(1600);

console.log('--- NOMS EN COURSE ---');
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(1200);
await page.evaluate(() => { const r=window.__race; r.countdown=0; for(let i=0;i<200;i++) r.update(0.02); });
await page.waitForTimeout(1500);

const t = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.name-tag')].filter(e => e.style.display !== 'none');
  return {
    total: document.querySelectorAll('.name-tag').length,
    visibles: els.length,
    noms: els.map(e => e.querySelector('span').textContent),
    opacites: els.map(e => Number(e.style.opacity))
  };
});
ok('étiquettes affichées', t.visibles > 0, `${t.visibles} visibles`);
ok('pas plus de 9 à la fois', t.visibles <= 9, `${t.visibles}`);
ok('noms de famille seulement', t.noms.every(n => n && !n.includes(' ')), t.noms.slice(0,5).join(' · '));
ok('opacité dégressive avec la distance', new Set(t.opacites).size > 1, t.opacites.slice(0,4).join(' / '));
ok('le joueur n\'est pas étiqueté', !t.noms.includes('Ceyrat'));

console.log('\n--- LES ÉTIQUETTES SUIVENT LES COUREURS ---');
const p1 = await page.evaluate(() => {
  const e = [...document.querySelectorAll('.name-tag')].find(x => x.style.display !== 'none');
  return e ? e.style.transform : null;
});
await page.evaluate(() => { const r=window.__race; for(let i=0;i<120;i++) r.update(0.02); });
await page.waitForTimeout(1200);
const p2 = await page.evaluate(() => {
  const e = [...document.querySelectorAll('.name-tag')].find(x => x.style.display !== 'none');
  return e ? e.style.transform : null;
});
ok('position mise à jour', p1 !== p2, 'les étiquettes bougent avec la course');

console.log('\n--- OPTION ACTIVABLE ---');
await page.evaluate(() => { const r=window.__race; r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.click('[data-action="continue"]');
await page.waitForTimeout(600);
await page.click('[data-tab="params"]');
await page.waitForTimeout(600);
const coche = await page.locator('#noms-coureurs').count();
ok('case à cocher présente', coche === 1);
ok('activée par défaut', await page.locator('#noms-coureurs').isChecked());
await page.uncheck('#noms-coureurs');
await page.waitForTimeout(400);
const off = await page.evaluate(() => ({
  save: window.__career.save.nomsCoureurs,
  affiche: document.querySelector('.name-tags').style.display
}));
ok('désactivation enregistrée', off.save === false && off.affiche === 'none', `display "${off.affiche}"`);

await page.click('[data-tab="tours"]');
await page.waitForTimeout(300);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(1200);
await page.evaluate(() => { const r=window.__race; r.countdown=0; for(let i=0;i<200;i++) r.update(0.02); });
await page.waitForTimeout(1000);
const apres = await page.evaluate(() =>
  [...document.querySelectorAll('.name-tag')].filter(e => e.style.display !== 'none').length);
ok('aucune étiquette une fois désactivé', apres === 0, `${apres}`);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
