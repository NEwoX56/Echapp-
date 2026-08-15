import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5144 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.goto('http://localhost:5144');
await page.waitForTimeout(1600);

const essaiUnique = (diff, stats, etape) => page.evaluate(async ({diff, stats, etape}) => {
  const g = window.__game, c = g.career;
  c.save.difficulty = diff;
  c.save.stats = stats;
  c.save.tour.currentStage = etape;
  Object.keys(c.save.tour.gc).forEach(id => { c.save.tour.gc[id] = 0; });
  c.persist(); g.menu.render();
  const bouton = document.querySelector('[data-action="play"]');
  if (!bouton) return { erreur: 'bouton de départ introuvable — écran de résultats encore affiché' };
  bouton.click();
  await new Promise(r=>setTimeout(r,350));
  document.querySelector('[data-action="partir"]')?.click();
  await new Promise(r=>setTimeout(r,600));
  const race = window.__race; race.countdown = 0;
  const p = race.player;
  let garde = 0;
  while (!race.isOver && garde < 60000) {
    const rem = race.track.length - p.dist;
    const grade = race.track.gradeAt(p.dist);
    if (grade > 3 && p.energy > 45) p.effort = 0.9;
    else if (p.energy < 32) p.effort = 0.45;
    else p.effort = 0.68;
    if (rem < 700) { p.effort = 1; p.sprinting = p.energy > 8; }
    if (p.energy < 55 && p.bidons > 0) p.drinkBidon();
    if (p.energy < 28 && p.gels > 0) p.eatGel();
    race.update(0.02); garde++;
  }
  const rows = race.getResults();
  const moi = rows.findIndex(x=>x.isPlayer);
  const r = {
    pos: moi+1, total: rows.length,
    ecart: rows[moi].time - rows[0].time,
    vainqueur: rows[0].name,
    energieFin: Math.round(p.energy)
  };
  // retour au menu
  document.querySelector('[data-action="continue"]')?.click();
  return r;
}, {diff, stats, etape});

// une étape comporte trop d'aléa pour conclure : on moyenne sur trois profils
const essai = async (diff, stats) => {
  const r = [];
  for (const etape of [0, 1, 4]) {
    const x = await essaiUnique(diff, stats, etape);
    await page.waitForTimeout(700);
    if (!x.erreur) r.push(x);
  }
  if (!r.length) return { erreur: 'aucune étape jouable' };
  return {
    pos: r.reduce((s, x) => s + x.pos, 0) / r.length,
    total: r[0].total,
    ecart: r.reduce((s, x) => s + x.ecart, 0) / r.length,
    victoires: r.filter((x) => x.pos === 1).length,
    detail: r.map((x) => x.pos).join('/')
  };
};

const MAX = { flat:99, climb:99, sprint:99, endurance:99 };
const MOY = { flat:72, climb:70, sprint:70, endurance:74 };

console.log('--- COUREUR AU MAXIMUM (99 partout) ---');
for (const d of ['normal','difficile','expert','champion','legende']) {
  const r = await essai(d, MAX);
  await page.waitForTimeout(700);
  if (r.erreur) { console.log(`  ${d.padEnd(11)} → ${r.erreur}`); continue; }
  console.log(`  ${d.padEnd(11)} → place moyenne ${r.pos.toFixed(1)}/${r.total}  (${r.detail})  ${r.victoires} victoire(s) sur 3  écart moyen +${r.ecart.toFixed(1)} s`);
}

console.log('\n--- COUREUR MOYEN (72) : les niveaux bas restent jouables ---');
for (const d of ['facile','normal','difficile']) {
  const r = await essai(d, MOY);
  await page.waitForTimeout(700);
  if (r.erreur) { console.log(`  ${d.padEnd(11)} → ${r.erreur}`); continue; }
  console.log(`  ${d.padEnd(11)} → place moyenne ${r.pos.toFixed(1)}/${r.total}  (${r.detail})  ${r.victoires} victoire(s) sur 3  écart moyen +${r.ecart.toFixed(1)} s`);
}

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
