/**
 * Prépare la fonction de synchronisation pour un dépôt manuel sur Netlify.
 *
 * Deux précautions tirées d'une mise en ligne ratée :
 *
 *  1. Aucun package.json ne doit se retrouver dans le dossier déposé. Netlify
 *     y verrait un projet à compiler, lancerait une compilation qui échoue et
 *     ne publierait plus rien — le site entier renvoyait alors une erreur 404.
 *
 *  2. La fonction est empaquetée ici, dépendances comprises, en un seul
 *     fichier sans import externe. Un dépôt manuel n'installe rien : une
 *     fonction qui importerait un module ne démarrerait jamais.
 *
 * Si malgré tout la fonction n'est pas publiée, seul /api/sync répond 404 ;
 * le jeu le détecte, l'annonce dans les paramètres et reste utilisable.
 */
import { build } from 'esbuild';
import fs from 'fs';

await build({
  entryPoints: ['netlify/functions/sync.mts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/netlify/functions/sync.mjs',
  external: ['node:*'],
  logLevel: 'error'
});

fs.copyFileSync('netlify-deploy.toml', 'dist/netlify.toml');

const taille = fs.statSync('dist/netlify/functions/sync.mjs').size;
console.log(`  fonction de synchronisation empaquetée (${Math.round(taille / 1024)} Ko, sans dépendance)`);
if (fs.existsSync('dist/package.json')) {
  fs.rmSync('dist/package.json');
  console.log('  package.json retiré de dist : il ferait échouer le dépôt');
}
