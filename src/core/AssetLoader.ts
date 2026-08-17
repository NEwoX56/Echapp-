import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildRider, type RiderVisual, type RiderOptions } from '../models/RiderModel';
import type { RiderAppearance } from '../data/appearance';
import { SceneryAssets } from './SceneryAssets';
import { BuildingKit } from '../race/BuildingKit';
import { Sky } from '../race/Sky';

/**
 * Point d'entrée unique pour les modèles 3D.
 *
 * Par défaut : coureur + vélo générés en procédural (RiderModel), entièrement
 * personnalisables (peau, maillot, sponsor, cadre, roues).
 *
 * Si un fichier /public/models/rider.glb est déposé, il prend le relais :
 *   - orienté +Z, ~1.8 unité de haut, sol à y=0
 *   - matériau nommé "Jersey" recoloré automatiquement
 * Aucune autre modification de code nécessaire.
 */
export class AssetLoader {
  private loader = new GLTFLoader();
  private riderTemplate: THREE.Group | null = null;
  private tried = false;
  /** décor externe optionnel (arbres, rochers, barrières, spectateurs) */
  readonly scenery = new SceneryAssets();
  /** immeubles assemblés à partir de vrais modèles 3D, optionnel */
  readonly buildings = new BuildingKit();
  /** panoramas de ciel photographiques */
  readonly sky = new Sky();

  async preload(): Promise<void> {
    if (this.tried) return;
    this.tried = true;
    const rider = this.loader
      .loadAsync('models/rider.glb')
      .then((gltf) => {
        this.riderTemplate = gltf.scene;
      })
      .catch(() => {
        this.riderTemplate = null; // pas de GLB : modèle procédural
      });
    await Promise.all([rider, this.scenery.preload(), this.buildings.preload(), this.sky.preload()]);
  }

  createRider(appearance: RiderAppearance, options: RiderOptions = {}): RiderVisual {
    if (this.riderTemplate) {
      const clone = this.riderTemplate.clone(true);
      clone.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat.name === 'Jersey') {
            const m2 = mat.clone();
            m2.color = new THREE.Color(appearance.jerseyPrimary);
            mesh.material = m2;
          }
        }
      });
      return {
        group: clone,
        update: () => {
          /* AnimationMixer à brancher ici si le GLB contient un pédalage */
        },
        dispose: () => {}
      };
    }
    return buildRider(appearance, options);
  }
}
