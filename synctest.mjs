// Simule deux appareils : deux contextes de navigateur totalement séparés
// (stockage local et IndexedDB distincts), reliés par un serveur qui
// reproduit le contrat de la fonction Netlify.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import http from 'http';

const store = new Map();
const api = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const id = (u.searchParams.get('id') ?? '').toLowerCase();
  const piste = (u.searchParams.get('piste') ?? '').toLowerCase();
  const cle = piste ? `${id}::${piste}` : id;
  const head = { 'content-type': 'application/json', 'access-control-allow-origin': '*',
                 'access-control-allow-headers': 'content-type,x-code' };
  if (req.method === 'OPTIONS') { res.writeHead(204, head); return res.end(); }
  if (!/^[a-z0-9_-]{3,24}$/.test(id)) { res.writeHead(400, head); return res.end(JSON.stringify({ok:false,erreur:'Identifiant invalide'})); }
  if (req.method === 'GET') {
    const e = store.get(cle);
    if (!e) { res.writeHead(404, head); return res.end(JSON.stringify({ok:false,erreur:'Aucune sauvegarde'})); }
    const { code, ...d } = e;
    res.writeHead(200, head); return res.end(JSON.stringify({ ok:true, donnees:d }));
  }
  let body=''; for await (const c of req) body += c;
  const code = req.headers['x-code'] ?? '';
  // Netlify refuse au-delà de 6 Mo : on reproduit ce plafond pour vérifier
  // que le découpage passe bien sous la barre
  if (body.length > 6 * 1024 * 1024) { res.writeHead(413, head); return res.end(JSON.stringify({ok:false,erreur:'Trop lourd'})); }
  const ex = store.get(id);
  if (ex && ex.code && ex.code !== code) { res.writeHead(403, head); return res.end(JSON.stringify({ok:false,erreur:'Identifiant déjà pris'})); }
  store.set(cle, { ...JSON.parse(body), code });
  res.writeHead(200, head); return res.end(JSON.stringify({ ok:true }));
});
await new Promise(r => api.listen(5155, r));

const server = await createServer({ root: process.cwd(), server: { port: 5157 } });
await server.listen();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);

// rediriger /api/sync vers le serveur de test
const nouvelAppareil = async (nom, ua) => {
  const ctx = await browser.newContext(ua ? { userAgent: ua, viewport:{width:1280,height:800} } : { viewport:{width:1280,height:800} });
  const page = await ctx.newPage();
  await page.route('**/api/sync*', async (route) => {
    const u = new URL(route.request().url());
    await route.continue({ url: `http://localhost:5155${u.pathname}${u.search}` });
  });
  page.on('pageerror', e => console.log(`  [${nom}] ERR`, String(e).slice(0,120)));
  // les confirmations « remplacer la partie » sont acceptées automatiquement
  page.on('dialog', d => d.accept().catch(() => undefined));
  await page.goto('http://localhost:5157');
  await page.waitForTimeout(1800);
  return { ctx, page };
};

console.log('--- APPAREIL 1 : LE PC ---');
const pc = await nouvelAppareil('PC');
// personnaliser : peloton, nom, réglages, musique
await pc.page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  const ros = m.getRoster();
  m.setPatch(ros[0].id, { name: 'Tadej Pogačar', team: 'UAE Team Emirates' });
  m.setPatch(ros[1].id, { name: 'Jonas Vingegaard', team: 'Visma' });
  m.modifierStat(ros[0].id, 'climb', 97);
  const c = window.__career;
  c.save.name = 'Mony T.';
  c.save.team = 'UAE Team Emirates';
  c.save.difficulty = 'difficile';
  c.save.nomsCoureurs = false;
  c.save.appearance.jerseyPrimary = 0x2f9e5b;
  c.save.level = 7;
  c.persist();
});
// importer un morceau
await pc.page.locator('#import-musique').count().catch(()=>{});
await pc.page.click('[data-tab="params"]');
await pc.page.waitForTimeout(700);
await pc.page.locator('[data-import="course"]').click();
await pc.page.locator('#import-musique').setInputFiles('/tmp/musique/ma-musique-de-course.wav');
await pc.page.waitForTimeout(1500);
const etatPC = await pc.page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  return {
    noms: m.getRoster().slice(0,2).map(r=>r.name),
    climb: m.getRoster()[0].stats.climb,
    joueur: window.__career.save.name,
    equipe: window.__career.save.team,
    diff: window.__career.save.difficulty,
    niveau: window.__career.save.level,
    musique: window.__game.music.ambiancesFournies
  };
});
console.log('    état PC :', etatPC.noms.join(', '), '| niveau', etatPC.niveau, '| musique', etatPC.musique.join(','));

