import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5161 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5161');
await page.waitForTimeout(1600);

console.log('--- IMPORT DU FICHIER ---');
await page.click('[data-tab="peloton"]');
await page.waitForTimeout(500);
await page.locator('#roster-fichier').setInputFiles('/tmp/peloton-worldtour.json');
await page.waitForTimeout(1200);

const r = await page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  const ros = m.getRoster();
  return {
    total: ros.length,
    equipes: [...new Set(ros.map(x => x.team))].sort(),
    noms: ros.map(x => x.name),
    pogacar: ros.find(x => x.name === 'Tadej Pogačar'),
    ganna: ros.find(x => x.name === 'Filippo Ganna')
  };
});
ok('16 coureurs après import', r.total === 16, `${r.total}`);
ok('8 équipes', r.equipes.length === 8, r.equipes.length + ' équipes');
ok('Pogačar présent', !!r.pogacar, r.pogacar ? `${r.pogacar.team}, ${r.pogacar.age} ans, ${r.pogacar.archetype}` : '');
ok('stats appliquées', r.pogacar?.stats.climb === 97, `montagne ${r.pogacar?.stats.climb}`);
ok('sponsor du maillot', r.pogacar?.appearance.sponsor === 'UAE', r.pogacar?.appearance.sponsor);
ok('Ganna en rouleur', r.ganna?.archetype === 'rouleur' && r.ganna?.stats.flat === 97, `plat ${r.ganna?.stats.flat}`);
console.log('    équipes :', r.equipes.join(' · '));

console.log('\n--- AFFICHAGE DANS L\'ÉDITEUR ---');
const blocs = await page.locator('.equipe-bloc').count();
const coureurs = await page.locator('.coureur').count();
ok('groupés par équipe réelle', blocs === 8, `${blocs} blocs`);
ok('16 coureurs listés', coureurs === 16, `${coureurs}`);

console.log('\n--- CHOIX DE MON ÉQUIPE ---');
await page.click('[data-tab="atelier"]');
await page.waitForTimeout(800);
await page.click('[data-atelier="coureur"]');
await page.waitForTimeout(600);
const opts = await page.locator('#liste-equipes option').count();
ok('liste des équipes proposée', opts === 8, `${opts} options`);
const champ = page.locator('#rider-team');
await champ.fill('Visma–Lease a Bike');
await champ.dispatchEvent('change');
await page.waitForTimeout(500);
const monEq = await page.evaluate(() => window.__career.save.team);
ok('mon équipe enregistrée', monEq === 'Visma–Lease a Bike', monEq);

console.log('\n--- EN COURSE ---');
await page.click('[data-tab="tours"]');
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(1800);
const course = await page.evaluate(() => {
  const s = window.__race.hudState();
  return {
    total: s.radar.length,
    equipiers: s.radar.filter(x => x.teammate).map(x => x.name),
    noms: s.radar.filter(x => !x.isPlayer).slice(0,4).map(x => x.name)
  };
});
ok('peloton complet en course', course.total === 17, `${course.total} coureurs`);
ok('équipiers reconnus', course.equipiers.length === 2, course.equipiers.join(' + '));
console.log('    tête de course :', course.noms.join(' · '));

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
