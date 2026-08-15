import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5173 } });
await server.listen();
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);

// --- 1. simulation Xbox : UA console + extensions flottantes absentes ---
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Edge/120',
  viewport: { width: 1280, height: 720 }
});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e=>errs.push(String(e)));
await page.addInitScript(() => {
  // le GPU de la console ne filtre pas les textures flottantes
  const proto = WebGL2RenderingContext.prototype;
  const real = proto.getExtension;
  proto.getExtension = function (name) {
    if (/float_linear/i.test(name)) return null;
    return real.call(this, name);
  };
  // manette virtuelle
  window.__pad = { id:'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)',
    index:0, connected:true, mapping:'standard', axes:[0,0,0,0],
    buttons: Array.from({length:17},()=>({pressed:false,touched:false,value:0})) };
  navigator.getGamepads = () => [window.__pad,null,null,null];
  window.__press=(i,v=true)=>{ window.__pad.buttons[i].pressed=v; window.__pad.buttons[i].value=v?1:0; };
});
await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);

console.log('--- DÉTECTION XBOX ---');
const caps = await page.evaluate(() => {
  const g = window.__game;
  return { caps: g.capabilities, q: g.qualitySettings };
});
ok('console détectée', caps.caps.console === true);
ok('textures flottantes absentes détectées', caps.caps.floatLineaire === false);
ok('environnement PMREM désactivé', caps.q.environnement === false, 'cause probable de l\'écran blanc');
ok('qualité réduite automatiquement', caps.q.densiteFoule < 1, `foule à ${Math.round(caps.q.densiteFoule*100)} %`);

console.log('\n--- LA COURSE S\'AFFICHE ---');
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(1800);
await page.evaluate(() => { const r=window.__race; r.countdown=0; r.player.dist=r.track.length*0.35; for(let i=0;i<150;i++) r.update(0.02); });
await page.waitForTimeout(1500);
const env = await page.evaluate(() => ({
  env: !!window.__race.scene.environment,
  bg: !!window.__race.scene.background?.isTexture
}));
ok('pas d\'environnement PMREM en course', env.env === false);
ok('ciel photo conservé en fond', env.bg === true, 'le ciel reste, seuls les reflets sautent');

await page.screenshot({ path: 'xbox-race.png' });
const blanc = await page.evaluate(() => {
  const c = document.getElementById('game-canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  return gl ? gl.isContextLost() : true;
});
ok('contexte WebGL vivant', blanc === false);

console.log('\n--- BOUTONS DE SECOURS (Y intercepté par le navigateur) ---');
const inv = await page.evaluate(() => {
  const r = window.__race, g = window.__game;
  r.player.energy = 40;
  const b0 = r.player.bidons, g0 = r.player.gels;
  // LB puis RB, sans jamais toucher X ni Y
  window.__press(4, true); g.input.poll(); r.handleInput(g.input, 0.02); window.__press(4, false);
  g.input.poll(); r.handleInput(g.input, 0.02);
  window.__press(5, true); g.input.poll(); r.handleInput(g.input, 0.02); window.__press(5, false);
  g.input.poll(); r.handleInput(g.input, 0.02);
  return { b0, g0, b: r.player.bidons, g: r.player.gels };
});
ok('LB boit un bidon', inv.b === inv.b0 - 1, `${inv.b0} → ${inv.b}`);
ok('RB avale un gel', inv.g === inv.g0 - 1, `${inv.g0} → ${inv.g}`);

console.log('\n--- QUALITÉ MANUELLE ---');
await page.evaluate(() => { const r=window.__race; r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02); });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000});
await page.click('[data-action="continue"]');
await page.waitForTimeout(600);
await page.click('[data-tab="params"]');
await page.waitForTimeout(500);
const qb = await page.locator('[data-quality]').count();
ok('4 niveaux de qualité proposés', qb === 4);
await page.click('[data-quality="basse"]');
await page.waitForTimeout(500);
const low = await page.evaluate(() => window.__game.qualitySettings);
ok('mode Basse appliqué', low.shadows === false && low.pixelRatioMax < 1, `ombres ${low.shadows}, ratio ${low.pixelRatioMax}`);
const fs = await page.locator('[data-action="fullscreen"]').count();
ok('bouton plein écran présent', fs === 1);
const autofs = await page.locator('#auto-fs').isChecked();
ok('plein écran auto activé par défaut', autofs === true);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
