import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5172 } });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5172');
await page.waitForTimeout(1600);

console.log('--- AUDIO ---');
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(2000);
const a = await page.evaluate(() => {
  const g = window.__game;
  return { pret: g.audio.pret, etat: g.audio.context?.state ?? 'absent' };
});
ok('contexte audio démarré au clic de départ', a.pret, a.etat);

// Le signal musical est mesuré par musictest.mjs, fil principal libre :
// pendant une course en headless le rendu bloque le fil et fausse la lecture.
// Ici on vérifie seulement que le séquenceur tourne et avance.
const seq = await page.evaluate(async () => {
  const m = window.__game.music;
  const a = m.pas;
  await new Promise(r => setTimeout(r, 1200));
  return { avant: a, apres: m.pas, ambiance: m.ambiance };
});
ok('séquenceur musical actif', seq.apres > seq.avant, `${seq.avant} → ${seq.apres} pas`);
ok('ambiance de course lancée', seq.ambiance === 'course', seq.ambiance);

// ambiances adaptatives
const amb = await page.evaluate(() => {
  const r = window.__race, out = [];
  r.countdown = 0;
  r.player.dist = r.track.length * 0.2;
  for (let i=0;i<60;i++) r.update(0.02);
  out.push(r.ambiance);
  // forcer une pente forte : aller au col
  r.player.dist = r.track.climbs.length ? r.track.climbs[0].dist - 120 : r.track.length*0.5;
  for (let i=0;i<60;i++) r.update(0.02);
  out.push(r.ambiance);
  // dernier kilomètre
  r.player.dist = r.track.length - 700;
  for (let i=0;i<60;i++) r.update(0.02);
  out.push(r.ambiance);
  return out;
});
console.log('    ambiances traversées :', amb.join(' → '));
ok('ambiance finale dans le dernier km', amb[2] === 'finale');

const cloche = await page.evaluate(() => window.__race.clocheSonnee);
ok('cloche du dernier kilomètre sonnée', cloche === true);

console.log('\n--- RÉGLAGES ---');
await page.evaluate(() => { const r=window.__race; r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.click('[data-action="continue"]');
await page.waitForTimeout(600);
await page.click('[data-tab="params"]');
await page.waitForTimeout(500);
ok('curseurs de volume', await page.locator('#vol-master').count() === 1 && await page.locator('#vol-musique').count() === 1);
await page.locator('#vol-musique').fill('20');
await page.waitForTimeout(300);
const v = await page.evaluate(() => window.__career.save.volMusique);
ok('volume musique enregistré', Math.abs(v - 0.2) < 0.01, `${v}`);
await page.check('#son-coupe');
await page.waitForTimeout(300);
ok('coupure du son', await page.evaluate(() => window.__game.audio.estCoupe) === true);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
