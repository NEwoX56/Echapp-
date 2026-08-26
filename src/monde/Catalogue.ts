import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Catalogue d'objets posables.
 *
 * L'onglet Test permet de meubler soi-même un parcours. Pour que ce soit
 * jouable — et pas un exercice de modélisation 3D — chaque objet est une
 * pièce toute faite, construite ici à partir de primitives et peinte au
 * sommet plutôt qu'au matériau.
 *
 * Peindre les couleurs dans la géométrie a une conséquence heureuse : tous
 * les modèles partagent un seul et même matériau. Poser deux cents objets
 * de vingt types différents ne coûte donc que vingt appels de rendu, ce qui
 * reste dans le budget d'un navigateur de console.
 */

export type CategorieObjet = 'nature' | 'batiment' | 'route' | 'course' | 'divers';

export interface ModeleObjet {
  id: string;
  nom: string;
  categorie: CategorieObjet;
  /** hauteur approximative en mètres, affichée dans la palette */
  hauteur: number;
  /** construite à la demande, puis mise en cache */
  geo: () => THREE.BufferGeometry;
}

/* ------------------------------------------------------------------ */
/* primitives peintes                                                  */
/* ------------------------------------------------------------------ */

/** ajoute un attribut de couleur constant et déindexe, pour que tout se fusionne */
function peindre(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const p = g.index ? g.toNonIndexed() : g;
  if (p !== g) g.dispose();
  const c = new THREE.Color(hex);
  const n = p.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  p.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return p;
}

const boite = (
  w: number, h: number, d: number, c: number,
  x = 0, y = 0, z = 0, ry = 0, rx = 0
): THREE.BufferGeometry =>
  peindre(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).translate(x, y, z), c);

const cyl = (
  rh: number, rb: number, h: number, seg: number, c: number,
  x = 0, y = 0, z = 0, rz = 0, rx = 0
): THREE.BufferGeometry =>
  peindre(
    new THREE.CylinderGeometry(rh, rb, h, seg).rotateX(rx).rotateZ(rz).translate(x, y, z),
    c
  );

const cone = (
  r: number, h: number, seg: number, c: number,
  x = 0, y = 0, z = 0, ry = 0
): THREE.BufferGeometry =>
  peindre(new THREE.ConeGeometry(r, h, seg).rotateY(ry).translate(x, y, z), c);

const bille = (r: number, c: number, x = 0, y = 0, z = 0, seg = 7): THREE.BufferGeometry =>
  peindre(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)).translate(x, y, z), c);

const caillou = (r: number, c: number, x = 0, y = 0, z = 0, sy = 1): THREE.BufferGeometry =>
  peindre(new THREE.IcosahedronGeometry(r, 0).scale(1, sy, 0.9).translate(x, y, z), c);

const fusion = (...p: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const g = mergeGeometries(p, false);
  for (const x of p) x.dispose();
  return g ?? new THREE.BufferGeometry();
};

/* ------------------------------------------------------------------ */
/* modèles                                                             */
/* ------------------------------------------------------------------ */

const VERT_FEUILLE = 0x4a7c3f;
const VERT_SOMBRE = 0x2f5c33;
const BOIS = 0x6b4c35;
const PIERRE = 0xb9b0a0;
const TUILE = 0x9c4f34;
const ARDOISE = 0x4c5158;
const BLANC = 0xe8e6e0;
const METAL = 0x8d949c;
const ASPHALTE = 0x3b3f45;

/**
 * Toit à deux pentes. Un cône à quatre côtés fait un toit pyramidal
 * convaincant et ne coûte que six triangles ; on l'aplatit sur un axe pour
 * obtenir une vraie toiture rectangulaire.
 */
function toit(w: number, h: number, d: number, c: number, y: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.72, h, 4).rotateY(Math.PI / 4);
  g.scale(w, 1, d);
  g.translate(0, y + h / 2, 0);
  return peindre(g, c);
}

