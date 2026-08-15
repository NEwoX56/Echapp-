import type {
  CareerSave,
  RiderStats,
  StageResultRow,
  StagePoints,
  TourState,
  StageType
} from '../data/types';
import type { ClassementKey } from '../data/appearance';
import { defaultAppearance } from '../data/appearance';
import { TOURS } from '../data/tours';
import {
  BADGES,
  SPECIALITES,
  COUTS,
  coutEmplacement,
  badge,
  proposerContrat,
  tirerForme,
  type BadgeId,
  type SpecialiteId,
  type Contrat,
  type Forme
} from '../data/progression';
import { getRoster } from '../data/rosterStore';

const KEY = 'echappee-save-v2';
const LEGACY_KEY = 'echappee-save-v1';

export const PLAYER_ID = 'player';

function emptyTour(tourId: string): TourState {
  const gc: Record<string, number> = { [PLAYER_ID]: 0 };
  const points: Record<string, number> = { [PLAYER_ID]: 0 };
  const montagne: Record<string, number> = { [PLAYER_ID]: 0 };
  for (const r of getRoster()) {
    gc[r.id] = 0;
    points[r.id] = 0;
    montagne[r.id] = 0;
  }
  return { tourId, currentStage: 0, gc, points, montagne, stageWins: 0, finished: false, jerseysWon: [] };
}

function freshSave(): CareerSave {
  return {
    version: 2,
    name: 'Jules Ceyrat',
    age: 24,
    team: 'Mistral Sud',
    appearance: defaultAppearance(),
    level: 1,
    xp: 0,
    upgradePoints: 2,
    stats: { flat: 55, climb: 55, sprint: 55, endurance: 55 },
    difficulty: 'normal',
    quality: 'auto',
    autoFullscreen: true,
    volMaster: 0.75,
    volMusique: 0.55,
    volEffets: 0.8,
    sonCoupe: false,
    nomsCoureurs: true,
    tour: emptyTour(TOURS[0].id),
    palmares: {},
    badges: [],
    specialites: [],
    equipees: [],
    emplacements: 2,
    equipiersAmeliores: {},
    bidonsBonus: 0,
    pointsGagnes: 0,
    contrat: null,
    forme: null,
    suivi: { colsHorsCategorie: 0, toursTermines: 0 }
  };
}

/** âge de chaque coureur, pour le classement du meilleur jeune */
/** âges du peloton : relu à chaque fois, le joueur peut les modifier en jeu */
function ageDe(id: string): number {
  return getRoster().find((r) => r.id === id)?.age ?? 99;
}
const YOUNG_MAX = 25;

export class Career {
  save: CareerSave;

  constructor() {
    this.save = this.load() ?? freshSave();
  }

