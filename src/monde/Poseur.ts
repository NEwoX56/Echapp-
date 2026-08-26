import * as THREE from 'three';
import type { ObjetPose } from '../data/types';
import { geometrie, materiauObjets } from './Catalogue';

/** ce que le poseur attend de la piste : de quoi placer un objet au sol */
export interface PisteObjets {
  length: number;
  pose(dist: number, lateral: number, out: THREE.Vector3, tan?: THREE.Vector3): void;
  groundAt(dist: number, lat: number): number;
}

/**
 * Objets posés à la main sur un parcours.
 *
 * Contrairement au décor automatique, qui est figé une fois pour toutes à la
 * construction de l'étape, ceux-ci s'ajoutent et se retirent pendant qu'on
 * regarde. Chaque type garde donc son propre lot d'instances, avec de la
 * marge : poser un arbre de plus ne recrée rien tant que la réserve n'est pas
 * pleine, on se contente d'écrire une matrice et de relever le compteur.
 */
export class Poseur {
  readonly group = new THREE.Group();
  private piste: PisteObjets;
  private ombres: boolean;
  private lots = new Map<string, { mesh: THREE.InstancedMesh; capacite: number }>();
  private objets: ObjetPose[] = [];

  private tmp = new THREE.Vector3();
  private tan = new THREE.Vector3();

  constructor(piste: PisteObjets, objets: ObjetPose[] = [], ombres = false) {
    this.piste = piste;
    this.ombres = ombres;
    this.group.name = 'objets-poses';
    for (const o of objets) this.objets.push({ ...o });
    this.reconstruire();
  }

  /** copie de la liste, prête à être enregistrée dans la définition d'étape */
  liste(): ObjetPose[] {
    return this.objets.map((o) => ({ ...o }));
  }

  get nombre(): number {
    return this.objets.length;
  }

  ajouter(o: ObjetPose): boolean {
    if (!geometrie(o.type)) return false;
    this.objets.push({ ...o });
    this.majType(o.type);
    return true;
  }

  /** retire le dernier objet posé ; rend son type pour le message à l'écran */
  annuler(): ObjetPose | null {
    const o = this.objets.pop();
    if (!o) return null;
    this.majType(o.type);
    return o;
  }

  /** retire l'objet le plus proche d'un point du parcours, s'il y en a un */
  retirerPres(dist: number, lat: number, rayon = 12): ObjetPose | null {
    let best = -1;
    let bestD = rayon * rayon;
    this.objets.forEach((o, i) => {
      const dd = (o.dist - dist) ** 2 + (o.lat - lat) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    if (best < 0) return null;
    const [o] = this.objets.splice(best, 1);
    this.majType(o.type);
    return o;
  }

  vider(): void {
    const types = new Set(this.objets.map((o) => o.type));
    this.objets = [];
    for (const t of types) this.majType(t);
  }

  /** remplace toute la liste (chargement d'une création) */
  remplacer(objets: ObjetPose[]): void {
    this.vider();
    this.objets = objets.map((o) => ({ ...o }));
    this.reconstruire();
  }

  private reconstruire(): void {
    const types = new Set(this.objets.map((o) => o.type));
    for (const t of types) this.majType(t);
  }

  /**
   * Réécrit le lot d'un type. La réserve double quand elle déborde : on ne
   * recrée donc un InstancedMesh qu'une poignée de fois, pas à chaque pose.
   */
  private majType(type: string): void {
    const geo = geometrie(type);
    if (!geo) return;
    const membres = this.objets.filter((o) => o.type === type);
    let lot = this.lots.get(type);
    if (!lot || membres.length > lot.capacite) {
      if (lot) {
        this.group.remove(lot.mesh);
        lot.mesh.dispose();
      }
      const capacite = Math.max(16, 1 << Math.ceil(Math.log2(Math.max(1, membres.length + 4))));
      const mesh = new THREE.InstancedMesh(geo, materiauObjets(), capacite);
      mesh.name = `pose-${type}`;
      mesh.castShadow = this.ombres;
      mesh.receiveShadow = false;
      // sans cela un lot vide reste visible sous forme d'instances empilées à
      // l'origine tant que le frustum n'est pas recalculé
      mesh.frustumCulled = false;
      this.group.add(mesh);
      lot = { mesh, capacite };
      this.lots.set(type, lot);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const ech = new THREE.Vector3();
    membres.forEach((o, i) => {
      this.matrice(o, m, q, up, ech);
      lot!.mesh.setMatrixAt(i, m);
    });
    lot.mesh.count = membres.length;
    lot.mesh.instanceMatrix.needsUpdate = true;
    lot.mesh.computeBoundingSphere();
  }

  private matrice(
    o: ObjetPose,
    m: THREE.Matrix4,
    q: THREE.Quaternion,
    up: THREE.Vector3,
    ech: THREE.Vector3
  ): void {
    this.piste.pose(o.dist, o.lat, this.tmp, this.tan);
    const cap = Math.atan2(this.tan.x, this.tan.z);
    q.setFromAxisAngle(up, cap + o.rot);
    ech.setScalar(o.echelle);
    m.compose(
      new THREE.Vector3(this.tmp.x, this.tmp.y + this.piste.groundAt(o.dist, o.lat), this.tmp.z),
      q,
      ech
    );
  }

  dispose(): void {
    for (const [, lot] of this.lots) {
      this.group.remove(lot.mesh);
      lot.mesh.dispose();
    }
    this.lots.clear();
    // géométries et matériau sont partagés pour toute la session : rien à jeter
  }
}
