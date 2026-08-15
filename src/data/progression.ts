import type { StageDef, StageType, RiderStats } from './types';

/**
 * Progression au-delà du plafond de caractéristiques.
 *
 * Une fois monté à 99 partout, un coureur n'avait plus rien à dépenser et les
 * points s'accumulaient sans usage. Quatre systèmes prennent le relais, reliés
 * par une monnaie unique — les points de carrière — pour éviter quatre
 * compteurs séparés que personne ne suivrait.
 *
 * Règle de conception tenue partout ici : aucun bonus ne donne de vitesse
 * pure. Sinon on ne fait que déplacer le curseur, et le palier de difficulté
 * suivant redevient l'ancien. Les spécialités réduisent un coût, allongent une
 * durée ou ouvrent une option ; c'est le choix qui compte, pas la puissance.
 */

/* ------------------------------------------------------------------ */
/* Badges                                                             */
/* ------------------------------------------------------------------ */

export type BadgeId =
  | 'baroudeur'
  | 'solitaire'
  | 'roi-montagne'
  | 'chrono'
  | 'intouchable'
  | 'regulier'
  | 'increvable'
  | 'grand-chelem'
  | 'face-au-mur'
  | 'premiere-victoire'
  | 'sprinteur-ne'
  | 'collectionneur';

export interface BadgeDef {
  id: BadgeId;
  nom: string;
  description: string;
  /** points de carrière crédités à l'obtention */
  points: number;
  /** difficulté indicative, pour le tri et l'affichage */
  rang: 'bronze' | 'argent' | 'or';
}

export const BADGES: BadgeDef[] = [
  {
    id: 'premiere-victoire',
    nom: 'Première victoire',
    description: "Gagner une étape, quelle qu'elle soit",
    points: 6,
    rang: 'bronze'
  },
  {
    id: 'sprinteur-ne',
    nom: 'Sprinteur né',
    description: 'Gagner une étape de plaine au sprint',
    points: 10,
    rang: 'bronze'
  },
  {
    id: 'chrono',
    nom: 'Contre la montre',
    description: 'Gagner un contre-la-montre',
    points: 12,
    rang: 'bronze'
  },
  {
    id: 'baroudeur',
    nom: 'Baroudeur',
    description: "Gagner une étape en étant parti dans l'échappée",
    points: 20,
    rang: 'argent'
  },
  {
    id: 'solitaire',
    nom: 'Le solitaire',
    description: "Gagner avec plus de 30 secondes d'avance",
    points: 22,
    rang: 'argent'
  },
  {
    id: 'increvable',
    nom: 'Increvable',
    description: 'Finir une étape de montagne sans jamais tomber sous 20 % d\'énergie',
    points: 18,
    rang: 'argent'
  },
  {
    id: 'roi-montagne',
    nom: 'Roi de la montagne',
    description: 'Passer premier au sommet de trois cols hors catégorie',
    points: 25,
    rang: 'argent'
  },
  {
    id: 'regulier',
    nom: 'La régularité',
    description: 'Terminer chaque étape d\'un grand tour dans les cinq premiers',
    points: 35,
    rang: 'or'
  },
  {
    id: 'intouchable',
    nom: 'Intouchable',
    description: 'Porter le maillot jaune du premier au dernier jour d\'un grand tour',
    points: 40,
    rang: 'or'
  },
  {
    id: 'grand-chelem',
    nom: 'Grand Chelem',
    description: 'Remporter les quatre maillots sur un même grand tour',
    points: 60,
    rang: 'or'
  },
  {
    id: 'face-au-mur',
    nom: 'Face au mur',
    description: 'Gagner une étape en difficulté Légende',
    points: 50,
    rang: 'or'
  },
  {
    id: 'collectionneur',
    nom: 'Le collectionneur',
    description: 'Obtenir huit autres badges',
    points: 45,
    rang: 'or'
  }
];

export function badge(id: BadgeId): BadgeDef {
  return BADGES.find((b) => b.id === id) ?? BADGES[0];
}

