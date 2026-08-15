import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5146 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5146');
await page.waitForTimeout(1600);

// simule une étape entière en relevant l'écart tout du long
const courir = (stage) => page.evaluate(async ({stage}) => {
  const g = window.__game;
  const c = g.career;
  c.save.tour.currentStage = stage;
  const ids = Object.keys(c.save.tour.gc);
  ids.forEach((id,i) => { c.save.tour.gc[id] = 9000 + i*40; });
  c.persist();
  g.menu.render();
  document.querySelector('[data-action="play"]').click();
  await new Promise(r=>setTimeout(r,350));
  document.querySelector('[data-action="partir"]')?.click();
  await new Promise(r=>setTimeout(r,600));
  const race = window.__race;
  race.countdown = 0;
  const p = race.player;
  const releves = [];
  let garde = 0;
  while (!race.isOver && garde < 60000) {
    // pilotage simple et identique pour toutes les étapes
    const rem = race.track.length - p.dist;
    if (rem < 700) { p.sprinting = p.energy > 8; p.effort = 1; }
    else p.effort = 0.66;
    race.update(0.02);
    if (garde % 250 === 0) {
      const s = race.hudState();
      releves.push({
        prog: +(p.dist/race.track.length).toFixed(2),
        n: s.course.tailleEchappee,
        ecart: Math.round(s.course.ecart),
        phase: s.course.phase,
        chasse: s.course.chasse,
        devant: s.course.joueurDevant
      });
    }
    garde++;
  }
  const rows = race.getResults();
  return {
    releves,
    stage: race.stage.name,
    type: race.stage.type,
    pos: rows.findIndex(x=>x.isPlayer)+1,
    vainqueur: rows[0].name,
    /*
     * On mesure l'écart AVANT le final, pas au dernier relevé : dans les
     * derniers mètres le joueur sprinte et se détache lui-même du peloton,
     * ce qui rouvre un écart sans rapport avec l'échappée du jour.
     */
    ecartFinal: (() => {
      const avantFinal = releves.filter(r => r.prog >= 0.82 && r.prog <= 0.93);
      return avantFinal.length ? Math.min(...avantFinal.map(r => r.ecart)) : 0;
    })()
  };
}, {stage});

console.log('--- ÉTAPE DE PLAINE : le peloton doit reprendre ---');
const plaine = await courir(0);
console.log(`    ${plaine.stage} (${plaine.type})`);
const maxP = Math.max(...plaine.releves.map(r=>r.ecart));
const echP = plaine.releves.filter(r=>r.n>0).length;
ok('une échappée se forme', echP > 0, `${Math.max(...plaine.releves.map(r=>r.n))} coureurs devant`);
ok('l\'écart monte puis redescend', maxP > 20, `écart maxi ${maxP} s`);
ok('la chasse se déclenche', plaine.releves.some(r=>r.chasse));
ok('reprise avant l\'arrivée', plaine.ecartFinal < 12, `écart final ${plaine.ecartFinal} s`);
console.log('    courbe de l\'écart :');
console.log('      ' + plaine.releves.filter((_,i)=>i%2===0).map(r=>`${Math.round(r.prog*100)}%:${r.ecart}s`).join('  '));

console.log('\n--- ÉTAPE DE MONTAGNE : l\'échappée peut aller au bout ---');
await page.evaluate(()=>{ const r=window.__race; if(r) { r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02);} });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000}).catch(()=>{});
await page.click('[data-action="continue"]').catch(()=>{});
await page.waitForTimeout(600);
const mont = await courir(3);
console.log(`    ${mont.stage} (${mont.type})`);
const maxM = Math.max(...mont.releves.map(r=>r.ecart));
ok('échappée en montagne aussi', mont.releves.some(r=>r.n>0), `écart maxi ${maxM} s`);
console.log('    courbe de l\'écart :');
console.log('      ' + mont.releves.filter((_,i)=>i%2===0).map(r=>`${Math.round(r.prog*100)}%:${r.ecart}s`).join('  '));

console.log('\n--- LE JOUEUR PART DANS L\'ÉCHAPPÉE ---');
await page.evaluate(()=>{ const r=window.__race; if(r){ r.player.dist=r.track.length-5; for(let i=0;i<400;i++) r.update(0.02);} });
await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000}).catch(()=>{});
await page.click('[data-action="continue"]').catch(()=>{});
await page.waitForTimeout(600);
const essaiAttaque = async (stats, label) => {
  await page.evaluate((st) => { window.__statsTest = st; }, stats);
  const r = await page.evaluate(async () => {
  const g = window.__game, c = g.career;
  c.save.tour.currentStage = 0;
  Object.keys(c.save.tour.gc).forEach((id,i)=>{ c.save.tour.gc[id] = 9000 + i*40; });
  c.persist(); g.menu.render();
  document.querySelector('[data-action="play"]').click();
  await new Promise(r=>setTimeout(r,350));
  document.querySelector('[data-action="partir"]')?.click();
  await new Promise(r=>setTimeout(r,600));
  const race = window.__race; race.countdown = 0;
  const p = race.player;
  p.stats = window.__statsTest;
  const releves = []; let garde = 0; let devantVu = false; let ecartMax = 0;
  while (!race.isOver && garde < 60000) {
    const prog = p.dist / race.track.length;
    // attaque franche au début, puis on tient
    if (prog < 0.06) p.effort = 1;
    else if (p.energy > 30) p.effort = 0.86;
    else p.effort = 0.6;
    if (p.energy < 55 && p.bidons > 0) p.drinkBidon();
    race.update(0.02);
    const s = race.hudState();
    if (s.course.joueurDevant) devantVu = true;
    ecartMax = Math.max(ecartMax, s.course.ecart);
    if (garde % 400 === 0) releves.push({ prog: +prog.toFixed(2), devant: s.course.joueurDevant, n: s.course.tailleEchappee, ecart: Math.round(s.course.ecart) });
    garde++;
  }
  const rows = race.getResults();
  return { devantVu, ecartMax: Math.round(ecartMax), releves, pos: rows.findIndex(x=>x.isPlayer)+1, total: rows.length, energie: Math.round(p.energy) };
  });
  console.log(`  ${label.padEnd(22)} ${r.devantVu?'part devant':'reste dans le peloton'} · écart maxi ${r.ecartMax}s · ${r.pos}e/${r.total} · énergie finale ${r.energie}%`);
  // revenir au menu pour l'essai suivant
  await page.waitForFunction(()=>!document.getElementById('screen-results').classList.contains('hidden'),null,{timeout:15000}).catch(()=>{});
  await page.click('[data-action="continue"]').catch(()=>{});
  await page.waitForTimeout(600);
  return r;
};

const debutant = await essaiAttaque({flat:55,climb:55,sprint:55,endurance:55}, 'débutant (55)');
const confirme = await essaiAttaque({flat:72,climb:70,sprint:70,endurance:74}, 'confirmé (72)');
const elite = await essaiAttaque({flat:92,climb:88,sprint:80,endurance:94}, 'élite (92)');
const attaque = elite;
ok('le joueur peut rejoindre l\'échappée', elite.devantVu);
ok('un débutant ne tient pas seul devant', debutant.pos > 3, `${debutant.pos}e`);
ok('un coureur élite est récompensé', elite.pos <= 6, `${elite.pos}e — l'échappée solitaire est devenue plus dure maintenant que les IA se ravitaillent`);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
