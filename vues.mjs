import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5219 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const [tour, idx, nom, ...fracs] = process.argv.slice(2);
await page.goto('http://localhost:5219');
await page.waitForTimeout(700);
await page.evaluate(({ tour, idx }) => {
  const c = window.__career;
  c.save.level = 99;
  c.selectTour(tour);
  c.save.tour.currentStage = Number(idx);
  for (const k of Object.keys(c.save.tour.gc)) c.save.tour.gc[k] = 3000;
  c.persist(); window.__menu.render();
}, { tour, idx });
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('[data-action="play"]')?.click());
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('[data-action="partir"]')?.click());
await page.waitForTimeout(500);
for (const f of fracs) {
  await page.evaluate((frac) => {
    const r = window.__race;
    r.countdown = 0;
    r.cameraModeIndex = 3; // drone : on voit large, idéal pour juger le décor
    r.player.dist = r.track.length * Number(frac);
    for (let i = 0; i < 150; i++) r.update(0.02);
  }, f);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `v-${nom}-${Math.round(Number(f) * 100)}.png` });
}
console.log('erreurs JS:', errors.length ? errors.join(' | ') : 'aucune');
await browser.close();
await server.close();
