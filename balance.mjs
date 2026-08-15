import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5186 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
await page.goto('http://localhost:5186');
await page.waitForTimeout(900);

const run = (mode) => page.evaluate((mode) => {
  const race = window.__race;
  race.countdown = 0;
  const p = race.player;
  let minE = 100, bonkTime = 0, guard = 0;
  while (!race.isOver && guard < 60000) {
    const rem = race.track.length - p.dist;
    if (mode === 'offensif') {
      // attaque dans les cols, récupère ensuite, sprint final
      const grade = race.track.gradeAt(p.dist);
      if (grade > 3 && p.energy > 45) p.effort = 0.92;
      else if (p.energy < 30) p.effort = 0.45;
      else p.effort = 0.66;
      if (rem < 700) { p.effort = 1; p.sprinting = p.energy > 8; }
      if (p.energy < 55 && p.bidons > 0) p.drinkBidon();
      if (p.energy < 28 && p.gels > 0) p.eatGel();
    } else if (mode === 'gestion') {
      // pilote qui gère : lève le pied quand l'énergie baisse, boit, garde pour le final
      if (p.energy < 35 && rem > 900) p.effort = 0.42;
      else if (p.energy < 60 && rem > 900) p.effort = 0.55;
      else p.effort = 0.68;
      if (rem < 700) { p.effort = 1; p.sprinting = p.energy > 8; }
      if (p.energy < 55 && p.bidons > 0) p.drinkBidon();
      if (p.energy < 30 && p.gels > 0) p.eatGel();
    } else {
      p.effort = 0.75;
      if (rem < 500) { p.effort = 1; p.sprinting = p.energy > 5; }
    }
    race.update(0.02);
    minE = Math.min(minE, p.energy);
    if (p.energy <= 0.1) bonkTime += 0.02;
    guard++;
  }
  const rows = race.getResults();
  return {
    stage: race.stage.name,
    pos: rows.findIndex(x => x.isPlayer) + 1,
    field: rows.length,
    minE, bonkTime,
    finalE: p.energy
  };
}, mode);

console.log('--- ÉQUILIBRAGE : deux styles de pilotage sur la même étape ---\n');
for (const mode of ['bourrin', 'gestion', 'offensif']) {
  await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
  await page.waitForTimeout(400);
  const r = await run(mode);
  console.log(`${mode.padEnd(8)} → ${r.pos}e/${r.field} | énergie mini ${r.minE.toFixed(0)}% | temps à sec ${r.bonkTime.toFixed(0)} s`);
  await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), null, { timeout: 15000 });
  await page.click('[data-action="continue"]');
  await page.waitForTimeout(400);
  // remettre l'étape à zéro pour comparer à armes égales
  await page.evaluate(() => {
    const c = window.__career;
    c.save.tour.currentStage = 0;
    for (const k of Object.keys(c.save.tour.gc)) c.save.tour.gc[k] = 0;
    c.persist(); window.__menu.render();
  });
  await page.waitForTimeout(300);
}
await browser.close(); await server.close();
