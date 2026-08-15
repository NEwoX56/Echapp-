import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5136 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edge/120';
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5136');
await page.waitForTimeout(3000);
const m = await page.evaluate(() => ({
  hero: document.querySelectorAll('.hero-couche').length,
  accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  images: performance.getEntriesByType('resource').filter(r=>r.name.includes('/menu/')).length,
  poids: Math.round(performance.getEntriesByType('resource').filter(r=>r.name.includes('/menu/')).reduce((s,r)=>s+(r.encodedBodySize||0),0)/1024)
}));
ok('panneau visuel actif sur console', m.hero === 2 && !!m.accent, `accent ${m.accent}`);
ok('image de fond chargée', m.images >= 1, `${m.images} image, ${m.poids} Ko`);
// la course reste jouable
await page.click('[data-action="play"]');
await page.waitForTimeout(700);
await page.click('[data-action="partir"]');
await page.waitForTimeout(1600);
const r = await page.evaluate(() => {
  const g = window.__game;
  return { q: g.qualitySettings.densiteFoule, tri: g.renderer.info.render.triangles, joue: !!window.__race };
});
ok('course lancée en conditions Xbox', r.joue, `${r.tri.toLocaleString('fr-FR')} triangles, foule ${Math.round(r.q*100)} %`);
console.log('erreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
