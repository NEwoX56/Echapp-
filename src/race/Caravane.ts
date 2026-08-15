import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Rider } from './Rider';
import type { Track } from './Track';

/**
 * Véhicules de course.
 *
 * Une course cycliste n'est jamais seule sur la route : une voiture de
 * direction ouvre devant les échappés, une moto suit le premier pour l'image,
 * une voiture-balai ferme la marche. Leur présence est ce qui distingue une
 * course d'une sortie d'entraînement, et elle donne au passage une échelle
 * aux distances — on comprend d'un coup d'œil ce que valent trente mètres.
 *
 * Les véhicules ne sont pas simulés : ils se calent sur des coureurs de
 * référence avec un décalage, et suivent la route par les mêmes coordonnées
 * que tout le reste. Les faire rouler pour de bon coûterait cher et
 * n'apporterait rien de visible.
 */

interface Vehicule {
  objet: THREE.Group;
  /** décalage le long de la route, en unités */
  avance: number;
  /** décalage latéral */
  lateral: number;
  /** coureur suivi : 'tete' ou 'joueur' ou 'dernier' */
  ancre: 'tete' | 'joueur' | 'dernier';
  /** distance lissée, pour éviter les à-coups */
  dist: number;
  /** hauteur au-dessus du sol */
  hauteur: number;
}

function materiau(couleur: number, rugosite = 0.6, metal = 0.15): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: couleur, roughness: rugosite, metalness: metal });
}

export class Caravane {
  readonly group = new THREE.Group();
  private vehicules: Vehicule[] = [];
  private jetables: (THREE.Material | THREE.BufferGeometry)[] = [];
  private track: Track;
  private tmp = new THREE.Vector3();
  private tan = new THREE.Vector3();

  constructor(track: Track, couleurEquipe: number) {
    this.track = track;

    this.ajouter(this.voiture(0xe8e6df, true), { avance: 34, lateral: 0, ancre: 'tete', hauteur: 0 });
    this.ajouter(this.moto(), { avance: 13, lateral: -2.6, ancre: 'tete', hauteur: 0 });
    this.ajouter(this.voiture(couleurEquipe, false), {
      avance: -22,
      lateral: 2.3,
      ancre: 'joueur',
      hauteur: 0
    });
    this.ajouter(this.voiture(0x2f7d43, false), {
      avance: -16,
      lateral: 0,
      ancre: 'dernier',
      hauteur: 0
    });
  }

  private ajouter(brut: THREE.Group, o: Omit<Vehicule, 'objet' | 'dist'>): void {
    const objet = this.compacter(brut);
    this.group.add(objet);
    this.vehicules.push({ objet, dist: 0, ...o });
  }

  /**
   * Fusionne les pièces d'un véhicule par matériau.
   *
   * Une voiture montée en une dizaine de boîtes coûte une dizaine d'appels de
   * rendu, et quatre véhicules suffisaient à en ajouter près de quarante. Les
   * géométries partageant un matériau sont donc soudées en une seule. Les
   * roues perdent leur rotation propre au passage : à la vitesse d'une course,
   * elle n'était de toute façon pas lisible.
   */
  private compacter(g: THREE.Group): THREE.Group {
    const parMateriau = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const restants: THREE.Object3D[] = [];
    for (const enfant of [...g.children]) {
      const m = enfant as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) {
        restants.push(enfant);
        continue;
      }
      m.updateMatrix();
      const geo = m.geometry.clone().applyMatrix4(m.matrix);
      const liste = parMateriau.get(m.material as THREE.Material) ?? [];
      liste.push(geo);
      parMateriau.set(m.material as THREE.Material, liste);
      m.geometry.dispose();
    }

