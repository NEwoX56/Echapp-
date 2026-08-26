import type {
  StageDef,
  StageType,
  ClimbDef,
  SprintDef,
  PaveDef,
  VentDef,
  Periode,
  Meteo,
  Biome
} from './types';
import { nouvelId } from './creations';

/**
 * Générateur de parcours à partir d'une phrase.
 *
 * « Une étape de montagne au bord de la mer, sous la pluie, avec un final
 * en côte. » Le texte est lu, les intentions en sont extraites, et le reste
 * est tiré au sort de façon cohérente : un col se termine par une descente,
 * une étape de plaine ne monte pas à deux cents mètres, une arrivée au
 * sommet ne redescend pas.
 *
 * Ce n'est pas un modèle de langue — c'est un lecteur de mots-clés, et c'est
 * précisément ce qu'il faut ici : la réponse est immédiate, hors ligne, et
 * toujours jouable.
 */

/* ------------------------------------------------------------------ */
/* lecture de la demande                                              */
/* ------------------------------------------------------------------ */

export interface Intentions {
  type: StageType;
  mer: boolean;
  biome: Biome;
  paves: boolean;
  vent: boolean;
  periode?: Periode;
  meteo?: Meteo;
  /** multiplicateur de longueur, 1 = étape standard */
  longueur: number;
  /** distance affichée imposée par le texte, si un nombre de km y figure */
  km?: number;
  /** l'arrivée se juge au sommet */
  arriveeSommet: boolean;
  /** l'étape se termine par un sprint massif */
  finalSprint: boolean;
  /** mots-clés reconnus, affichés au joueur pour qu'il comprenne la lecture */
  reconnus: string[];
}

/** retire accents et ponctuation : « Pyrénées » et « pyrenees » se valent */
function normaliser(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ');
}

const MOTS = {
  montagne: ['montagne', 'montagnes', 'col', 'cols', 'alpe', 'alpes', 'pyrenee', 'pyrenees',
    'sommet', 'altitude', 'grimpe', 'grimpeur', 'ascension', 'cime', 'pic', 'haute', 'lacet',
    'lacets', 'massif', 'dolomite', 'dolomites', 'ventoux', 'galibier', 'tourmalet'],
  clm: ['chrono', 'contre la montre', 'clm', 'prologue', 'seul face', 'contre-la-montre'],
  vallonnee: ['vallonn', 'vallonne', 'colline', 'collines', 'coteau', 'coteaux', 'puncheur',
    'ardenne', 'ardennes', 'mur ', 'murs', 'bosse', 'bosses', 'accidente', 'raidillon'],
  plaine: ['plat', 'plate', 'plaine', 'roulant', 'roulante', 'sprint', 'sprinteur', 'sprinteurs',
    'massif sprint'],
  mer: ['mer', 'cote', 'cotier', 'cotiere', 'littoral', 'plage', 'ocean', 'baie', 'ile',
    'maritime', 'rivage', 'falaise'],
  sud: ['sud', 'mediterranee', 'mediterraneen', 'provence', 'olivier', 'oliviers', 'soleil',
    'chaleur', 'desert', 'aride', 'palmier', 'palmiers', 'italie', 'espagne', 'grece',
    'sicile', 'andalousie', 'garrigue'],
  paves: ['pave', 'paves', 'roubaix', 'flandre', 'flandres', 'enfer', 'secteur', 'secteurs',
    'trouee', 'arenberg'],
  vent: ['vent', 'vents', 'bordure', 'bordures', 'rafale', 'rafales', 'bourrasque', 'expose',
    'exposee', 'tempete'],
  nuit: ['nuit', 'nocturne', 'nocturnes', 'etoile', 'etoiles', 'lune', 'obscurite'],
  aube: ['aube', 'matin', 'matinale', 'lever', 'aurore', 'petit matin'],
  crepuscule: ['crepuscule', 'soir', 'soiree', 'coucher', 'couchant', 'fin de journee'],
  pluie: ['pluie', 'orage', 'averse', 'averses', 'mouille', 'mouillee', 'deluge', 'humide',
    'trempe', 'detrempe'],
  court: ['court', 'courte', 'bref', 'breve', 'prologue', 'nerveux', 'nerveuse'],
  long: ['long', 'longue', 'marathon', 'interminable', 'fleuve', 'epique'],
  sommet: ['arrivee au sommet', 'arrivee en altitude', 'final en cote', 'final en montee',
    'monte finale', 'montee finale', 'arrivee en haut'],
  finalSprint: ['sprint massif', 'sprint final', 'arrivee au sprint', 'emballage']
};

