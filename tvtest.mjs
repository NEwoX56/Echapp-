import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5145 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5145');
await page.waitForTimeout(1600);

await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(900);
// avancer jusqu'à ce que la course se fractionne
await page.evaluate(() => {
  const r = window.__race; r.countdown = 0;
  const p = r.player;
  for (let i=0;i<4000;i++) { p.effort = 0.66; r.update(0.02); }
});
await page.waitForTimeout(1400);

const bar = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tv-groupe')].map(e => ({
    titre: e.querySelector('.tv-titre')?.textContent?.trim(),
    nb: e.querySelector('.tv-nb')?.textContent?.trim(),
    val: [...e.querySelectorAll('.tv-val')].map(v=>v.textContent.trim()),
    moi: e.classList.contains('tv-moi')
  }));
  return { g, logo: !!document.querySelector('.tv-logo svg'), groupes: window.__race.hudState().groupes.length };
});
ok('logo du tour affiché', bar.logo);
ok('groupes détectés', bar.g.length >= 2, `${bar.g.length} groupes au bandeau`);
ok('premier bloc = tête de course', bar.g[0]?.titre === 'Tête de la course');
ok('kilomètres restants affichés', /km/.test(bar.g[0]?.val[0] ?? ''), bar.g[0]?.val.join(' / '));
ok('écarts en minutes-secondes', bar.g[1] ? /\d+["']/.test(bar.g[1].val[0]) : false, bar.g[1]?.val[0]);
console.log('    bandeau :');
bar.g.forEach(x => console.log(`      ${(x.titre??'').padEnd(22)} ${x.nb ?? ''}  ${x.val.join('  ')}${x.moi?'   ← toi':''}`));

console.log('\n--- LOGOS DES QUATRE TOURS ---');
const logos = await page.evaluate(async () => {
  const m = await import('/src/ui/RaceGroups.ts');
  return ['cimes','littoral','traversee','couronne'].map(id => ({ id, taille: m.logoTour(id).length }));
});
logos.forEach(l => console.log(`      ${l.id.padEnd(11)} ${l.taille > 300 ? 'emblème présent' : 'MANQUANT'}`));
ok('quatre emblèmes distincts', new Set(logos.map(l=>l.taille)).size === 4);

console.log('\n--- ÉTAPE DE MONTAGNE : distance au sommet ---');
await page.evaluate(() => { const r=window.__race; r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.click('[data-action="continue"]');
await page.waitForTimeout(600);
await page.evaluate(()=>{ const c=window.__career; c.save.tour.currentStage=3; c.persist(); window.__menu.render(); });
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(900);
await page.evaluate(()=>{ const r=window.__race; r.countdown=0; r.player.dist=r.track.climbs[0].dist-300; for(let i=0;i<600;i++){ r.player.effort=0.7; r.update(0.02);} });
await page.waitForTimeout(1400);
const mont = await page.evaluate(() => {
  const t = document.querySelector('.tv-tete');
  return { lignes: t?.querySelectorAll('.tv-ligne').length, sommet: t?.querySelector('.tv-sommet .tv-val')?.textContent?.trim() };
});
ok('ligne « distance au sommet » présente', mont.lignes === 2, `sommet dans ${mont.sommet}`);
await page.screenshot({ path: 'tv-bandeau.png', clip: { x: 0, y: 0, width: 700, height: 130 } });

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
