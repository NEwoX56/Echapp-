import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5162 } });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5162');
await page.waitForTimeout(1600);
await page.click('[data-tab="params"]');
await page.waitForTimeout(700);

console.log('--- IMPORT DEPUIS LE JEU ---');
const pistes = await page.locator('.piste').count();
ok('5 ambiances proposées', pistes === 5, `${pistes}`);
const boutons = await page.locator('[data-import]').count();
ok('bouton d\'import par ambiance', boutons === 5);

await page.locator('[data-import="course"]').click();
await page.locator('#import-musique').setInputFiles('/tmp/musique/ma-musique-de-course.wav');
await page.waitForTimeout(1500);

const apres = await page.evaluate(() => ({
  fournies: window.__game.music.ambiancesFournies,
  info: window.__game.music.bibliotheque.info('course')
}));
ok('morceau importé', apres.fournies.includes('course'), apres.info ? `${apres.info.nom} — ${Math.round(apres.info.taille/1024)} Ko` : '');
ok('nom du fichier conservé', apres.info?.nom === 'ma-musique-de-course.wav');

const marque = await page.locator('.piste.fournie').count();
ok('affiché comme fourni', marque === 1, `${marque} piste(s)`);
const btnRetirer = await page.locator('[data-suppr="course"]').count();
ok('bouton de retrait présent', btnRetirer === 1);

console.log('\n--- PERSISTANCE APRÈS RECHARGEMENT ---');
await page.reload();
await page.waitForTimeout(2200);
const apresReload = await page.evaluate(() => ({
  fournies: window.__game.music.ambiancesFournies,
  info: window.__game.music.bibliotheque.info('course')
}));
ok('morceau conservé après rechargement', apresReload.fournies.includes('course'), apresReload.info?.nom ?? '');

console.log('\n--- LECTURE EN COURSE ---');
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(2500);
const lecture = await page.evaluate(async () => {
  const g = window.__game;
  await new Promise(r=>setTimeout(r,800));
  const p = g.music.fournie.pistes.get('course');
  return { source: g.music.sourceCourante, joue: p ? !p.element.paused : false, url: p?.element.src.slice(0,10) };
});
ok('le morceau importé est joué en course', lecture.source === 'fichier' && lecture.joue, `source ${lecture.source}, URL ${lecture.url}…`);

console.log('\n--- SUPPRESSION ---');
await page.evaluate(() => { const r=window.__race; r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.click('[data-action="continue"]');
await page.waitForTimeout(600);
await page.click('[data-tab="params"]');
await page.waitForTimeout(600);
await page.locator('[data-suppr="course"]').click();
await page.waitForTimeout(1200);
const final = await page.evaluate(() => window.__game.music.ambiancesFournies);
ok('morceau retiré', !final.includes('course'), `restants : ${final.length}`);
const gen = await page.evaluate(async () => {
  const g = window.__game;
  g.music.jouer('course');
  await new Promise(r=>setTimeout(r,400));
  return g.music.sourceCourante;
});
ok('retour à la musique générée', gen === 'generee', gen);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