function contient(t: string, liste: readonly string[], trouves: string[]): boolean {
  let ok = false;
  for (const m of liste) {
    if (t.includes(m)) {
      ok = true;
      if (!trouves.includes(m)) trouves.push(m);
    }
  }
  return ok;
}

export function analyser(texte: string): Intentions {
  const t = ` ${normaliser(texte)} `;
  const reconnus: string[] = [];

  const estMontagne = contient(t, MOTS.montagne, reconnus);
  const estClm = contient(t, MOTS.clm, reconnus);
  const estVallonnee = contient(t, MOTS.vallonnee, reconnus);
  const estPlaine = contient(t, MOTS.plaine, reconnus);

  /*
   * Une même phrase peut évoquer plusieurs terrains (« un chrono en côte »).
   * On tranche par ordre de spécificité : le chrono impose le format, la
   * montagne impose le profil, le vallonné vient ensuite, la plaine par
   * défaut.
   */
  let type: StageType = 'plaine';
  if (estClm) type = 'clm';
  else if (estMontagne) type = 'montagne';
  else if (estVallonnee) type = 'vallonnee';
  else if (estPlaine) type = 'plaine';

  const mer = contient(t, MOTS.mer, reconnus);
  const sud = contient(t, MOTS.sud, reconnus);
  const paves = contient(t, MOTS.paves, reconnus);
  const vent = contient(t, MOTS.vent, reconnus);

  let periode: Periode | undefined;
  if (contient(t, MOTS.nuit, reconnus)) periode = 'nuit';
  else if (contient(t, MOTS.aube, reconnus)) periode = 'aube';
  else if (contient(t, MOTS.crepuscule, reconnus)) periode = 'crepuscule';

  const meteo: Meteo | undefined = contient(t, MOTS.pluie, reconnus) ? 'pluie' : undefined;

  let longueur = 1;
  if (contient(t, MOTS.court, reconnus)) longueur = 0.72;
  if (contient(t, MOTS.long, reconnus)) longueur = 1.32;

  // « 180 km » dans la phrase fixe la distance affichée
  const mKm = t.match(/(\d{2,3})\s*(km|kilometre)/);
  const km = mKm ? Math.min(320, Math.max(15, parseInt(mKm[1], 10))) : undefined;

  return {
    type,
    mer,
    biome: sud ? 'mediterraneen' : 'tempere',
    paves,
    vent,
    periode,
    meteo,
    longueur,
    km,
    arriveeSommet: contient(t, MOTS.sommet, reconnus) || (estMontagne && t.includes('arrivee')),
    finalSprint: contient(t, MOTS.finalSprint, reconnus),
    reconnus
  };
}

/* ------------------------------------------------------------------ */
/* toponymie                                                          */
/* ------------------------------------------------------------------ */

const RACINES = [
  'Valmont', 'Brumelac', 'Fayet', 'Solmagne', 'Roquebrune', 'Chantrieux', 'Bellecombe',
  'Aubrac', 'Montfaucon', 'Sérignan', 'Vaugelles', 'Peyrelade', 'Cornillac', 'Sauveterre',
  'Aiguebelle', 'Rochefort', 'Malaval', 'Cheylard', 'Tourmens', 'Estarac', 'Villefranche',
  'Grandvaux', 'Bourgnac', 'Clairmont', 'Ambrecy', 'Saint-Loup', 'Vernouze', 'Falaisette',
  'Pierrelongue', 'Casteldon', 'Marbrière', 'Ondelune', 'Hautecombe', 'Genestier', 'Ravières'
];
const PREFIXES_COL = ['Col de', 'Col du', 'Mont', 'Côte de', 'Mur de', 'Pas de', 'Port de',
  'Cime de', 'Pic de', 'Croix de', 'Signal de', 'Plateau de'];
const PREFIXES_VILLE = ['', '', 'Saint-', 'Villeneuve-de-', 'Le Grand ', 'Bourg-de-'];

function nom(rand: () => number): string {
  return RACINES[Math.floor(rand() * RACINES.length)];
}

/* ------------------------------------------------------------------ */
/* générateur d'aléa reproductible                                     */
/* ------------------------------------------------------------------ */

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* profils                                                            */
/* ------------------------------------------------------------------ */