/* ------------------------------------------------------------------ */
/* Spécialités                                                        */
/* ------------------------------------------------------------------ */

export type SpecialiteId =
  | 'rouleur'
  | 'grimpeur-ne'
  | 'puncheur'
  | 'estomac'
  | 'sang-froid'
  | 'meneur'
  | 'lecture'
  | 'finisseur';

export interface SpecialiteDef {
  id: SpecialiteId;
  nom: string;
  description: string;
  /** coût de déblocage en points de carrière */
  cout: number;
  /** profils où elle est la plus utile, pour la suggestion avant départ */
  utile: StageType[];
}

export const SPECIALITES: SpecialiteDef[] = [
  {
    id: 'rouleur',
    nom: 'Rouleur',
    description: "Le surcoût du vent en solitaire baisse d'un tiers. L'échappée redevient tenable.",
    cout: 8,
    utile: ['plaine', 'clm']
  },
  {
    id: 'grimpeur-ne',
    nom: 'Grimpeur né',
    description: 'Dépense réduite de 25 % au-dessus de 6 % de pente.',
    cout: 8,
    utile: ['montagne']
  },
  {
    id: 'puncheur',
    nom: 'Puncheur',
    description: 'Les relances sur les pentes courtes coûtent nettement moins cher.',
    cout: 8,
    utile: ['vallonnee']
  },
  {
    id: 'estomac',
    nom: 'Estomac solide',
    description: 'Les bidons agissent deux fois plus vite et tu pars avec un gel de plus.',
    cout: 8,
    utile: ['plaine', 'vallonnee', 'montagne']
  },
  {
    id: 'sang-froid',
    nom: 'Sang-froid',
    description: 'La fringale bride beaucoup moins, et on en sort plus vite.',
    cout: 8,
    utile: ['montagne', 'vallonnee']
  },
  {
    id: 'meneur',
    nom: "Meneur d'hommes",
    description: 'Tes équipiers puisent plus bas dans leurs réserves pour te protéger.',
    cout: 8,
    utile: ['plaine', 'vallonnee']
  },
  {
    id: 'lecture',
    nom: 'Lecture de course',
    description: "Ton directeur annonce l'échappée et les attaques bien plus tôt.",
    cout: 8,
    utile: ['plaine', 'vallonnee', 'montagne']
  },
  {
    id: 'finisseur',
    nom: 'Finisseur',
    description: 'Le sprint coûte un quart de moins dans les 400 derniers mètres.',
    cout: 8,
    utile: ['plaine', 'vallonnee']
  }
];

export function specialite(id: SpecialiteId): SpecialiteDef {
  return SPECIALITES.find((s) => s.id === id) ?? SPECIALITES[0];
}

/** coût du prochain emplacement de spécialité, ou null si maximum atteint */
export function coutEmplacement(emplacementsActuels: number): number | null {
  if (emplacementsActuels < 3) return 40;
  if (emplacementsActuels < 4) return 120;
  return null;
}

/* ------------------------------------------------------------------ */
/* Contrats d'étape                                                   */
/* ------------------------------------------------------------------ */

export type ObjectifType =
  | 'place'
  | 'victoire'
  | 'sprint-intermediaire'
  | 'col-en-tete'
  | 'echappee'
  | 'energie';

export interface Contrat {
  type: ObjectifType;
  /** libellé affiché */
  texte: string;
  /** valeur seuil : place à tenir, nombre de cols, etc. */
  cible: number;
  /** points de carrière si réussi */
  recompense: number;
  /** points perdus si accepté et manqué */
  penalite: number;
}

/**
 * Propose un contrat adapté au profil de l'étape.
 *
 * Le tirage tient compte du type d'étape et du niveau du coureur : inutile de
 * demander la victoire à un débutant, ni un simple top 10 à un coureur monté
 * au maximum. C'est ce qui donne un but aux étapes qu'on ne peut pas gagner.
 */
