import type { RosterRider } from './types';
import type { RiderAppearance, JerseyPattern, WheelStyle } from './appearance';

interface Look {
  skin: number;
  p: number;
  s: number;
  pat: JerseyPattern;
  shorts?: number;
  frame: number;
  wheels?: WheelStyle;
}

function look(team: string, l: Look): RiderAppearance {
  return {
    skin: l.skin,
    jerseyPrimary: l.p,
    jerseySecondary: l.s,
    pattern: l.pat,
    sponsor: team,
    shorts: l.shorts ?? 0x141519,
    helmet: l.p,
    bikeFrame: l.frame,
    bikeAccent: l.s,
    wheels: l.wheels ?? 'profil'
  };
}

export const ROSTER: RosterRider[] = [
  {
    id: 'falaise',
    name: 'Rémi Falaise',
    team: 'Granit-Volcania',
    color: 0x8e44ad,
    archetype: 'grimpeur',
    age: 27,
    stats: { flat: 52, climb: 86, sprint: 40, endurance: 74 },
    appearance: look('GRANIT', { skin: 0xe2b48f, p: 0x8e44ad, s: 0xffd633, pat: 'epaules', frame: 0x2a1633 })
  },
  {
    id: 'verhoeven',
    name: 'Stan Verhoeven',
    team: 'Nordwind Cycling',
    color: 0x2980b9,
    archetype: 'sprinteur',
    age: 29,
    stats: { flat: 66, climb: 34, sprint: 90, endurance: 58 },
    appearance: look('NORDWIND', { skin: 0xf2d3bb, p: 0x2980b9, s: 0xf4f4f0, pat: 'bande-horizontale', frame: 0x0d1b2a, wheels: 'pleine' })
  },
  {
    id: 'moretti',
    name: 'Luca Moretti',
    team: 'Aurora Prisma',
    color: 0x16a085,
    archetype: 'complet',
    age: 26,
    stats: { flat: 70, climb: 70, sprint: 62, endurance: 76 },
    appearance: look('AURORA', { skin: 0xc98d63, p: 0x16a085, s: 0x141519, pat: 'diagonale', frame: 0x0e3d36 })
  },
  {
    id: 'okada',
    name: 'Kenji Okada',
    team: 'Sakura Dynamics',
    color: 0xe84393,
    archetype: 'rouleur',
    age: 31,
    stats: { flat: 84, climb: 48, sprint: 55, endurance: 80 },
    appearance: look('SAKURA', { skin: 0xe8c39e, p: 0xe84393, s: 0xf4f4f0, pat: 'bande-verticale', frame: 0x3d0f28, wheels: 'pleine' })
  },
  {
    id: 'baumann',
    name: 'Felix Baumann',
    team: 'Nordwind Cycling',
    color: 0x2c6b8f,
    archetype: 'rouleur',
    age: 24,
    stats: { flat: 78, climb: 55, sprint: 50, endurance: 72 },
    appearance: look('NORDWIND', { skin: 0xf2d3bb, p: 0x2c6b8f, s: 0xf4f4f0, pat: 'bande-horizontale', frame: 0x0d1b2a })
  },
  {
    id: 'iriarte',
    name: 'Mikel Iriarte',
    team: 'Granit-Volcania',
    color: 0x6c3483,
    archetype: 'grimpeur',
    age: 23,
    stats: { flat: 48, climb: 80, sprint: 44, endurance: 70 },
    appearance: look('GRANIT', { skin: 0xb07b4f, p: 0x6c3483, s: 0xffd633, pat: 'epaules', frame: 0x2a1633, wheels: 'classique' })
  },
  {
    id: 'duval',
    name: 'Théo Duval',
    team: 'Aurora Prisma',
    color: 0x1abc9c,
    archetype: 'sprinteur',
    age: 22,
    stats: { flat: 62, climb: 30, sprint: 84, endurance: 55 },
    appearance: look('AURORA', { skin: 0xe2b48f, p: 0x1abc9c, s: 0x141519, pat: 'diagonale', frame: 0x0e3d36, wheels: 'pleine' })
  },
  {
    id: 'nkemba',
    name: 'Idriss Nkemba',
    team: 'Solstice Racing',
    color: 0xf39c12,
    archetype: 'complet',
    age: 25,
    stats: { flat: 72, climb: 66, sprint: 68, endurance: 74 },
    appearance: look('SOLSTICE', { skin: 0x5f3720, p: 0xf39c12, s: 0x1f3a8a, pat: 'chevrons', frame: 0x5c3a06 })
  },
  {
    id: 'lindqvist',
    name: 'Erik Lindqvist',
    team: 'Boreal Q7',
    color: 0x7f8c8d,
    archetype: 'rouleur',
    age: 30,
    stats: { flat: 82, climb: 52, sprint: 58, endurance: 78 },
    appearance: look('BOREAL', { skin: 0xf2d3bb, p: 0xdfe4e8, s: 0x1f3a8a, pat: 'damier', frame: 0x1c2226, wheels: 'pleine' })
  },
  {
    id: 'salazar',
    name: 'Andrés Salazar',
    team: 'Cordillera',
    color: 0xc0392b,
    archetype: 'grimpeur',
    age: 28,
    stats: { flat: 50, climb: 88, sprint: 38, endurance: 76 },
    appearance: look('CORDILLERA', { skin: 0x8d5a34, p: 0xc0392b, s: 0xf4f4f0, pat: 'bande-horizontale', frame: 0x3d0f0c, wheels: 'classique' })
  },
  {
    id: 'novak',
    name: 'Pavel Novák',
    team: 'Boreal Q7',
    color: 0x546e7a,
    archetype: 'complet',
    age: 33,
    stats: { flat: 68, climb: 64, sprint: 60, endurance: 82 },
    appearance: look('BOREAL', { skin: 0xe2b48f, p: 0xdfe4e8, s: 0x1f3a8a, pat: 'damier', frame: 0x1c2226 })
  },
  {
    id: 'aoki',
    name: 'Haru Aoki',
    team: 'Sakura Dynamics',
    color: 0xd81b60,
    archetype: 'grimpeur',
    age: 21,
    stats: { flat: 54, climb: 78, sprint: 46, endurance: 68 },
    appearance: look('SAKURA', { skin: 0xe8c39e, p: 0xd81b60, s: 0xf4f4f0, pat: 'bande-verticale', frame: 0x3d0f28, wheels: 'classique' })
  },
  {
    id: 'ferreira',
    name: 'Tiago Ferreira',
    team: 'Solstice Racing',
    color: 0xe67e22,
    archetype: 'sprinteur',
    age: 26,
    stats: { flat: 68, climb: 32, sprint: 88, endurance: 56 },
    appearance: look('SOLSTICE', { skin: 0xc98d63, p: 0xe67e22, s: 0x1f3a8a, pat: 'chevrons', frame: 0x5c3a06, wheels: 'pleine' })
  },
  {
    id: 'kowalski',
    name: 'Marek Kowalski',
    team: 'Cordillera',
    color: 0x922b21,
    archetype: 'rouleur',
    age: 32,
    stats: { flat: 80, climb: 58, sprint: 52, endurance: 79 },
    appearance: look('CORDILLERA', { skin: 0xf2d3bb, p: 0x922b21, s: 0xf4f4f0, pat: 'bande-horizontale', frame: 0x3d0f0c })
  },
  {
    id: 'benali',
    name: 'Yanis Benali',
    team: 'Mistral Sud',
    color: 0x27ae60,
    archetype: 'complet',
    age: 23,
    stats: { flat: 71, climb: 69, sprint: 63, endurance: 73 },
    appearance: look('MISTRAL', { skin: 0xb07b4f, p: 0x27ae60, s: 0xffd633, pat: 'pois', frame: 0x0c3d22 })
  },
  {
    id: 'delacroix',
    name: 'Hugo Delacroix',
    team: 'Mistral Sud',
    color: 0x2ecc71,
    archetype: 'sprinteur',
    age: 20,
    stats: { flat: 64, climb: 36, sprint: 82, endurance: 57 },
    appearance: look('MISTRAL', { skin: 0xe2b48f, p: 0x2ecc71, s: 0xffd633, pat: 'pois', frame: 0x0c3d22, wheels: 'pleine' })
  },
  {
    id: 'tanaka',
    name: 'Sora Tanaka',
    team: 'Sakura Dynamics',
    color: 0xad1457,
    archetype: 'complet',
    age: 29,
    stats: { flat: 69, climb: 67, sprint: 58, endurance: 77 },
    appearance: look('SAKURA', { skin: 0xe8c39e, p: 0xad1457, s: 0xf4f4f0, pat: 'bande-verticale', frame: 0x3d0f28 })
  }
];
