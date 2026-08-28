/**
 * Assets Higgsfield pré-générés, livrés avec l'application.
 *
 * Ils garantissent que ScanFood est complet dès le premier lancement,
 * sans clé API : générique d'intro, vidéos de victoire et de couronnement
 * de repli, photos éditoriales pour la home et les états vides.
 *
 * `npm run higgsfield:prefetch` télécharge ces fichiers dans
 * `public/higgsfield/` ; l'application préfère alors la copie locale.
 * Voir README « Assets Higgsfield ».
 */

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_37cd3iMaUaDVkLLC8LfIDDLehK1';

export interface CuratedAsset {
  /** Nom du fichier local une fois `higgsfield:prefetch` exécuté. */
  file: string;
  /** URL CDN d'origine (repli si le fichier local est absent). */
  remote: string;
}

export const CURATED = {
  intro: { file: 'intro.mp4', remote: `${CDN}/hf_20260828_112857_fb8ab10f-7938-49e8-8805-dbcb2f272bc4.mp4` },
  victory: { file: 'victory.mp4', remote: `${CDN}/hf_20260828_112857_4b2b452d-9943-42e1-9781-1b09462c002a.mp4` },
  coronation: { file: 'coronation.mp4', remote: `${CDN}/hf_20260828_112857_186189d0-a507-4b4a-b51f-81fe331520b1.mp4` },
} satisfies Record<string, CuratedAsset>;

/** Photos éditoriales réutilisées en arrière-plans sobres (overlay crème). */
export const EDITORIAL = {
  couverts: { file: 'couverts.png', remote: `${CDN}/hf_20260828_112918_bce09c00-0386-4970-91a1-db49ac6348c6.png` },
  frigo: { file: 'frigo.png', remote: `${CDN}/hf_20260828_112918_f5f43bd5-59f1-4dd5-beb9-17f1b261ffe0.png` },
  ingredients: { file: 'ingredients.png', remote: `${CDN}/hf_20260828_112918_a49bb5d2-a82a-4228-913a-4c4cb372fdf4.png` },
  rayon: { file: 'rayon.png', remote: `${CDN}/hf_20260828_112918_f67189a6-106f-4c35-8097-dc8f30215978.png` },
  verre: { file: 'verre.png', remote: `${CDN}/hf_20260828_112918_88ec0644-7add-4d98-84bd-443585f3d555.png` },
  pain: { file: 'pain.png', remote: `${CDN}/hf_20260828_112918_30c9a7b0-309d-4961-918c-8ace31fe9028.png` },
} satisfies Record<string, CuratedAsset>;

export type EditorialKey = keyof typeof EDITORIAL;

export function editorialUrl(key: EditorialKey): string {
  return EDITORIAL[key].remote;
}
