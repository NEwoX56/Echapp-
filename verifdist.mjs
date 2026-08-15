// Contrôle avant livraison : le dossier déposé ne doit rien contenir qui
// pousse Netlify à tenter une compilation.
import fs from 'fs';
import path from 'path';
let souci = 0;
const dire = (ok, txt) => { console.log(`  ${ok ? 'OK  ' : 'ALERTE'} ${txt}`); if (!ok) souci++; };

dire(!fs.existsSync('dist/package.json'), 'aucun package.json (sinon Netlify compile et le site tombe en 404)');
dire(!fs.existsSync('dist/package-lock.json'), 'aucun package-lock.json');
dire(!fs.existsSync('dist/node_modules'), 'aucun node_modules');
dire(fs.existsSync('dist/index.html'), 'index.html présent');

const toml = fs.existsSync('dist/netlify.toml') ? fs.readFileSync('dist/netlify.toml','utf8') : '';
dire(!/\[build\]/.test(toml), 'netlify.toml sans section [build]');
dire(!/command\s*=/.test(toml), 'netlify.toml sans commande de compilation');

const fn = 'dist/netlify/functions/sync.mjs';
if (fs.existsSync(fn)) {
  const src = fs.readFileSync(fn, 'utf8');
  const imports = [...src.matchAll(/^import .* from ['"]([^'"]+)['"]/gm)].map(m => m[1]);
  const externes = imports.filter(i => !i.startsWith('node:'));
  dire(externes.length === 0, `fonction sans import externe${externes.length ? ' : ' + externes.join(', ') : ''}`);
  dire(src.includes('/api/sync'), 'chemin /api/sync déclaré');
} else {
  dire(false, 'fonction absente');
}

// taille totale
let total = 0;
const parcourir = (d) => { for (const e of fs.readdirSync(d, {withFileTypes:true})) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) parcourir(p); else total += fs.statSync(p).size; } };
parcourir('dist');
console.log(`\n  poids du dossier : ${(total/1048576).toFixed(2)} Mo`);
process.exit(souci ? 1 : 0);
