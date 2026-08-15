import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5185 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
await page.goto('http://localhost:5185');
await page.waitForTimeout(900);
console.log('--- LE COUREUR AMÉLIORÉ PEUT-IL GAGNER ? ---\n');
for (const [label, stats, diff] of [
  ['débutant (55)', { flat:55, climb:55, sprint:55, endurance:55 }, 'normal'],
  ['confirmé (72)', { flat:72, climb:70, sprint:74, endurance:72 }, 'normal'],
  ['élite (88)',    { flat:88, climb:84, sprint:90, endurance:86 }, 'normal'],
  ['élite (88)',    { flat:88, climb:84, sprint:90, endurance:86 }, 'difficile']
]) {
  await page.evaluate(({ stats, diff }) => {
    const c = window.__career;
    c.save.stats = stats; c.save.difficulty = diff;
    c.save.tour.currentStage = 0;
    for (const k of Object.keys(c.save.tour.gc)) c.save.tour.gc[k] = 0;
    c.persist(); window.__menu.render();
  }, { stats, diff });
  await page.waitForTimeout(300);
  await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const race = window.__race; race.countdown = 0;
    const p = race.player; let guard = 0;
    while (!race.isOver && guard < 60000) {
      const rem = race.track.length - p.dist;
      const grade = race.track.gradeAt(p.dist);
      if (grade > 3 && p.energy > 45) p.effort = 0.9;
      else if (p.energy < 32) p.effort = 0.45;
      else p.effort = 0.66;
      if (rem < 700) { p.effort = 1; p.sprinting = p.energy > 8; }
      if (p.energy < 55 && p.bidons > 0) p.drinkBidon();
      if (p.energy < 28 && p.gels > 0) p.eatGel();
      race.update(0.02); guard++;
    }
    const rows = race.getResults();
    return { pos: rows.findIndex(x => x.isPlayer)+1, field: rows.length, gap: rows.find(x=>x.isPlayer).time - rows[0].time };
  });
  console.log(`${label.padEnd(15)} ${diff.padEnd(10)} → ${r.pos}e/${r.field}  (${r.gap > 0.05 ? '+' + r.gap.toFixed(1) + ' s' : 'vainqueur'})`);
  await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), null, { timeout: 15000 });
  await page.click('[data-action="continue"]');
  await page.waitForTimeout(400);
}
await browser.close(); await server.close();