/** catégorie d'un col d'après le dénivelé de son ascension */
function categorie(gain: number): 0 | 1 | 2 | 3 | 4 {
  if (gain >= 105) return 0;
  if (gain >= 78) return 1;
  if (gain >= 52) return 2;
  if (gain >= 30) return 3;
  return 4;
}

interface Relief {
  profile: [number, number][];
  climbs: ClimbDef[];
}

/**
 * Construit un profil et les cols qui vont avec.
 *
 * On ne tire pas des altitudes au hasard : on enchaîne des montées et des
 * descentes. Chaque montée devient un col répertorié dès qu'elle vaut la
 * peine, ce qui garantit que les pancartes du jeu tombent bien là où la
 * route monte — le défaut de tout profil bruité.
 */
function reliefPour(type: StageType, arriveeSommet: boolean, rand: () => number): Relief {
  const profile: [number, number][] = [];
  const climbs: ClimbDef[] = [];

  const reglages = {
    plaine: { nb: [3, 5], gain: [6, 20], base: 4 },
    vallonnee: { nb: [4, 7], gain: [22, 52], base: 8 },
    montagne: { nb: [2, 4], gain: [58, 130], base: 10 },
    clm: { nb: [2, 4], gain: [6, 18], base: 5 }
  }[type];

  const nb = reglages.nb[0] + Math.floor(rand() * (reglages.nb[1] - reglages.nb[0] + 1));
  let alt = reglages.base + rand() * 6;
  profile.push([0, Math.round(alt)]);

  // les bosses se répartissent sur le parcours, la dernière calée sur le final
  const derniere = arriveeSommet ? 0.93 : 0.86;
  for (let i = 0; i < nb; i++) {
    const t0 = 0.08 + (i / nb) * (derniere - 0.08);
    const t1 = 0.08 + ((i + 0.62) / nb) * (derniere - 0.08);
    const gain = reglages.gain[0] + rand() * (reglages.gain[1] - reglages.gain[0]);
    // en montagne les cols montent au fil de l'étape : le plus dur vient tard
    const echelle = type === 'montagne' ? 0.72 + (i / Math.max(1, nb - 1)) * 0.55 : 1;
    const haut = alt + gain * echelle;
    profile.push([Number(t1.toFixed(3)), Math.round(haut)]);
    if (gain * echelle >= (type === 'plaine' ? 999 : 26)) {
      const prefixe = PREFIXES_COL[Math.floor(rand() * PREFIXES_COL.length)];
      climbs.push({
        at: Number(t1.toFixed(3)),
        name: `${prefixe} ${nom(rand)}`,
        category: categorie(gain * echelle)
      });
    }
    const dernier = i === nb - 1;
    if (dernier && arriveeSommet) {
      alt = haut;
      break;
    }
    // redescente partielle : on ne revient jamais tout à fait au point de départ
    const bas = haut - gain * echelle * (0.55 + rand() * 0.35);
    const tBas = Math.min(0.97, t1 + (t1 - t0) * (0.5 + rand() * 0.5));
    profile.push([Number(tBas.toFixed(3)), Math.round(Math.max(reglages.base * 0.5, bas))]);
    alt = bas;
  }
  const fin = arriveeSommet ? alt : Math.max(reglages.base * 0.6, alt - rand() * 12);
  profile.push([1, Math.round(fin)]);

  // le profil doit être strictement croissant en abscisse pour l'interpolation
  const propre: [number, number][] = [];
  for (const p of profile) {
    if (!propre.length || p[0] > propre[propre.length - 1][0] + 0.005) propre.push(p);
  }
  if (propre[propre.length - 1][0] < 1) propre.push([1, Math.round(fin)]);
  return { profile: propre, climbs };
}

/* ------------------------------------------------------------------ */
/* génération d'étape                                                  */
/* ------------------------------------------------------------------ */

export interface OptionsGeneration {
  /** graine ; tirée au sort si absente */
  seed?: number;
  /** nom imposé ; sinon inventé */
  nom?: string;
  /** intentions déjà analysées (évite de relire le texte) */
  intentions?: Intentions;
}

const LIBELLE_TYPE: Record<StageType, string> = {
  plaine: 'Étape de plaine',
  vallonnee: 'Étape vallonnée',
  montagne: 'Étape de montagne',
  clm: 'Contre-la-montre'
};

