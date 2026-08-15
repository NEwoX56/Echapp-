import * as THREE from 'three';
import type { StageType } from '../data/types';

/**
 * Ciel photographique.
 *
 * Trois panoramas équirectangulaires (photos réelles sous licence CC0,
 * Poly Haven) servent de fond de scène et d'environnement d'éclairage.
 * Le choix dépend du type d'étape : ciel dégagé en plaine, ciel chargé en
 * montagne, lumière chaude sur les étapes vallonnées.
 *
 * Le mouvement des nuages est obtenu en faisant tourner très lentement le
 * fond (`backgroundRotation`). C'est le seul moyen crédible avec une photo
 * fixe : une vraie simulation de nuages coûterait bien plus cher qu'elle ne
 * rapporterait à cette distance.
 *
 * La vitesse compte beaucoup : un tour complet en 20 min ferait pivoter le
 * ciel de 65° sur une étape, ce qui se voit immédiatement et donne le
 * tournis. Calé sur 100 min, le ciel avance d'une quinzaine de degrés sur
 * une étape — assez pour que le paysage vive, jamais assez pour distraire.
 */

const FILES: Record<StageType, string> = {
  plaine: 'sky-clear.jpg',
  clm: 'sky-clear.jpg',
  vallonnee: 'sky-warm.jpg',
  montagne: 'sky-mountain.jpg'
};

/** teinte de brume assortie à chaque ciel, pour raccorder le lointain */
const FOG: Record<StageType, number> = {
  plaine: 0xc3d4e4,
  clm: 0xc3d4e4,
  vallonnee: 0xd8cfbd,
  montagne: 0xbcc6d2
};

/** radians par seconde : un tour complet en 100 min, soit ~3,6°/min */
const DRIFT = (Math.PI * 2) / (100 * 60);

export class Sky {
  private loader = new THREE.TextureLoader();
  private textures = new Map<string, THREE.Texture>();
  private angle = 0;
  private scene: THREE.Scene | null = null;
  private loaded = false;

  /** précharge les trois panoramas ; échoue silencieusement si absents */
  async preload(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const names = [...new Set(Object.values(FILES))];
    await Promise.all(
      names.map(async (n) => {
        try {
          const tex = await this.loader.loadAsync(`textures/${n}`);
          tex.mapping = THREE.EquirectangularReflectionMapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          this.textures.set(n, tex);
        } catch {
          /* texture absente : dégradé uni de repli */
        }
      })
    );
  }

  /** true si au moins un panorama a été chargé */
  get available(): boolean {
    return this.textures.size > 0;
  }

  /** couleur de brume assortie, utilisable même sans texture */
  fogColor(type: StageType): number {
    return FOG[type];
  }

  /**
   * Applique le ciel à une scène. Retourne false si aucune texture n'est
   * disponible, auquel cas l'appelant garde son fond de couleur unie.
   */
  apply(scene: THREE.Scene, type: StageType, avecEnvironnement: boolean): boolean {
    const tex = this.textures.get(FILES[type]);
    if (!tex) return false;
    this.scene = scene;

    try {
      scene.background = tex;
      scene.backgroundIntensity = 1;

      // Le panorama en environnement donne de vrais reflets sur les lunettes,
      // les jantes et le métal du vélo. Mais Three.js doit alors générer une
      // carte PMREM, qui s'appuie sur des cibles de rendu flottantes : sur
      // certains GPU (navigateur de console notamment) l'opération échoue
      // sans lever d'erreur et la scène devient blanche. On ne l'active donc
      // que si les capacités ont été validées en amont.
      if (avecEnvironnement) {
        scene.environment = tex;
        scene.environmentIntensity = 0.55;
      } else {
        scene.environment = null;
      }

      this.angle = Math.random() * Math.PI * 2;
      this.updateRotation();
      return true;
    } catch {
      // repli complet : fond de couleur unie géré par l'appelant
      scene.background = null;
      scene.environment = null;
      this.scene = null;
      return false;
    }
  }

  private updateRotation(): void {
    const sc = this.scene;
    if (!sc) return;
    // backgroundRotation date de Three r163 : on vérifie sa présence plutôt
    // que de supposer la version du moteur côté navigateur
    if (sc.backgroundRotation) sc.backgroundRotation.set(0, this.angle, 0);
    if (sc.environment && sc.environmentRotation) {
      sc.environmentRotation.set(0, this.angle, 0);
    }
  }

  /** dérive des nuages ; à appeler une fois par frame */
  update(dt: number): void {
    if (!this.scene) return;
    this.angle += DRIFT * dt;
    this.updateRotation();
  }

  detach(): void {
    this.scene = null;
  }

  dispose(): void {
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}