const MODELES: ModeleObjet[] = [
  /* ---- nature ---- */
  {
    id: 'chene', nom: 'Chêne', categorie: 'nature', hauteur: 8,
    geo: () => fusion(
      cyl(0.22, 0.34, 3.2, 6, BOIS, 0, 1.6, 0),
      bille(1.9, VERT_FEUILLE, 0, 4.4, 0),
      bille(1.35, VERT_SOMBRE, 0.9, 5.4, 0.4),
      bille(1.2, VERT_FEUILLE, -0.8, 5.1, -0.5)
    )
  },
  {
    id: 'pin', nom: 'Pin', categorie: 'nature', hauteur: 10,
    geo: () => fusion(
      cyl(0.18, 0.28, 3.4, 5, 0x5a4530, 0, 1.7, 0),
      cone(1.7, 3.0, 7, VERT_SOMBRE, 0, 4.2, 0),
      cone(1.35, 2.6, 7, VERT_SOMBRE, 0, 5.9, 0),
      cone(0.95, 2.2, 7, VERT_FEUILLE, 0, 7.4, 0)
    )
  },
  {
    id: 'cypres', nom: 'Cyprès', categorie: 'nature', hauteur: 9,
    geo: () => fusion(
      cyl(0.12, 0.2, 1.2, 5, 0x5a4530, 0, 0.6, 0),
      cone(0.72, 7.4, 7, 0x36512f, 0, 4.5, 0)
    )
  },
  {
    id: 'palmier', nom: 'Palmier', categorie: 'nature', hauteur: 9,
    geo: () => fusion(
      cyl(0.2, 0.32, 6.4, 6, 0x8a6f4e, 0.25, 3.2, 0, 0.07),
      boite(3.4, 0.12, 0.75, 0x3f7a45, 1.7, 6.5, 0, 0, -0.22),
      boite(3.4, 0.12, 0.75, 0x3f7a45, -1.5, 6.5, 0, Math.PI, -0.22),
      boite(3.2, 0.12, 0.7, 0x468a4c, 0.2, 6.6, 1.6, Math.PI / 2, -0.22),
      boite(3.2, 0.12, 0.7, 0x468a4c, 0.2, 6.6, -1.6, -Math.PI / 2, -0.22)
    )
  },
  {
    id: 'buisson', nom: 'Buisson', categorie: 'nature', hauteur: 1.6,
    geo: () => fusion(
      bille(0.85, VERT_FEUILLE, 0, 0.7, 0, 6),
      bille(0.6, VERT_SOMBRE, 0.7, 0.5, 0.3, 6)
    )
  },
  {
    id: 'rocher', nom: 'Rocher', categorie: 'nature', hauteur: 2.4,
    geo: () => fusion(
      caillou(1.5, 0x8b8578, 0, 0.9, 0, 0.75),
      caillou(0.8, 0x9a9386, 1.4, 0.5, 0.5, 0.8)
    )
  },
  {
    id: 'haie', nom: 'Haie', categorie: 'nature', hauteur: 1.5,
    geo: () => fusion(boite(6, 1.4, 0.9, 0x3d6b36, 0, 0.7, 0))
  },

  /* ---- bâtiments ---- */
  {
    id: 'maison', nom: 'Maison', categorie: 'batiment', hauteur: 7,
    geo: () => fusion(
      boite(7, 4.2, 6, 0xd9cfbc, 0, 2.1, 0),
      toit(7.6, 2.4, 6.6, TUILE, 4.2),
      boite(1.1, 2.1, 0.16, 0x6b4a30, 0, 1.05, 3.05),
      boite(1.2, 1.1, 0.14, 0x7fa3bd, -2.2, 2.6, 3.04),
      boite(1.2, 1.1, 0.14, 0x7fa3bd, 2.2, 2.6, 3.04)
    )
  },
  {
    id: 'chalet', nom: 'Chalet', categorie: 'batiment', hauteur: 7,
    geo: () => fusion(
      boite(6.4, 3.4, 5.4, 0x8a6842, 0, 1.7, 0),
      boite(7.4, 0.3, 6.4, 0x6b4c35, 0, 3.5, 0),
      toit(7.6, 2.9, 6.6, 0x53422f, 3.6),
      boite(6.6, 0.14, 0.9, 0x6b4c35, 0, 2.5, 2.8)
    )
  },
  {
    id: 'grange', nom: 'Grange', categorie: 'batiment', hauteur: 8,
    geo: () => fusion(
      boite(12, 4.6, 7, 0xa8563c, 0, 2.3, 0),
      toit(12.8, 2.6, 7.6, ARDOISE, 4.6),
      boite(3.2, 3.4, 0.18, 0x5c3a26, 0, 1.7, 3.55)
    )
  },
  {
    id: 'immeuble', nom: 'Immeuble', categorie: 'batiment', hauteur: 18,
    geo: () => fusion(
      boite(9, 16, 9, 0xc9c2b4, 0, 8, 0),
      boite(9.3, 0.5, 9.3, 0xa9a294, 0, 4.2, 0),
      boite(9.3, 0.5, 9.3, 0xa9a294, 0, 8.6, 0),
      boite(9.3, 0.5, 9.3, 0xa9a294, 0, 13, 0),
      boite(9.4, 0.4, 9.4, ARDOISE, 0, 16.2, 0)
    )
  },
  {
    id: 'tour-verre', nom: 'Tour de verre', categorie: 'batiment', hauteur: 34,
    geo: () => fusion(
      boite(8, 30, 8, 0x5d7a8c, 0, 15, 0),
      boite(8.3, 0.45, 8.3, 0x8fa3b0, 0, 7, 0),
      boite(8.3, 0.45, 8.3, 0x8fa3b0, 0, 15, 0),
      boite(8.3, 0.45, 8.3, 0x8fa3b0, 0, 23, 0),
      boite(6, 2.2, 6, METAL, 0, 31, 0)
    )
  },
  {
    id: 'eglise', nom: 'Église', categorie: 'batiment', hauteur: 20,
    geo: () => fusion(
      boite(8, 5.5, 14, PIERRE, 0, 2.75, 0),
      toit(8.6, 2.8, 14.6, ARDOISE, 5.5),
      boite(4.2, 13, 4.2, PIERRE, 0, 6.5, -8),
      cone(3.2, 5, 4, ARDOISE, 0, 15.5, -8, Math.PI / 4),
      boite(0.22, 1.6, 0.22, 0xd9c98a, 0, 19, -8)
    )
  },
  {
    id: 'hangar', nom: 'Hangar', categorie: 'batiment', hauteur: 8,
    geo: () => fusion(
      boite(16, 5, 11, 0xb5bcc2, 0, 2.5, 0),
      cyl(5.6, 5.6, 16, 10, METAL, 0, 5, 0, Math.PI / 2, 0),
      boite(6, 4.2, 0.2, 0x6d757c, 0, 2.1, 5.6)
    )
  },
  {
    id: 'tour-chateau', nom: 'Tour de château', categorie: 'batiment', hauteur: 16,
    geo: () => fusion(
      cyl(2.6, 3.1, 12, 9, 0x9e988a, 0, 6, 0),
      cyl(3.3, 3.3, 1.1, 9, 0x8b8577, 0, 12.4, 0),
      cone(3.2, 4, 9, ARDOISE, 0, 14.6, 0),
      boite(0.6, 1.2, 0.4, 0x2a2622, 0, 8, 3)
    )
  },
  {
    id: 'ruine', nom: 'Ruine', categorie: 'batiment', hauteur: 5,
    geo: () => fusion(
      boite(7, 3.6, 0.7, 0x9c9689, 0, 1.8, -3),
      boite(0.7, 4.6, 5.4, 0x9c9689, -3.2, 2.3, -0.5),
      boite(2.6, 1.6, 0.7, 0x9c9689, 2, 0.8, 2.4),
      caillou(1, 0x8b8578, 1.2, 0.4, 0.6, 0.5)
    )
  },
  {
    id: 'phare', nom: 'Phare', categorie: 'batiment', hauteur: 22,
    geo: () => fusion(
      cyl(3.4, 4.2, 1.6, 10, PIERRE, 0, 0.8, 0),
      cyl(1.5, 2.4, 14, 10, BLANC, 0, 8.6, 0),
      cyl(1.6, 1.6, 2, 10, 0xb03a2e, 0, 10.4, 0),
      cyl(2, 2, 0.5, 10, ARDOISE, 0, 15.8, 0),
      cyl(1.3, 1.3, 2.2, 8, 0xffe7ae, 0, 17.1, 0),
      cone(1.9, 1.8, 8, ARDOISE, 0, 19.1, 0)
    )
  },
  {
    id: 'moulin', nom: 'Moulin', categorie: 'batiment', hauteur: 14,
    geo: () => fusion(
      cyl(2.2, 3.2, 8.5, 9, 0xd6cdb8, 0, 4.25, 0),
      cone(2.9, 2.6, 9, 0x6b4c35, 0, 9.8, 0),
      boite(0.35, 8.6, 0.2, BOIS, 0, 9, 2.9),
      boite(8.6, 0.35, 0.2, BOIS, 0, 9, 2.9),
      boite(0.9, 3.4, 0.1, 0xe4dccb, 2.1, 11.2, 2.98),
      boite(0.9, 3.4, 0.1, 0xe4dccb, -2.1, 6.8, 2.98)
    )
  },

  /* ---- route ---- */
  {
    id: 'lampadaire', nom: 'Lampadaire', categorie: 'route', hauteur: 6.5,
    geo: () => fusion(
      cyl(0.09, 0.15, 6.2, 6, 0x3a3f47, 0, 3.1, 0),
      boite(1.8, 0.1, 0.1, 0x3a3f47, -0.9, 6.15, 0),
      boite(0.62, 0.16, 0.3, 0xffe6b0, -1.7, 6.0, 0)
    )
  },
  {
    id: 'panneau', nom: 'Panneau', categorie: 'route', hauteur: 3,
    geo: () => fusion(
      cyl(0.06, 0.06, 2.4, 5, METAL, 0, 1.2, 0),
      boite(1.5, 0.9, 0.08, 0x1d5fa8, 0, 2.6, 0),
      boite(1.35, 0.16, 0.1, BLANC, 0, 2.6, 0.05)
    )
  },
  {
    id: 'barriere', nom: 'Barrière de course', categorie: 'route', hauteur: 1.2,
    geo: () => fusion(
      boite(2.4, 0.12, 0.06, METAL, 0, 1.05, 0),
      boite(2.4, 0.12, 0.06, METAL, 0, 0.62, 0),
      boite(0.09, 1.1, 0.09, METAL, -1.15, 0.55, 0),
      boite(0.09, 1.1, 0.09, METAL, 1.15, 0.55, 0),
      boite(2.1, 0.42, 0.03, 0xf2d64b, 0, 0.84, 0.04)
    )
  },
  {
    id: 'borne', nom: 'Borne kilométrique', categorie: 'route', hauteur: 1.1,
    geo: () => fusion(
      boite(0.34, 0.9, 0.24, BLANC, 0, 0.45, 0),
      boite(0.36, 0.22, 0.26, 0xd23b2e, 0, 0.82, 0)
    )
  },
  {
    id: 'muret', nom: 'Muret de pierre', categorie: 'route', hauteur: 1,
    geo: () => fusion(
      boite(6, 0.85, 0.5, 0xa39a88, 0, 0.42, 0),
      boite(6.2, 0.14, 0.62, 0x8e8574, 0, 0.9, 0)
    )
  },
  {
    id: 'pylone', nom: 'Pylône', categorie: 'route', hauteur: 20,
    geo: () => fusion(
      boite(0.28, 18, 0.28, METAL, -1.4, 9, 0, 0, 0.05),
      boite(0.28, 18, 0.28, METAL, 1.4, 9, 0, 0, -0.05),
      boite(3.2, 0.2, 0.2, METAL, 0, 6, 0),
      boite(3.2, 0.2, 0.2, METAL, 0, 12, 0),
      boite(7, 0.24, 0.24, METAL, 0, 16.5, 0),
      boite(5, 0.24, 0.24, METAL, 0, 18.4, 0)
    )
  },

  /* ---- course ---- */
  {
    id: 'arche', nom: 'Arche gonflable', categorie: 'course', hauteur: 8,
    geo: () => fusion(
      cyl(0.55, 0.7, 6, 8, 0xd23b2e, -5, 3, 0),
      cyl(0.55, 0.7, 6, 8, 0xd23b2e, 5, 3, 0),
      boite(11.2, 1.5, 1.1, 0xd23b2e, 0, 6.6, 0),
      boite(9.4, 0.9, 0.12, BLANC, 0, 6.6, 0.6)
    )
  },
  {
    id: 'podium', nom: 'Podium', categorie: 'course', hauteur: 2.4,
    geo: () => fusion(
      boite(2.2, 1.5, 2, 0xf2d64b, 0, 0.75, 0),
      boite(2.2, 1.1, 2, 0xc9c2b4, -2.3, 0.55, 0),
      boite(2.2, 0.8, 2, 0xb98a4a, 2.3, 0.4, 0),
      boite(7.2, 0.16, 2.3, 0x2b2f36, 0, 0.08, 0)
    )
  },
  {
    id: 'tente', nom: 'Tente de village', categorie: 'course', hauteur: 4,
    geo: () => fusion(
      boite(5.4, 0.1, 5.4, BLANC, 0, 2.5, 0),
      toit(5.8, 1.4, 5.8, BLANC, 2.5),
      boite(0.12, 2.5, 0.12, METAL, -2.5, 1.25, -2.5),
      boite(0.12, 2.5, 0.12, METAL, 2.5, 1.25, -2.5),
      boite(0.12, 2.5, 0.12, METAL, -2.5, 1.25, 2.5),
      boite(0.12, 2.5, 0.12, METAL, 2.5, 1.25, 2.5)
    )
  },
  {
    id: 'camion', nom: 'Camion d’équipe', categorie: 'course', hauteur: 3.8,
    geo: () => fusion(
      boite(2.5, 2.6, 8, BLANC, 0, 2.1, -0.6),
      boite(2.4, 1.9, 2.4, 0x2f6fb5, 0, 1.6, 4.4),
      boite(2.2, 0.9, 0.14, 0x2a2e34, 0, 2.1, 5.55),
      cyl(0.62, 0.62, 0.4, 8, ASPHALTE, -1.25, 0.62, 3.4, Math.PI / 2),
      cyl(0.62, 0.62, 0.4, 8, ASPHALTE, 1.25, 0.62, 3.4, Math.PI / 2),
      cyl(0.62, 0.62, 0.4, 8, ASPHALTE, -1.25, 0.62, -2.6, Math.PI / 2),
      cyl(0.62, 0.62, 0.4, 8, ASPHALTE, 1.25, 0.62, -2.6, Math.PI / 2)
    )
  },
  {
    id: 'voiture', nom: 'Voiture suiveuse', categorie: 'course', hauteur: 1.8,
    geo: () => fusion(
      boite(1.9, 0.95, 4.4, 0xc23b3b, 0, 0.75, 0),
      boite(1.7, 0.72, 2.2, 0x2b3038, 0, 1.5, -0.25),
      boite(1.3, 0.1, 1.1, 0x2a2e34, 0, 1.92, -0.3),
      cyl(0.36, 0.36, 0.26, 8, ASPHALTE, -0.95, 0.36, 1.5, Math.PI / 2),
      cyl(0.36, 0.36, 0.26, 8, ASPHALTE, 0.95, 0.36, 1.5, Math.PI / 2),
      cyl(0.36, 0.36, 0.26, 8, ASPHALTE, -0.95, 0.36, -1.5, Math.PI / 2),
      cyl(0.36, 0.36, 0.26, 8, ASPHALTE, 0.95, 0.36, -1.5, Math.PI / 2)
    )
  },
  {
    id: 'spectateur', nom: 'Spectateur', categorie: 'course', hauteur: 1.75,
    geo: () => fusion(
      cyl(0.17, 0.2, 0.95, 6, 0x2f5f9e, 0, 0.95, 0),
      boite(0.16, 0.75, 0.16, 0x2b3038, -0.09, 0.38, 0),
      boite(0.16, 0.75, 0.16, 0x2b3038, 0.09, 0.38, 0),
      bille(0.17, 0xd9a97f, 0, 1.6, 0, 6),
      boite(0.11, 0.62, 0.11, 0x2f5f9e, -0.27, 1.42, 0, 0, 0.5),
      boite(0.11, 0.62, 0.11, 0x2f5f9e, 0.27, 1.42, 0, 0, -0.5)
    )
  },
  {
    id: 'drapeau', nom: 'Drapeau', categorie: 'course', hauteur: 5,
    geo: () => fusion(
      cyl(0.05, 0.07, 4.6, 5, 0xd8d4cc, 0, 2.3, 0),
      boite(1.7, 1.05, 0.05, 0xf2d64b, 0.85, 4.1, 0)
    )
  },

  /* ---- divers ---- */
  {
    id: 'eolienne', nom: 'Éolienne', categorie: 'divers', hauteur: 30,
    geo: () => fusion(
      cyl(0.55, 1.1, 24, 10, BLANC, 0, 12, 0),
      boite(1.2, 1.2, 2.6, 0xdedad2, 0, 24.4, 0),
      boite(0.5, 11, 0.16, BLANC, 0, 30, 1.4),
      boite(0.5, 11, 0.16, BLANC, -4.8, 21.6, 1.4, 0, 0),
      boite(0.5, 11, 0.16, BLANC, 4.8, 21.6, 1.4, 0, 0)
    )
  },
  {
    id: 'silo', nom: 'Silo', categorie: 'divers', hauteur: 14,
    geo: () => fusion(
      cyl(2, 2, 11, 10, 0xc6c0b2, 0, 5.5, 0),
      cone(2.3, 2.4, 10, METAL, 0, 12.2, 0),
      boite(0.14, 10, 0.14, METAL, 2.05, 5, 0)
    )
  },
  {
    id: 'statue', nom: 'Statue', categorie: 'divers', hauteur: 6,
    geo: () => fusion(
      boite(2.4, 1.2, 2.4, 0x8e8778, 0, 0.6, 0),
      boite(1.6, 2.2, 1.6, 0xa39c8d, 0, 2.3, 0),
      cyl(0.28, 0.34, 1.8, 7, 0x7d8a76, 0, 4.3, 0),
      bille(0.36, 0x7d8a76, 0, 5.4, 0, 6)
    )
  },
  {
    id: 'vache', nom: 'Vache', categorie: 'divers', hauteur: 1.6,
    geo: () => fusion(
      boite(0.85, 0.95, 2.1, BLANC, 0, 1.05, 0),
      boite(0.5, 0.55, 0.6, 0x2b2b2b, 0, 1.25, 1.25),
      boite(0.2, 0.72, 0.2, 0x2b2b2b, -0.3, 0.36, 0.7),
      boite(0.2, 0.72, 0.2, 0x2b2b2b, 0.3, 0.36, 0.7),
      boite(0.2, 0.72, 0.2, 0x2b2b2b, -0.3, 0.36, -0.7),
      boite(0.2, 0.72, 0.2, 0x2b2b2b, 0.3, 0.36, -0.7),
      boite(0.5, 0.4, 0.55, 0x3a3a3a, 0.1, 1.5, -0.3)
    )
  },
  {
    id: 'mouton', nom: 'Mouton', categorie: 'divers', hauteur: 1,
    geo: () => fusion(
      bille(0.52, 0xdedad2, 0, 0.7, 0, 6),
      bille(0.24, 0x35302c, 0, 0.78, 0.55, 5),
      boite(0.12, 0.42, 0.12, 0x35302c, -0.2, 0.21, 0.22),
      boite(0.12, 0.42, 0.12, 0x35302c, 0.2, 0.21, 0.22),
      boite(0.12, 0.42, 0.12, 0x35302c, -0.2, 0.21, -0.22),
      boite(0.12, 0.42, 0.12, 0x35302c, 0.2, 0.21, -0.22)
    )
  },
  {
    id: 'fontaine', nom: 'Fontaine', categorie: 'divers', hauteur: 2.6,
    geo: () => fusion(
      cyl(2.1, 2.3, 0.8, 12, 0xa8a094, 0, 0.4, 0),
      cyl(1.85, 1.85, 0.5, 12, 0x4f7d95, 0, 0.72, 0),
      cyl(0.3, 0.42, 1.6, 8, 0xa8a094, 0, 1.6, 0),
      cyl(0.95, 0.2, 0.35, 10, 0xa8a094, 0, 2.5, 0)
    )
  }
];

