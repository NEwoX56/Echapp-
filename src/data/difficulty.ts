import type { RiderStats } from './types';

/**
 * Niveaux de difficulté.
 *
 * Le premier système se contentait de multiplier les statistiques des
 * adversaires, en les plafonnant à 100. Face à un coureur monté à 99 partout,
 * cela ne servait plus à rien : les meilleures IA butaient sur le même
 * plafond et le joueur gagnait sans effort.
 *
 * Les paliers élevés lèvent donc ce plafond et agissent sur d'autres leviers,
 * qui pèsent autant que les statistiques brutes :
 *
 *  - la réserve d'énergie, qui décide combien de temps une IA peut tenir un
 *    effort avant de devoir lever le pied ;
 *  - le rubber-banding, cette main invisible qui freinait les adversaires
 *    trop détachés du joueur — un confort qui n'a plus lieu d'être quand on
 *    cherche de la difficulté ;
 *  - la vigueur de la chasse du peloton, qui détermine si une échappée du
 *    joueur peut vivre.
 *
 * Ce sont ces trois derniers points qui font qu'un palier « légende » reste
 * exigeant même pour un coureur au maximum, sans donner d'adversaires aux
 * chiffres absurdes.
 */

export type Difficulty = 'facile' | 'normal' | 'difficile' | 'expert' | 'champion' | 'legende';

export interface ReglageDifficulte {
  id: Difficulty;
  label: string;
  description: string;
  /** multiplicateur des statistiques des adversaires */
  stats: number;
  /** plafond des statistiques : au-delà de 100, l'IA dépasse l'humain */
  plafond: number;
  /** réserve d'énergie des adversaires, 100 par défaut */
  energie: number;
  /** intensité du rubber-banding, 1 = celui d'origine, 0 = aucun */
  rubberBand: number;
  /** vigueur de la chasse du peloton */
  chasse: number;
  /** seuil d'énergie sous lequel une IA lève le pied — bas = plus courageuse */
  plancherEnergie: number;
}

export const DIFFICULTES: ReglageDifficulte[] = [
  {
    id: 'facile',
    label: 'Facile',
    description: 'Pour apprendre les commandes',
    stats: 0.86,
    plafond: 100,
    energie: 90,
    rubberBand: 1.2,
    chasse: 0.85,
    plancherEnergie: 26
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'Course équilibrée',
    stats: 1,
    plafond: 100,
    energie: 100,
    rubberBand: 1,
    chasse: 1,
    plancherEnergie: 22
  },
  {
    id: 'difficile',
    label: 'Difficile',
    description: 'Chaque erreur se paie',
    stats: 1.1,
    plafond: 100,
    energie: 105,
    rubberBand: 0.8,
    chasse: 1.1,
    plancherEnergie: 18
  },
  {
    id: 'expert',
    label: 'Expert',
    description: 'Adversaires au-delà du plafond humain',
    stats: 1.23,
    plafond: 113,
    energie: 120,
    rubberBand: 0.35,
    chasse: 1.3,
    plancherEnergie: 13
  },
  {
    id: 'champion',
    label: 'Champion',
    description: 'Plus aucune aide, peloton impitoyable',
    stats: 1.34,
    plafond: 124,
    energie: 134,
    rubberBand: 0,
    chasse: 1.55,
    plancherEnergie: 9
  },
  {
    id: 'legende',
    label: 'Légende',
    description: 'Pour un coureur monté au maximum',
    stats: 1.45,
    plafond: 138,
    energie: 148,
    rubberBand: 0,
    chasse: 1.85,
    plancherEnergie: 6
  }
];

export function reglage(d: Difficulty): ReglageDifficulte {
  return DIFFICULTES.find((x) => x.id === d) ?? DIFFICULTES[1];
}

export function scaleStats(stats: RiderStats, r: ReglageDifficulte): RiderStats {
  const c = (v: number) => Math.min(r.plafond, v * r.stats);
  return {
    flat: c(stats.flat),
    climb: c(stats.climb),
    sprint: c(stats.sprint),
    endurance: c(stats.endurance)
  };
}
