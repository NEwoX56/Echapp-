/** Apparence complète d'un coureur : peau, maillot, vélo. */

export type JerseyPattern =
  | 'uni'
  | 'bande-horizontale'
  | 'bande-verticale'
  | 'epaules'
  | 'chevrons'
  | 'damier'
  | 'diagonale'
  | 'pois';

export type WheelStyle = 'classique' | 'profil' | 'pleine';

export type BeardStyle = 'aucune' | 'courte' | 'pleine';

export interface RiderAppearance {
  skin: number;
  jerseyPrimary: number;
  jerseySecondary: number;
  pattern: JerseyPattern;
  sponsor: string;
  shorts: number;
  helmet: number;
  bikeFrame: number;
  bikeAccent: number;
  wheels: WheelStyle;
  /** numéro de dossard imprimé dans le bas du dos */
  dossard?: number;
  /** couleur des cheveux et de la barbe. Par défaut brun foncé si absent */
  hairColor?: number;
  /** style de barbe. Par défaut 'aucune' si absent */
  beard?: BeardStyle;
  /** brassard façon tatouage sur le bras. Par défaut absent */
  tattoo?: boolean;
  tattooColor?: number;
}

/** Maillots distinctifs : appliqués par-dessus l'apparence du coureur. */
export type ClassementKey = 'general' | 'points' | 'montagne' | 'jeune';

export interface JerseyAward {
  key: ClassementKey;
  label: string;
  short: string;
  cssColor: string;
  /** surcharge d'apparence quand le coureur porte ce maillot */
  override: Pick<RiderAppearance, 'jerseyPrimary' | 'jerseySecondary' | 'pattern'> & {
    helmet: number;
  };
}

export const SKIN_TONES: { id: string; label: string; value: number }[] = [
  { id: 'tres-claire', label: 'Très claire', value: 0xf2d3bb },
  { id: 'claire', label: 'Claire', value: 0xe2b48f },
  { id: 'moyenne', label: 'Moyenne', value: 0xc98d63 },
  { id: 'halee', label: 'Hâlée', value: 0xb07b4f },
  { id: 'mate', label: 'Mate', value: 0x8d5a34 },
  { id: 'foncee', label: 'Foncée', value: 0x5f3720 },
  { id: 'tres-foncee', label: 'Très foncée', value: 0x3d2417 }
];

export const PATTERNS: { id: JerseyPattern; label: string }[] = [
  { id: 'uni', label: 'Uni' },
  { id: 'bande-horizontale', label: 'Bande horizontale' },
  { id: 'bande-verticale', label: 'Bande verticale' },
  { id: 'epaules', label: 'Épaules' },
  { id: 'chevrons', label: 'Chevrons' },
  { id: 'damier', label: 'Damier' },
  { id: 'diagonale', label: 'Diagonale' },
  { id: 'pois', label: 'Pois' }
];

export const HAIR_COLORS: { id: string; label: string; value: number }[] = [
  { id: 'noir', label: 'Noir', value: 0x1c1712 },
  { id: 'brun', label: 'Brun', value: 0x3d2817 },
  { id: 'chatain', label: 'Châtain', value: 0x6b4423 },
  { id: 'blond', label: 'Blond', value: 0xc9a563 },
  { id: 'roux', label: 'Roux', value: 0x8a3f22 },
  { id: 'gris', label: 'Gris', value: 0x8a8a8a },
  { id: 'blanc', label: 'Blanc', value: 0xe8e4dc }
];

export const BEARD_STYLES: { id: BeardStyle; label: string }[] = [
  { id: 'aucune', label: 'Aucune' },
  { id: 'courte', label: 'Courte' },
  { id: 'pleine', label: 'Pleine' }
];

export const WHEEL_STYLES: { id: WheelStyle; label: string }[] = [
  { id: 'classique', label: 'Rayons classiques' },
  { id: 'profil', label: 'Jante à profil' },
  { id: 'pleine', label: 'Roue lenticulaire' }
];

/** palette générique réutilisée pour maillot / cuissard / casque / vélo */
export const PALETTE: { label: string; value: number }[] = [
  { label: 'Jaune', value: 0xffd633 },
  { label: 'Orange', value: 0xf25c2a },
  { label: 'Rouge', value: 0xd6382c },
  { label: 'Bordeaux', value: 0x7d1f2c },
  { label: 'Rose', value: 0xe8559b },
  { label: 'Violet', value: 0x7a4bc4 },
  { label: 'Bleu nuit', value: 0x1f3a8a },
  { label: 'Bleu ciel', value: 0x3fa9f5 },
  { label: 'Turquoise', value: 0x1fb8a6 },
  { label: 'Vert', value: 0x2f9e5b },
  { label: 'Vert fluo', value: 0xa8e02c },
  { label: 'Blanc', value: 0xf4f4f0 },
  { label: 'Gris', value: 0x9aa0ad },
  { label: 'Anthracite', value: 0x33363d },
  { label: 'Noir', value: 0x141519 },
  { label: 'Cuivre', value: 0xb87333 }
];

export const SPONSORS = [
  'ÉCHAPPÉE',
  'CIMES',
  'VOLTA',
  'ARDENT',
  'KRONOS',
  'BRUMEL',
  'SOLMAGNE',
  'CORBEAU',
  'ALTIS',
  'FERRO',
  'NIMBUS',
  'ORIGO'
];

export const AWARDS: Record<ClassementKey, JerseyAward> = {
  general: {
    key: 'general',
    label: 'Maillot Jaune — classement général',
    short: 'Jaune',
    cssColor: '#ffd633',
    override: { jerseyPrimary: 0xffd633, jerseySecondary: 0x1d1f24, pattern: 'uni', helmet: 0xffd633 }
  },
  points: {
    key: 'points',
    label: 'Maillot Vert — classement par points',
    short: 'Vert',
    cssColor: '#2f9e5b',
    override: { jerseyPrimary: 0x2f9e5b, jerseySecondary: 0xf4f4f0, pattern: 'uni', helmet: 0x2f9e5b }
  },
  montagne: {
    key: 'montagne',
    label: 'Maillot à Pois — meilleur grimpeur',
    short: 'Pois',
    cssColor: '#d6382c',
    override: { jerseyPrimary: 0xf4f4f0, jerseySecondary: 0xd6382c, pattern: 'pois', helmet: 0xd6382c }
  },
  jeune: {
    key: 'jeune',
    label: 'Maillot Blanc — meilleur jeune',
    short: 'Blanc',
    cssColor: '#f4f4f0',
    override: { jerseyPrimary: 0xf4f4f0, jerseySecondary: 0x3fa9f5, pattern: 'uni', helmet: 0xf4f4f0 }
  }
};

export function defaultAppearance(): RiderAppearance {
  return {
    skin: 0xe2b48f,
    jerseyPrimary: 0xf25c2a,
    jerseySecondary: 0x141519,
    pattern: 'epaules',
    sponsor: 'ÉCHAPPÉE',
    shorts: 0x141519,
    helmet: 0xf25c2a,
    bikeFrame: 0x141519,
    bikeAccent: 0xf25c2a,
    wheels: 'profil',
    dossard: 1
  };
}