export function genererEtape(texte: string, opts: OptionsGeneration = {}): StageDef {
  const intentions = opts.intentions ?? analyser(texte);
  const seed = opts.seed ?? Math.floor(Math.random() * 99000) + 7;
  const rand = mulberry32(seed);
  const i = intentions;

  const baseLong = { plaine: 2900, vallonnee: 3200, montagne: 3600, clm: 2100 }[i.type];
  const worldLength = Math.round(baseLong * i.longueur * (0.9 + rand() * 0.24));
  const displayKm =
    i.km ??
    Math.round(
      i.type === 'clm'
        ? 18 + rand() * 34
        : (110 + rand() * 90) * i.longueur * (i.type === 'montagne' ? 0.95 : 1)
    );

  const { profile, climbs } = reliefPour(i.type, i.arriveeSommet, rand);

  const sprints: SprintDef[] = [];
  if (i.type !== 'clm') {
    const nbS = i.type === 'plaine' ? 1 + (rand() < 0.45 ? 1 : 0) : rand() < 0.7 ? 1 : 0;
    for (let k = 0; k < nbS; k++) {
      sprints.push({
        at: Number((0.3 + rand() * 0.4).toFixed(3)),
        name: `Sprint de ${nom(rand)}`
      });
    }
  }

  const paves: PaveDef[] = [];
  if (i.paves) {
    const nb = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < nb; k++) {
      const from = 0.12 + (k / nb) * 0.66 + rand() * 0.04;
      paves.push({
        from: Number(from.toFixed(3)),
        to: Number(Math.min(0.95, from + 0.035 + rand() * 0.04).toFixed(3)),
        name: `Secteur de ${nom(rand)}`
      });
    }
  }

  const vent: VentDef[] = [];
  if (i.vent) {
    const from = 0.15 + rand() * 0.45;
    vent.push({
      from: Number(from.toFixed(3)),
      to: Number(Math.min(0.92, from + 0.1 + rand() * 0.12).toFixed(3)),
      name: `Plateau de ${nom(rand)}`
    });
  }

  const lieu = nom(rand);
  const prefixe = PREFIXES_VILLE[Math.floor(rand() * PREFIXES_VILLE.length)];
  const titre =
    opts.nom ??
    (i.arriveeSommet && climbs.length
      ? `Arrivée au ${climbs[climbs.length - 1].name}`
      : i.type === 'clm'
        ? `Chrono de ${prefixe}${lieu}`
        : `${prefixe}${lieu}`);

  return {
    id: nouvelId('etape'),
    name: titre,
    type: i.type,
    worldLength,
    displayKm,
    seed,
    profile,
    description: decrire(i, climbs, sprints),
    climbs: climbs.length ? climbs : undefined,
    sprints: sprints.length ? sprints : undefined,
    paves: paves.length ? paves : undefined,
    vent: vent.length ? vent : undefined,
    periode: i.periode,
    meteo: i.meteo,
    biome: i.biome === 'mediterraneen' ? 'mediterraneen' : undefined,
    mer: i.mer || undefined,
    creee: true
  };
}

function decrire(i: Intentions, climbs: ClimbDef[], sprints: SprintDef[]): string {
  const bouts: string[] = [LIBELLE_TYPE[i.type] + '.'];
  if (climbs.length) {
    const dur = climbs.reduce((a, c) => (c.category <= a.category ? c : a), climbs[0]);
    bouts.push(
      `${climbs.length} difficulté${climbs.length > 1 ? 's' : ''} répertoriée${climbs.length > 1 ? 's' : ''}, dont ${dur.name}.`
    );
  }
  if (i.arriveeSommet) bouts.push('Arrivée au sommet : la route ne redescend plus.');
  else if (sprints.length && i.type === 'plaine') bouts.push('Final promis aux sprinteurs.');
  if (i.paves) bouts.push('Secteurs pavés à négocier.');
  if (i.vent) bouts.push('Plateau exposé : les bordures peuvent tout casser.');
  if (i.mer) bouts.push('La route longe la mer.');
  if (i.meteo === 'pluie') bouts.push('Sous la pluie.');
  if (i.periode === 'nuit') bouts.push('Course de nuit, sous les lampadaires.');
  else if (i.periode === 'aube') bouts.push('Départ à l’aube.');
  else if (i.periode === 'crepuscule') bouts.push('Arrivée au crépuscule.');
  return bouts.join(' ');
}

