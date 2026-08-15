import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5184 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
await page.goto('http://localhost:5184');
await page.waitForTimeout(900);
await page.evaluate(() => {
  const c = window.__career; c.save.tour.currentStage = 3;
  for (const k of Object.keys(c.save.tour.gc)) c.save.tour.gc[k] = 3000;
  c.persist(); window.__menu.render();
});
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(600);

// vérification géométrique : le terrain est-il sous la route partout ?
const geo = await page.evaluate(() => {
  const t = window.__race.track;
  const THREE = window.__THREE;
  let worst = 999, worstAt = 0, breaches = 0, samples = 0;
  const p = new (t.pose.constructor === Function ? Object : Object)();
  for (let d = 0; d < t.length; d += 7) {
    for (const lat of [-4.4, -2, 0, 2, 4.4]) {
      const g = t.groundAt(d, lat);
      const roadY = 0.01;
      const margin = roadY - g;
      samples++;
      if (margin < worst) { worst = margin; worstAt = d; }
      if (margin <= 0) breaches++;
    }
  }
  return { worst, worstAt, breaches, samples };
});
console.log(`marge minimale route/terrain : ${geo.worst.toFixed(3)} unité (à ${geo.worstAt.toFixed(0)} m)`);
console.log(`percements détectés : ${geo.breaches} / ${geo.samples} points testés`);

// vérification visuelle : proportion de pixels "herbe" dans le couloir de la route
const shots = [];
for (const frac of [0.15, 0.35, 0.55, 0.75, 0.9]) {
  await page.evaluate((f) => {
    const r = window.__race;
    r.countdown = 0;
    r.player.dist = r.track.length * f;
    // laisse la simulation (et la caméra) converger sans dépendre du framerate
    for (let i = 0; i < 150; i++) r.update(0.02);
  }, frac);
  await page.waitForTimeout(1200);
  const name = `road-${Math.round(frac*100)}.png`;
  await page.screenshot({ path: name });
  shots.push(name);
}
console.log('captures :', shots.join(', '));
await browser.close(); await server.close();
