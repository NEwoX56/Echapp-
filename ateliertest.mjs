import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 5191 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 880 } });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
const ok = (l, c, x='') => { console.log(`${c ? '  OK ' : ' FAIL'} ${l}${x ? ' — ' + x : ''}`); if(!c) process.exitCode = 1; };
await page.goto('http://localhost:5191');
await page.waitForTimeout(1000);

console.log('\n--- ONGLET TEST ---');
await page.click('[data-tab="test"]');
await page.waitForTimeout(300);
ok('quatre ateliers', await page.locator('.test-onglet').count() === 4);
ok('énergie illimitée par défaut', await page.locator('[data-test-fatigue="oui"].active').count() === 1);

console.log('\n--- GÉNÉRATEUR ---');
await page.click('[data-test-onglet="decrire"]');
await page.waitForTimeout(200);
const lecture = await page.evaluate(async () => {
  const m = await import('/src/data/generateur.ts');
  const cas = [
    ['une étape de montagne avec arrivée au sommet', 'montagne'],
    ['un chrono court et nerveux', 'clm'],
    ['une étape de plaine pour les sprinteurs', 'plaine'],
    ['un parcours vallonné plein de bosses', 'vallonnee']
  ];
  const types = cas.map(([t, attendu]) => [m.analyser(t).type, attendu]);
  const nuit = m.analyser('une étape de nuit sous la pluie au bord de la mer dans le sud');
  const e = m.genererEtape('une étape de montagne au bord de la mer, la nuit, arrivée au sommet');
  const tour = m.genererTour('un grand tour de montagne', 7);
  const croissant = e.profile.every((p, i) => i === 0 || p[0] > e.profile[i - 1][0]);
  const colsSurMontee = (e.climbs ?? []).every((c) => {
    const i = e.profile.findIndex((p) => p[0] === c.at);
    return i > 0 && e.profile[i][1] > e.profile[i - 1][1];
  });
  return {
    types, nuit: { p: nuit.periode, m: nuit.meteo, mer: nuit.mer, b: nuit.biome },
    e: { type: e.type, mer: e.mer, periode: e.periode, cols: (e.climbs ?? []).length,
         debut: e.profile[0][0], fin: e.profile[e.profile.length - 1][0], croissant, colsSurMontee,
         sommet: e.profile[e.profile.length - 1][1] >= e.profile[e.profile.length - 2][1] },
    tour: { n: tour.stages.length, types: tour.stages.map(s => s.type).join(','),
            ids: new Set(tour.stages.map(s => s.id)).size,
            seeds: new Set(tour.stages.map(s => s.seed)).size }
  };
});
for (const [obtenu, attendu] of lecture.types) ok(`type lu : ${attendu}`, obtenu === attendu, obtenu);
ok('nuit + pluie + mer + sud lus ensemble',
  lecture.nuit.p === 'nuit' && lecture.nuit.m === 'pluie' && lecture.nuit.mer && lecture.nuit.b === 'mediterraneen',
  JSON.stringify(lecture.nuit));
ok('profil bien formé (0 → 1, strictement croissant)',
  lecture.e.debut === 0 && lecture.e.fin === 1 && lecture.e.croissant);
ok('chaque col tombe sur une montée', lecture.e.colsSurMontee, `${lecture.e.cols} col(s)`);
ok('arrivée au sommet : la route ne redescend pas', lecture.e.sommet);
ok('tour généré : 7 étapes, ids et graines uniques',
  lecture.tour.n === 7 && lecture.tour.ids === 7 && lecture.tour.seeds === 7, lecture.tour.types);

console.log('\n--- CRÉATEUR ---');
await page.click('[data-test-onglet="creer"]');
await page.waitForTimeout(250);
ok('aperçu de profil affiché', await page.locator('.test-carte svg').count() >= 1);
await page.click('[data-creer-type="montagne"]'); await page.waitForTimeout(200);
await page.click('[data-creer-bascule="sommet"]'); await page.waitForTimeout(200);
await page.click('[data-action="creer-enregistrer"]'); await page.waitForTimeout(300);
const nbCrees = await page.evaluate(async () => (await import('/src/data/creations.ts')).creations.etapes().length);
ok('étape enregistrée dans les créations', nbCrees === 1, `${nbCrees} étape(s)`);
ok('onglet Mes créations à jour', (await page.locator('[data-test-onglet="creations"]').textContent()).includes('(1)'));

console.log('\n--- VOL LIBRE ---');
await page.click('[data-test-onglet="rouler"]'); await page.waitForTimeout(250);
await page.click('[data-action="test-atelier"]');
await page.waitForTimeout(2500);
const vol = await page.evaluate(() => {
  const r = window.__race;
  return { volLibre: r.volLibre, countdown: r.countdown, seul: r.riders.length };
});
ok('la séance démarre en vol libre', vol.volLibre === true);
ok('aucun décompte en exploration', vol.countdown <= 0);
ok('seul sur la route', vol.seul === 1, `${vol.seul} coureur`);
ok('panneau atelier visible', await page.locator('#screen-atelier .atl-flanc').isVisible());
ok('HUD de course masqué', await page.locator('#screen-hud').isHidden());
ok('palette d’objets présente', await page.locator('.atl-modele').count() >= 4);

console.log('\n--- SIMULATION GELÉE ---');
const gel = await page.evaluate(() => {
  const r = window.__race;
  const avant = { d: r.player.dist, c: r.clock ?? 0 };
  for (let i = 0; i < 300; i++) r.update(0.02);
  return { bouge: Math.abs(r.player.dist - avant.d), fini: r.isOver };
});
ok('le coureur n’avance pas pendant le vol', gel.bouge < 0.001, `${gel.bouge.toFixed(4)} m`);
ok('l’étape ne se termine pas toute seule', gel.fini === false);

