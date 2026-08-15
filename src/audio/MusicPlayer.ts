import type { AudioEngine } from './AudioEngine';
import type { Ambiance } from './Music';
import type { MusicLibrary } from './MusicLibrary';

/**
 * Musique fournie par le joueur.
 *
 * Si des fichiers audio sont déposés dans `public/audio/`, ils remplacent la
 * musique générée. Chaque ambiance a son fichier ; celles qui manquent
 * retombent sur la musique procédurale, si bien qu'on peut n'en fournir
 * qu'une ou deux.
 *
 * Les morceaux sont lus par des éléments `<audio>` routés dans le bus musique
 * via `createMediaElementSource`. C'est un choix délibéré face au décodage
 * complet en mémoire : un morceau de trois minutes décodé occupe une
 * trentaine de mégaoctets de mémoire vive, ce qui est intenable dans le
 * navigateur d'une console. L'élément `<audio>` diffuse en continu et ne
 * garde qu'un tampon.
 */

/** extensions tentées dans l'ordre, la première trouvée gagne */
const EXTENSIONS = ['mp3', 'ogg', 'm4a', 'wav'];

const NOMS: Record<Exclude<Ambiance, 'aucune'>, string> = {
  menu: 'menu',
  course: 'course',
  tension: 'tension',
  finale: 'finale',
  victoire: 'victoire'
};

interface Piste {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  fichier: string;
}

const FONDU = 1.6;

export class MusicPlayer {
  private engine: AudioEngine;
  private bibliotheque: MusicLibrary | null = null;
  private pistes = new Map<string, Piste>();
  private dispo = new Map<string, string>();
  private courante: string | null = null;
  private sonde = false;
  /**
   * Jeton incrémenté à chaque changement. Les mises en pause sont différées
   * de la durée du fondu ; sans ce jeton, une pause programmée par un
   * changement précédent viendrait couper une piste relancée entre-temps.
   */
  private jeton = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  /** la bibliothèque importée depuis le jeu prime sur les fichiers du dossier */
  attacherBibliotheque(lib: MusicLibrary): void {
    this.bibliotheque = lib;
  }

  /** à appeler après un import ou une suppression */
  rafraichir(ambiance: string): void {
    const piste = this.pistes.get(ambiance);
    if (piste) {
      piste.element.pause();
      piste.gain.disconnect();
      piste.source.disconnect();
      this.pistes.delete(ambiance);
    }
    if (this.courante === ambiance) this.courante = null;
  }

  private urlPour(ambiance: string): string | null {
    return this.bibliotheque?.url(ambiance) ?? this.dispo.get(ambiance) ?? null;
  }

  /**
   * Cherche les fichiers présents. Ne décode rien : on teste seulement leur
   * existence, le chargement réel n'a lieu qu'à la première lecture.
   */
  async detecter(): Promise<void> {
    if (this.sonde) return;
    this.sonde = true;
    await Promise.all(
      (Object.keys(NOMS) as Exclude<Ambiance, 'aucune'>[]).map(async (amb) => {
        for (const ext of EXTENSIONS) {
          const url = `audio/${NOMS[amb]}.${ext}`;
          try {
            const r = await fetch(url, { method: 'HEAD' });
            // un serveur statique mal configuré peut renvoyer la page
            // d'accueil au lieu d'un 404 : on vérifie donc le type déclaré
            const type = r.headers.get('content-type') ?? '';
            if (r.ok && !type.includes('text/html')) {
              this.dispo.set(amb, url);
              return;
            }
          } catch {
            /* fichier absent */
          }
        }
      })
    );
  }

  /** ambiances pour lesquelles un fichier a été trouvé */
  get ambiancesFournies(): string[] {
    return [...this.dispo.keys()];
  }

  aFichier(ambiance: Ambiance): boolean {
    return !!this.urlPour(ambiance);
  }

  get actif(): boolean {
    return this.dispo.size > 0 || (this.bibliotheque?.ambiances().length ?? 0) > 0;
  }

  /** ambiances couvertes, bibliothèque et dossier confondus */
  get toutesAmbiances(): string[] {
    const s = new Set<string>([...this.dispo.keys(), ...(this.bibliotheque?.ambiances() ?? [])]);
    return [...s];
  }

  private creer(ambiance: string): Piste | null {
    const ctx = this.engine.context;
    const bus = this.engine.musiqueBus;
    const url = this.urlPour(ambiance);
    if (!ctx || !bus || !url) return null;

    const element = new Audio(url);
    element.loop = true;
    element.preload = 'auto';
    element.crossOrigin = 'anonymous';
    // le volume de l'élément reste à 1 : tout le dosage passe par le bus,
    // pour que les réglages du menu s'appliquent aussi à ces pistes
    element.volume = 1;

    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(element);
    } catch {
      return null;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(bus);

    const piste: Piste = { element, source, gain, fichier: url };
    this.pistes.set(ambiance, piste);
    return piste;
  }

  /**
   * Bascule sur l'ambiance demandée en fondu enchaîné.
   * Retourne false si aucun fichier ne correspond : l'appelant reprend alors
   * la musique procédurale.
   */
  jouer(ambiance: Ambiance): boolean {
    const ctx = this.engine.context;
    if (!ctx) return false;

    if (ambiance === 'aucune' || !this.aFichier(ambiance)) {
      this.stopper();
      return false;
    }
    if (this.courante === ambiance) return true;

    const jeton = ++this.jeton;
    const t = ctx.currentTime;
    // fondu sortant de la piste précédente
    if (this.courante) {
      const ancienne = this.pistes.get(this.courante);
      if (ancienne) {
        ancienne.gain.gain.cancelScheduledValues(t);
        ancienne.gain.gain.setValueAtTime(ancienne.gain.gain.value, t);
        ancienne.gain.gain.linearRampToValueAtTime(0, t + FONDU);
        const el = ancienne.element;
        window.setTimeout(() => {
          // ne rien faire si un autre changement est survenu depuis
          if (this.jeton !== jeton) return;
          el.pause();
        }, FONDU * 1000 + 120);
      }
    }

    const piste = this.pistes.get(ambiance) ?? this.creer(ambiance);
    if (!piste) return false;

    piste.gain.gain.cancelScheduledValues(t);
    piste.gain.gain.setValueAtTime(piste.gain.gain.value, t);
    piste.gain.gain.linearRampToValueAtTime(1, t + FONDU);
    const p = piste.element.play();
    if (p) p.catch(() => undefined);

    this.courante = ambiance;
    return true;
  }

  stopper(): void {
    const ctx = this.engine.context;
    if (!ctx) return;
    if (this.courante === null) return;
    const jeton = ++this.jeton;
    const t = ctx.currentTime;
    for (const piste of this.pistes.values()) {
      piste.gain.gain.cancelScheduledValues(t);
      piste.gain.gain.setValueAtTime(piste.gain.gain.value, t);
      piste.gain.gain.linearRampToValueAtTime(0, t + 0.8);
      window.setTimeout(() => {
        if (this.jeton !== jeton) return;
        piste.element.pause();
      }, 900);
    }
    this.courante = null;
  }

  dispose(): void {
    for (const piste of this.pistes.values()) {
      piste.element.pause();
      piste.gain.disconnect();
      piste.source.disconnect();
    }
    this.pistes.clear();
    this.courante = null;
  }
}
