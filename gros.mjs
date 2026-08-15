import { chromium } from 'playwright';
import { createServer } from 'vite';
import http from 'http';
const store = new Map(); let refus413 = 0;
const api = http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://x'); const id=(u.searchParams.get('id')??'').toLowerCase();
  const piste=(u.searchParams.get('piste')??'').toLowerCase(); const cle=piste?`${id}::${piste}`:id;
  const head={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-code'};
  if(req.method==='OPTIONS'){res.writeHead(204,head);return res.end();}
  if(req.method==='GET'){const e=store.get(cle); if(!e){res.writeHead(404,head);return res.end(JSON.stringify({ok:false,erreur:'absent'}));}
    const{code,...d}=e; res.writeHead(200,head); return res.end(JSON.stringify({ok:true,donnees:d}));}
  let body=''; for await(const c of req) body+=c;
  if(body.length > 6*1024*1024){ refus413++; res.writeHead(413,head); return res.end(JSON.stringify({ok:false,erreur:'Trop lourd'})); }
  store.set(cle,{...JSON.parse(body),code:req.headers['x-code']??''});
  res.writeHead(200,head); res.end(JSON.stringify({ok:true}));
});
await new Promise(r=>api.listen(5148,r));
const server = await createServer({ root: process.cwd(), server:{port:5147} });
await server.listen();
const browser = await chromium.launch({ args:['--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const ok=(l,c,x='')=>console.log(`${c?'  OK ':' FAIL'} ${l}${x?' — '+x:''}`);
const appareil = async () => {
  const ctx = await browser.newContext({ viewport:{width:1200,height:800} });
  const page = await ctx.newPage();
  await page.route('**/api/sync*', r => { const u=new URL(r.request().url()); return r.continue({url:`http://localhost:5148${u.pathname}${u.search}`}); });
  page.on('dialog', d => d.accept().catch(()=>{}));
  await page.goto('http://localhost:5147'); await page.waitForTimeout(1800);
  return { ctx, page };
};

console.log('--- PC : trois morceaux, 5,1 Mo bruts (~7 Mo encodés) ---');
const pc = await appareil();
await pc.page.click('[data-tab="params"]'); await pc.page.waitForTimeout(700);
for (const [amb, f] of [['course','gros-course'],['tension','gros-tension'],['finale','gros-finale']]) {
  await pc.page.locator(`[data-import="${amb}"]`).click();
  await pc.page.locator('#import-musique').setInputFiles(`/tmp/musique/${f}.wav`);
  await pc.page.waitForTimeout(1800);
}
const importes = await pc.page.evaluate(()=>window.__game.music.ambiancesFournies);
ok('trois morceaux importés', importes.length===3, importes.join(', '));

await pc.page.fill('#sync-id','montest'); await pc.page.fill('#sync-code','velo42');
await pc.page.click('[data-sync="envoyer"]');
await pc.page.waitForTimeout(14000);
const etat = await pc.page.locator('#sync-etat').textContent();
ok('envoi accepté malgré le volume', etat.includes('envoyée'), etat.trim().slice(0,70));
ok('aucun refus 413', refus413===0, `${refus413} refus`);
const cles=[...store.keys()];
ok('un enregistrement par morceau', cles.length===4, cles.join(', '));
const max=Math.max(...[...store.values()].map(v=>JSON.stringify(v).length));
ok('plus grosse requête sous 6 Mo', max < 6*1024*1024, `${(max/1048576).toFixed(2)} Mo`);

console.log('\n--- XBOX : récupération ---');
const xb = await appareil();
await xb.page.click('[data-tab="params"]'); await xb.page.waitForTimeout(700);
await xb.page.fill('#sync-id','montest'); await xb.page.fill('#sync-code','velo42');
await xb.page.click('[data-sync="recuperer"]');
await xb.page.waitForTimeout(14000);
const recu = await xb.page.evaluate(()=>({
  amb: window.__game.music.ambiancesFournies,
  noms: ['course','tension','finale'].map(a=>window.__game.music.bibliotheque.info(a)?.nom)
}));
ok('les trois morceaux récupérés', recu.amb.length===3, recu.noms.join(', '));

console.log('\n--- MORCEAU TROP LOURD ---');
await pc.page.locator('[data-import="menu"]').click();
await pc.page.locator('#import-musique').setInputFiles('/tmp/musique/enorme.wav');
await pc.page.waitForTimeout(2500);
await pc.page.click('[data-sync="envoyer"]');
await pc.page.waitForTimeout(16000);
const etat2 = await pc.page.locator('#sync-etat').textContent();
ok('le morceau trop lourd est écarté, pas l\'envoi entier', etat2.includes('envoyée') && etat2.includes('Non envoyé'), etat2.trim().slice(0,110));
ok('toujours aucun refus 413', refus413===0, `${refus413}`);

await browser.close(); await server.close(); api.close();
