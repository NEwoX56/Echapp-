import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'fs';
import { execSync } from 'child_process';

/*
 * Ce test vérifie la musique déposée dans public/audio/. Il fabrique lui-même
 * ses fichiers et les retire à la fin : dépendre de fichiers laissés par une
 * exécution précédente rendait le résultat imprévisible.
 */
fs.mkdirSync('public/audio', { recursive: true });
const faireWav = (chemin, freqs, sec = 3, sr = 22050) => {
  const n = Math.floor(sr * sec);
  const d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    for (const f of freqs) v += Math.sin(2 * Math.PI * f * t);
    v /= freqs.length;
    const env = Math.min(1, t / 0.1, (sec - t) / 0.1);
    d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * env)) * 20000), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  fs.writeFileSync(chemin, Buffer.concat([h, d]));
};
faireWav('public/audio/course.wav', [220, 277, 330]);
faireWav('public/audio/finale.wav', [294, 370, 440]);
void execSync;
const server = await createServer({ root: process.cwd(), server: { port: 5165 } });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await page.goto('http://localhost:5165');
await page.waitForTimeout(1800);

console.log('--- DÉTECTION DES FICHIERS ---');
const det = await page.evaluate(() => window.__game.music.ambiancesFournies);
ok('fichiers du joueur détectés', det.length === 2, det.join(', '));
ok('course et finale reconnus', det.includes('course') && det.includes('finale'));
const absent = await page.evaluate(() => window.__game.music.fournie.aFichier('menu'));
ok('menu correctement absent', absent === false);

console.log('\n--- ARBITRAGE FICHIER / GÉNÉRÉ ---');
const arb = await page.evaluate(async () => {
  const g = window.__game;
  await g.audio.resume();
  const out = {};
  for (const a of ['menu','course','tension','finale','victoire']) {
    g.music.jouer(a);
    await new Promise(r=>setTimeout(r,300));
    out[a] = g.music.sourceCourante;
  }
  return out;
});
for (const [a,src] of Object.entries(arb)) {
  const attendu = (a === 'course' || a === 'finale') ? 'fichier' : 'generee';
  console.log(`  ${src===attendu?'OK  ':'FAIL'} ${a.padEnd(9)} → ${src}`);
}

console.log('\n--- LECTURE RÉELLE ---');
const sig = await page.evaluate(async () => {
  const g = window.__game, ctx = g.audio.context;
  g.music.jouer('course');
  await new Promise(r=>setTimeout(r,2200));
  const an = ctx.createAnalyser(); an.fftSize=1024; an.smoothingTimeConstant=0;
  g.audio.musiqueBus.connect(an);
  const vals=[];
  const t0=performance.now();
  while(performance.now()-t0<3000){
    const d=new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
    let s=0; for(const v of d) s+=v*v;
    vals.push(Math.sqrt(s/d.length));
    await new Promise(r=>setTimeout(r,20));
  }
  const el = g.music.fournie.pistes.get('course')?.element;
  return {
    moy: vals.reduce((a,b)=>a+b,0)/vals.length,
    sil: 100*vals.filter(v=>v<0.002).length/vals.length,
    joue: el ? !el.paused : false,
    boucle: el ? el.loop : false,
    fichier: el ? el.src.split('/').pop() : null
  };
});
ok('le fichier joue', sig.joue === true, sig.fichier ?? '');
ok('lecture en boucle', sig.boucle === true);
ok('signal audible', sig.moy > 0.01, `RMS ${sig.moy.toFixed(4)}, silence ${sig.sil.toFixed(0)} %`);

console.log('\n--- FONDU ENCHAÎNÉ ET NON-SUPERPOSITION ---');
const fondu = await page.evaluate(async () => {
  const g = window.__game;
  g.music.jouer('course');
  await new Promise(r=>setTimeout(r,1200));
  g.music.jouer('finale');
  await new Promise(r=>setTimeout(r,400));
  const c = g.music.fournie.pistes.get('course');
  const f = g.music.fournie.pistes.get('finale');
  const enCours = { course: c?.gain.gain.value ?? 0, finale: f?.gain.gain.value ?? 0 };
  await new Promise(r=>setTimeout(r,2200));
  const apres = { course: c?.gain.gain.value ?? 0, finale: f?.gain.gain.value ?? 0, coursePause: c?.element.paused };
  return { enCours, apres };
});
ok('les deux pistes se croisent pendant le fondu', fondu.enCours.course > 0.05 && fondu.enCours.finale > 0.02,
   `course ${fondu.enCours.course.toFixed(2)} / finale ${fondu.enCours.finale.toFixed(2)}`);
ok('ancienne piste coupée après le fondu', fondu.apres.course < 0.02 && fondu.apres.coursePause === true,
   `course ${fondu.apres.course.toFixed(3)}, en pause ${fondu.apres.coursePause}`);
ok('nouvelle piste à plein volume', fondu.apres.finale > 0.9, fondu.apres.finale.toFixed(2));

const gen = await page.evaluate(() => window.__game.music.generee.ambiance);
ok('générateur en veille quand un fichier joue', gen === 'aucune', gen);

console.log('\n--- AFFICHAGE ---');
await page.click('[data-tab="params"]');
await page.waitForTimeout(600);
const pistes = await page.locator('.piste').count();
const fournies = await page.locator('.piste.fournie').count();
ok('5 ambiances listées', pistes === 5, `${pistes}`);
ok('2 marquées comme fournies', fournies === 2, `${fournies}`);

console.log('\nerreurs JS:', errs.filter(e=>!e.includes('fonts.g')).length ? errs.slice(0,3) : 'aucune');
await browser.close(); await server.close();
for (const f of ['course', 'finale']) fs.rmSync(`public/audio/${f}.wav`, { force: true });
