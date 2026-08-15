import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5137 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.addInitScript(() => {
  window.__pad = { id:'Xbox Wireless Controller (STANDARD GAMEPAD)', index:0, connected:true, mapping:'standard',
    axes:[0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,touched:false,value:0})) };
  navigator.getGamepads = () => [window.__pad,null,null,null];
  window.__press=(i,v=true)=>{ window.__pad.buttons[i].pressed=v; window.__pad.buttons[i].value=v?1:0; };
});
const tap = async (i) => { await page.evaluate(n=>window.__press(n,true), i); await page.waitForTimeout(90);
  await page.evaluate(n=>window.__press(n,false), i); await page.waitForTimeout(200); };
await page.goto('http://localhost:5137');
await page.waitForTimeout(2400);

// débloquer de quoi remplir l'écran
await page.evaluate(() => {
  const c = window.__career;
  c.save.upgradePoints = 200;
  c.save.specialites = ['rouleur','grimpeur-ne','estomac'];
  c.save.emplacements = 3;
  c.persist(); window.__menu.render();
});
await page.waitForTimeout(600);

console.log('--- A LANCE L\'AVANT-COURSE PUIS LA COURSE ---');
await tap(0);
await page.waitForTimeout(900);
const enBriefing = await page.evaluate(() => !document.getElementById('screen-briefing').classList.contains('hidden'));
ok('A ouvre l\'écran d\'avant-course depuis le menu', enBriefing);

console.log('\n--- TOUT EST ATTEIGNABLE À LA MANETTE ---');
const cibles = await page.evaluate(() => {
  const nav = window.__game.navBriefing;
  nav.collecter();
  return nav.cibles.map(c => ({ ...c.el.dataset, txt: (c.el.textContent||'').trim().slice(0,20) }));
});
const a = (k) => cibles.filter(c => k in c).length;
ok('spécialités atteignables', a('spec') === 3, `${a('spec')} cartes`);
ok('boutons de contrat atteignables', a('contrat') === 2);
ok('relance de forme atteignable', cibles.some(c => c.action === 'relancer'));
ok('bouton de départ atteignable', cibles.some(c => c.action === 'partir'));
ok('retour au menu atteignable', cibles.some(c => c.action === 'retour'));

console.log('\n--- ÉQUIPER UNE SPÉCIALITÉ À LA MANETTE ---');
const pose = await page.evaluate(() => {
  const nav = window.__game.navBriefing;
  nav.actif = true; nav.collecter();
  const i = nav.cibles.findIndex(c => c.el.dataset.spec === 'grimpeur-ne');
  if (i < 0) return false;
  nav.index = i; nav.appliquer(); return true;
});
ok('curseur posé sur une spécialité', pose);
await tap(0);
await page.waitForTimeout(500);
ok('A équipe la spécialité', await page.evaluate(()=>window.__career.estEquipee('grimpeur-ne')));

console.log('\n--- ACCEPTER LE CONTRAT ---');
const poseC = await page.evaluate(() => {
  const nav = window.__game.navBriefing;
  nav.actif = true; nav.collecter();
  const i = nav.cibles.findIndex(c => c.el.dataset.contrat === 'oui');
  if (i < 0) return false;
  nav.index = i; nav.appliquer(); return true;
});
await tap(0);
await page.waitForTimeout(500);
ok('A accepte le contrat', poseC && await page.evaluate(()=>window.__career.contrat?.accepte === true));

console.log('\n--- DÉPART ---');
const poseD = await page.evaluate(() => {
  const nav = window.__game.navBriefing;
  nav.actif = true; nav.collecter();
  const i = nav.cibles.findIndex(c => c.el.dataset.action === 'partir');
  nav.index = i; nav.appliquer(); return i >= 0;
});
await tap(0);
await page.waitForTimeout(1400);
ok('A lance la course', poseD && await page.evaluate(()=>!document.getElementById('screen-hud').classList.contains('hidden')));
const spec = await page.evaluate(()=>[...(window.__race?.player.specialites ?? [])]);
ok('spécialité transmise à la course', spec.includes('grimpeur-ne'), spec.join(', '));

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