  private load(): CareerSave | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CareerSave;
        if (parsed.version === 2) return this.repair(parsed);
      }
      // migration depuis la v1 : on conserve nom et niveau, on repart sur un tour propre
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const old = JSON.parse(legacy) as Partial<CareerSave> & { jerseyColor?: number };
        const s = freshSave();
        if (old.name) s.name = old.name;
        if (old.level) s.level = old.level;
        if (old.stats) s.stats = old.stats;
        if (old.upgradePoints) s.upgradePoints = old.upgradePoints;
        if (old.jerseyColor) {
          s.appearance.jerseyPrimary = old.jerseyColor;
          s.appearance.helmet = old.jerseyColor;
          s.appearance.bikeAccent = old.jerseyColor;
        }
        localStorage.removeItem(LEGACY_KEY);
        return s;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** complète les champs manquants si le roster a évolué */
  private repair(s: CareerSave): CareerSave {
    if (!s.appearance) s.appearance = defaultAppearance();
    if (!s.team) s.team = 'Mistral Sud';
    if (!s.quality) s.quality = 'auto';
    if (s.autoFullscreen === undefined) s.autoFullscreen = true;
    if (s.volMaster === undefined) s.volMaster = 0.75;
    if (s.volMusique === undefined) s.volMusique = 0.55;
    if (s.volEffets === undefined) s.volEffets = 0.8;
    if (s.sonCoupe === undefined) s.sonCoupe = false;
    if (s.nomsCoureurs === undefined) s.nomsCoureurs = true;
    // les parties d'avant la progression étendue sont complétées telles quelles :
    // les points déjà accumulés restent acquis et deviennent dépensables
    if (!s.badges) s.badges = [];
    if (!s.specialites) s.specialites = [];
    if (!s.equipees) s.equipees = [];
    if (!s.emplacements) s.emplacements = 2;
    if (!s.equipiersAmeliores) s.equipiersAmeliores = {};
    if (s.bidonsBonus === undefined) s.bidonsBonus = 0;
    if (s.pointsGagnes === undefined) s.pointsGagnes = s.upgradePoints;
    if (s.contrat === undefined) s.contrat = null;
    if (s.forme === undefined) s.forme = null;
    if (!s.suivi) s.suivi = { colsHorsCategorie: 0, toursTermines: 0 };
    if (!s.palmares) s.palmares = {};
    if (!s.tour.points) s.tour.points = {};
    if (!s.tour.montagne) s.tour.montagne = {};
    if (!s.tour.jerseysWon) s.tour.jerseysWon = [];
    for (const r of [...getRoster().map((x) => x.id), PLAYER_ID]) {
      if (s.tour.gc[r] === undefined) s.tour.gc[r] = 0;
      if (s.tour.points[r] === undefined) s.tour.points[r] = 0;
      if (s.tour.montagne[r] === undefined) s.tour.montagne[r] = 0;
    }
    return s;
  }

  persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.save));
    } catch {
      /* stockage indisponible */
    }
  }

  reset(): void {
    this.save = freshSave();
    this.persist();
  }

  get tourDef() {
    return TOURS.find((t) => t.id === this.save.tour.tourId) ?? TOURS[0];
  }

  /** un tour se débloque au niveau requis OU en ayant terminé le tour précédent */
  isTourUnlocked(tourId: string): boolean {
    const t = TOURS.find((x) => x.id === tourId);
    if (!t) return false;
    if (this.save.level >= t.requiredLevel) return true;
    return !!t.requiredTour && this.save.palmares[t.requiredTour] !== undefined;
  }

  /** message expliquant comment débloquer un tour */
  unlockHint(tourId: string): string {
    const t = TOURS.find((x) => x.id === tourId);
    if (!t) return '';
    const prev = t.requiredTour ? TOURS.find((x) => x.id === t.requiredTour) : null;
    return prev
      ? `Niveau ${t.requiredLevel} ou terminer ${prev.name}`
      : `Niveau ${t.requiredLevel} requis`;
  }

  /** change de grand tour (remet à zéro sa progression) */
  selectTour(tourId: string): void {
    if (this.save.tour.tourId === tourId) return;
    this.save.tour = emptyTour(tourId);
    this.persist();
  }

  restartTour(): void {
    this.save.tour = emptyTour(this.save.tour.tourId);
    this.persist();
  }

  /* ------------------------------------------------------------ */
  /* classements                                                  */
  /* ------------------------------------------------------------ */

  private isYoung(id: string): boolean {
    if (id === PLAYER_ID) return this.save.age <= YOUNG_MAX;
    return ageDe(id) <= YOUNG_MAX;
  }

  /**
   * Porteur de chaque maillot. Comme dans une vraie course, un coureur qui
   * mène plusieurs classements ne porte que le plus prestigieux : les autres
   * maillots descendent au suivant au classement concerné.
   * Ordre de préséance : général > montagne > points > jeune.
   */
  jerseyHolders(): Partial<Record<ClassementKey, string>> {
    const t = this.save.tour;
    if (t.currentStage === 0) return {};

    const byTime = Object.entries(t.gc)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
    const byPoints = Object.entries(t.points)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    const byMont = Object.entries(t.montagne)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    const youngs = byTime.filter((id) => this.isYoung(id));

    const ranking: Record<ClassementKey, string[]> = {
      general: byTime,
      montagne: byMont,
      points: byPoints,
      jeune: youngs
    };

    const out: Partial<Record<ClassementKey, string>> = {};
    const taken = new Set<string>();
    // préséance : le général d'abord, puis montagne, points, jeune
    for (const key of ['general', 'montagne', 'points', 'jeune'] as ClassementKey[]) {
      const list = ranking[key];
      const holder = list.find((id) => !taken.has(id));
      if (holder) {
        out[key] = holder;
        taken.add(holder);
      }
    }
    return out;
  }

  /** photographie du général avant l'étape, pour évaluer les menaces en course */
  gcSnapshot(): { times: Record<string, number>; ranks: Record<string, number> } {
    const times = { ...this.save.tour.gc };
    const ranks: Record<string, number> = {};
    Object.entries(times)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[1] - b[1])
      .forEach(([id], i) => {
        ranks[id] = i + 1;
      });
    return { times, ranks };
  }

  /** maillots effectivement portés par le joueur */
  playerJerseys(): ClassementKey[] {
    const h = this.jerseyHolders();
    return (['general', 'montagne', 'points', 'jeune'] as ClassementKey[]).filter(
      (k) => h[k] === PLAYER_ID
    );
  }

  /** leader réel de chaque classement, sans redistribution (pour les tableaux) */
  classementLeader(key: ClassementKey): string | undefined {
    const t = this.save.tour;
    if (key === 'general') {
      return Object.entries(t.gc)
        .filter(([, v]) => v > 0)
        .sort((a, b) => a[1] - b[1])[0]?.[0];
    }
    if (key === 'jeune') {
      return Object.entries(t.gc)
        .filter(([id, v]) => v > 0 && this.isYoung(id))
        .sort((a, b) => a[1] - b[1])[0]?.[0];
    }
    const src = key === 'points' ? t.points : t.montagne;
    return Object.entries(src)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  /** maillot porté par le joueur au départ de la prochaine étape */
  playerJersey(): ClassementKey | null {
    const h = this.jerseyHolders();
    // priorité : général > montagne > points > jeune
    for (const k of ['general', 'montagne', 'points', 'jeune'] as ClassementKey[]) {
      if (h[k] === PLAYER_ID) return k;
    }
    return null;
  }

  /** classement général trié, avec écarts */
  gcTable(): { id: string; name: string; time: number; gap: number; isPlayer: boolean }[] {
    const t = this.save.tour;
    const rows = Object.entries(t.gc)
      .filter(([, v]) => v > 0)
      .map(([id, time]) => ({
        id,
        name: id === PLAYER_ID ? this.save.name : getRoster().find((r) => r.id === id)?.name ?? id,
        time,
        gap: 0,
        isPlayer: id === PLAYER_ID
      }))
      .sort((a, b) => a.time - b.time);
    if (rows.length) {
      const lead = rows[0].time;
      for (const r of rows) r.gap = r.time - lead;
    }
    return rows;
  }

  pointsTable(key: 'points' | 'montagne'): { id: string; name: string; value: number; isPlayer: boolean }[] {
    const src = this.save.tour[key];
    return Object.entries(src)
      .filter(([, v]) => v > 0)
      .map(([id, value]) => ({
        id,
        name: id === PLAYER_ID ? this.save.name : getRoster().find((r) => r.id === id)?.name ?? id,
        value,
        isPlayer: id === PLAYER_ID
      }))
      .sort((a, b) => b.value - a.value);
  }

  /* ------------------------------------------------------------ */
  /* progression                                                  */
  /* ------------------------------------------------------------ */

  rewardForPosition(pos: number, _fieldSize: number): { xp: number; points: number } {
    const xp = Math.max(35, 160 - (pos - 1) * 10);
    let points = 1;
    if (pos === 1) points = 4;
    else if (pos === 2) points = 3;
    else if (pos === 3) points = 2;
    return { xp, points };
  }

  applyReward(xp: number, points: number): { leveledUp: boolean; newLevel: number } {
    const s = this.save;
    s.xp += xp;
    s.upgradePoints += points;
    let leveledUp = false;
    while (s.xp >= s.level * 120) {
      s.xp -= s.level * 120;
      s.level += 1;
      s.upgradePoints += 2;
      leveledUp = true;
    }
    return { leveledUp, newLevel: s.level };
  }

  /** enregistre une étape terminée ; retourne les maillots pris par le joueur */
  applyStage(
    results: StageResultRow[],
    points: StagePoints[]
  ): { gained: ClassementKey[]; lost: ClassementKey[] } {
    const KEYS: ClassementKey[] = ['general', 'montagne', 'points', 'jeune'];
    const before: Partial<Record<ClassementKey, string>> = {};
    for (const k of KEYS) before[k] = this.classementLeader(k);
    const t = this.save.tour;
    for (const row of results) {
      t.gc[row.riderId] = (t.gc[row.riderId] ?? 0) + row.time;
    }
    for (const p of points) {
      t.points[p.riderId] = (t.points[p.riderId] ?? 0) + p.points;
      t.montagne[p.riderId] = (t.montagne[p.riderId] ?? 0) + p.montagne;
    }
    t.currentStage += 1;
    const stages = this.tourDef.stages.length;
    if (t.currentStage >= stages) {
      t.finished = true;
      const table = this.gcTable();
      const rank = table.findIndex((r) => r.isPlayer) + 1;
      if (rank > 0) {
        const prev = this.save.palmares[t.tourId];
        if (!prev || rank < prev) this.save.palmares[t.tourId] = rank;
        // prime de fin de grand tour : terminer compte autant que bien figurer
        const bonusXp = 120 + Math.max(0, 12 - rank) * 25;
        this.applyReward(bonusXp, 2 + (rank <= 3 ? 3 : rank <= 10 ? 1 : 0));
      }
    }
    const gained: ClassementKey[] = [];
    const lost: ClassementKey[] = [];
    for (const k of KEYS) {
      const wasMine = before[k] === PLAYER_ID;
      const isMine = this.classementLeader(k) === PLAYER_ID;
      if (isMine && !wasMine) {
        gained.push(k);
        if (!t.jerseysWon.includes(k)) t.jerseysWon.push(k);
      }
      if (!isMine && wasMine) lost.push(k);
    }
    return { gained, lost };
  }

  canUpgrade(): boolean {
    return this.save.upgradePoints > 0;
  }

  upgrade(stat: keyof RiderStats): boolean {
    const s = this.save;
    if (s.upgradePoints <= 0 || s.stats[stat] >= 99) return false;
    s.upgradePoints -= 1;
    s.stats[stat] = Math.min(99, s.stats[stat] + 2);
    this.persist();
    return true;
  }

  addStageWin(): void {
    this.save.tour.stageWins += 1;
  }

  /* ------------------------------------------------------------ */
  /* points de carrière                                           */
  /* ------------------------------------------------------------ */

  get points(): number {
    return this.save.upgradePoints;
  }

  crediter(n: number): void {
    this.save.upgradePoints += n;
    this.save.pointsGagnes = (this.save.pointsGagnes ?? 0) + Math.max(0, n);
  }

  depenser(n: number): boolean {
    if (this.save.upgradePoints < n) return false;
    this.save.upgradePoints -= n;
    this.persist();
    return true;
  }

  /** moyenne des caractéristiques, base des propositions de contrat */
  get moyenneStats(): number {
    const s = this.save.stats;
    return (s.flat + s.climb + s.sprint + s.endurance) / 4;
  }

  get toutAuMaximum(): boolean {
    const s = this.save.stats;
    return s.flat >= 99 && s.climb >= 99 && s.sprint >= 99 && s.endurance >= 99;
  }

  /* ------------------------------------------------------------ */
  /* badges                                                       */
  /* ------------------------------------------------------------ */

  aBadge(id: BadgeId): boolean {
    return (this.save.badges ?? []).includes(id);
  }

  /** attribue un badge s'il n'est pas déjà obtenu ; retourne true si nouveau */
  obtenirBadge(id: BadgeId): boolean {
    if (this.aBadge(id)) return false;
    this.save.badges = [...(this.save.badges ?? []), id];
    this.crediter(badge(id).points);
    // le collectionneur se déclenche quand huit autres badges sont acquis
    if (id !== 'collectionneur' && (this.save.badges?.length ?? 0) >= 8) {
      this.obtenirBadge('collectionneur');
    }
    return true;
  }

  get badgesObtenus(): BadgeId[] {
    return (this.save.badges ?? []) as BadgeId[];
  }

  get progressionBadges(): string {
    return `${this.badgesObtenus.length} / ${BADGES.length}`;
  }

  /* ------------------------------------------------------------ */
  /* spécialités                                                  */
  /* ------------------------------------------------------------ */

  aSpecialite(id: SpecialiteId): boolean {
    return (this.save.specialites ?? []).includes(id);
  }

  debloquerSpecialite(id: SpecialiteId): boolean {
    if (this.aSpecialite(id)) return false;
    const def = SPECIALITES.find((s) => s.id === id);
    if (!def || !this.depenser(def.cout)) return false;
    this.save.specialites = [...(this.save.specialites ?? []), id];
    this.persist();
    return true;
  }

  get emplacements(): number {
    return this.save.emplacements ?? 2;
  }

  acheterEmplacement(): boolean {
    const cout = coutEmplacement(this.emplacements);
    if (cout === null || !this.depenser(cout)) return false;
    this.save.emplacements = this.emplacements + 1;
    this.persist();
    return true;
  }

  get equipees(): SpecialiteId[] {
    return (this.save.equipees ?? []) as SpecialiteId[];
  }

  /** équipe ou retire une spécialité ; respecte le nombre d'emplacements */
  basculerEquipee(id: SpecialiteId): boolean {
    if (!this.aSpecialite(id)) return false;
    const liste = [...this.equipees];
    const i = liste.indexOf(id);
    if (i >= 0) liste.splice(i, 1);
    else {
      if (liste.length >= this.emplacements) return false;
      liste.push(id);
    }
    this.save.equipees = liste;
    this.persist();
    return true;
  }

  estEquipee(id: SpecialiteId): boolean {
    return this.equipees.includes(id);
  }

  /* ------------------------------------------------------------ */
  /* contrat et forme du jour                                     */
  /* ------------------------------------------------------------ */

  /** prépare le contrat et la forme pour l'étape à venir */
  preparerEtape(force = false): void {
    const stage = this.tourDef.stages[this.save.tour.currentStage];
    if (!stage) return;
    if (!force && this.save.contrat && this.save.forme) return;
    const alea = () => Math.random();
    const c = proposerContrat(stage, this.moyenneStats, alea);
    this.save.contrat = { ...c, accepte: false };
    this.save.forme = tirerForme(alea);
    this.persist();
  }

  accepterContrat(accepte: boolean): void {
    if (this.save.contrat) {
      this.save.contrat.accepte = accepte;
      this.persist();
    }
  }

  /** relance la forme du jour contre des points */
  relancerForme(): boolean {
    if (!this.depenser(COUTS.relancerForme)) return false;
    this.save.forme = tirerForme(() => Math.random());
    this.persist();
    return true;
  }

  get contrat(): (Contrat & { accepte: boolean }) | null {
    return (this.save.contrat as (Contrat & { accepte: boolean }) | null) ?? null;
  }

  get forme(): Forme | null {
    return (this.save.forme as Forme | null) ?? null;
  }

  /** efface contrat et forme après une étape courue */
  cloreEtape(): void {
    this.save.contrat = null;
    this.save.forme = null;
  }

  /**
   * Bilan d'une étape : badges obtenus et contrat évalué.
   *
   * Appelé après l'enregistrement des temps, de sorte que les classements
   * soient déjà à jour quand on vérifie un maillot ou une place au général.
   */
  bilanEtape(ctx: {
    place: number;
    total: number;
    ecartVainqueur: number;
    typeEtape: StageType;
    difficulte: string;
    suivi: {
      energieMin: number;
      colsEnTete: number;
      colsHcEnTete: number;
      sprintsTop3: number;
      aEteDansEchappee: boolean;
    };
    tourTermine: boolean;
    maillotsGagnes: string[];
  }): { badges: BadgeId[]; contrat: { reussi: boolean; points: number; texte: string } | null } {
    const nouveaux: BadgeId[] = [];
    const gagner = (id: BadgeId) => {
      if (this.obtenirBadge(id)) nouveaux.push(id);
    };

    if (ctx.place === 1) {
      gagner('premiere-victoire');
      if (ctx.typeEtape === 'clm') gagner('chrono');
      if (ctx.typeEtape === 'plaine') gagner('sprinteur-ne');
      if (ctx.suivi.aEteDansEchappee) gagner('baroudeur');
      if (ctx.ecartVainqueur <= -30 || ctx.ecartVainqueur >= 30) gagner('solitaire');
      if (ctx.difficulte === 'legende') gagner('face-au-mur');
    }
    if (ctx.typeEtape === 'montagne' && ctx.suivi.energieMin >= 20) gagner('increvable');

    const suivi = this.save.suivi ?? { colsHorsCategorie: 0, toursTermines: 0 };
    suivi.colsHorsCategorie += ctx.suivi.colsHcEnTete;
    this.save.suivi = suivi;
    if (suivi.colsHorsCategorie >= 3) gagner('roi-montagne');

    if (ctx.tourTermine) {
      if (ctx.maillotsGagnes.length >= 4) gagner('grand-chelem');
    }

    // évaluation du contrat
    let bilanContrat: { reussi: boolean; points: number; texte: string } | null = null;
    const c = this.contrat;
    if (c && c.accepte) {
      let reussi = false;
      switch (c.type) {
        case 'victoire':
          reussi = ctx.place === 1;
          break;
        case 'place':
          reussi = ctx.place <= c.cible;
          break;
        case 'sprint-intermediaire':
          reussi = ctx.suivi.sprintsTop3 >= 1;
          break;
        case 'col-en-tete':
          reussi = ctx.suivi.colsEnTete >= c.cible;
          break;
        case 'echappee':
          reussi = ctx.suivi.aEteDansEchappee;
          break;
        case 'energie':
          reussi = ctx.suivi.energieMin >= c.cible;
          break;
      }
      const points = reussi ? c.recompense : -c.penalite;
      if (reussi) this.crediter(c.recompense);
      else this.save.upgradePoints = Math.max(0, this.save.upgradePoints - c.penalite);
      bilanContrat = { reussi, points, texte: c.texte };
    }

    this.cloreEtape();
    this.persist();
    return { badges: nouveaux, contrat: bilanContrat };
  }

  /* ------------------------------------------------------------ */
  /* achats divers                                                */
  /* ------------------------------------------------------------ */

  get bidonsBonus(): number {
    return this.save.bidonsBonus ?? 0;
  }

  acheterBidon(): boolean {
    const n = this.bidonsBonus;
    if (n >= COUTS.bidonSupplementaire.length) return false;
    if (!this.depenser(COUTS.bidonSupplementaire[n])) return false;
    this.save.bidonsBonus = n + 1;
    this.persist();
    return true;
  }

  niveauEquipier(id: string): number {
    return this.save.equipiersAmeliores?.[id] ?? 0;
  }

  ameliorerEquipier(id: string): boolean {
    const n = this.niveauEquipier(id);
    if (n >= COUTS.equipier.length) return false;
    if (!this.depenser(COUTS.equipier[n])) return false;
    this.save.equipiersAmeliores = { ...(this.save.equipiersAmeliores ?? {}), [id]: n + 1 };
    this.persist();
    return true;
  }
}
