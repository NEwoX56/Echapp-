import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5160 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.addInitScript(() => {
  window.__pad = { id:'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)',
    index:0, connected:true, mapping:'standard', axes:[0,0,0,0],
    buttons: Array.from({length:17},()=>({pressed:false,touched:false,value:0})) };
  navigator.getGamepads = () => [window.__pad,null,null,null];
  window.__press=(i,v=true)=>{ window.__pad.buttons[i].pressed=v; window.__pad.buttons[i].value=v?1:0; };
  window.__axis=(i,v)=>{ window.__pad.axes[i]=v; };
});
await page.goto('http://localhost:5160');
await page.waitForTimeout(1600);

// helpers : appui bref, et maintien d'une direction le temps voulu
const tap = async (i) => { await page.evaluate(n=>window.__press(n,true), i); await page.waitForTimeout(90); await page.evaluate(n=>window.__press(n,false), i); await page.waitForTimeout(160); };

// inspection directe des cibles de navigation : plus fiable et bien plus
// rapide que de parcourir tout l'écran cran par cran
const cibles = () => page.evaluate(() => {
  const nav = window.__game.navMenu;
  nav.collecter();
  return nav.cibles.map(c => ({ tag: c.el.tagName, type: c.el.type ?? '', data: { ...c.el.dataset } }));
});
const dir = async (bouton, fois=1) => { for (let k=0;k<fois;k++) await tap(bouton); };
const focus = () => page.evaluate(() => {
  const e = document.querySelector('.nav-focus');
  if (!e) return null;
  return { tag: e.tagName, type: e.type ?? '', txt: (e.textContent||'').trim().slice(0,26), data: JSON.stringify(e.dataset) };
});

console.log('--- PRISE EN MAIN ---');
await dir(13); // croix bas
const f0 = await focus();
ok('le curseur apparaît au premier mouvement', !!f0, f0 ? `${f0.tag} ${f0.txt}` : 'aucun');

console.log('\n--- ATELIER : TOUT DOIT ÊTRE ATTEIGNABLE ---');
await page.click('[data-tab="atelier"]');
await page.waitForTimeout(900);
const c1 = await cibles();
const cpt = (k) => c1.filter(c => k in c.data).length;
// six entrées de navigation, plus l'engrenage en haut à gauche
ok('onglets principaux atteignables', cpt('tab') === 7, `${cpt('tab')} cibles`);
ok('onglets d\'atelier atteignables', cpt('atelier') === 3, `${cpt('atelier')} sous-onglets`);
ok('pastilles de couleur atteignables', cpt('colorField') >= 32, `${cpt('colorField')} pastilles`);
ok('motifs de maillot atteignables', cpt('pattern') === 8, `${cpt('pattern')} motifs`);
ok('champs texte atteignables', c1.some(c => c.type === 'text'), 'sponsor');

await page.evaluate(() => document.querySelector('[data-atelier="velo"]').click());
await page.waitForTimeout(700);
const c2 = await cibles();
const cpt2 = (k) => c2.filter(c => k in c.data).length;
ok('styles de roues atteignables', cpt2('wheels') === 3, `${cpt2('wheels')} styles`);
ok('couleurs de cadre atteignables', cpt2('colorField') >= 32, `${cpt2('colorField')} pastilles`);

await page.evaluate(() => document.querySelector('[data-atelier="coureur"]').click());
await page.waitForTimeout(700);
const c3 = await cibles();
ok('couleurs de peau atteignables', c3.filter(c => c.data.colorField === 'skin').length === 7,
   `${c3.filter(c => c.data.colorField === 'skin').length} teintes`);
ok('nom, âge et équipe atteignables', c3.filter(c => c.type === 'text' || c.type === 'number').length >= 3);

