import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5218 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function ouvrir(tour, idx) {
  await page.goto('http://localhost:5218');
  await page.waitForTimeout(700);
  await page.evaluate(({ tour, idx }) => {
    const c = window.__career;
    c.save.level = 99;
    c.selectTour(tour);
    c.save.tour.currentStage = idx;
    for (const k of Object.keys(c.save.tour.gc)) c.save.tour.gc[k] = 3000;
    c.persist(); window.__menu.render();
  }, { tour, idx });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-action="play"]')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-action="partir"]')?.click());
  await page.waitForTimeout(600);
}

const cas = [
  ['cimes', 3, 'Mont Cendré (vide en montagne)'],
  ['littoral', 0, 'Digue de Kerantec (mer)'],
  ['littoral', 1, "Falaises d'Argent (mer)"],
  ['couronne', 3, 'Col de Bramefont (vide)']
];

for (const [tour, idx, nom] of cas) {
  await ouvrir(tour, idx);
  const r = await page.evaluate(async () => {
    const T = await import('/src/_probe.ts');
    const THREE = T.THREE;
    const track = window.__race.track;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const axe = new THREE.Vector3(), tanv = new THREE.Vector3();

    const table = [];
    for (let d = 0; d <= track.length; d += 8) {
      const q = new THREE.Vector3();
      track.pose(d, 0, q);
      table.push({ d, x: q.x, z: q.z });
    }

    let total = 0, dansVide = 0, dansEau = 0;
    let pireVide = 0, pireEau = 0;

    track.group.traverse((o) => {
      if (!o.isInstancedMesh) return;
      const n = Math.min(o.count, 120);
      for (let i = 0; i < n; i++) {
        o.getMatrixAt(Math.floor((i / n) * o.count), m);
        p.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
        let best = null;
        for (const e of table) {
          const dd = (e.x - p.x) ** 2 + (e.z - p.z) ** 2;
          if (!best || dd < best.dd) best = { dd, d: e.d };
        }
        track.pose(best.d, 0, axe, tanv);
        const rx = -tanv.z, rz = tanv.x, nn = Math.hypot(rx, rz) || 1;
        const lat = ((p.x - axe.x) * rx + (p.z - axe.z) * rz) / nn;
        total++;
        if (Math.abs(lat) <= 20) continue;
        const cote = Math.sign(lat);
        if (track.coteVide !== 0 && cote === track.coteVide) {
          dansVide++;
          pireVide = Math.max(pireVide, Math.abs(lat));
        }
        if (track.coteMer !== 0 && cote === track.coteMer) {
          dansEau++;
          pireEau = Math.max(pireEau, Math.abs(lat));
        }
      }
    });
    return {
      objetsExamines: total,
      poseDansLeVide: dansVide,
      poseDansLEau: dansEau,
      coteVide: track.coteVide,
      coteMer: track.coteMer
    };
  });
  console.log(`${nom.padEnd(34)} ${JSON.stringify(r)}`);
}
console.log('\nerreurs JS:', errors.length ? errors.join(' | ') : 'aucune');
await browser.close();
await server.close();
