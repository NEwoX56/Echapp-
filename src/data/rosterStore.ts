import type { RosterRider, Archetype, RiderStats } from './types';
import { ROSTER as ROSTER_DEFAUT } from './roster';

/**
 * Peloton modifiable depuis le jeu.
 *
 * Le peloton livré (`roster.ts`) sert de base. Les modifications du joueur
 * sont enregistrées à part, sous forme de différences, et réappliquées au
 * chargement. Conserver des différences plutôt qu'une copie complète permet
 * de bénéficier des corrections d'une future version du jeu sur tous les
 * champs qui n'ont pas été touchés.
 *
 * Tout passe par le navigateur : aucune recompilation, aucun outil à
 * installer.
 */

const CLE = 'echappee-roster-v1';

/** champs qu'un joueur peut modifier */
export interface RiderPatch {
  name?: string;
  team?: string;
  archetype?: Archetype;
  age?: number;
  stats?: Partial<RiderStats>;
  color?: number;
  /** coureur ajouté par le joueur, absent du peloton d'origine */
  ajoute?: boolean;
  /** coureur du peloton d'origine masqué */
  retire?: boolean;
  appearance?: Partial<RosterRider['appearance']>;
}

type Patches = Record<string, RiderPatch>;

function lire(): Patches {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return {};
    const p = JSON.parse(brut) as Patches;
    return typeof p === 'object' && p ? p : {};
  } catch {
    return {};
  }
}

let patches: Patches = lire();
let cache: RosterRider[] | null = null;

function ecrire(): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(patches));
  } catch {
    /* stockage plein ou indisponible */
  }
  cache = null;
}

/** modèle utilisé pour les coureurs ajoutés par le joueur */
function gabarit(id: string, index: number): RosterRider {
  const base = ROSTER_DEFAUT[index % ROSTER_DEFAUT.length];
  return {
    ...base,
    id,
    name: 'Nouveau coureur',
    team: 'Sans équipe',
    stats: { ...base.stats },
    appearance: { ...base.appearance }
  };
}

/** peloton effectif, base plus modifications */
export function getRoster(): RosterRider[] {
  if (cache) return cache;
  const out: RosterRider[] = [];

  for (const base of ROSTER_DEFAUT) {
    const p = patches[base.id];
    if (p?.retire) continue;
    out.push(appliquer(base, p));
  }

  // coureurs ajoutés par le joueur
  let i = 0;
  for (const [id, p] of Object.entries(patches)) {
    if (!p.ajoute || p.retire) continue;
    if (ROSTER_DEFAUT.some((r) => r.id === id)) continue;
    out.push(appliquer(gabarit(id, i++), p));
  }

  cache = out;
  return out;
}

function appliquer(base: RosterRider, p: RiderPatch | undefined): RosterRider {
  if (!p) return base;
  return {
    ...base,
    name: p.name ?? base.name,
    team: p.team ?? base.team,
    archetype: p.archetype ?? base.archetype,
    age: p.age ?? base.age,
    color: p.color ?? base.color,
    stats: { ...base.stats, ...(p.stats ?? {}) },
    appearance: {
      ...base.appearance,
      ...(p.appearance ?? {}),
      // le sponsor imprimé suit le nom d'équipe si le joueur l'a changé
      sponsor: p.appearance?.sponsor ?? (p.team ? p.team.slice(0, 12).toUpperCase() : base.appearance.sponsor)
    }
  };
}

export function getPatch(id: string): RiderPatch {
  return patches[id] ?? {};
}

export function setPatch(id: string, patch: RiderPatch): void {
  const actuel = patches[id] ?? {};
  patches[id] = { ...actuel, ...patch };
  ecrire();
}

export function modifierStat(id: string, stat: keyof RiderStats, valeur: number): void {
  const actuel = patches[id] ?? {};
  patches[id] = {
    ...actuel,
    stats: { ...(actuel.stats ?? {}), [stat]: Math.max(1, Math.min(99, Math.round(valeur))) }
  };
  ecrire();
}

/** ajoute un coureur ; retourne son identifiant */
export function ajouterCoureur(): string {
  const id = `perso-${Date.now().toString(36)}`;
  patches[id] = { ajoute: true, name: 'Nouveau coureur', team: 'Sans équipe' };
  ecrire();
  return id;
}

export function retirerCoureur(id: string): void {
  const p = patches[id] ?? {};
  if (p.ajoute) delete patches[id];
  else patches[id] = { ...p, retire: true };
  ecrire();
}

export function restaurerCoureur(id: string): void {
  delete patches[id];
  ecrire();
}

/** coureurs d'origine actuellement masqués */
export function coureursRetires(): RosterRider[] {
  return ROSTER_DEFAUT.filter((r) => patches[r.id]?.retire);
}

export function estModifie(id: string): boolean {
  const p = patches[id];
  if (!p) return false;
  return Object.keys(p).some((k) => k !== 'ajoute');
}

export function toutRestaurer(): void {
  patches = {};
  ecrire();
}

/** équipes présentes dans le peloton, pour la liste déroulante */
export function equipes(): string[] {
  return [...new Set(getRoster().map((r) => r.team))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/* --------------------------------------------------------------- */
/* sauvegarde et restauration par fichier                          */
/* --------------------------------------------------------------- */

export function exporter(): string {
  return JSON.stringify({ version: 1, patches }, null, 2);
}

export function importer(texte: string): { ok: boolean; message: string } {
  try {
    const d = JSON.parse(texte) as { version?: number; patches?: Patches };
    if (!d || typeof d !== 'object' || !d.patches) {
      return { ok: false, message: 'Fichier non reconnu' };
    }
    patches = d.patches;
    ecrire();
    return { ok: true, message: `${Object.keys(patches).length} modification(s) restaurée(s)` };
  } catch {
    return { ok: false, message: 'Fichier illisible' };
  }
}