console.log('\n--- ACTIVER AVEC A ---');
await page.click('[data-tab="atelier"]');
await page.waitForTimeout(600);
await page.evaluate(() => { const b=[...document.querySelectorAll('[data-atelier="maillot"]')][0]; b.click(); });
await page.waitForTimeout(700);
// descendre jusqu'à une pastille de couleur principale puis valider
// on pose le curseur sur une pastille dont la couleur DIFFÈRE de l'actuelle :
// tomber sur celle déjà active donnerait un « avant » égal à « après » sans
// que le bouton soit en cause
const cible = await page.evaluate(() => {
  const nav = window.__game.navMenu;
  nav.actif = true; nav.collecter();
  const actuelle = window.__career.save.appearance.jerseyPrimary;
  const i = nav.cibles.findIndex(
    c => c.el.dataset.colorField === 'jerseyPrimary' && Number(c.el.dataset.color) !== actuelle
  );
  if (i < 0) return null;
  nav.index = i; nav.appliquer();
  return { avant: actuelle, visee: Number(nav.cibles[i].el.dataset.color) };
});
ok('curseur posé sur une couleur principale', !!cible);
await tap(0); // A
await page.waitForTimeout(500);
const apres = await page.evaluate(() => window.__career.save.appearance.jerseyPrimary);
ok('A applique la couleur', apres === cible?.visee, `0x${cible?.avant.toString(16)} → 0x${apres.toString(16)}`);

console.log('\n--- CURSEURS RÉGLABLES ---');
await page.click('[data-tab="params"]');
await page.waitForTimeout(800);
const cp = await cibles();
ok('curseurs de volume atteignables', cp.filter(c=>c.type==='range').length === 3, `${cp.filter(c=>c.type==='range').length} curseurs`);
ok('boutons d\'import de musique atteignables', cp.filter(c=>'import' in c.data).length === 5);
ok('niveaux de qualité atteignables', cp.filter(c=>'quality' in c.data).length === 4);
// poser le curseur directement sur le premier réglage de volume
const surCurseur = await page.evaluate(() => {
  const nav = window.__game.navMenu;
  nav.actif = true; nav.collecter();
  const i = nav.cibles.findIndex(c => c.el.type === 'range');
  if (i < 0) return false;
  nav.index = i; nav.appliquer(); return true;
});
if (surCurseur) {
  const v0 = await page.evaluate(() => window.__career.save.volMaster ?? window.__career.save.volMusique);
  await page.evaluate(()=>window.__press(14,true));
  await page.waitForTimeout(700);
  await page.evaluate(()=>window.__press(14,false));
  await page.waitForTimeout(300);
  const v1 = await page.evaluate(() => window.__career.save.volMaster ?? window.__career.save.volMusique);
  ok('gauche/droite règle le curseur', v1 !== v0, `${v0} → ${v1}`);
}

console.log('\n--- PELOTON ---');
await page.click('[data-tab="peloton"]');
await page.waitForTimeout(800);
await dir(13);
let surCoureur = false;
for (let i=0;i<25 && !surCoureur;i++){
  const f = await focus();
  if (f && f.data.includes('ouvrir')) surCoureur = true; else await tap(13);
}
ok('coureurs atteignables', surCoureur);
if (surCoureur) {
  await tap(0);
  await page.waitForTimeout(700);
  const ouvert = await page.locator('.coureur.ouvert').count();
  ok('A ouvre la fiche du coureur', ouvert === 1);
  const persiste = await focus();
  ok('le curseur survit au re-rendu', !!persiste, persiste ? persiste.txt : 'perdu');
}

console.log('\n--- LB / RB ET B ---');
const onglet0 = await page.locator('.side-nav button.active').textContent();
await tap(5);
await page.waitForTimeout(500);
const onglet1 = await page.locator('.side-nav button.active').textContent();
ok('RB change d\'onglet', onglet0.trim() !== onglet1.trim(), `${onglet0.trim()} → ${onglet1.trim()}`);
await dir(13, 3);
await tap(1); // B
await page.waitForTimeout(400);
const f2 = await focus();
ok('B ramène en haut', !!f2, f2 ? f2.txt : '');

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
