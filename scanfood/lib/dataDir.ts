import 'server-only';

import path from 'node:path';

/**
 * Emplacement du magasin fichier et du cache Higgsfield.
 *
 * Sur Netlify et Vercel, le répertoire de l'application est monté en
 * lecture seule : seul `/tmp` est inscriptible. On y bascule donc
 * automatiquement, sans quoi la première écriture lèverait `EROFS`.
 *
 * Cette persistance reste **non durable** : `/tmp` appartient au conteneur
 * de la fonction, qui est recyclé sans prévenir. C'est un filet de
 * sécurité pour que rien ne casse, pas un substitut à `DATABASE_URL`.
 */
export const IS_SERVERLESS = Boolean(process.env.NETLIFY || process.env.VERCEL);

export const DATA_DIR =
  process.env.SCANFOOD_DATA_DIR ||
  (IS_SERVERLESS ? '/tmp/scanfood-data' : path.join(process.cwd(), '.data'));

let warned = false;

/** Avertit une seule fois quand on tourne sans base de données en production. */
export function warnEphemeralStorage(): void {
  if (warned || process.env.NODE_ENV !== 'production' || process.env.DATABASE_URL) return;
  warned = true;
  console.warn(
    '[ScanFood] Aucune DATABASE_URL : les scans, favoris, combats et tournois ' +
      'sont écrits dans un dossier temporaire et disparaîtront sans prévenir. ' +
      'Configure une base Postgres pour une persistance réelle.',
  );
}
