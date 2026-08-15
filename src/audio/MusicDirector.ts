import type { AudioEngine } from './AudioEngine';
import { Music, type Ambiance } from './Music';
import { MusicPlayer } from './MusicPlayer';
import { MusicLibrary } from './MusicLibrary';

/**
 * Chef d'orchestre.
 *
 * Arbitre pour chaque ambiance entre la musique fournie par le joueur et la
 * musique générée. L'arbitrage est fait ambiance par ambiance et non une fois
 * pour toutes : on peut ne fournir qu'un thème de course et garder le
 * procédural pour le menu, la tension et la finale.
 *
 * Quand un fichier prend la main, le générateur est mis en veille pour éviter
 * que les deux se superposent.
 */
export class MusicDirector {
  readonly generee: Music;
  readonly fournie: MusicPlayer;
  readonly bibliotheque = new MusicLibrary();
  private ambiance: Ambiance = 'aucune';

  constructor(engine: AudioEngine) {
    this.generee = new Music(engine);
    this.fournie = new MusicPlayer(engine);
  }

  /** cherche les fichiers du joueur ; à appeler au démarrage */
  async detecter(): Promise<void> {
    await this.bibliotheque.init();
    this.fournie.attacherBibliotheque(this.bibliotheque);
    await this.fournie.detecter();
  }

  /** après import ou suppression d'un morceau */
  rafraichir(ambiance: string): void {
    this.fournie.rafraichir(ambiance);
    if (this.ambiance === ambiance) {
      // relancer l'ambiance courante pour prendre en compte le changement
      const a = this.ambiance;
      this.ambiance = 'aucune';
      this.jouer(a);
    }
  }

  get ambianceCourante(): Ambiance {
    return this.ambiance;
  }

  /** liste des ambiances couvertes par un fichier */
  get ambiancesFournies(): string[] {
    return this.fournie.toutesAmbiances;
  }

  jouer(ambiance: Ambiance): void {
    if (this.ambiance === ambiance) return;
    this.ambiance = ambiance;

    if (ambiance !== 'aucune' && this.fournie.aFichier(ambiance)) {
      // un fichier couvre cette ambiance : on coupe le générateur
      this.generee.jouer('aucune');
      this.fournie.jouer(ambiance);
      return;
    }
    this.fournie.stopper();
    this.generee.jouer(ambiance);
  }

  setIntensite(v: number): void {
    // l'intensité ne s'applique qu'à la musique générée : un morceau fourni
    // a son propre arrangement, le modifier le dénaturerait
    this.generee.setIntensite(v);
  }

  tick(): void {
    this.generee.tick();
  }

  dispose(): void {
    this.generee.dispose();
    this.fournie.dispose();
  }

  /** pour les réglages : d'où vient la musique en cours */
  get sourceCourante(): 'fichier' | 'generee' | 'aucune' {
    if (this.ambiance === 'aucune') return 'aucune';
    return this.fournie.aFichier(this.ambiance) ? 'fichier' : 'generee';
  }
}
