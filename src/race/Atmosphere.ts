import type { Periode, Meteo } from '../data/types';

/**
 * Lumière et brume selon l'heure et la météo de l'étape.
 *
 * Pas de nouvelle photo de ciel : le panorama existant (Sky.ts) reste le
 * même par type d'étape, seule l'intensité de son affichage change. C'est la
 * lumière directionnelle (le « soleil »), la brume et l'ambiance générale qui
 * font la différence — un simple bloc de réglages, sans texture
 * supplémentaire à charger.
 */

export interface ReglagesAtmosphere {
  soleilCouleur: number;
  soleilIntensite: number;
  /** position du soleil, en unités relatives au coureur */
  soleilPos: [number, number, number];
  hemisphereCiel: number;
  hemisphereSol: number;
  hemisphereIntensite: number;
  /** multiplicateur appliqué à scene.backgroundIntensity (1 = photo pleine intensité) */
  fondIntensite: number;
  /** teinte mélangée à la couleur de brume habituelle, et sa force 0..1 */
  brumeTeinte: number;
  brumeMelange: number;
  /** brume plus proche et plus dense sous la pluie */
  brumeLointain: number;
  pluie: boolean;
}

const JOUR: ReglagesAtmosphere = {
  soleilCouleur: 0xfff2d0,
  soleilIntensite: 2.4,
  soleilPos: [38, 62, -30],
  hemisphereCiel: 0xfff6e0,
  hemisphereSol: 0x4a5240,
  hemisphereIntensite: 0.85,
  fondIntensite: 1,
  brumeTeinte: 0xffffff,
  brumeMelange: 0,
  brumeLointain: 1500,
  pluie: false
};

export function atmosphereDe(periode: Periode = 'jour', meteo: Meteo = 'sec'): ReglagesAtmosphere {
  let r: ReglagesAtmosphere = JOUR;

  if (periode === 'aube') {
    r = {
      ...r,
      soleilCouleur: 0xffb877,
      soleilIntensite: 2.0,
      soleilPos: [66, 20, -14],
      hemisphereCiel: 0xffd9c2,
      hemisphereSol: 0x39392f,
      hemisphereIntensite: 0.7,
      fondIntensite: 0.85,
      brumeTeinte: 0xffb87a,
      brumeMelange: 0.4
    };
  } else if (periode === 'crepuscule') {
    r = {
      ...r,
      soleilCouleur: 0xff8a4d,
      soleilIntensite: 1.9,
      soleilPos: [-58, 16, 36],
      hemisphereCiel: 0xffb98a,
      hemisphereSol: 0x2e2117,
      hemisphereIntensite: 0.6,
      fondIntensite: 0.55,
      brumeTeinte: 0xff7a42,
      brumeMelange: 0.55
    };
  } else if (periode === 'nuit') {
    r = {
      ...r,
      soleilCouleur: 0x93aad8,
      soleilIntensite: 0.55,
      soleilPos: [22, 90, -12],
      hemisphereCiel: 0x2b3550,
      hemisphereSol: 0x121319,
      hemisphereIntensite: 0.32,
      fondIntensite: 0.12,
      brumeTeinte: 0x151a2c,
      brumeMelange: 0.6
    };
  }

  if (meteo === 'pluie') {
    r = {
      ...r,
      soleilCouleur: blend(r.soleilCouleur, 0x9aa6b2, 0.75),
      soleilIntensite: r.soleilIntensite * 0.4,
      hemisphereCiel: blend(r.hemisphereCiel, 0x8c95a0, 0.6),
      hemisphereIntensite: r.hemisphereIntensite * 0.65,
      // la brume ne mord pas sur la photo de fond (skybox) : sans baisser
      // franchement son intensité, un ciel d'orage resterait bleu et éclatant
      fondIntensite: r.fondIntensite * 0.28,
      brumeTeinte: blend(r.brumeTeinte, 0x828e99, r.brumeMelange > 0 ? 0.5 : 1),
      brumeMelange: Math.max(r.brumeMelange, 0.65),
      brumeLointain: Math.min(r.brumeLointain, 550),
      pluie: true
    };
  }

  return r;
}

/** couleur de brume finale : la teinte de base (par type d'étape) mélangée à la teinte d'ambiance */
export function brumeFinale(base: number, r: ReglagesAtmosphere): number {
  return blend(base, r.brumeTeinte, r.brumeMelange);
}

export function blend(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255,
    ag = (a >> 8) & 255,
    ab = a & 255;
  const br = (b >> 16) & 255,
    bg = (b >> 8) & 255,
    bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
