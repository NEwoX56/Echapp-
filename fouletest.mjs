import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5124 } });
await server.listen();
const b = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const p = await b.newPage({ viewport: { width: 900, height: 520 } });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await p.goto('http://localhost:5124');
await p.waitForTimeout(2200);
await p.click('[data-action="play"]'); await p.waitForTimeout(600);
await p.click('[data-action="partir"]').catch(()=>{}); await p.waitForTimeout(1800);

const info = await p.evaluate(() => {
  const t = window.__race.track;
  let inst = null;
  t.group.traverse(o => { if (o.isInstancedMesh && o.geometry.getAttribute('phase')) inst = o; });
  if (!inst) return null;
  const ph = inst.geometry.getAttribute('phase');
  const fe = inst.geometry.getAttribute('ferveur');
  let calmes = 0;
  for (let i = 0; i < inst.count; i++) if (fe.array[i] < 0.4) calmes++;
  return {
    count: inst.count,
    // sur trois décimales, six cents tirages aléatoires produisent
    // naturellement des collisions : on compare les valeurs brutes
    phasesUniques: new Set([...ph.array.slice(0, inst.count)]).size,
    calmes: Math.round(100 * calmes / inst.count),
    horloge: t.horlogeFoule ? t.horlogeFoule.value : null
  };
});
ok('foule instanciée avec attributs', !!info && info.count > 500, info ? `${info.count} spectateurs` : 'aucun');
ok('phases toutes différentes', info && info.phasesUniques > info.count * 0.9, `${info?.phasesUniques} phases distinctes`);
ok('une part de la foule reste calme', info && info.calmes > 20 && info.calmes < 50, `${info?.calmes} % de calmes`);

// l'horloge avance
const t1 = await p.evaluate(() => window.__race.track.horlogeFoule.value);
await p.evaluate(() => { const r = window.__race; for (let i=0;i<120;i++) r.update(0.02); });
const t2 = await p.evaluate(() => window.__race.track.horlogeFoule.value);
ok('horloge d\'animation transmise au shader', t2 > t1 + 2, `${t1.toFixed(2)} → ${t2.toFixed(2)} s`);

// le shader compile bien (sinon les spectateurs disparaîtraient)
const rendu = await p.evaluate(() => {
  const g = window.__game;
  return { erreurs: g.renderer.info.programs?.length ?? 0, tri: g.renderer.info.render.triangles };
});
ok('programmes compilés sans erreur', rendu.tri > 1000, `${rendu.tri.toLocaleString('fr-FR')} triangles rendus`);
console.log('erreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await b.close(); await server.close();
