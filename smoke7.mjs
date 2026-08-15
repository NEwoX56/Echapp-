import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5183 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs=[]; page.on('pageerror', e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5183');
await page.waitForTimeout(900);

// on se place au milieu du tour pour avoir un vrai classement général
await page.evaluate(() => {
  const c = window.__career;
  c.save.tour.currentStage = 1;
  const ids = Object.keys(c.save.tour.gc);
  ids.forEach((id, i) => { c.save.tour.gc[id] = 6000 + i * 18; });
  c.save.tour.gc['player'] = 6000 + 3 * 18;      // joueur 4e du général
  c.save.tour.gc['moretti'] = 6000 + 2 * 18;     // rival direct devant
  c.save.tour.gc['duval'] = 6000 + 600;          // très loin, inoffensif
  c.persist(); window.__menu.render();
});
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(600);

console.log('\n--- MINI-CARTE ---');
const radar = await page.evaluate(() => {
  const r = window.__race; r.countdown = 0;
  for (let i=0;i<200;i++) r.update(0.02);
  const s = r.hudState();
  return { n: s.radar.length, player: s.radar.filter(x=>x.isPlayer).length,
           mates: s.radar.filter(x=>x.teammate).length,
           threats: s.radar.filter(x=>x.threat>0.7 && !x.isPlayer).length,
           sample: s.radar.slice(0,3).map(x=>`${x.name.split(' ').pop()} ${x.gapSeconds.toFixed(0)}s`) };
});
ok('tous les coureurs sur la carte', radar.n === 18, `${radar.n} points`);
ok('joueur identifié', radar.player === 1);
ok('équipiers repérés', radar.mates >= 1, `${radar.mates} équipier(s) Mistral Sud`);
ok('menaces au général identifiées', radar.threats >= 1, `${radar.threats} rival(aux) dangereux`);
console.log('    tête de course :', radar.sample.join(' | '));
await page.waitForTimeout(600);
const legend = await page.locator('.radar-legend .rl').count();
ok('légende des écarts affichée', legend === 3, `${legend} coureurs listés`);

console.log('\n--- OREILLETTE ---');
const msgs = await page.evaluate(() => {
  const r = window.__race;
  const seen = [];
  const p = r.player;
  for (let i = 0; i < 9000; i++) {
    const rem = r.track.length - p.dist;
    p.effort = rem < 800 ? 1 : 0.68;
    if (rem < 600) p.sprinting = p.energy > 8;
    r.update(0.02);
    const m = r.hudState().radio;
    if (m && !seen.some(s => s.text === m.text)) seen.push({ text: m.text, tone: m.tone });
    if (r.isOver) break;
  }
  return seen;
});
ok('le directeur parle', msgs.length >= 4, `${msgs.length} messages distincts`);
console.log('');
msgs.slice(0, 8).forEach(m => console.log(`    [${m.tone}] ${m.text}`));

console.log('\n--- ÉQUIPIERS ---');
const team = await page.evaluate(() => {
  const r = window.__race;
  return r.hudState().radar.filter(x => x.teammate).map(x => x.name);
});
console.log('    équipiers :', team.join(', ') || 'aucun');

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,2) : 'aucune');
await browser.close(); await server.close();
