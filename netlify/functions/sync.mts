import { getStore } from '@netlify/blobs';

/**
 * Synchronisation entre appareils.
 *
 * Une fonction serveur est indispensable ici : deux appareils ne peuvent pas
 * se transmettre des données sans un point commun accessible aux deux. Il
 * n'y a en revanche pas de base de données à administrer — Netlify Blobs est
 * un simple stockage clé-valeur fourni avec l'hébergement, sans configuration
 * et sans compte supplémentaire.
 *
 * Le modèle est volontairement minimal : un identifiant choisi par le joueur
 * sert de clé, et un code personnel protège l'écriture. Ce n'est pas de
 * l'authentification au sens strict, et c'est assumé — il s'agit de retrouver
 * ses réglages sur un autre écran, pas de garder un secret.
 *
 * Les données sont découpées : la partie elle-même d'un côté, chaque morceau
 * de musique de l'autre. Netlify plafonne une requête à 6 Mo, et une
 * sauvegarde avec cinq morceaux encodés en base64 dépasse largement ce seuil.
 * Un envoi monolithique se faisait refuser avec un code 413.
 *
 * API :
 *   GET  /api/sync?id=pogacar2000               → partie (sans musique)
 *   POST /api/sync?id=pogacar2000               → écrit la partie
 *   GET  /api/sync?id=pogacar2000&piste=course  → un morceau
 *   POST /api/sync?id=pogacar2000&piste=course  → écrit un morceau
 *   DELETE même adresse                          → efface un morceau
 *   Entête X-Code : code personnel, requis en écriture
 */

/** marge sous le plafond de 6 Mo imposé par la plateforme */
const LIMITE_OCTETS = 4.5 * 1024 * 1024;
const PISTES = ['menu', 'course', 'tension', 'finale', 'victoire'];
const ID_VALIDE = /^[a-z0-9_-]{3,24}$/;

function reponse(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,x-code',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    }
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return reponse({ ok: true });

  const url = new URL(req.url);
  const id = (url.searchParams.get('id') ?? '').trim().toLowerCase();
  const piste = (url.searchParams.get('piste') ?? '').trim().toLowerCase();

  if (piste && !PISTES.includes(piste)) {
    return reponse({ ok: false, erreur: 'Piste inconnue' }, 400);
  }
  if (!ID_VALIDE.test(id)) {
    return reponse(
      { ok: false, erreur: "Identifiant invalide : 3 à 24 caractères, lettres, chiffres, tiret ou souligné" },
      400
    );
  }

  let store;
  try {
    store = getStore({ name: 'echappee-saves', consistency: 'strong' });
  } catch {
    return reponse({ ok: false, erreur: 'Stockage indisponible sur ce site' }, 503);
  }

  const cle = piste ? `${id}::${piste}` : id;

  if (req.method === 'GET') {
    const brut = await store.get(cle, { type: 'json' });
    if (!brut) {
      return reponse(
        { ok: false, erreur: piste ? 'Morceau absent' : 'Aucune sauvegarde pour cet identifiant' },
        404
      );
    }
    // le code n'est jamais renvoyé : il ne sert qu'à comparer côté serveur
    const { code, ...donnees } = brut as Record<string, unknown>;
    void code;
    return reponse({ ok: true, donnees });
  }

  if (req.method === 'DELETE') {
    const codeSup = (req.headers.get('x-code') ?? '').trim();
    const ref = (await store.get(id, { type: 'json' })) as Record<string, unknown> | null;
    if (ref && ref.code && ref.code !== codeSup) {
      return reponse({ ok: false, erreur: 'Code personnel incorrect' }, 403);
    }
    await store.delete(cle);
    return reponse({ ok: true });
  }

  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode non gérée' }, 405);

  const code = (req.headers.get('x-code') ?? '').trim();
  if (code.length < 4) {
    return reponse({ ok: false, erreur: 'Code personnel trop court (4 caractères minimum)' }, 400);
  }

  const texte = await req.text();
  if (texte.length > LIMITE_OCTETS) {
    return reponse(
      {
        ok: false,
        erreur: piste
          ? `Morceau trop lourd (${(texte.length / 1048576).toFixed(1)} Mo). Prends un fichier de moins de 3 Mo.`
          : `Sauvegarde trop lourde (${(texte.length / 1048576).toFixed(1)} Mo)`
      },
      413
    );
  }

  let donnees: Record<string, unknown>;
  try {
    donnees = JSON.parse(texte);
  } catch {
    return reponse({ ok: false, erreur: 'Contenu illisible' }, 400);
  }

  // le code de référence est toujours celui de la partie, jamais celui d'une
  // piste : sans cela un morceau envoyé en premier fixerait le code du compte
  const existant = (await store.get(id, { type: 'json' })) as Record<string, unknown> | null;
  if (existant && existant.code && existant.code !== code) {
    return reponse(
      { ok: false, erreur: 'Cet identifiant est déjà pris, avec un autre code personnel' },
      403
    );
  }

  await store.setJSON(cle, { ...donnees, code, maj: new Date().toISOString() });
  return reponse({ ok: true, maj: new Date().toISOString() });
}

export const config = { path: '/api/sync' };