/* ------------------------------------------------------------------ */
/* création guidée : les mêmes rouages, pilotés par des curseurs        */
/* ------------------------------------------------------------------ */

export interface ParamsEtape {
  nom: string;
  type: StageType;
  /** multiplicateur de longueur, 0.6 à 1.6 */
  longueur: number;
  /** distance affichée, en km */
  km: number;
  seed: number;
  periode?: Periode;
  meteo?: Meteo;
  biome: Biome;
  mer: boolean;
  arriveeSommet: boolean;
  paves: boolean;
  vent: boolean;
}

/**
 * Étape construite à partir de réglages plutôt que d'une phrase.
 *
 * C'est le même moteur : l'éditeur remplit les intentions à la main au lieu
 * de les lire dans un texte. Une étape écrite au curseur et une étape
 * décrite en français sortent donc de la même chaîne, avec les mêmes
 * garanties de cohérence.
 */
export function construireEtape(p: ParamsEtape, id?: string): StageDef {
  const intentions: Intentions = {
    type: p.type,
    mer: p.mer,
    biome: p.biome,
    paves: p.paves,
    vent: p.vent,
    periode: p.periode,
    meteo: p.meteo,
    longueur: p.longueur,
    km: p.km,
    arriveeSommet: p.arriveeSommet,
    finalSprint: p.type === 'plaine',
    reconnus: []
  };
  const etape = genererEtape('', { intentions, seed: p.seed, nom: p.nom || undefined });
  return id ? { ...etape, id } : etape;
}

/* ------------------------------------------------------------------ */
/* génération de tour                                                  */
/* ------------------------------------------------------------------ */

export interface TourGenere {
  name: string;
  region: string;
  stages: StageDef[];
}

/**
 * Un tour n'est pas une pile d'étapes identiques.
 *
 * On respecte la grammaire d'un grand tour : une entrée en matière roulante,
 * du vallonné, un chrono, une ou deux étapes reines placées aux deux tiers,
 * et une dernière étape pour les sprinteurs. Les intentions du texte
 * colorent l'ensemble — « au bord de la mer » s'applique à tout le tour, «
 * montagne » augmente la part de cols — sans écraser la variété.
 */
export function genererTour(texte: string, nbEtapes = 5): TourGenere {
  const base = analyser(texte);
  const seed = Math.floor(Math.random() * 90000) + 11;
  const rand = mulberry32(seed);
  const n = Math.max(2, Math.min(12, nbEtapes));

  const plan: StageType[] = [];
  const montagnard = base.type === 'montagne';
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1);
    if (k === 0) plan.push('plaine');
    else if (k === n - 1) plan.push(montagnard && rand() < 0.35 ? 'montagne' : 'plaine');
    else if (n >= 4 && k === Math.floor(n * 0.4)) plan.push('clm');
    else if (f > 0.5 && (montagnard || rand() < 0.4)) plan.push('montagne');
    else plan.push(rand() < 0.55 ? 'vallonnee' : 'plaine');
  }

  const region = `${['Massif', 'Pays', 'Vallée', 'Côte', 'Plateau'][Math.floor(rand() * 5)]} de ${nom(rand)}`;
  const stages: StageDef[] = plan.map((type, k) => {
    const i: Intentions = {
      ...base,
      type,
      // le sommet ne s'invite que sur une étape de montagne, et pas la dernière
      arriveeSommet: type === 'montagne' && (base.arriveeSommet || rand() < 0.6) && k < n - 1,
      // pavés et vent ponctuent le tour au lieu de le saturer
      paves: base.paves && type !== 'montagne' && type !== 'clm' && rand() < 0.5,
      vent: base.vent && type !== 'montagne' && rand() < 0.55,
      // la météo et l'heure varient d'un jour à l'autre, comme sur un vrai tour
      meteo: base.meteo && rand() < 0.5 ? base.meteo : undefined,
      periode: base.periode && rand() < 0.5 ? base.periode : undefined,
      mer: base.mer && rand() < 0.7,
      longueur: base.longueur * (0.9 + rand() * 0.25)
    };
    return genererEtape(texte, { intentions: i, seed: seed + k * 137 });
  });

  const titre = `${['Tour', 'Grand Prix', 'Boucle', 'Route', 'Trophée'][Math.floor(rand() * 5)]} ${
    montagnard ? 'des Cimes de ' : base.mer ? 'du Littoral de ' : 'de '
  }${nom(rand)}`;
  return { name: titre, region, stages };
}
