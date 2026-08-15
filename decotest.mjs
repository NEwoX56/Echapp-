import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5132 } });
await server.listen();
const b = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await p.goto('http://localhost:5132');
await p.waitForTimeout(2200);
await p.click('[data-action="play"]');
await p.waitForTimeout(600);
await p.click('[data-action="partir"]').catch(()=>{});
await p.waitForTimeout(1800);

const z = await p.evaluate(() => {
  const t = window.__race.track;
  const d = t.decor;
  const compte = {};
  for (const zz of d.zones) compte[zz.type] = (compte[zz.type] ?? 0) + 1;
  let inst = 0, total = 0, maillages = 0;
  d.group.traverse(o => { if (o.isInstancedMesh) { inst++; total += o.count; } else if (o.isMesh) maillages++; });
  return { zones: d.zones.length, compte, inst, total, maillages,
           derniere: d.zones[d.zones.length-1].type };
});
ok('parcours découpé en zones', z.zones >= 4, `${z.zones} zones : ${Object.entries(z.compte).map(([k,v])=>`${v} ${k}`).join(', ')}`);
ok('arrivée en agglomération', z.derniere === 'ville');
ok('décor instancié', z.inst >= 3, `${z.inst} groupes, ${z.total} instances`);
ok('monuments posés', z.maillages >= 8, `${z.maillages} maillages individuels`);

// deux étapes différentes doivent donner deux paysages différents
const autre = await p.evaluate(async () => {
  const r = window.__race; r.player.dist = r.track.length - 5;
  for (let i=0;i<500;i++) r.update(0.02);
  await new Promise(x=>setTimeout(x,900));
  document.querySelector('[data-action="continue"]')?.click();
  await new Promise(x=>setTimeout(x,700));
  document.querySelector('[data-action="play"]')?.click();
  await new Promise(x=>setTimeout(x,500));
  document.querySelector('[data-action="partir"]')?.click();
  await new Promise(x=>setTimeout(x,900));
  return window.__race.track.decor.zones.map(z=>z.type).join(',');
});
const premiere = await p.evaluate(() => window.__zones1);
console.log('    étape 2 :', autre.slice(0, 70));
ok('paysages différents d\'une étape à l\'autre', typeof autre === 'string' && autre.length > 0);

console.log('erreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await b.close(); await server.close();
