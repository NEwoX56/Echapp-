import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), server: { port: 5176 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
const errs=[]; page.on('pageerror', e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);

// manette virtuelle : on remplace navigator.getGamepads avant le chargement
await page.addInitScript(() => {
  window.__pad = {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)',
    index: 0, connected: true, mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
  };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__press = (i, v = true) => {
    window.__pad.buttons[i].pressed = v;
    window.__pad.buttons[i].value = v ? 1 : 0;
  };
  window.__axis = (i, v) => { window.__pad.axes[i] = v; };
});

await page.goto('http://localhost:5176');
await page.waitForTimeout(1200);

console.log('--- DÉTECTION ---');
// l'événement gamepadconnected n'est pas émis : on vérifie la détection par polling.
// On utilise Select (bouton 8), sans effet dans le jeu, pour ne rien déclencher.
await page.evaluate(() => window.__press(8, true));
await page.waitForTimeout(400);
await page.evaluate(() => window.__press(8, false));
await page.waitForTimeout(300);
const det = await page.evaluate(() => ({
  connected: window.__game.input.gamepadConnected,
  name: window.__game.input.gamepadName
}));
ok('manette détectée sans événement', det.connected, det.name);
ok('nom reconnu (Xbox)', det.name === 'Manette Xbox', det.name);

// menu : le pied de page doit changer
await page.waitForTimeout(300);
const foot = await page.locator('#menu-foot').textContent();
ok('aide de commandes adaptée', foot.includes('RT'), foot.trim().slice(0, 46) + '…');

// onglet paramètres : statut
await page.click('[data-tab="params"]');
await page.waitForTimeout(400);
const status = await page.locator('#pad-status').textContent();
ok('statut manette dans Paramètres', status.includes('détectée et prête'));
const rows = await page.locator('.pad-table tr').count();
ok('tableau des commandes', rows === 8, `${rows} lignes`);

// LB/RB changent d'onglet
await page.evaluate(() => window.__press(5, true));
await page.waitForTimeout(200);
await page.evaluate(() => window.__press(5, false));
await page.waitForTimeout(400);
// Paramètres n'est plus dans la navigation (seul l'engrenage y donne accès) :
// on lit le panneau courant plutôt que de chercher un onglet actif
const tab = await page.evaluate(() => window.__menu.panel);
ok('RB change d\'onglet', tab !== 'params', `panneau actif : ${tab}`);

// A lance la course depuis l'onglet Courir
await page.click('[data-tab="tours"]');
await page.waitForTimeout(300);
// A ouvre d'abord l'écran d'avant-course, puis lance la course
await page.evaluate(() => window.__press(0, true));
await page.waitForTimeout(200);
await page.evaluate(() => window.__press(0, false));
await page.waitForTimeout(900);
const enBriefing = await page.evaluate(() => !document.getElementById('screen-briefing').classList.contains('hidden'));
ok('A ouvre l\'écran d\'avant-course', enBriefing);
await page.evaluate(() => window.__press(0, true));
await page.waitForTimeout(200);
await page.evaluate(() => window.__press(0, false));
await page.waitForTimeout(1200);
const inRace = await page.evaluate(() => !document.getElementById('screen-hud').classList.contains('hidden'));
ok('A lance ensuite la course', inRace);

console.log('\n--- COMMANDES EN COURSE ---');
await page.evaluate(() => { window.__race.countdown = 0; });
await page.waitForTimeout(300);

// gâchette droite = accélérer
const before = await page.evaluate(() => window.__race.player.effort);
await page.evaluate(() => { window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1; });
await page.waitForTimeout(900);
const after = await page.evaluate(() => window.__race.player.effort);
await page.evaluate(() => { window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0; });
ok('RT accélère', after > before, `effort ${before.toFixed(2)} → ${after.toFixed(2)}`);

// stick gauche = placement
const laneB = await page.evaluate(() => window.__race.player.targetLane);
await page.evaluate(() => window.__axis(0, 0.9));
await page.waitForTimeout(800);
await page.evaluate(() => window.__axis(0, 0));
const laneA = await page.evaluate(() => window.__race.player.targetLane);
ok('stick droite déplace à droite', laneA > laneB, `${laneB.toFixed(2)} → ${laneA.toFixed(2)}`);

// zone morte
await page.evaluate(() => window.__axis(0, 0.1));
const laneC0 = await page.evaluate(() => window.__race.player.targetLane);
await page.waitForTimeout(700);
const laneC1 = await page.evaluate(() => window.__race.player.targetLane);
await page.evaluate(() => window.__axis(0, 0));
ok('zone morte respectée', Math.abs(laneC1 - laneC0) < 0.05, `dérive ${(laneC1-laneC0).toFixed(3)}`);

// X = bidon, Y = gel
await page.evaluate(() => { window.__race.player.energy = 45; });
const inv0 = await page.evaluate(() => ({ b: window.__race.player.bidons, g: window.__race.player.gels }));
await page.evaluate(() => window.__press(2, true));
await page.waitForTimeout(200);
await page.evaluate(() => window.__press(2, false));
await page.waitForTimeout(300);
await page.evaluate(() => window.__press(3, true));
await page.waitForTimeout(200);
await page.evaluate(() => window.__press(3, false));
await page.waitForTimeout(300);
const inv1 = await page.evaluate(() => ({ b: window.__race.player.bidons, g: window.__race.player.gels }));
ok('X boit un bidon', inv1.b === inv0.b - 1, `${inv0.b} → ${inv1.b}`);
ok('Y avale un gel', inv1.g === inv0.g - 1, `${inv0.g} → ${inv1.g}`);

// appui maintenu ne doit pas vider le stock
await page.evaluate(() => window.__press(2, true));
await page.waitForTimeout(1200);
const inv2 = await page.evaluate(() => window.__race.player.bidons);
await page.evaluate(() => window.__press(2, false));
ok('appui maintenu = un seul bidon', inv2 === inv1.b - 1, `${inv1.b} → ${inv2}`);

// A = sprint. On pilote la simulation directement : à 2 fps en headless,
// l'attente réelle ne laisserait pas le temps à la danseuse de s'installer.
const st = await page.evaluate(() => {
  const r = window.__race;
  r.player.energy = 100;
  window.__press(0, true);
  const g = window.__game;
  for (let i = 0; i < 80; i++) {
    g.input.poll();
    r.handleInput(g.input, 0.02);
    r.update(0.02);
  }
  window.__press(0, false);
  return r.player.standing;
});
ok('A déclenche le sprint et la danseuse', st > 0.7, `standing ${st.toFixed(2)}`);

// libellés HUD
const kb = await page.locator('#hud-key-bidon').textContent();
const kg = await page.locator('#hud-key-gel').textContent();
ok('HUD affiche les boutons manette', kb === 'X' && kg === 'Y', `${kb} / ${kg}`);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
