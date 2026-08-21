import * as THREE from 'three';

/**
 * Pluie : un nuage de traits qui tombe autour du coureur.
 *
 * Le groupe suit la position du joueur à chaque image — les gouttes sont
 * stockées en coordonnées locales et n'ont donc qu'à boucler en hauteur,
 * sans jamais recalculer leur position latérale par rapport à la route.
 * Une ligne (deux sommets par goutte) plutôt qu'un point donne l'impression
 * de vitesse qu'un simple sprite rond n'aurait pas.
 */

const N = 750;
const RAYON = 24;
const HAUTEUR = 20;
const LONGUEUR_TRAIT = 0.6;
const VITESSE_MIN = 26;
const VITESSE_MAX = 34;

export class Rain {
  readonly group = new THREE.Group();
  private lignes: THREE.LineSegments;
  private positions: Float32Array;
  private vitesses: Float32Array;

  constructor() {
    this.positions = new Float32Array(N * 2 * 3);
    this.vitesses = new Float32Array(N);
    for (let i = 0; i < N; i++) this.reinit(i, Math.random() * HAUTEUR);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xcfd9e6,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });
    this.lignes = new THREE.LineSegments(geo, mat);
    this.lignes.frustumCulled = false;
    this.group.add(this.lignes);
  }

  private reinit(i: number, y: number): void {
    const x = (Math.random() - 0.5) * RAYON * 2;
    const z = (Math.random() - 0.5) * RAYON * 2;
    const o = i * 6;
    this.positions[o] = x;
    this.positions[o + 1] = y;
    this.positions[o + 2] = z;
    this.positions[o + 3] = x;
    this.positions[o + 4] = y - LONGUEUR_TRAIT;
    this.positions[o + 5] = z;
    this.vitesses[i] = VITESSE_MIN + Math.random() * (VITESSE_MAX - VITESSE_MIN);
  }

  /** centre le nuage sur le coureur et fait tomber les gouttes */
  update(dt: number, centre: THREE.Vector3): void {
    this.group.position.set(centre.x, 0, centre.z);
    const pos = this.positions;
    for (let i = 0; i < N; i++) {
      const chute = this.vitesses[i] * dt;
      const o = i * 6;
      pos[o + 1] -= chute;
      pos[o + 4] -= chute;
      if (pos[o + 1] < 0) this.reinit(i, HAUTEUR);
    }
    this.lignes.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.lignes.geometry.dispose();
    (this.lignes.material as THREE.Material).dispose();
  }
}
