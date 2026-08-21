import type { Periode, Meteo, StageDef } from '../data/types';

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

/** petit générateur déterministe, indépendant de celui utilisé pour le reste du parcours */
function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Réglages d'atmosphère d'une étape. Sur les quelques étapes où l'heure ou la
 * météo sont écrites dans les données (flavor text assorti, ex. « Grand
 * départ à l'aube »), on les respecte telles quelles. Partout ailleurs, un
 * tirage déterministe (à partir de la graine de l'étape, donc toujours le
 * même pour une étape donnée) en choisit une : sans ça, l'écrasante majorité
 * des étapes tombait sur le réglage par défaut « jour, sec » et la météo
 * n'existait presque jamais en pratique, même si le système marchait.
 */
export function atmosphereDeEtape(stage: StageDef): ReglagesAtmosphere {
  const rand = seededRand(stage.seed + 4001);

  let periode = stage.periode;
  if (!periode) {
    const t = rand();
    periode = t < 0.42 ? 'jour' : t < 0.6 ? 'aube' : t < 0.78 ? 'crepuscule' : 'nuit';
  }
  let meteo = stage.meteo;
  if (!meteo) {
    meteo = rand() < 0.3 ? 'pluie' : 'sec';
  }
  return atmosphereDe(periode, meteo);
}
