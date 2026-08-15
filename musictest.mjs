import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5167 } });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.goto('http://localhost:5167');
await page.waitForTimeout(1000);

console.log('--- LES CINQ AMBIANCES ---');
for (const amb of ['menu','course','tension','finale','victoire']) {
  const r = await page.evaluate(async (a) => {
    const g = window.__game;
    await g.audio.resume();
    g.music.jouer(a);
    g.music.setIntensite(a === 'menu' ? 0.35 : 0.75);
    await new Promise(r=>setTimeout(r,1400));
    const ctx = g.audio.context;
    const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0;
    g.audio.musiqueBus.connect(an);
    const vals=[]; const freqs=new Float32Array(an.frequencyBinCount);
    let bandes=0;
    const t0=performance.now();
    while (performance.now()-t0<3200){
      const d=new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(d);
      let s=0; for(const v of d) s+=v*v;
      vals.push(Math.sqrt(s/d.length));
      an.getFloatFrequencyData(freqs);
      let b=0; for(const f of freqs) if(f>-90) b++;
      bandes=Math.max(bandes,b);
      await new Promise(r=>setTimeout(r,20));
    }
    an.disconnect();
    const sil=vals.filter(v=>v<0.002).length;
    let cur=0,mx=0; for(const v of vals){ if(v<0.002){cur++;mx=Math.max(mx,cur);} else cur=0; }
    return { moy: vals.reduce((x,y)=>x+y,0)/vals.length, max: Math.max(...vals), sil: 100*sil/vals.length, trou: mx*20, bandes, total: freqs.length };
  }, amb);
  const bon = r.moy > 0.008 && r.trou < 200;
  console.log(`  ${bon?'OK  ':'FAIL'} ${amb.padEnd(9)} RMS ${r.moy.toFixed(4)} (max ${r.max.toFixed(3)})  silence ${r.sil.toFixed(0)} %  trou ${r.trou} ms  ${r.bandes}/${r.total} bandes`);
}

console.log('\n--- EFFETS SONORES ---');
await page.evaluate(async () => {
  window.__game.music.jouer('aucune');
  await new Promise(r=>setTimeout(r,900));
});
const fx2 = await page.evaluate(async () => {
  const g = window.__game, ctx = g.audio.context;
  const an = ctx.createAnalyser(); an.fftSize=1024; an.smoothingTimeConstant=0;
  // brancher sur le bus effets par réflexion
  const bus = g.audio.effetsBus;
  if (!bus) return null;
  bus.connect(an);
  const pic = async (fn, ms=700) => {
    fn();
    let mx=0; const t0=performance.now();
    while(performance.now()-t0<ms){
      const d=new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      for(const v of d) mx=Math.max(mx,Math.abs(v));
      await new Promise(r=>setTimeout(r,15));
    }
    return mx;
  };
  return {
    bip: await pic(()=>g.audio.bip(false)),
    depart: await pic(()=>g.audio.bip(true)),
    cloche: await pic(()=>g.audio.cloche(), 1400),
    gorgee: await pic(()=>g.audio.gorgee()),
    sachet: await pic(()=>g.audio.sachet()),
    derailleur: await pic(()=>g.audio.derailleur()),
    acclamation: await pic(()=>g.audio.acclamation(1), 1400)
  };
});
if (fx2) for (const [k,v] of Object.entries(fx2)) {
  console.log(`  ${v>0.01?'OK  ':'FAIL'} ${k.padEnd(12)} crête ${v.toFixed(3)}`);
} else console.log('  (bus effets introuvable)');

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,2) : 'aucune');
await browser.close(); await server.close();