console.log('\n--- POSE D’OBJETS ---');
const pose = await page.evaluate(() => {
  const r = window.__race;
  r.allerA(r.track.length * 0.3, 22);
  const types = ['chene', 'maison', 'phare', 'eolienne', 'vache'];
  let poses = 0;
  for (const t of types) {
    r.atelierType = t;
    r.atelierEchelle = 1 + Math.random();
    for (let k = 0; k < 4; k++) {
      r.allerA(r.track.length * (0.2 + Math.random() * 0.6), 18 + Math.random() * 14);
      if (r.poserIci()) poses++;
    }
  }
  const liste = r.objetsPoses();
  const dansLeMonde = [];
  r.track.objets.group.traverse((o) => { if (o.isInstancedMesh) dansLeMonde.push([o.name, o.count]); });
  const total = dansLeMonde.reduce((a, x) => a + x[1], 0);
  const bornes = liste.every(o => o.dist >= 0 && o.dist <= r.track.length && Math.abs(o.lat) < 400);
  r.annulerDernierObjet();
  const apresAnnule = r.nombreObjets;
  return { poses, n: liste.length, total, lots: dansLeMonde.length, bornes, apresAnnule,
           types: [...new Set(liste.map(o => o.type))].length };
});
ok('objets posés', pose.poses >= 15, `${pose.poses} poses réussies`);
ok('un lot d’instances par modèle', pose.lots === pose.types, `${pose.lots} lots / ${pose.types} modèles`);
ok('compteurs d’instances cohérents', pose.total === pose.n, `${pose.total} instances / ${pose.n} objets`);
ok('positions dans les bornes du parcours', pose.bornes);
ok('annulation du dernier objet', pose.apresAnnule === pose.n - 1);

console.log('\n--- MANETTE ---');
const pad = await page.evaluate(() => {
  const r = window.__race;
  r.atelierType = 'chene';
  const suite = [];
  for (let i = 0; i < 3; i++) { r.changerModele(1); suite.push(r.atelierType); }
  r.changerModele(-3);
  const retour = r.atelierType;
  r.allerA(r.track.length * 0.5, 20);
  const avant = r.nombreObjets;
  const pose = r.poserIci();
  return { suite, retour, pose, delta: r.nombreObjets - avant };
});
ok('LB/RB parcourt le catalogue', new Set(pad.suite).size === 3, pad.suite.join(' → '));
ok('le cycle revient sur ses pas', pad.retour === 'chene', pad.retour);
ok('pose à la manette', pad.pose && pad.delta === 1);
await page.waitForTimeout(200);
const synchro = await page.evaluate(() => {
  const r = window.__race;
  r.atelierType = 'phare';
  r.atelierEchelle = 2.5;
  return true;
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__game && null);
await page.waitForTimeout(600);
const actif = await page.locator('.atl-modele.active').getAttribute('data-atl-modele');
ok('la palette suit le modèle choisi hors panneau', actif === 'phare', String(actif));
ok('la catégorie a suivi', (await page.locator('.atl-cat.active').textContent()).trim() === 'Bâtiments');
await page.evaluate(() => { window.__race.annulerDernierObjet(); });

console.log('\n--- ENREGISTREMENT DES OBJETS ---');
await page.click('[data-atl="enregistrer"]');
await page.waitForTimeout(500);
const sauve = await page.evaluate(async () => {
  const { creations } = await import('/src/data/creations.ts');
  const avecObjets = creations.etapes().filter(e => (e.objets ?? []).length > 0);
  return { n: avecObjets.length, objets: avecObjets[0]?.objets?.length ?? 0, id: avecObjets[0]?.id };
});
ok('objets enregistrés dans une création', sauve.n === 1, `${sauve.objets} objet(s)`);
ok('le compte inclut la pose manette', sauve.objets === 19, String(sauve.objets));

console.log('\n--- RETOUR AU VÉLO ---');
const retour = await page.evaluate(() => {
  const r = window.__race;
  r.basculerVolLibre();
  const avant = r.player.dist;
  for (let i = 0; i < 200; i++) r.update(0.02);
  return { vol: r.volLibre, avance: r.player.dist - avant, energie: r.player.energy, fringale: r.player.bonking };
});
ok('retour au vélo', retour.vol === false);
ok('le coureur roule à nouveau', retour.avance > 5, `${retour.avance.toFixed(1)} m`);
ok('énergie restée pleine', retour.energie >= 99.9, retour.energie.toFixed(1));

console.log('\n--- RECHARGEMENT D’UNE CRÉATION MEUBLÉE ---');
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await page.click('[data-tab="test"]').catch(()=>{});
await page.waitForTimeout(300);
await page.click('[data-test-onglet="creations"]');
await page.waitForTimeout(300);
const carte = await page.locator('.test-carte').count();
ok('créations listées', carte >= 1, `${carte} carte(s)`);
await page.locator(`[data-cre-explorer="${sauve.id}"]`).click();
await page.waitForTimeout(2500);
const recharge = await page.evaluate(() => {
  const r = window.__race;
  let n = 0;
  r.track.objets.group.traverse(o => { if (o.isInstancedMesh) n += o.count; });
  return { n, stock: r.nombreObjets, vol: r.volLibre };
});
ok('objets rechargés avec le parcours', recharge.n === recharge.stock && recharge.n > 0, `${recharge.n} objets`);
ok('exploration relancée', recharge.vol === true);

console.log('\n--- ERREURS ---');
ok('aucune erreur JS', errs.length === 0, errs.slice(0, 3).join(' | '));

await page.screenshot({ path: 'atelier.png' });
await browser.close();
await server.close();
