import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), server: { port: 5188 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
const ok = (l, c, x='') => console.log(`${c ? '  OK ' : ' FAIL'} ${l}${x ? ' — ' + x : ''}`);

await page.goto('http://localhost:5188');
await page.waitForTimeout(900);

console.log('\n--- SIMULATION PILOTÉE (indépendante du framerate) ---');
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(600);

// avance la simulation de N secondes en pas fixes
const sim = (sec, opts = {}) => page.evaluate(({ sec, opts }) => {
  const r = window.__race;
  r.countdown = 0;
  const p = r.player;
  const steps = Math.round(sec / 0.02);
  for (let i = 0; i < steps; i++) {
    if (opts.effort !== undefined) p.effort = opts.effort;
    if (opts.sprint !== undefined) p.sprinting = opts.sprint && p.energy > 2;
    r.update(0.02);
  }
  return { dist: p.dist, speed: p.speed, energy: p.energy, standing: p.standing, clock: r.clock };
}, { sec, opts });

let st = await sim(6, { effort: 0.6 });
ok('la course avance', st.dist > 60, `${st.dist.toFixed(0)} m à ${(st.speed*3.6).toFixed(0)} km/h`);

// danseuse
await page.evaluate(() => { window.__race.player.energy = 100; });
st = await sim(2, { effort: 1, sprint: true });
ok('danseuse au sprint', st.standing > 0.9, `standing=${st.standing.toFixed(2)}`);
const badge = await page.evaluate(() => {
  window.__hud = window.__race.hudState();
  return window.__hud.standing;
});
ok('HUD signale la danseuse', badge === true);
st = await sim(2.5, { effort: 0.5, sprint: false });
ok('retour assis', st.standing < 0.1, `standing=${st.standing.toFixed(2)}`);

// énergie : vérifier que le drain est plus doux qu'avant
await page.evaluate(() => { window.__race.player.energy = 100; });
const before = 100;
st = await sim(30, { effort: 0.75, sprint: false });
ok('drain d\'énergie raisonnable', st.energy > 25, `${before} → ${st.energy.toFixed(0)} après 30 s à 75 % d'effort`);

// bidon / gel
const inv = await page.evaluate(() => {
  const p = window.__race.player;
  p.energy = 40;
  const b0 = p.bidons, g0 = p.gels;
  p.drinkBidon(); p.eatGel();
  return { b0, g0, b: p.bidons, g: p.gels, e: p.energy };
});
ok('bidon et gel consommés', inv.b === inv.b0 - 1 && inv.g === inv.g0 - 1, `${inv.b} bidons, ${inv.g} gels`);

// sprint intermédiaire
const sp = await page.evaluate(() => {
  const r = window.__race;
  r.player.dist = r.track.sprints[0].dist - 4;
  for (let i = 0; i < 200; i++) r.update(0.02);
  return r.getPoints().find(p => p.riderId === 'player');
});
ok('points au sprint intermédiaire', sp.points > 0, `${sp.points} pts`);

// arrivée + résultats
await page.evaluate(() => {
  const r = window.__race;
  r.player.dist = r.track.length - 5;
  for (let i = 0; i < 400; i++) r.update(0.02);
});
await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), null, { timeout: 15000 });
ok('écran de résultats affiché', true);
const res = await page.evaluate(() => ({
  ceremony: document.querySelectorAll('.ceremony').length,
  blocks: document.querySelectorAll('.res-block').length,
  jerseys: document.querySelectorAll('.ceremony-jersey').length,
  title: document.querySelector('.res-header h1')?.textContent?.trim()
}));
ok('classements étape + général', res.blocks === 2);
ok('protocole des maillots', res.ceremony > 0, `${res.jerseys} maillot(s) : ${res.title}`);
await page.screenshot({ path: 'v3-results.png' });

await page.click('[data-action="continue"]');
await page.waitForTimeout(600);

console.log('\n--- APRÈS L\'ÉTAPE ---');
const after = await page.evaluate(() => {
  const c = window.__career;
  return {
    holders: c.jerseyHolders(),
    gc: c.gcTable().length,
    stage: c.save.tour.currentStage,
    xp: c.save.xp,
    level: c.save.level
  };
});
ok('classement général alimenté', after.gc >= 18, `${after.gc} coureurs classés`);
ok('étape suivante déverrouillée', after.stage === 1, `étape ${after.stage + 1}`);
ok('porteurs de maillots', !!after.holders.general, JSON.stringify(after.holders));
// l'accueil n'affiche plus la liste des étapes : on interroge la carrière
ok('étape marquée terminée', await page.evaluate(() => window.__career.save.tour.currentStage) === 1);

// classements consultables : ils ont désormais leur propre onglet
await page.click('[data-tab="classements"]');
await page.waitForTimeout(500);
await page.click('[data-cls="montagne"]');
await page.waitForTimeout(300);
ok('onglet classement montagne', (await page.locator('.cls-tab.active').textContent()) === 'Montagne');

console.log('\nerreurs JS:', errs.filter(e => !e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close();
await server.close();
