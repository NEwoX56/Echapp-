import * as THREE from 'three';
import type { Track } from './Track';

/**
 * Les spectateurs qui courent à côté des coureurs.
 *
 * L'image même d'une étape de montagne : dans les pourcentages, le peloton
 * roule si lentement qu'un supporter peut tenir à sa hauteur quelques
 * secondes en courant sur le bas-côté, avant d'être lâché.
 *
 * Ils n'apparaissent donc que dans les fortes pentes, et seulement autour de
 * l'homme de tête. Une poignée d'entre eux suffit : ce sont des silhouettes
 * qu'on aperçoit une seconde, pas une foule à simuler. Chacun est un objet
 * ordinaire — à ce nombre-là, l'instanciation coûterait plus en complexité
 * qu'elle ne rapporterait.
 */

const NB = 7;
/** pente à partir de laquelle on peut suivre un coureur en courant, en % */
const PENTE_MINI = 4.5;

interface Coureur {
  groupe: THREE.Group;
  buste: THREE.Mesh;
  actif: boolean;
  dist: number;
  lat: number;
  /** vitesse propre, en unités/s */
  vitesse: number;
  /** temps restant avant d'être lâché */
  reste: number;
  phase: number;
}

export class Supporters {
  readonly group = new THREE.Group();
  private coureurs: Coureur[] = [];
  private jetables: (THREE.Material | THREE.BufferGeometry)[] = [];
  private delai = 0;
  private tmp = new THREE.Vector3();
  private tan = new THREE.Vector3();

  constructor(ombres: boolean) {
    const gBuste = new THREE.CapsuleGeometry(0.17, 0.6, 3, 6);
    const gTete = new THREE.SphereGeometry(0.115, 6, 5);
    const gBras = new THREE.CapsuleGeometry(0.055, 0.42, 2, 5);
    this.jetables.push(gBuste, gTete, gBras);

    const peaux = [0xf2d3bb, 0xe2b48f, 0xc98d63, 0xb07b4f, 0x8d5a34, 0x5f3720];
    for (let i = 0; i < NB; i++) {
      const g = new THREE.Group();
      const mBuste = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5),
        roughness: 0.85
      });
      const mPeau = new THREE.MeshStandardMaterial({
        color: peaux[Math.floor(Math.random() * peaux.length)],
        roughness: 0.8
      });
      this.jetables.push(mBuste, mPeau);

      const buste = new THREE.Mesh(gBuste, mBuste);
      buste.position.y = 0.48;
      buste.castShadow = ombres;
      const tete = new THREE.Mesh(gTete, mPeau);
      tete.position.y = 1.0;
      // un bras en l'air : on encourage en agitant la main
      const bras = new THREE.Mesh(gBras, mPeau);
      bras.position.set(0.16, 0.95, 0);
      bras.rotation.z = -0.5;
      g.add(buste, tete, bras);
      g.visible = false;
      this.group.add(g);
      this.coureurs.push({
        groupe: g,
        buste,
        actif: false,
        dist: 0,
        lat: 0,
        vitesse: 0,
        reste: 0,
        phase: Math.random() * 6.28
      });
    }
  }

  /**
   * @param teteDist distance de l'homme de tête
   * @param vitesseTete sa vitesse, en unités/s
   * @param pente pourcentage de pente à cet endroit
   */
  update(dt: number, track: Track, teteDist: number, vitesseTete: number, pente: number): void {
    const ouvert = pente >= PENTE_MINI && teteDist > 40 && teteDist < track.length - 30;

    // apparition : un supporter s'élance de temps en temps
    this.delai -= dt;
    if (ouvert && this.delai <= 0) {
      this.delai = 0.5 + Math.random() * 1.4;
      const libre = this.coureurs.find((c) => !c.actif);
      if (libre) {
        libre.actif = true;
        libre.groupe.visible = true;
        // il démarre un peu devant, sur un bas-côté
        libre.dist = teteDist + 4 + Math.random() * 16;
        libre.lat = (Math.random() > 0.5 ? 1 : -1) * (5.6 + Math.random() * 1.6);
        // il court à peu près à l'allure du coureur, jamais plus vite longtemps
        libre.vitesse = vitesseTete * (0.9 + Math.random() * 0.2);
        libre.reste = 2.5 + Math.random() * 3.5;
      }
    }

    for (const c of this.coureurs) {
      if (!c.actif) continue;
      c.reste -= dt;
      // il s'essouffle : la vitesse retombe avant qu'il ne renonce
      const fatigue = Math.max(0.35, Math.min(1, c.reste / 1.6));
      c.dist += c.vitesse * fatigue * dt;
      c.phase += dt * 13;

      if (c.reste <= 0 || Math.abs(c.dist - teteDist) > 55) {
        c.actif = false;
        c.groupe.visible = false;
        continue;
      }

      track.pose(c.dist, c.lat, this.tmp, this.tan);
      c.groupe.position.set(this.tmp.x, this.tmp.y + track.groundAt(c.dist, c.lat), this.tmp.z);
      // face à la route, penché vers l'avant, avec le rebond de la course
      c.groupe.rotation.y = Math.atan2(this.tan.x, this.tan.z);
      c.groupe.position.y += Math.abs(Math.sin(c.phase)) * 0.11;
      c.buste.rotation.x = 0.18 + Math.sin(c.phase) * 0.06;
    }
  }

  dispose(): void {
    for (const d of this.jetables) d.dispose();
  }
}
