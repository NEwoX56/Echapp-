import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Décor optionnel chargé depuis des fichiers GLB.
 *
 * Le jeu fonctionne sans : chaque élément absent retombe sur la version
 * procédurale. Quand un fichier est présent, sa géométrie est aplatie en un
 * seul buffer réutilisable par `InstancedMesh` — c'est ce qui permet
 * d'afficher des milliers d'arbres ou de spectateurs sans écrouler le
 * framerate. Un GLB posé tel quel, cloné mille fois, serait injouable.
 *
 * Fichiers reconnus, à déposer dans `public/models/scenery/` :
 *
 *   tree-pine.glb        conifère (étapes de montagne)
 *   tree-broadleaf.glb   feuillu (plaine et vallonné)
 *   rock.glb             rocher
 *   barrier.glb          barrière de course (~2 m de long)
 *   spectator.glb        spectateur debout (~1,75 m)
 *
 * Chacun accepte aussi des variantes numérotées — tree-pine-2.glb,
 * tree-pine-3.glb, etc. — piochées au hasard à l'instanciation. Sans elles,
 * une forêt entière répète le même arbre : la première variante venait
 * seule, ce qui se voyait immédiatement sur un flanc de montagne couvert.
 *
 * Conventions : orienté +Z, origine au sol (y=0), échelle en mètres.
 * L'échelle est corrigée automatiquement si le modèle est trop grand ou
 * trop petit (voir `normalise`).
 */

export interface SceneryPiece {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** hauteur du modèle après normalisation, en mètres */
  height: number;
}

const FILES = {
  treePine: 'tree-pine',
  treeBroadleaf: 'tree-broadleaf',
  rock: 'rock',
  barrier: 'barrier',
  spectator: 'spectator'
} as const;

export type SceneryKey = keyof typeof FILES;

/** nombre de variantes numérotées tentées en plus du fichier principal */
const VARIANTS = 5;

/** hauteur attendue de chaque élément, sert à recaler l'échelle */
const TARGET_HEIGHT: Record<SceneryKey, number> = {
  treePine: 6.5,
  treeBroadleaf: 5.5,
  rock: 1.6,
  barrier: 1.0,
  spectator: 1.75
};

export class SceneryAssets {
  private loader = new GLTFLoader();
  private pools = new Map<SceneryKey, SceneryPiece[]>();
  private loaded = false;

  /** true si au moins un modèle externe a été trouvé */
  get hasAny(): boolean {
    return this.pools.size > 0;
  }

  /** une pièce quelconque de la variété disponible, ou null */
  get(key: SceneryKey): SceneryPiece | null {
    const pool = this.pools.get(key);
    return pool?.[0] ?? null;
  }

  /** une pièce tirée au hasard dans la variété disponible, ou null */
  getRandom(key: SceneryKey, rand: () => number = Math.random): SceneryPiece | null {
    const pool = this.pools.get(key);
    if (!pool?.length) return null;
    return pool[Math.floor(rand() * pool.length)];
  }

  async preload(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await Promise.all(
      (Object.keys(FILES) as SceneryKey[]).map(async (key) => {
        const noms = [FILES[key], ...Array.from({ length: VARIANTS }, (_, i) => `${FILES[key]}-${i + 2}`)];
        const pieces = await Promise.all(noms.map((nom) => this.loadPiece(nom, key)));
        const trouvees = pieces.filter((p): p is SceneryPiece => p !== null);
        if (trouvees.length) this.pools.set(key, trouvees);
      })
    );
  }

  private async loadPiece(nom: string, key: SceneryKey): Promise<SceneryPiece | null> {
    try {
      const gltf = await this.loader.loadAsync(`models/scenery/${nom}.glb`);
      return this.flatten(gltf.scene, key);
    } catch {
      return null; // fichier absent : cette variante n'existe pas
    }
  }

  /**
   * Aplatit une scène glTF en une géométrie unique instanciable.
   *
   * Les matériaux multiples sont fusionnés en un seul : on conserve la
   * couleur du matériau dominant (celui qui couvre le plus de sommets) et on
   * transfère les couleurs des autres dans l'attribut `color` des sommets.
   * C'est un compromis assumé : on perd les textures, on gagne la capacité
   * d'instancier des milliers de copies en un seul draw call.
   */
  private flatten(root: THREE.Object3D, key: SceneryKey): SceneryPiece | null {
    root.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    const colors: THREE.Color[] = [];
    let dominant: THREE.MeshStandardMaterial | null = null;
    let dominantCount = 0;

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      for (const attr of Object.keys(g.attributes)) {
        if (!['position', 'normal'].includes(attr)) g.deleteAttribute(attr);
      }
      if (!g.attributes.normal) g.computeVertexNormals();

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const mat = mats[0] as THREE.MeshStandardMaterial;
      const col = mat?.color ? mat.color.clone() : new THREE.Color(0x8a8a8a);
      const n = g.attributes.position.count;
      if (n > dominantCount) {
        dominantCount = n;
        dominant = mat ?? null;
      }
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = col.r;
        arr[i * 3 + 1] = col.g;
        arr[i * 3 + 2] = col.b;
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
      geos.push(g);
      colors.push(col);
    });

    if (!geos.length) return null;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    if (!merged) return null;

    const height = this.normalise(merged, key);

    const src = dominant as THREE.MeshStandardMaterial | null;
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: src?.roughness ?? 0.85,
      metalness: src?.metalness ?? 0,
      flatShading: false
    });

    return { geometry: merged, material, height };
  }

  /**
   * Recentre le modèle sur son origine au sol et ramène sa hauteur à la
   * valeur attendue. Sans cela, un pack dont l'unité est le centimètre
   * produirait des arbres de 600 m de haut.
   */
  private normalise(g: THREE.BufferGeometry, key: SceneryKey): number {
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const size = new THREE.Vector3();
    bb.getSize(size);
    const h = size.y || 1;
    const scale = TARGET_HEIGHT[key] / h;

    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    const m = new THREE.Matrix4()
      .makeScale(scale, scale, scale)
      .multiply(new THREE.Matrix4().makeTranslation(-cx, -bb.min.y, -cz));
    g.applyMatrix4(m);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return TARGET_HEIGHT[key];
  }

  dispose(): void {
    for (const pool of this.pools.values()) {
      for (const p of pool) {
        p.geometry.dispose();
        p.material.dispose();
      }
    }
    this.pools.clear();
  }
}
