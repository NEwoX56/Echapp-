import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5175 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.addInitScript(() => {
  window.__pad = {
    id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
    index: 0, connected: true, mapping: 'standard',
    axes: [0,0,0,0],
    buttons: Array.from({length:17},()=>({pressed:false,touched:false,value:0}))
  };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__press = (i,v=true)=>{ window.__pad.buttons[i].pressed=v; window.__pad.buttons[i].value=v?1:0; };
});
await page.goto('http://localhost:5175');
await page.waitForTimeout(1000);
await page.evaluate(()=>window.__press(8,true)); await page.waitForTimeout(350);
await page.evaluate(()=>window.__press(8,false)); await page.waitForTimeout(400);
const n = await page.evaluate(()=>window.__game.input.gamepadName);
console.log(n === 'Manette PlayStation' ? `  OK  DualSense reconnue — ${n}` : `  FAIL — ${n}`);
// déconnexion
await page.evaluate(()=>{ window.__pad.connected = false; navigator.getGamepads = () => [null,null,null,null]; });
await page.waitForTimeout(600);
const foot = await page.locator('#menu-foot').textContent();
console.log(foot.includes('ESPACE') ? '  OK  retour aux libellés clavier après débranchement' : `  FAIL — ${foot.trim().slice(0,40)}`);
await browser.close(); await server.close();
