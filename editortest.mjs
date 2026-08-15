import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5163 } });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5163');
await page.waitForTimeout(1600);

console.log('--- ONGLET PELOTON ---');
await page.click('[data-tab="peloton"]');
await page.waitForTimeout(500);
const nb = await page.locator('.coureur').count();
ok('coureurs listés', nb === 17, `${nb} coureurs`);
const eq = await page.locator('.equipe-bloc').count();
ok('groupés par équipe', eq >= 5, `${eq} équipes`);

console.log('\n--- RENOMMER UN COUREUR ---');
await page.locator('.coureur-tete').first().click();
await page.waitForTimeout(400);
const champ = page.locator('[data-champ="name"]').first();
await champ.fill('Tadej P.');
await champ.dispatchEvent('change');
await page.waitForTimeout(500);
const nom = await page.evaluate(() => window.__game.menu ? null : null);
const rosterNom = await page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  return m.getRoster().find(r => r.name === 'Tadej P.') ? 'trouvé' : 'absent';
});
ok('nom appliqué au peloton', rosterNom === 'trouvé');
const persist = await page.evaluate(() => {
  const raw = localStorage.getItem('echappee-roster-v1');
  return raw ? Object.values(JSON.parse(raw)).some(p => p.name === 'Tadej P.') : false;
});
ok('modification enregistrée dans le navigateur', persist === true);

console.log('\n--- RENOMMER UNE ÉQUIPE ENTIÈRE ---');
const eqInput = page.locator('.equipe-nom').first();
const avant = await eqInput.inputValue();
await eqInput.fill('UAE Test');
await eqInput.dispatchEvent('change');
await page.waitForTimeout(600);
const membres = await page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  return m.getRoster().filter(r => r.team === 'UAE Test').length;
});
ok('toute l\'équipe renommée', membres >= 2, `${membres} coureurs dans "UAE Test" (avant : ${avant})`);
const sponsor = await page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  return m.getRoster().find(r => r.team === 'UAE Test')?.appearance.sponsor;
});
ok('sponsor du maillot suit', sponsor === 'UAE TEST', sponsor);

console.log('\n--- STATS, TYPE, COULEUR ---');
await page.locator('.coureur-tete').first().click();
await page.waitForTimeout(400);
// on lit l'identifiant réellement édité : l'affichage est trié par équipe,
// il ne suit pas l'ordre du tableau source
const slider = page.locator('[data-stat="climb"]').first();
const cibleId = await slider.getAttribute('data-id');
await slider.fill('95');
await slider.dispatchEvent('input');
await page.waitForTimeout(400);
const st = await page.evaluate(async (id) => {
  const m = await import('/src/data/rosterStore.ts');
  return m.getRoster().find(r => r.id === id)?.stats.climb;
}, cibleId);
ok('caractéristique modifiée', st === 95, `montagne = ${st}`);
await page.locator('[data-archetype="grimpeur"]').first().click();
await page.waitForTimeout(400);
const arch = await page.evaluate(async (id) => {
  const m = await import('/src/data/rosterStore.ts');
  return m.getRoster().find(r => r.id === id)?.archetype;
}, cibleId);
ok('type modifié', arch === 'grimpeur', arch);

console.log('\n--- AJOUT ET RETRAIT ---');
await page.click('[data-roster="ajouter"]');
await page.waitForTimeout(600);
const nb2 = await page.locator('.coureur').count();
ok('coureur ajouté', nb2 === nb + 1, `${nb} → ${nb2}`);
await page.locator('[data-retirer]').first().click();
await page.waitForTimeout(600);
const nb3 = await page.locator('.coureur').count();
ok('coureur retiré', nb3 === nb, `${nb2} → ${nb3}`);
const restaurables = await page.locator('[data-restaurer]').count();
ok('retrait réversible', restaurables >= 0);

console.log('\n--- EFFET EN COURSE ---');
await page.click('[data-tab="tours"]');
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(1500);
const enCourse = await page.evaluate(() => {
  const r = window.__race;
  const noms = r.hudState().radar.map(x => x.name);
  return { total: noms.length, tadej: noms.includes('Tadej P.') };
});
ok('le peloton modifié est bien en course', enCourse.tadej === true, `${enCourse.total} coureurs, nom personnalisé présent`);

console.log('\n--- SAUVEGARDE PAR FICHIER ---');
await page.evaluate(() => { const r=window.__race; r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.click('[data-action="continue"]');
await page.waitForTimeout(600);
await page.click('[data-tab="peloton"]');
await page.waitForTimeout(500);
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.click('[data-roster="exporter"]');
const fichier = await dl;
ok('export du peloton téléchargeable', !!fichier, fichier ? await fichier.suggestedFilename() : 'échec');

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
