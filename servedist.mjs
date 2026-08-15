// Sert le dossier dist exactement comme un hébergeur statique, SANS la
// fonction : c'est le pire cas si Netlify ne la publie pas. Le jeu doit
// rester pleinement utilisable.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const T = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg',
  '.wav':'audio/wav','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.txt':'text/plain','.toml':'text/plain'};
const srv = http.createServer((req,res)=>{
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u.startsWith('/api/')) { res.writeHead(404); return res.end('no function'); }
  let f = path.join('dist', u);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f,'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, {'content-type': T[path.extname(f)] ?? 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
await new Promise(r=>srv.listen(5149,r));
const browser = await chromium.launch({ args:['--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport:{width:1200,height:800} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5149');
await page.waitForTimeout(2500);
ok('la page se charge', await page.locator('.app-shell').count() === 1);
ok('menu complet', await page.locator('[data-tab]').count() >= 5);
await page.click('[data-tab="params"]');
await page.waitForTimeout(900);
const dispo = await page.locator('#sync-dispo').textContent();
ok('absence de synchronisation annoncée clairement', dispo.includes("n'est pas active"), dispo.trim().slice(0,58));
await page.click('[data-tab="tours"]');
await page.waitForTimeout(400);
await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
await page.waitForTimeout(2000);
const enCourse = await page.evaluate(() => !!window.__race && window.__race.riders.length > 0);
ok('la course démarre malgré tout', enCourse);
console.log('erreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,2) : 'aucune');
await browser.close(); srv.close();