// envoyer
await pc.page.fill('#sync-id', 'Pogacar2000');
await pc.page.fill('#sync-code', 'velo42');
await pc.page.click('[data-sync="envoyer"]');
await pc.page.waitForTimeout(3500);
const envoi = await pc.page.locator('#sync-etat').textContent();
ok('envoi réussi', envoi.includes('envoyée'), envoi.trim());
ok('identifiant normalisé en minuscules', store.has('pogacar2000'), [...store.keys()].join(','));
const paquet = store.get('pogacar2000');
ok('musique stockée à part', store.has('pogacar2000::course'), store.get('pogacar2000::course')?.nom);
ok('partie référençant la piste', (paquet?.pistes ?? []).includes('course'), JSON.stringify(paquet?.pistes));
const tailles = [...store.entries()].map(([k,v]) => [k, JSON.stringify(v).length]);
ok('chaque requête sous le plafond de 6 Mo', tailles.every(([,t]) => t < 6*1024*1024),
   tailles.map(([k,t]) => `${k.split('::')[1] ?? 'partie'} ${(t/1024).toFixed(0)} Ko`).join(', '));

console.log('\n--- APPAREIL 2 : LA XBOX (stockage vierge) ---');
const xbox = await nouvelAppareil('Xbox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edge/120');
const avant = await xbox.page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  return { noms: m.getRoster().slice(0,2).map(r=>r.name), joueur: window.__career.save.name, musique: window.__game.music.ambiancesFournies.length };
});
ok('la Xbox part bien d\'une partie vierge', avant.joueur === 'Jules Ceyrat' && avant.musique === 0, `${avant.noms[0]}, ${avant.joueur}`);

// mauvais code : doit être refusé
await xbox.page.click('[data-tab="params"]');
await xbox.page.waitForTimeout(700);
await xbox.page.fill('#sync-id', 'pogacar2000');
await xbox.page.fill('#sync-code', 'mauvais');
await xbox.page.click('[data-sync="envoyer"]');
await xbox.page.waitForTimeout(1500);
const refus = await xbox.page.locator('#sync-etat').textContent();
ok('un autre code ne peut pas écraser le compte', refus.includes('déjà pris'), refus.trim().slice(0,50));

// récupérer avec le bon code
await xbox.page.fill('#sync-code', 'velo42');
await xbox.page.click('[data-sync="recuperer"]');
await xbox.page.waitForTimeout(4000);
const etatXbox = await xbox.page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  return {
    noms: m.getRoster().slice(0,2).map(r=>r.name),
    climb: m.getRoster()[0].stats.climb,
    joueur: window.__career.save.name,
    equipe: window.__career.save.team,
    diff: window.__career.save.difficulty,
    niveau: window.__career.save.level,
    maillot: window.__career.save.appearance.jerseyPrimary,
    noms3d: window.__career.save.nomsCoureurs,
    musique: window.__game.music.ambiancesFournies,
    infoMusique: window.__game.music.bibliotheque.info('course')
  };
});
ok('noms des coureurs identiques', JSON.stringify(etatXbox.noms) === JSON.stringify(etatPC.noms), etatXbox.noms.join(', '));
ok('statistiques identiques', etatXbox.climb === 97, `montagne ${etatXbox.climb}`);
ok('nom du joueur', etatXbox.joueur === 'Mony T.', etatXbox.joueur);
ok('équipe du joueur', etatXbox.equipe === 'UAE Team Emirates', etatXbox.equipe);
ok('niveau et carrière', etatXbox.niveau === 7, `niveau ${etatXbox.niveau}`);
ok('réglages (difficulté, noms 3D, maillot)', etatXbox.diff === 'difficile' && etatXbox.noms3d === false && etatXbox.maillot === 0x2f9e5b);
ok('musique transférée', etatXbox.musique.includes('course'), etatXbox.infoMusique?.nom ?? 'aucune');
ok('même fichier audio', etatXbox.infoMusique?.nom === 'ma-musique-de-course.wav');

console.log('\n--- PERSISTANCE SUR LA XBOX ---');
await xbox.page.reload();
await xbox.page.waitForTimeout(2200);
const apresReload = await xbox.page.evaluate(async () => {
  const m = await import('/src/data/rosterStore.ts');
  return { nom: m.getRoster()[0].name, joueur: window.__career.save.name, musique: window.__game.music.ambiancesFournies };
});
ok('tout survit au rechargement', apresReload.nom === 'Tadej Pogačar' && apresReload.joueur === 'Mony T.' && apresReload.musique.includes('course'));

console.log('\n--- IDENTIFIANT INCONNU ---');
await xbox.page.click('[data-tab="params"]');
await xbox.page.waitForTimeout(600);
await xbox.page.fill('#sync-id', 'inconnu999');
await xbox.page.click('[data-sync="recuperer"]');
await xbox.page.waitForTimeout(1500);
const inconnu = await xbox.page.locator('#sync-etat').textContent();
ok('message clair si l\'identifiant n\'existe pas', inconnu.includes('Aucune sauvegarde'), inconnu.trim().slice(0,44));

await browser.close(); await server.close(); api.close();
