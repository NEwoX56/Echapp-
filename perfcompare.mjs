import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5158 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const UA_XBOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edge/120';

for (const [label, q, ua] of [
  ['PC élevée', 'elevee', null],
  ['Xbox auto (moyenne)', 'auto', UA_XBOX],
  ['Xbox basse', 'basse', UA_XBOX]
]) {
  const ctx = await browser.newContext(ua ? { userAgent: ua, viewport:{width:1280,height:720} } : { viewport:{width:1280,height:720} });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5158');
  await page.waitForTimeout(1400);
  if (q !== 'auto') {
    await page.evaluate((qq) => { const c=window.__career; c.save.quality=qq; c.persist(); }, q);
    await page.reload();
    await page.waitForTimeout(1600);
  }
  await page.click('[data-action="play"]');
await page.waitForTimeout(500);
await page.click('[data-action="partir"]').catch(()=>{});
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => {
    const race = window.__race, g = window.__game;
    let meshes=0, tris=0, ombres=0;
    race.scene.traverse(o => {
      if (o.isMesh || o.isInstancedMesh) {
        meshes++;
        if (o.castShadow) ombres++;
        const gg=o.geometry;
        const n = gg?.index ? gg.index.count/3 : (gg?.attributes?.position?.count ?? 0)/3;
        tris += n * (o.count || 1);
      }
    });
    // avec le post-traitement (bloom/vignette), une frame déclenche plusieurs
    // renderer.render() internes au composer — chacun remet à zéro
    // renderer.info au démarrage. On les cumule sur un cycle complet, sans
    // quoi on ne lit que la toute dernière passe (le carré plein écran final).
    let draws = 0, trisRendus = 0;
    if (g.postfx) {
      const orig = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        orig(...args);
        draws += g.renderer.info.render.calls;
        trisRendus += g.renderer.info.render.triangles;
      };
      g.postfx.render(race.scene, race.camera);
      g.renderer.render = orig;
    } else {
      g.renderer.render(race.scene, race.camera);
      draws = g.renderer.info.render.calls;
      trisRendus = g.renderer.info.render.triangles;
    }
    return {
      meshes, tris: Math.round(tris), ombres,
      draws,
      trisRendus,
      aa: g.renderer.getContext().getContextAttributes().antialias,
      ratio: g.renderer.getPixelRatio(),
      q: g.qualitySettings
    };
  });
  console.log(`${label.padEnd(22)} ${String(r.draws).padStart(4)} draw calls · ${r.trisRendus.toLocaleString('fr-FR').padStart(9)} tri rendus · AA ${r.aa?'oui':'non '} · ratio ${r.ratio} · ombres ${r.q.shadows?r.ombres:'off'} · LOD ${r.q.distanceLod} m`);
  await ctx.close();
}
await browser.close(); await server.close();
