import * as THREE from 'three';

/**
 * Niveaux de qualité.
 *
 * Le jeu tourne aussi bien sur un PC de bureau que dans le navigateur d'une
 * console ou sur un portable modeste. Ces machines n'ont ni la même mémoire
 * vidéo ni le même support des extensions WebGL, et certaines échouent
 * silencieusement — écran blanc, aucune erreur JavaScript — quand on leur
 * demande une génération PMREM ou des ombres douces.
 *
 * Plutôt que de viser le plus petit dénominateur commun, on détecte ce que
 * la machine sait faire et on désactive ce qui est risqué.
 */

export type Quality = 'auto' | 'elevee' | 'moyenne' | 'basse';

export interface QualitySettings {
  /** ombres portées */
  shadows: boolean;
  resolutionOmbres: number;
  /** panorama photo en fond de scène */
  cielTexture: boolean;
  /** panorama utilisé comme environnement (reflets) — coûteux, PMREM */
  environnement: boolean;
  /** densité de la foule, 0..1 */
  densiteFoule: number;
  /** distance de bascule vers le modèle simplifié de coureur */
  distanceLod: number;
  /** limite de pixel ratio */
  pixelRatioMax: number;
  antialias: boolean;
  /** finesse du maillage de terrain : mètres entre deux points */
  pasTerrain: number;
  /** segments du ruban de route */
  segmentsRoute: number;
  /** distance au-delà de laquelle un coureur ne projette plus d'ombre */
  distanceOmbre: number;
  /** n'actualiser la carte d'ombres qu'une frame sur n */
  intervalleOmbre: number;
  /** rochers et arbres : diviseur de densité */
  densiteDecor: number;
}

const PRESETS: Record<Exclude<Quality, 'auto'>, QualitySettings> = {
  elevee: {
    shadows: true,
    resolutionOmbres: 1024,
    cielTexture: true,
    environnement: true,
    densiteFoule: 1,
    distanceLod: 34,
    pixelRatioMax: 2,
    antialias: true,
    pasTerrain: 9,
    segmentsRoute: 520,
    distanceOmbre: 60,
    intervalleOmbre: 1,
    densiteDecor: 1
  },
  moyenne: {
    shadows: true,
    resolutionOmbres: 512,
    cielTexture: true,
    environnement: false,
    densiteFoule: 0.6,
    distanceLod: 20,
    pixelRatioMax: 1.15,
    antialias: false,
    pasTerrain: 15,
    segmentsRoute: 320,
    distanceOmbre: 26,
    intervalleOmbre: 2,
    densiteDecor: 0.7
  },
  basse: {
    shadows: false,
    resolutionOmbres: 512,
    cielTexture: true,
    environnement: false,
    densiteFoule: 0.3,
    distanceLod: 12,
    pixelRatioMax: 0.85,
    antialias: false,
    pasTerrain: 24,
    segmentsRoute: 200,
    distanceOmbre: 0,
    intervalleOmbre: 3,
    densiteDecor: 0.45
  }
};

export interface Capabilities {
  /** textures flottantes filtrables : nécessaires à la génération PMREM */
  floatLineaire: boolean;
  maxTexture: number;
  /** navigateur d'une console de salon */
  console: boolean;
  mobile: boolean;
  renderer: string;
}

/**
 * Détection sommaire, faite AVANT la création du renderer.
 *
 * L'antialiasing se fixe à la construction du contexte WebGL et ne peut plus
 * être changé ensuite. Il faut donc savoir avant si l'on est sur une machine
 * modeste — c'est le réglage le plus coûteux du lot, et il était jusqu'ici
 * activé pour tout le monde.
 */
export function detecterPlateforme(): { console: boolean; mobile: boolean } {
  const ua = navigator.userAgent;
  return {
    console: /Xbox|PlayStation|Nintendo/i.test(ua),
    mobile: /Android|iPhone|iPad|iPod/i.test(ua)
  };
}

/** antialias souhaité pour une préférence donnée, avant tout contexte WebGL */
export function antialiasSouhaite(pref: Quality): boolean {
  if (pref === 'elevee') return true;
  if (pref === 'moyenne' || pref === 'basse') return false;
  const p = detecterPlateforme();
  return !p.console && !p.mobile;
}

export function detectCapabilities(gl: THREE.WebGLRenderer): Capabilities {
  const ctx = gl.getContext();
  const ext = gl.extensions;
  const floatLineaire =
    !!ext.get('OES_texture_float_linear') || !!ext.get('OES_texture_half_float_linear');
  const maxTexture = ctx.getParameter(ctx.MAX_TEXTURE_SIZE) as number;

  const ua = navigator.userAgent;
  // Edge sur Xbox s'identifie par "Xbox" ; les autres consoles suivent
  const consoleUA = /Xbox|PlayStation|Nintendo/i.test(ua);
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua);

  let renderer = 'inconnu';
  try {
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    if (dbg) renderer = String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
  } catch {
    /* extension indisponible */
  }

  return { floatLineaire, maxTexture, console: consoleUA, mobile, renderer };
}

/** choisit un preset adapté à la machine */
export function resolveQuality(pref: Quality, caps: Capabilities): QualitySettings {
  let level: Exclude<Quality, 'auto'>;
  if (pref !== 'auto') {
    level = pref;
  } else if (caps.console) {
    // le navigateur des consoles dispose de peu de mémoire vidéo et échoue
    // souvent sur la génération PMREM : on reste prudent par défaut
    level = 'moyenne';
  } else if (caps.mobile || caps.maxTexture < 4096) {
    level = 'moyenne';
  } else {
    level = 'elevee';
  }

  const s = { ...PRESETS[level] };
  // l'environnement exige des textures flottantes filtrables, sans quoi la
  // génération PMREM peut produire un rendu vide sans lever d'erreur
  if (!caps.floatLineaire) s.environnement = false;
  if (caps.maxTexture < 2048) s.cielTexture = false;
  return s;
}

export function qualityLabel(q: Quality): string {
  switch (q) {
    case 'elevee':
      return 'Élevée';
    case 'moyenne':
      return 'Moyenne';
    case 'basse':
      return 'Basse';
    default:
      return 'Automatique';
  }
}
