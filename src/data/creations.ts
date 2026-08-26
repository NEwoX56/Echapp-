import type { StageDef, TourDef } from './types';

/**
 * Créations du joueur.
 *
 * Les étapes écrites dans l'onglet Test vivent à côté des tours officiels,
 * dans le stockage local du navigateur. Ce sont de vraies StageDef : rien ne
 * les distingue au moteur, elles se jouent, se survolent et se meublent
 * exactement comme les autres. Seul l'onglet Test sait qu'elles existent.
 */

const CLE = 'echappee-creations-v1';
const VERSION = 1;

/** tour composé d'étapes créées */
export interface TourCree {
  id: string;
  name: string;
  region: string;
  /** identifiants d'étapes créées, dans l'ordre */
  etapes: string[];
}

interface Coffre {
  version: number;
  etapes: StageDef[];
  tours: TourCree[];
}

function vide(): Coffre {
  return { version: VERSION, etapes: [], tours: [] };
}

export class Creations {
  private data: Coffre = vide();

  constructor() {
    this.charger();
  }

  private charger(): void {
    try {
      const brut = localStorage.getItem(CLE);
      if (!brut) return;
      const d = JSON.parse(brut) as Coffre;
      if (!d || !Array.isArray(d.etapes)) return;
      this.data = {
        version: VERSION,
        etapes: d.etapes.filter((e) => e && typeof e.id === 'string'),
        tours: Array.isArray(d.tours) ? d.tours : []
      };
    } catch {
      // stockage illisible ou refusé : on repart d'un coffre vide plutôt que
      // de faire échouer le démarrage du jeu
      this.data = vide();
    }
  }

  persister(): void {
    try {
      localStorage.setItem(CLE, JSON.stringify(this.data));
    } catch {
      /* quota plein ou navigation privée : la session reste jouable */
    }
  }

  etapes(): StageDef[] {
    return this.data.etapes;
  }

  tours(): TourCree[] {
    return this.data.tours;
  }

  etape(id: string): StageDef | undefined {
    return this.data.etapes.find((e) => e.id === id);
  }

  /** ajoute ou remplace une étape ; rend l'étape enregistrée */
  enregistrer(stage: StageDef): StageDef {
    const s: StageDef = { ...stage, creee: true };
    const i = this.data.etapes.findIndex((e) => e.id === s.id);
    if (i >= 0) this.data.etapes[i] = s;
    else this.data.etapes.push(s);
    this.persister();
    return s;
  }

  supprimer(id: string): void {
    this.data.etapes = this.data.etapes.filter((e) => e.id !== id);
    for (const t of this.data.tours) t.etapes = t.etapes.filter((e) => e !== id);
    this.persister();
  }

  dupliquer(id: string): StageDef | null {
    const src = this.etape(id);
    if (!src) return null;
    const copie: StageDef = {
      ...structuredClone(src),
      id: nouvelId('etape'),
      name: `${src.name} (copie)`,
      seed: (src.seed + 977) % 100000
    };
    return this.enregistrer(copie);
  }

  /* ---- tours ---- */

  creerTour(name: string, region: string, etapes: string[] = []): TourCree {
    const t: TourCree = { id: nouvelId('tour'), name, region, etapes };
    this.data.tours.push(t);
    this.persister();
    return t;
  }

  majTour(tour: TourCree): void {
    const i = this.data.tours.findIndex((t) => t.id === tour.id);
    if (i >= 0) this.data.tours[i] = tour;
    else this.data.tours.push(tour);
    this.persister();
  }

  supprimerTour(id: string): void {
    this.data.tours = this.data.tours.filter((t) => t.id !== id);
    this.persister();
  }

  /** version jouable d'un tour créé : les étapes y sont résolues */
  tourDef(id: string): TourDef | null {
    const t = this.data.tours.find((x) => x.id === id);
    if (!t) return null;
    const stages = t.etapes
      .map((sid) => this.etape(sid))
      .filter((s): s is StageDef => s !== undefined);
    if (!stages.length) return null;
    return { id: t.id, name: t.name, region: t.region, requiredLevel: 0, stages };
  }

  /* ---- échange ---- */

  exporter(): string {
    return JSON.stringify(this.data, null, 1);
  }

  /**
   * Importe un fichier de créations sans écraser les siennes : les
   * identifiants qui existent déjà sont réattribués, si bien que recevoir
   * deux fois le même parcours donne deux parcours, jamais un conflit.
   */
  importer(json: string): { etapes: number; tours: number } {
    const d = JSON.parse(json) as Partial<Coffre>;
    if (!d || !Array.isArray(d.etapes)) throw new Error('Fichier de créations illisible');
    const renommage = new Map<string, string>();
    let nbE = 0;
    for (const brute of d.etapes) {
      if (!brute || typeof brute.id !== 'string') continue;
      const s = structuredClone(brute) as StageDef;
      if (this.etape(s.id)) {
        const neuf = nouvelId('etape');
        renommage.set(s.id, neuf);
        s.id = neuf;
      }
      this.enregistrer(s);
      nbE++;
    }
    let nbT = 0;
    for (const t of d.tours ?? []) {
      if (!t || typeof t.id !== 'string') continue;
      const etapes = (t.etapes ?? []).map((e) => renommage.get(e) ?? e);
      this.creerTour(t.name ?? 'Tour importé', t.region ?? '', etapes);
      nbT++;
    }
    this.persister();
    return { etapes: nbE, tours: nbT };
  }

  toutEffacer(): void {
    this.data = vide();
    this.persister();
  }
}

/** identifiant court et unique, lisible dans les fichiers exportés */
export function nouvelId(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

export const creations = new Creations();
