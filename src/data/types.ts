import type { RiderAppearance, ClassementKey } from './appearance';

export type StageType = 'plaine' | 'vallonnee' | 'montagne' | 'clm';

/** moment de la journée : influence la lumière, le ciel et la brume */
export type Periode = 'jour' | 'aube' | 'crepuscule' | 'nuit';

/** météo de l'étape : influence la lumière et déclenche la pluie */
export type Meteo = 'sec' | 'pluie';

/** col répertorié : donne des points au classement de la montagne */
export interface ClimbDef {
  /** fraction 0..1 du parcours où se trouve le sommet */
  at: number;
  name: string;
  /** catégorie : 4 = facile ... 1 = dure, 0 = hors catégorie */
  category: 0 | 1 | 2 | 3 | 4;
}

/** sprint intermédiaire : donne des points au classement par points */
export interface SprintDef {
  at: number;
  name: string;
}

export interface StageDef {
  id: string;
  name: string;
  type: StageType;
  /** longueur monde en "mètres" de simulation */
  worldLength: number;
  /** distance affichée en km (fictive, échelle course réelle) */
  displayKm: number;
  /** profil altimétrique : [fraction 0..1, altitude monde] */
  profile: [number, number][];
  seed: number;
  description: string;
  climbs?: ClimbDef[];
  sprints?: SprintDef[];
  /** par défaut 'jour' si absent */
  periode?: Periode;
  /** par défaut 'sec' si absent */
  meteo?: Meteo;
}

export interface TourDef {
  id: string;
  name: string;
  /** pays / région évoquée, purement cosmétique */
  region: string;
  /** niveau requis pour débloquer le tour */
  requiredLevel: number;
  /** ou bien : avoir terminé ce tour-là débloque celui-ci */
  requiredTour?: string;
  stages: StageDef[];
}

export interface RiderStats {
  flat: number;      // rouleur
  climb: number;     // grimpeur
  sprint: number;    // sprinteur
  endurance: number; // récupération / fond
}

export type Archetype = 'sprinteur' | 'grimpeur' | 'rouleur' | 'complet';

export interface RosterRider {
  id: string;
  name: string;
  team: string;
  color: number;
  archetype: Archetype;
  age: number;
  stats: RiderStats;
  appearance: RiderAppearance;
}

export interface StageResultRow {
  riderId: string;
  name: string;
  color: number;
  time: number; // secondes
  isPlayer: boolean;
}

/** points glanés pendant l'étape (sprints, cols, place finale) */
export interface StagePoints {
  riderId: string;
  points: number;
  montagne: number;
}

export interface TourState {
  tourId: string;
  currentStage: number;
  gc: Record<string, number>;
  points: Record<string, number>;
  montagne: Record<string, number>;
  stageWins: number;
  finished: boolean;
  /** maillots gagnés au fil du tour, pour la vitrine du menu */
  jerseysWon: ClassementKey[];
}

export interface CareerSave {
  version: number;
  name: string;
  age: number;
  /** équipe du joueur : ses coureurs le protègent en course */
  team: string;
  appearance: RiderAppearance;
  level: number;
  xp: number;
  upgradePoints: number;
  stats: RiderStats;
  difficulty: Difficulty;
  /** préférence de qualité graphique */
  quality: 'auto' | 'elevee' | 'moyenne' | 'basse';
  /** passer en plein écran au départ d'une étape */
  autoFullscreen: boolean;
  /** volumes 0..1 et coupure générale */
  volMaster: number;
  volMusique: number;
  volEffets: number;
  sonCoupe: boolean;
  /** afficher le nom des coureurs au-dessus de leur tête */
  nomsCoureurs: boolean;
  /** compte de synchronisation entre appareils */
  syncId?: string;
  syncCode?: string;

  /* --- progression au-delà du plafond de caractéristiques --- */
  /** badges obtenus */
  badges?: string[];
  /** spécialités débloquées */
  specialites?: string[];
  /** spécialités équipées pour la prochaine étape */
  equipees?: string[];
  /** nombre d'emplacements de spécialité (2 au départ) */
  emplacements?: number;
  /** améliorations achetées par équipier */
  equipiersAmeliores?: Record<string, number>;
  /** bidons supplémentaires achetés */
  bidonsBonus?: number;
  /** total de points de carrière gagnés depuis le début */
  pointsGagnes?: number;
  /** contrat en cours pour l'étape à venir */
  contrat?: {
    type: string;
    texte: string;
    cible: number;
    recompense: number;
    penalite: number;
    accepte: boolean;
  } | null;
  /** forme du jour tirée pour l'étape à venir */
  forme?: { delta: number; libelle: string; couleur: string } | null;
  /** compteurs servant aux badges */
  suivi?: {
    colsHorsCategorie: number;
    toursTermines: number;
  };
  tour: TourState;
  /** tours terminés : id -> meilleure place au général */
  palmares: Record<string, number>;
}

export type { Difficulty } from './difficulty';
import type { Difficulty } from './difficulty';