export function proposerContrat(stage: StageDef, moyenneStats: number, alea: () => number): Contrat {
  const fort = moyenneStats >= 88;
  const moyen = moyenneStats >= 72;
  const choix: Contrat[] = [];

  if (stage.type === 'clm') {
    choix.push({
      type: 'place',
      texte: `Terminer dans les ${fort ? 3 : moyen ? 5 : 8} premiers du chrono`,
      cible: fort ? 3 : moyen ? 5 : 8,
      recompense: fort ? 14 : 10,
      penalite: 5
    });
  } else {
    if (stage.sprints?.length) {
      choix.push({
        type: 'sprint-intermediaire',
        texte: `Passer dans les 3 premiers au sprint de ${stage.sprints[0].name.replace('Sprint ', '')}`,
        cible: 3,
        recompense: 12,
        penalite: 4
      });
    }
    if (stage.climbs?.length) {
      const n = Math.min(stage.climbs.length, fort ? 2 : 1);
      choix.push({
        type: 'col-en-tete',
        texte: `Passer en tête au sommet de ${n} col${n > 1 ? 's' : ''}`,
        cible: n,
        recompense: 10 + n * 6,
        penalite: 5
      });
    }
    choix.push({
      type: 'echappee',
      texte: "Faire partie de l'échappée pendant la course",
      cible: 1,
      recompense: 14,
      penalite: 5
    });
    choix.push({
      type: 'place',
      texte: `Terminer dans les ${fort ? 3 : moyen ? 6 : 10} premiers`,
      cible: fort ? 3 : moyen ? 6 : 10,
      recompense: fort ? 16 : 11,
      penalite: 5
    });
    if (fort) {
      choix.push({
        type: 'victoire',
        texte: "Gagner l'étape",
        cible: 1,
        recompense: 30,
        penalite: 10
      });
    }
    if (stage.type === 'montagne') {
      choix.push({
        type: 'energie',
        texte: 'Franchir la ligne sans jamais descendre sous 15 % d\'énergie',
        cible: 15,
        recompense: 15,
        penalite: 4
      });
    }
  }

  return choix[Math.floor(alea() * choix.length)];
}

/* ------------------------------------------------------------------ */
/* Forme du jour                                                      */
/* ------------------------------------------------------------------ */

export interface Forme {
  /** variation appliquée à chaque caractéristique, en points */
  delta: number;
  libelle: string;
  couleur: string;
}

/**
 * Forme du jour, connue avant le départ.
 *
 * Elle ne rend pas plus fort en moyenne — les bons et les mauvais jours
 * s'équilibrent — mais elle oblige à adapter ses ambitions et le choix des
 * spécialités. C'est ce qui différencie deux passages sur la même étape.
 */
export function tirerForme(alea: () => number): Forme {
  const r = alea();
  if (r < 0.08) return { delta: -7, libelle: 'Jour sans', couleur: '#d6382c' };
  if (r < 0.24) return { delta: -3, libelle: 'Jambes lourdes', couleur: '#e8a33d' };
  if (r < 0.72) return { delta: 0, libelle: 'Forme normale', couleur: '#9aa0ad' };
  if (r < 0.92) return { delta: 4, libelle: 'Bonnes sensations', couleur: '#3fd07a' };
  return { delta: 8, libelle: 'Grande forme', couleur: '#ffd633' };
}

export function appliquerForme(stats: RiderStats, forme: Forme): RiderStats {
  const c = (v: number) => Math.max(20, Math.min(110, v + forme.delta));
  return { flat: c(stats.flat), climb: c(stats.climb), sprint: c(stats.sprint), endurance: c(stats.endurance) };
}

/* ------------------------------------------------------------------ */
/* Barème des dépenses                                                */
/* ------------------------------------------------------------------ */

export const COUTS = {
  /** +2 sur une caractéristique */
  caracteristique: 1,
  equipier: [5, 10, 20],
  troisiemeEquipier: 60,
  bidonSupplementaire: [15, 35],
  relancerForme: 3,
  refuserSansPenalite: 2
} as const;
