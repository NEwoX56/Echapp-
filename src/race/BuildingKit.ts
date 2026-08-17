import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Immeubles assemblés à partir de vrais modèles 3D (Kenney Modular
 * Buildings, CC0), optionnels comme le reste du décor GLB.
 *
 * Contrairement à `SceneryAssets` — qui recale chaque pièce à une hauteur
 * cible indépendante — les pièces ici doivent garder entre elles la même
 * échelle : un étage (`wall`) et le toit (`roof`) partagent la même emprise
 * au sol (1×1 unité dans le fichier source) pour s'empiler sans marche ni
 * trou. On ne touche donc pas à l'échelle d'origine ; c'est l'appelant
 * (`Decor.batir`) qui choisit le facteur mètres/unité et la hauteur d'étage.
 *
 * Fichiers reconnus, dans `public/models/scenery/` :
 *
 *   building-wall-a.glb   étage avec fenêtres
 *   building-wall-b.glb   étage avec baie vitrée
 *   building-ground.glb   rez-de-chaussée avec entrée
 *   building-roof.glb     toit plat de couronnement
 *
 * La face « habitée » (fenêtres/porte) de chaque pièce regarde vers -X dans
 * le fichier source : `Decor` applique une rotation fixe pour l'orienter
 * vers la route.
 */

export interface BuildingPiece {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** emprise au sol dans les unités du fichier source (généralement 1×1) */
  footprint: THREE.Vector2;
  /** hauteur dans les unités du fichier source */
  height: number;
}

const WALL_FILES = ['building-wall-a', 'building-wall-b'];
const GROUND_FILE = 'building-ground';
const ROOF_FILE = 'building-roof';

export class BuildingKit {
  private loader = new GLTFLoader();
  walls: BuildingPiece[] = [];
  ground: BuildingPiece | null = null;
  roof: BuildingPiece | null = null;
  private loaded = false;

  /** vrai si assez de pièces sont là pour assembler un immeuble complet */
  get available(): boolean {
    return this.walls.length > 0 && this.roof !== null;
  }

  async preload(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const [walls, ground, roof] = await Promise.all([
      Promise.all(WALL_FILES.map((n) => this.loadPiece(n))),
      this.loadPiece(GROUND_FILE),
      this.loadPiece(ROOF_FILE)
    ]);
    this.walls = walls.filter((p): p is BuildingPiece => p !== null);
    this.ground = ground;
    this.roof = roof;
  }

  private async loadPiece(name: string): Promise<BuildingPiece | null> {
    try {
      const gltf = await this.loader.loadAsync(`models/scenery/${name}.glb`);
      return this.flatten(gltf.scene);
    } catch {
      return null; // fichier absent : cette pièce reste indisponible
    }
  }

  /** aplatit en une géométrie unique, sans re-normaliser l'échelle (voir en-tête) */
  private flatten(root: THREE.Object3D): BuildingPiece | null {
    root.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
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
      /*
       * Le bleu pâle d'origine du matériau « Glass » se distingue à peine du
       * mur crème sous un ciel clair : les fenêtres disparaissaient à
       * distance. On le fonce pour qu'elles se lisent nettement, comme un
       * vitrage qui renvoie le ciel plutôt qu'une façade éclairée de l'intérieur.
       */
      if (mat?.name && /glass|window/i.test(mat.name)) col.set(0x2c3a44);
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
    });

    if (!geos.length) return null;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    if (!merged) return null;

    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const size = new THREE.Vector3();
    bb.getSize(size);
    // recentré en x/z, posé au sol : c'est l'appelant qui choisit l'échelle finale
    const m = new THREE.Matrix4().makeTranslation(
      -(bb.min.x + bb.max.x) / 2,
      -bb.min.y,
      -(bb.min.z + bb.max.z) / 2
    );
    merged.applyMatrix4(m);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    const src = dominant as THREE.MeshStandardMaterial | null;
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: src?.roughness ?? 0.9,
      metalness: src?.metalness ?? 0,
      flatShading: false
    });

    return { geometry: merged, material, footprint: new THREE.Vector2(size.x, size.z), height: size.y };
  }

  dispose(): void {
    for (const p of [...this.walls, this.ground, this.roof]) {
      p?.geometry.dispose();
      p?.material.dispose();
    }
    this.walls = [];
    this.ground = null;
    this.roof = null;
  }
}