    const compact = new THREE.Group();
    for (const [mat, geos] of parMateriau) {
      const fusion = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
      if (!fusion) continue;
      for (const geo of geos) if (geo !== fusion) geo.dispose();
      const mesh = new THREE.Mesh(fusion, mat);
      mesh.castShadow = true;
      compact.add(mesh);
      this.jetables.push(fusion);
    }
    for (const r of restants) compact.add(r);
    return compact;
  }

  /** berline de direction, avec vélos sur le toit pour les voitures d'équipe */
  private voiture(couleur: number, direction: boolean): THREE.Group {
    const g = new THREE.Group();
    const carrosserie = materiau(couleur, 0.42, 0.35);
    const vitre = new THREE.MeshStandardMaterial({
      color: 0x1a2028,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.82
    });
    const sombre = materiau(0x15171c, 0.9, 0.05);

    const caisse = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 4.5), carrosserie);
    caisse.position.y = 0.78;
    g.add(caisse);

    const habitacle = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.72, 2.3), vitre);
    habitacle.position.set(0, 1.55, -0.15);
    g.add(habitacle);

    const toit = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.12, 2.3), carrosserie);
    toit.position.set(0, 1.94, -0.15);
    g.add(toit);

    // roues : conservées pour les faire tourner
    for (const [x, z] of [
      [-0.92, 1.5],
      [0.92, 1.5],
      [-0.92, -1.5],
      [0.92, -1.5]
    ]) {
      const roue = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2),
        sombre
      );
      roue.position.set(x, 0.34, z);
      g.add(roue);
    }

    if (direction) {
      // gyrophare et panneau de toit de la voiture de direction
      const barre = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.3), materiau(0xffd633, 0.5));
      barre.position.set(0, 2.09, -0.15);
      g.add(barre);
    } else {
      // vélos de rechange sur la galerie
      for (const x of [-0.42, 0.42]) {
        const cadre = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.7), materiau(0x2b2f36, 0.5, 0.4));
        cadre.position.set(x, 2.24, -0.15);
        g.add(cadre);
        for (const z of [-0.72, 0.72]) {
          const r = new THREE.Mesh(
            new THREE.TorusGeometry(0.3, 0.04, 5, 12),
            materiau(0x101216, 0.8)
          );
          r.position.set(x, 2.24, -0.15 + z);
          r.rotation.y = Math.PI / 2;
          g.add(r);
        }
      }
    }

    this.jetables.push(carrosserie, vitre, sombre);
    return g;
  }

  /** moto de prise de vues, avec son passager tourné vers l'arrière */
  private moto(): THREE.Group {
    const g = new THREE.Group();
    const cadre = materiau(0x1d2229, 0.5, 0.4);
    const combi = materiau(0x2f3a48, 0.8, 0.05);
    const peau = materiau(0xc9a07d, 0.9, 0);

    const corps = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 1.7), cadre);
    corps.position.y = 0.72;
    g.add(corps);
    for (const z of [0.72, -0.72]) {
      const roue = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.16, 12).rotateZ(Math.PI / 2),
        materiau(0x101216, 0.85)
      );
      roue.position.set(0, 0.36, z);
      g.add(roue);
    }
    // pilote penché en avant
    const pilote = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), combi);
    pilote.position.set(0, 1.32, 0.18);
    pilote.rotation.x = 0.35;
    g.add(pilote);
    const casque = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), materiau(0xf0f1f4, 0.4));
    casque.position.set(0, 1.72, 0.32);
    g.add(casque);
    // passager tourné vers l'arrière, caméra à l'épaule
    const passager = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), combi);
    passager.position.set(0, 1.34, -0.42);
    passager.rotation.x = -0.22;
    g.add(passager);
    const casque2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), materiau(0x15171c, 0.5));
    casque2.position.set(0, 1.76, -0.5);
    g.add(casque2);
    const camera = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.36), materiau(0x0e1014, 0.6));
    camera.position.set(0.2, 1.68, -0.74);
    g.add(camera);
    const mains = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), peau);
    mains.position.set(0, 1.5, 0.42);
    g.add(mains);

    this.jetables.push(cadre, combi, peau);
    return g;
  }

  /**
   * Recale les véhicules. Ils sont masqués quand leur position sortirait du
   * parcours : une voiture de direction qui roulerait au-delà de la ligne
   * d'arrivée serait plus gênante qu'absente.
   */
  update(dt: number, riders: Rider[], joueur: Rider): void {
    let tete = -Infinity;
    let dernier = Infinity;
    for (const r of riders) {
      if (r.finished) continue;
      tete = Math.max(tete, r.dist);
      dernier = Math.min(dernier, r.dist);
    }
    if (!Number.isFinite(tete)) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    for (const v of this.vehicules) {
      const ancre = v.ancre === 'tete' ? tete : v.ancre === 'joueur' ? joueur.dist : dernier;
      const voulue = ancre + v.avance;
      // lissage : sans lui, un changement de leader ferait sauter la voiture
      // au premier appel, on se pose directement : sans cela les véhicules
      // arrivaient en glissant depuis l'origine de la scène
      v.dist = v.dist === 0 ? voulue : v.dist + (voulue - v.dist) * Math.min(1, dt * 2.4);

      /*
       * Une voiture de direction ne franchit pas la ligne devant les coureurs :
       * elle s'écarte dans le dernier hectomètre. On la fait donc glisser sur
       * le bas-côté plutôt que de la faire disparaître d'un coup, ce qui se
       * remarquait beaucoup plus.
       */
      const restant = this.track.length - v.dist;
      let lateral = v.lateral;
      if (v.ancre === 'tete' && restant < 120) {
        const k = Math.min(1, (120 - restant) / 90);
        lateral += (v.avance > 20 ? 1 : -1) * k * 9;
      }

      const hors = v.dist < -40 || v.dist > this.track.length + 130;
      v.objet.visible = !hors;
      if (hors) continue;

      this.track.pose(v.dist, lateral, this.tmp, this.tan);
      v.objet.position.set(this.tmp.x, this.tmp.y + v.hauteur, this.tmp.z);
      v.objet.rotation.y = Math.atan2(this.tan.x, this.tan.z);
    }

  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    for (const j of this.jetables) j.dispose();
  }
}
