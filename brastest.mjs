import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5126 } });
await server.listen();
const b = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
await p.goto('http://localhost:5126');
await p.waitForTimeout(2000);
await p.click('[data-action="play"]'); await p.waitForTimeout(600);
await p.click('[data-action="partir"]').catch(()=>{}); await p.waitForTimeout(1500);

const r = await p.evaluate(() => {
  const race = window.__race, pl = race.player;
  race.countdown = 0;
  const mesure = (standing, cel) => {
    pl.standing = standing; pl.celebration = cel; pl.effort = 0.7;
    for (let i=0;i<10;i++) race.update(0.02);
    const g = pl.visual.group;
    g.updateMatrixWorld(true);
    const art = pl.visual.articulations;
    if (!art) return null;
    // la main est à 0,28 sous le coude ; le point de saisie est dans le
    // repère du vélo, donc dans celui du groupe du coureur
    const ecarts = art.coudes.map((coude, i) => {
      const m = coude.matrixWorld.clone();
      // on reconstruit le point sans dépendre de THREE côté page
      const e = m.elements;
      const main = { x: -0.28 * e[4] + e[12], y: -0.28 * e[5] + e[13], z: -0.28 * e[6] + e[14] };
      // passage du monde vers le repère du coureur par la matrice inverse
      const inv = g.matrixWorld.clone().invert().elements;
      const lx = main.x * inv[0] + main.y * inv[4] + main.z * inv[8] + inv[12];
      const ly = main.x * inv[1] + main.y * inv[5] + main.z * inv[9] + inv[13];
      const lz = main.x * inv[2] + main.y * inv[6] + main.z * inv[10] + inv[14];
      void lx;
      const c = art.cintre[i];
      return Math.hypot(lz - c.z, ly - c.y);
    });
    // portée du bras contre distance réelle épaule → cintre
    const ep = art.epaules[0];
    const em = ep.matrixWorld.elements;
    const inv = g.matrixWorld.clone().invert().elements;
    const wx = em[12], wy = em[13], wz = em[14];
    const sy = wx*inv[1] + wy*inv[5] + wz*inv[9] + inv[13];
    const sz = wx*inv[2] + wy*inv[6] + wz*inv[10] + inv[14];
    const c = art.cintre[0];
    return {
      ecarts: ecarts.map(e => +e.toFixed(3)),
      epaule: [+sy.toFixed(3), +sz.toFixed(3)],
      cintre: [+c.y.toFixed(3), +c.z.toFixed(3)],
      distance: +Math.hypot(sz - c.z, sy - c.y).toFixed(3),
      portee: 0.56
    };
  };
  return { assis: mesure(0, 0), danseuse: mesure(1, 0), fete: mesure(0, 1) };
});
console.log(JSON.stringify(r));
await b.close(); await server.close();
