import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5130 } });
await server.listen();
const b = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await p.goto('http://localhost:5130');
await p.waitForTimeout(2200);
await p.click('[data-action="play"]');
await p.waitForTimeout(600);
await p.click('[data-action="partir"]').catch(()=>{});
await p.waitForTimeout(1600);

console.log('--- APPROCHE ET FRANCHISSEMENT ---');
const seq = await p.evaluate(async () => {
  const r = window.__race; r.countdown = 0;
  const pl = r.player;
  // se placer largement en tête pour gagner l'étape
  pl.stats = { flat: 120, climb: 120, sprint: 120, endurance: 120 };
  pl.dist = r.track.length - 260;
  for (const x of r.riders) if (x !== pl) x.dist = pl.dist - 220;
  const releves = [];
  for (let i = 0; i < 3000; i++) {
    pl.effort = 1;
    r.update(0.02);
    releves.push({
      phase: r.phaseArrivee,
      cel: +pl.celebration.toFixed(2),
      cam: [+r.camera.position.x.toFixed(1), +r.camera.position.y.toFixed(1)],
      fini: pl.finished,
      over: r.isOver
    });
    if (r.isOver) break;
  }
  const phases = [...new Set(releves.map(x => x.phase))];
  return {
    phases,
    celMax: Math.max(...releves.map(x => x.cel)),
    place: r.placeArrivee,
    camBouge: new Set(releves.map(x => x.cam.join())).size,
    duree: releves.filter(x => x.phase === 'franchie').length * 0.02,
    over: r.isOver
  };
});
ok('les trois phases se succèdent', seq.phases.join('→') === 'course→approche→franchie', seq.phases.join(' → '));
ok('victoire détectée', seq.place === 1, `${seq.place}re place`);
ok('bras levés', seq.celMax > 0.9, `célébration ${seq.celMax}`);
ok('caméra mobile pendant la fête', seq.camBouge > 60, `${seq.camBouge} positions`);
ok('séquence tenue avant les résultats', seq.duree > 4.5, `${seq.duree.toFixed(1)} s de célébration`);
ok('course close ensuite', seq.over === true);

console.log('\n--- BATTU AU SPRINT : PAS DE BRAS LEVÉS ---');
await p.waitForTimeout(900);
await p.evaluate(() => document.querySelector('[data-action="continue"]')?.click());
await p.waitForTimeout(700);
await p.evaluate(() => document.querySelector('[data-action="play"]')?.click());
await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('[data-action="partir"]')?.click());
await p.waitForTimeout(1400);
const perdu = await p.evaluate(async () => {
  const r = window.__race; r.countdown = 0;
  const pl = r.player;
  pl.stats = { flat: 40, climb: 40, sprint: 40, endurance: 40 };
  pl.dist = r.track.length - 200;
  for (const x of r.riders) if (x !== pl) { x.dist = pl.dist + 40; x.stats = { flat:110, climb:110, sprint:110, endurance:110 }; }
  for (let i = 0; i < 3000 && !r.isOver; i++) { pl.effort = 1; r.update(0.02); }
  return { place: r.placeArrivee, cel: +r.player.celebration.toFixed(2) };
});
ok('pas de célébration quand on est battu', perdu.cel < 0.5, `place ${perdu.place}, célébration ${perdu.cel}`);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await b.close(); await server.close();