/* ------------------------------------------------------------------ */
/* accès                                                              */
/* ------------------------------------------------------------------ */

const cache = new Map<string, THREE.BufferGeometry>();

export const CATALOGUE: readonly ModeleObjet[] = MODELES;

export const LIBELLE_CATEGORIE: Record<CategorieObjet, string> = {
  nature: 'Nature',
  batiment: 'Bâtiments',
  route: 'Bord de route',
  course: 'Course',
  divers: 'Divers'
};

export function modele(id: string): ModeleObjet | undefined {
  return MODELES.find((m) => m.id === id);
}

/**
 * Géométrie d'un modèle, construite une seule fois pour toute la session.
 * Elle n'est jamais disposée : une poignée de kilo-octets partagés vaut mieux
 * que de reconstruire à chaque changement d'étape.
 */
export function geometrie(id: string): THREE.BufferGeometry | null {
  const c = cache.get(id);
  if (c) return c;
  const m = modele(id);
  if (!m) return null;
  const g = m.geo();
  cache.set(id, g);
  return g;
}

/** matériau unique de tous les objets posés : les couleurs vivent dans la géométrie */
let materiauPartage: THREE.MeshStandardMaterial | null = null;
export function materiauObjets(): THREE.MeshStandardMaterial {
  if (!materiauPartage) {
    materiauPartage = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.04
    });
  }
  return materiauPartage;
}
