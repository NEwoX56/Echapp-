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
    const info = g.renderer.info;
    return {
      meshes, tris: Math.round(tris), ombres,
      draws: info.render.calls,
      trisRendus: info.render.triangles,
      aa: g.renderer.getContext().getContextAttributes().antialias,
      ratio: g.renderer.getPixelRatio(),
      q: g.qualitySettings
    };
  });
  console.log(`${label.padEnd(22)} ${String(r.draws).padStart(4)} draw calls · ${r.trisRendus.toLocaleString('fr-FR').padStart(9)} tri rendus · AA ${r.aa?'oui':'non '} · ratio ${r.ratio} · ombres ${r.q.shadows?r.ombres:'off'} · LOD ${r.q.distanceLod} m`);
  await ctx.close();
}
await browser.close(); await server.close();
