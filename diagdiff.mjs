import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5143 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage();
await page.goto('http://localhost:5143');
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const g = window.__game, c = g.career;
  c.save.difficulty = 'legende';
  c.save.stats = { flat:72, climb:70, sprint:70, endurance:74 };
  c.save.tour.currentStage = 0;
  c.persist(); g.menu.render();
  document.querySelector('[data-action="play"]').click();
  await new Promise(r=>setTimeout(r,350));
  document.querySelector('[data-action="partir"]')?.click();
  await new Promise(x=>setTimeout(x,600));
  const race = window.__race; race.countdown = 0;
  const p = race.player;
  const ia = race.riders.filter(x=>!x.isPlayer);
  const avant = ia.slice(0,3).map(x=>({nom:x.name, stats:{...x.stats}, eMax:x.energieMax}));
  let garde=0;
  const traces=[];
  while (!race.isOver && garde<60000) {
    const rem = race.track.length - p.dist;
    p.effort = rem < 700 ? 1 : 0.68;
    if (rem < 700) p.sprinting = p.energy > 8;
    if (p.energy < 55 && p.bidons > 0) p.drinkBidon();
    race.update(0.02);
    if (rem < 900 && garde % 40 === 0) {
      const tri = [...race.riders].sort((a,b)=>b.dist-a.dist).slice(0,3);
      traces.push(tri.map(x=>`${x.name.split(' ').pop()} v=${(x.speed*3.6).toFixed(0)} e=${Math.round(x.energy)} eff=${x.effort.toFixed(2)}${x.sprinting?'S':''}`).join(' | '));
    }
    garde++;
  }
  const rows = race.getResults();
  return { avant, top: rows.slice(0,5).map(x=>`${x.name} ${x.time.toFixed(1)}s`), traces: traces.slice(-6) };
});
console.log('stats IA après difficulté « légende » :');
r.avant.forEach(a=>console.log(`   ${a.nom}: plat ${a.stats.flat.toFixed(0)} sprint ${a.stats.sprint.toFixed(0)} endurance ${a.stats.endurance.toFixed(0)} · réserve ${a.eMax}`));
console.log('\nfinal (900 derniers m) :');
r.traces.forEach(t=>console.log('   '+t));
console.log('\ntop 5 :');
r.top.forEach(t=>console.log('   '+t));
await browser.close(); await server.close();
