import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5187 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:5187');
await page.waitForTimeout(900);

console.log('--- TOUR DES CIMES : 5 ÉTAPES D\'AFFILÉE ---');
for (let i = 0; i < 5; i++) {
  const label = await page.locator('[data-action="play"]').textContent();
  await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
  await page.waitForTimeout(500);
  // simule l'étape jusqu'à l'arrivée
  const r = await page.evaluate(() => {
    const race = window.__race;
    race.countdown = 0;
    const p = race.player;
    let guard = 0;
    while (!race.isOver && guard < 60000) {
      p.effort = 0.62 + Math.random() * 0.2;
      if (race.track.length - p.dist < 500) { p.effort = 1; p.sprinting = p.energy > 5; }
      race.update(0.02);
      guard++;
    }
    const rows = race.getResults();
    return {
      stage: race.stage.name,
      type: race.stage.type,
      pos: rows.findIndex(x => x.isPlayer) + 1,
      field: rows.length,
      time: rows.find(x => x.isPlayer).time,
      energy: p.energy
    };
  });
  await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), null, { timeout: 15000 });
  const cer = await page.locator('.ceremony-jersey').count();
  console.log(`  É${i+1} ${r.stage.padEnd(26)} ${r.type.padEnd(10)} → ${r.pos}${r.pos===1?'er':'e'}/${r.field}  ${(r.time/60).toFixed(1)} min  énergie ${r.energy.toFixed(0)}%${cer?`  [${cer} maillot(s)]`:''}`);
  await page.click('[data-action="continue"]');
  await page.waitForTimeout(500);
}

const fin = await page.evaluate(() => {
  const c = window.__career;
  return {
    finished: c.save.tour.finished,
    wins: c.save.tour.stageWins,
    jerseys: c.save.tour.jerseysWon,
    palmares: c.save.palmares,
    level: c.save.level,
    gcTop3: c.gcTable().slice(0,3).map(r => `${r.name}${r.isPlayer?' (moi)':''}`)
  };
});
console.log('\n--- FIN DE TOUR ---');
console.log('  tour terminé      :', fin.finished);
console.log('  victoires d\'étape :', fin.wins);
console.log('  maillots portés   :', fin.jerseys.join(', ') || 'aucun');
console.log('  palmarès          :', JSON.stringify(fin.palmares));
console.log('  niveau atteint    :', fin.level);
console.log('  podium général    :', fin.gcTop3.join(' · '));
const unlocked = await page.evaluate(() => window.__game ? ['cimes','littoral','traversee','couronne'].filter(id => window.__career.isTourUnlocked(id)).length : 0);
console.log('  tours débloqués   :', unlocked, '/ 4');
console.log('\nerreurs JS:', errs.filter(e => !e.includes('fonts.g')).length ? errs.slice(0,2) : 'aucune');
await browser.close(); await server.close();
