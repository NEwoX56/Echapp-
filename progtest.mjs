import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5140 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5140');
await page.waitForTimeout(2600);

console.log('--- PANNEAU VISUEL ---');
const hero = await page.evaluate(() => {
  // deux couches se relaient pour le fondu : on regarde celle qui est visible
  const couches = [...document.querySelectorAll('.hero-couche')];
  const visible = couches.find(x => getComputedStyle(x).opacity !== '0') ?? couches[0];
  return {
    couches: couches.length,
    image: visible ? getComputedStyle(visible).backgroundImage : '',
    points: document.querySelectorAll('.hero-points i').length,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    legende: document.querySelector('.hero-legende')?.textContent
  };
});
ok('panneau monté', hero.couches === 2 && hero.image.includes('menu/'));
ok('image de fond chargée', hero.points === 1, `${hero.points} image`);
ok('couleur extraite de l\'image', /^#[0-9a-f]{6}$/i.test(hero.accent), hero.accent);
console.log('    légende :', hero.legende);
const acc1 = hero.accent;
await page.evaluate(() => { const m = window.__menu; m.hero.index = 2; });
await page.waitForTimeout(500);

console.log('\n--- PROGRESSION ---');
await page.evaluate(() => { const c = window.__career; c.save.upgradePoints = 300; c.persist(); window.__menu.render(); });
await page.waitForTimeout(600);
await page.click('[data-tab="progression"]');
await page.waitForTimeout(700);
ok('points de carrière affichés', (await page.locator('.pts-grand').textContent()) === '300');
ok('12 badges listés', await page.locator('.badge-tuile').count() === 12);
ok('8 spécialités en boutique', await page.locator('[data-acheter-spec]').count() === 8);
await page.locator('[data-acheter-spec="rouleur"]').click();
await page.waitForTimeout(600);
ok('spécialité débloquée', await page.evaluate(()=>window.__career.aSpecialite('rouleur')));
ok('points débités', await page.evaluate(()=>window.__career.points) === 292);
await page.click('[data-acheter-emplacement]');
await page.waitForTimeout(600);
ok('emplacement acheté', await page.evaluate(()=>window.__career.emplacements) === 3);
await page.click('[data-acheter-bidon]');
await page.waitForTimeout(600);
ok('bidon supplémentaire', await page.evaluate(()=>window.__career.bidonsBonus) === 1);

console.log('\n--- AVANT-COURSE ---');
await page.click('[data-tab="tours"]');
await page.waitForTimeout(500);
// ce test inspecte justement l'écran d'avant-course : on ne le franchit pas
await page.click('[data-action="play"]');
await page.waitForTimeout(900);
const br = await page.evaluate(() => ({
  affiche: !document.getElementById('screen-briefing').classList.contains('hidden'),
  forme: document.querySelector('.br-forme-val')?.textContent?.trim(),
  contrat: document.querySelector('.br-contrat-texte')?.textContent?.trim(),
  specs: document.querySelectorAll('.spec-carte').length
}));
ok('écran d\'avant-course affiché', br.affiche);
ok('forme du jour tirée', !!br.forme, br.forme);
ok('contrat proposé', !!br.contrat, br.contrat?.slice(0,52));
ok('spécialités proposées', br.specs === 1, `${br.specs} débloquée(s)`);
await page.click('[data-spec="rouleur"]');
await page.waitForTimeout(400);
ok('spécialité équipée', await page.evaluate(()=>window.__career.estEquipee('rouleur')));
await page.click('[data-contrat="oui"]');
await page.waitForTimeout(400);
ok('contrat accepté', await page.evaluate(()=>window.__career.contrat?.accepte === true));
await page.screenshot({ path: 'ecran-briefing.png' });

console.log('\n--- COURSE ET BILAN ---');
await page.click('[data-action="partir"]');
await page.waitForTimeout(1200);
const enCourse = await page.evaluate(() => !!window.__race && window.__race.player.specialites.has('rouleur'));
ok('spécialité active en course', enCourse);
const bidons = await page.evaluate(() => window.__race.player.bidons);
ok('bidon supplémentaire embarqué', bidons === 5, `${bidons} bidons`);
await page.evaluate(() => { const r=window.__race; r.countdown=0; r.player.dist=r.track.length-5; for(let i=0;i<500;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.waitForTimeout(600);
const res = await page.evaluate(() => ({
  badges: document.querySelectorAll('.badge-carte').length,
  contrat: document.querySelector('.contrat-bilan')?.className,
  pts: window.__career.points
}));
ok('bilan de contrat affiché', !!res.contrat, res.contrat);
console.log(`    badges gagnés : ${res.badges} · points : ${res.pts}`);
ok('badges attribués', await page.evaluate(()=>window.__career.badgesObtenus.length) > 0,
   await page.evaluate(()=>window.__career.badgesObtenus.join(', ')));

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
