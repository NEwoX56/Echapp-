import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StageDef, StageType } from '../data/types';

/**
 * Paysages traversés.
 *
 * Une étape ne se déroulait jusqu'ici que dans un décor unique : des arbres et
 * de l'herbe du départ à l'arrivée. Une vraie course change de cadre en
 * permanence — on quitte la campagne pour un village, on franchit une rivière,
 * on longe un monument, on grimpe dans la forêt.
 *
 * Le parcours est donc découpé en zones tirées au sort selon le profil de
 * l'étape, puis chaque zone reçoit son mobilier. Le tirage est déterministe :
 * il dépend de la graine de l'étape, si bien qu'une même étape offre toujours
 * le même paysage, et deux étapes n'en offrent jamais le même.
 *
 * Tout est instancié. Une ville compte plusieurs centaines de bâtiments, et
 * les poser en objets séparés coûterait autant que le reste de la scène.
 */

export type ZoneType =
  | 'campagne'
  | 'village'
  | 'ville'
  | 'foret'
  | 'riviere'
  | 'sommet'
  | 'vignes'
  | 'littoral';

export interface Zone {
  from: number;
  to: number;
  type: ZoneType;
}

/** interface minimale attendue de la piste */
export interface PisteDecor {
  length: number;
  pose(dist: number, lateral: number, out: THREE.Vector3, tan?: THREE.Vector3): void;
  groundAt(dist: number, lat: number): number;
}

export interface ReglagesDecor {
  densiteDecor: number;
  shadows: boolean;
}

/* ------------------------------------------------------------------ */
/* Découpage du parcours                                              */
/* ------------------------------------------------------------------ */

/** enchaînements plausibles selon le profil de l'étape */
const REPERTOIRE: Record<StageType, ZoneType[]> = {
  plaine: ['campagne', 'village', 'vignes', 'ville', 'riviere', 'campagne', 'littoral', 'village'],
  vallonnee: ['campagne', 'foret', 'vignes', 'village', 'riviere', 'campagne', 'foret', 'ville'],
  montagne: ['foret', 'village', 'foret', 'sommet', 'riviere', 'sommet', 'foret', 'campagne'],
  clm: ['ville', 'campagne', 'vignes', 'village', 'riviere', 'littoral', 'ville']
};

export function decouperZones(stage: StageDef, rand: () => number): Zone[] {
  const rep = REPERTOIRE[stage.type];
  const zones: Zone[] = [];
  let d = 0;
  let i = Math.floor(rand() * rep.length);

  while (d < stage.worldLength) {
    const type = rep[i % rep.length];
    i += 1 + Math.floor(rand() * 2);
    // une ville ou un village s'étend moins qu'une campagne : on ne traverse
    // pas une agglomération pendant la moitié d'une étape
    const base =
      type === 'ville' ? 320 : type === 'village' ? 220 : type === 'riviere' ? 130 : 520;
    const longueur = base * (0.7 + rand() * 0.7);
    zones.push({ from: d, to: Math.min(stage.worldLength, d + longueur), type });
    d += longueur;
  }

  /*
   * L'arrivée se juge toujours en agglomération : c'est là que se trouvent les
   * barrières et le public, et cela donne un repère visuel fort dans le final.
   */
  const finFrom = Math.max(0, stage.worldLength - 340);
  while (zones.length && zones[zones.length - 1].from > finFrom) zones.pop();
  if (zones.length) zones[zones.length - 1].to = finFrom;
  zones.push({ from: finFrom, to: stage.worldLength, type: 'ville' });

  return zones;
}

/* ------------------------------------------------------------------ */
/* Textures                                                           */
/* ------------------------------------------------------------------ */

function textureFacade(teinte: string, nuit = false): THREE.CanvasTexture {
  const W = 64;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = teinte;
  g.fillRect(0, 0, W, H);

  // salissures et joints
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1 + Math.random() * 3);
  }

  // fenêtres : quatre colonnes, alignées, quelques-unes éclairées
  const cols = 4;
  const rangs = 10;
  const lw = W / cols;
  const lh = H / rangs;
  for (let x = 0; x < cols; x++) {
    for (let y = 1; y < rangs - 1; y++) {
      const allumee = nuit && Math.random() < 0.22;
      g.fillStyle = allumee ? 'rgba(255,214,140,0.92)' : 'rgba(28,34,44,0.85)';
      g.fillRect(x * lw + lw * 0.22, y * lh + lh * 0.24, lw * 0.56, lh * 0.5);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x * lw + lw * 0.22, y * lh + lh * 0.24, lw * 0.56, 1.5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ------------------------------------------------------------------ */
/* Construction                                                       */
/* ------------------------------------------------------------------ */

interface Placement {
  dist: number;
  lat: number;
  y: number;
  scale: THREE.Vector3;
  rotY: number;
}

export class Decor {
  readonly group = new THREE.Group();
  private jetables: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = [];
  private piste: PisteDecor;
  private q: ReglagesDecor;
  readonly zones: Zone[];

  private tmp = new THREE.Vector3();
  private tan = new THREE.Vector3();

  constructor(piste: PisteDecor, stage: StageDef, q: ReglagesDecor, rand: () => number) {
    this.piste = piste;
    this.q = q;
    this.zones = decouperZones(stage, rand);

    for (const z of this.zones) {
      switch (z.type) {
        case 'ville':
          this.batir(z, rand, true);
          this.lampadaires(z, rand);
          break;
        case 'village':
          this.batir(z, rand, false);
          break;
        case 'foret':
          this.bosquet(z, rand);
          break;
        case 'riviere':
          this.riviere(z, rand);
          break;
        case 'campagne':
          this.champs(z, rand);
          break;
        case 'vignes':
          this.vignes(z, rand);
          break;
        case 'littoral':
          this.littoral(z, rand);
          break;
        case 'sommet':
          this.hauteMontagne(z, rand);
          break;
        default:
          break;
      }
    }

    this.monuments(stage, rand);
    this.panneaux(stage, rand);
    this.bornes(stage);
    this.finaliser();
  }

  /**
   * Accumulation par type d'objet.
   *
   * Chaque zone produisait auparavant ses propres lots d'instances : avec dix
   * zones, on passait de trente à plus de cent appels de rendu, ce qui pèse
   * lourd sur un GPU modeste. Les placements sont désormais rassemblés pour
   * tout le parcours et envoyés en un seul lot par type d'objet.
   */
  private lots = new Map<
    string,
    { geo: () => THREE.BufferGeometry; mat: () => THREE.Material; places: Placement[]; ombre: boolean }
  >();

  private ajouter(
    cle: string,
    geo: () => THREE.BufferGeometry,
    mat: () => THREE.Material,
    places: Placement[],
    ombre = false
  ): void {
    if (!places.length) return;
    const lot = this.lots.get(cle);
    if (lot) lot.places.push(...places);
    else this.lots.set(cle, { geo, mat, places: [...places], ombre });
  }

  /** construit un lot d'instances par type d'objet accumulé */
  private finaliser(): void {
    for (const lot of this.lots.values()) {
      this.instancier(lot.geo(), lot.mat(), lot.places, lot.ombre);
    }
    this.lots.clear();
  }

  /** pose une série d'instances à partir d'une géométrie unique */
  private instancier(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    places: Placement[],
    ombre = false
  ): void {
    if (!places.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, places.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    places.forEach((p, i) => {
      this.piste.pose(p.dist, p.lat, pos);
      q.setFromAxisAngle(up, p.rotY);
      m.compose(new THREE.Vector3(pos.x, pos.y + p.y, pos.z), q, p.scale);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = ombre && this.q.shadows && this.q.densiteDecor >= 1;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    this.jetables.push(geo, mat);
  }

  /** orientation d'un objet aligné sur la route */
  private capAt(dist: number): number {
    this.piste.pose(dist, 0, this.tmp, this.tan);
    return Math.atan2(this.tan.x, this.tan.z);
  }

  /* ---------------- agglomérations ---------------- */

  /*
   * Plusieurs teintes de façade par palier : verre bleuté, pierre claire,
   * grès chaud, béton. Un seul ton partagé par toute la ville donnait un
   * alignement de clones — chaque bâtiment tire désormais l'une de ces
   * variantes, avec sa propre texture (fenêtres allumées différentes).
   */
  private static readonly TEINTES_HAUTS = ['#6d707a', '#8a95a3', '#8c7a68', '#767a72'];
  private static readonly TEINTES_MOYENS = ['#8a8073', '#a99378', '#8c9088', '#96877a'];
  private static readonly TEINTES_TOIT = [0x8c4a35, 0x5a5f68, 0x6b3d34];

  private batir(z: Zone, rand: () => number, urbain: boolean): void {
    const d = this.q.densiteDecor;
    const pas = (urbain ? 13 : 22) / Math.max(0.3, d);
    const nHauts = Decor.TEINTES_HAUTS.length;
    const nMoyens = Decor.TEINTES_MOYENS.length;
    const hauts: Placement[][] = Array.from({ length: nHauts }, () => []);
    const moyens: Placement[][] = Array.from({ length: nMoyens }, () => []);
    const maisons: Placement[] = [];
    const toits: Placement[][] = Decor.TEINTES_TOIT.map(() => []);
    // couronnement des tours : muret en retrait, et parfois citerne ou antenne
    const casquettes: Placement[] = [];
    const citernes: Placement[] = [];
    const antennes: Placement[] = [];
    // rez-de-chaussée commerçant des immeubles moyens : sans lui, le mur de
    // façade descendait tel quel jusqu'au trottoir
    const socles: Placement[] = [];
    const COULEURS_MARQUISE = [0xb23b32, 0x2f6b4f, 0x2c4f7a, 0xc79a3b];
    const marquises: Placement[][] = COULEURS_MARQUISE.map(() => []);

    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() > (urbain ? 0.92 : 0.6)) continue;
        const dist = x + rand() * pas * 0.7;
        const lat = side * (14 + rand() * (urbain ? 26 : 34));
        const y = this.piste.groundAt(dist, lat);
        const rotY = this.capAt(dist) + (rand() - 0.5) * 0.5;

        if (urbain && rand() < 0.42) {
          const h = 14 + rand() * 22;
          const scale = new THREE.Vector3(6 + rand() * 4, h, 6 + rand() * 4);
          hauts[Math.floor(rand() * nHauts)].push({ dist, lat, y, rotY, scale });
          casquettes.push({
            dist,
            lat,
            y: y + h,
            rotY,
            scale: new THREE.Vector3(scale.x * 0.88, 0.9, scale.z * 0.88)
          });
          const toit = rand();
          if (toit < 0.28) {
            citernes.push({
              dist: dist + (rand() - 0.5) * scale.x * 0.4,
              lat: lat + (rand() - 0.5) * scale.z * 0.4,
              y: y + h + 0.9,
              rotY,
              scale: new THREE.Vector3(1.1, 1.5 + rand(), 1.1)
            });
          } else if (toit < 0.55) {
            antennes.push({ dist, lat, y: y + h + 0.9, rotY, scale: new THREE.Vector3(1, 3 + rand() * 2.5, 1) });
          }
        } else if (urbain || rand() < 0.35) {
          const h = 7 + rand() * 6;
          const scale = new THREE.Vector3(6 + rand() * 3, h, 6 + rand() * 3);
          moyens[Math.floor(rand() * nMoyens)].push({ dist, lat, y, rotY, scale });
          if (urbain) {
            const hSocle = 2.4 + rand() * 0.5;
            socles.push({
              dist,
              lat,
              y,
              rotY,
              scale: new THREE.Vector3(scale.x * 1.04, hSocle, scale.z * 1.04)
            });
            marquises[Math.floor(rand() * COULEURS_MARQUISE.length)].push({
              dist,
              lat,
              y: y + hSocle,
              rotY,
              scale: new THREE.Vector3(scale.x * 1.1, 0.16, scale.z * 1.1)
            });
          }
        } else {
          const h = 4 + rand() * 2;
          const s = new THREE.Vector3(5 + rand() * 2, h, 5 + rand() * 2);
          maisons.push({ dist, lat, y, rotY, scale: s });
          // toit à deux pentes (pignon) posé au sommet des murs, avec léger débord
          toits[Math.floor(rand() * Decor.TEINTES_TOIT.length)].push({
            dist,
            lat,
            y: y + h,
            rotY,
            scale: new THREE.Vector3(s.x * 1.1, 2.1 + rand() * 1.1, s.z * 1.16)
          });
        }
      }
    }

    const cube = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const facade = (teinte: string, nuit: boolean, rx: number, ry: number) => () => {
      const t = textureFacade(teinte, nuit);
      t.repeat.set(rx, ry);
      this.jetables.push(t);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
    };
    // prisme à section triangulaire (3 segments radiaux), couché sur le côté :
    // la faîtière court selon x, les deux pans descendent vers ±z
    const gable = () => {
      const r = 0.62;
      return new THREE.CylinderGeometry(r, r, 1, 3).rotateZ(Math.PI / 2).translate(0, r / 2, 0);
    };

    Decor.TEINTES_HAUTS.forEach((teinte, i) =>
      this.ajouter(`imm-haut-${i}`, cube, facade(teinte, true, 2, 4), hauts[i], true)
    );
    Decor.TEINTES_MOYENS.forEach((teinte, i) =>
      this.ajouter(`imm-moyen-${i}`, cube, facade(teinte, true, 2, 2.4), moyens[i], true)
    );
    this.ajouter('maison', cube, facade('#c9bda8', false, 1.6, 1.2), maisons, true);
    Decor.TEINTES_TOIT.forEach((couleur, i) =>
      this.ajouter(
        `toit-${i}`,
        gable,
        () => new THREE.MeshStandardMaterial({ color: couleur, roughness: 1, flatShading: true }),
        toits[i],
        true
      )
    );
    this.ajouter(
      'casquette',
      cube,
      () => new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.85 }),
      casquettes,
      true
    );
    this.ajouter(
      'citerne',
      () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x4a4e58, roughness: 0.7, metalness: 0.3 }),
      citernes,
      true
    );
    this.ajouter(
      'antenne',
      () => new THREE.CylinderGeometry(0.06, 0.09, 1, 5).translate(0, 0.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.6, metalness: 0.4 }),
      antennes
    );
    // vitrine sombre en rez-de-chaussée, légèrement en saillie sur la façade
    this.ajouter(
      'socle',
      cube,
      () => new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.22, metalness: 0.2 }),
      socles,
      true
    );
    COULEURS_MARQUISE.forEach((couleur, i) =>
      this.ajouter(
        `marquise-${i}`,
        cube,
        () => new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.8 }),
        marquises[i]
      )
    );
  }

  private lampadaires(z: Zone, rand: () => number): void {
    const places: Placement[] = [];
    for (let x = z.from; x < z.to; x += 26 / Math.max(0.4, this.q.densiteDecor)) {
      for (const side of [-1, 1]) {
        const lat = side * 7.4;
        places.push({
          dist: x,
          lat,
          y: this.piste.groundAt(x, lat),
          rotY: 0,
          scale: new THREE.Vector3(1, 1, 1)
        });
      }
    }
    this.ajouter(
      'lampadaire',
      () => new THREE.CylinderGeometry(0.09, 0.13, 6, 5).translate(0, 3, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, metalness: 0.5 }),
      places
    );
  }

  /* ---------------- nature ---------------- */

  /**
   * Bosquet à essences variées.
   *
   * Un seul modèle d'arbre répété donne une forêt de sapins en plastique. On
   * mélange quatre silhouettes — épicéa, cyprès, feuillu rond et arbuste — dont
   * la proportion dépend du relief : les conifères prennent le dessus en
   * altitude, les feuillus dominent en plaine.
   */
  private bosquet(z: Zone, rand: () => number): void {
    const d = this.q.densiteDecor;
    const troncs: Placement[] = [];
    const epiceas: Placement[] = [];
    const cypres: Placement[] = [];
    const feuillus: Placement[] = [];
    const arbustes: Placement[] = [];
    const pas = 7 / Math.max(0.3, d);

    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() > 0.75) continue;
        const dist = x + rand() * pas;
        const lat = side * (12 + rand() * 80);
        const y = this.piste.groundAt(dist, lat);
        if (y > 120) continue;
        const s = 0.8 + rand() * 0.9;
        const rotY = rand() * 6.28;
        const base = { dist, lat, y, rotY, scale: new THREE.Vector3(s, s, s) };

        // en altitude, les conifères l'emportent
        const altitude = Math.min(1, Math.max(0, (y - 20) / 90));
        const tirage = rand();
        if (tirage < 0.12) {
          arbustes.push({ ...base, scale: new THREE.Vector3(s * 0.8, s * 0.7, s * 0.8) });
          continue;
        }
        troncs.push(base);
        const haut = { ...base, y: y + 1.4 * s, scale: new THREE.Vector3(s, s * (1 + rand() * 0.5), s) };
        if (tirage < 0.12 + 0.5 * altitude + 0.18) epiceas.push(haut);
        else if (tirage < 0.62) feuillus.push({ ...haut, y: y + 1.9 * s });
        else cypres.push(haut);
      }
    }

    const vert = (c: number, plat = true) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: plat });

    this.ajouter(
      'tronc',
      () => new THREE.CylinderGeometry(0.15, 0.22, 1.6, 5).translate(0, 0.8, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x4d3a29, roughness: 1 }),
      troncs
    );
    this.ajouter(
      'epicea',
      () => new THREE.ConeGeometry(1.15, 4, 6).translate(0, 2, 0),
      () => vert(0x24512c),
      epiceas,
      true
    );
    // cyprès : haut et effilé, silhouette du sud
    this.ajouter(
      'cypres',
      () => new THREE.ConeGeometry(0.62, 5.6, 6).translate(0, 2.8, 0),
      () => vert(0x1e4a30),
      cypres,
      true
    );
    // feuillu : deux masses rondes décalées, moins régulier qu'une sphère
    this.ajouter(
      'feuillu',
      () => {
        const a = new THREE.SphereGeometry(1.35, 7, 6).translate(0, 0.9, 0);
        const b = new THREE.SphereGeometry(0.95, 6, 5).translate(0.6, 1.75, -0.3);
        return mergeGeometries([a, b], false) ?? a;
      },
      () => vert(0x3c7a34),
      feuillus,
      true
    );
    this.ajouter(
      'arbuste',
      () => new THREE.SphereGeometry(0.75, 6, 5).translate(0, 0.6, 0),
      () => vert(0x4a7a3a),
      arbustes
    );
  }

  /** rangs de vigne, alignés perpendiculairement à la route */
  private vignes(z: Zone, rand: () => number): void {
    const ceps: Placement[] = [];
    const piquets: Placement[] = [];
    const pas = 3.4 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        const rotY = this.capAt(x);
        // un rang complet part du bord de route vers l'horizon
        for (let k = 0; k < 7; k++) {
          const lat = side * (14 + k * 7);
          const y = this.piste.groundAt(x, lat);
          if (y > 90) continue;
          ceps.push({ dist: x, lat, y, rotY, scale: new THREE.Vector3(1, 1, 1) });
          if (k % 3 === 0) piquets.push({ dist: x, lat, y, rotY, scale: new THREE.Vector3(1, 1, 1) });
        }
      }
    }
    this.ajouter(
      'cep',
      () => new THREE.BoxGeometry(5.6, 0.95, 0.5).translate(0, 0.75, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x3f6b32, roughness: 1, flatShading: true }),
      ceps
    );
    this.ajouter(
      'piquet-vigne',
      () => new THREE.CylinderGeometry(0.05, 0.05, 1.7, 4).translate(0, 0.85, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x6b5637, roughness: 1 }),
      piquets
    );
  }

  /** bord de mer : palmiers, sable et rochers */
  private littoral(z: Zone, rand: () => number): void {
    const troncs: Placement[] = [];
    const palmes: Placement[] = [];
    const rochers: Placement[] = [];
    const pas = 16 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() > 0.5) continue;
        const lat = side * (13 + rand() * 14);
        const y = this.piste.groundAt(x, lat);
        const s = 0.9 + rand() * 0.5;
        const rotY = rand() * 6.28;
        troncs.push({ dist: x, lat, y, rotY, scale: new THREE.Vector3(s, s, s) });
        // couronne de palmes : quatre cônes inclinés autour du sommet
        for (let k = 0; k < 4; k++) {
          palmes.push({
            dist: x,
            lat,
            y: y + 4.4 * s,
            rotY: rotY + (k * Math.PI) / 2,
            scale: new THREE.Vector3(s, s, s)
          });
        }
      }
      if (rand() < 0.45) {
        const lat = (rand() > 0.5 ? 1 : -1) * (30 + rand() * 40);
        rochers.push({
          dist: x,
          lat,
          y: this.piste.groundAt(x, lat),
          rotY: rand() * 6.28,
          scale: new THREE.Vector3(1 + rand(), 0.7 + rand() * 0.6, 1 + rand())
        });
      }
    }
    this.ajouter(
      'palmier-tronc',
      () => new THREE.CylinderGeometry(0.16, 0.26, 4.6, 6).translate(0, 2.3, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x8a7048, roughness: 1 }),
      troncs
    );
    this.ajouter(
      'palme',
      () => new THREE.ConeGeometry(0.42, 2.6, 4).rotateZ(Math.PI / 2.6).translate(0.9, 0, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x3f8a45, roughness: 1, flatShading: true }),
      palmes,
      true
    );
    this.ajouter(
      'rocher-cote',
      () => new THREE.DodecahedronGeometry(1.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x8a8577, roughness: 1, flatShading: true }),
      rochers,
      true
    );
  }

  /** haute montagne : éboulis, blocs et névés */
  private hauteMontagne(z: Zone, rand: () => number): void {
    const blocs: Placement[] = [];
    const neiges: Placement[] = [];
    const pas = 11 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() > 0.62) continue;
        const lat = side * (11 + rand() * 60);
        const y = this.piste.groundAt(x, lat);
        const s = 0.5 + rand() * 1.6;
        blocs.push({
          dist: x,
          lat,
          y,
          rotY: rand() * 6.28,
          scale: new THREE.Vector3(s, s * (0.6 + rand() * 0.6), s)
        });
        if (y > 70 && rand() < 0.35) {
          neiges.push({
            dist: x,
            lat: lat * 1.2,
            y: this.piste.groundAt(x, lat * 1.2) + 0.05,
            rotY: rand() * 6.28,
            scale: new THREE.Vector3(2 + rand() * 3, 0.3, 2 + rand() * 3)
          });
        }
      }
    }
    this.ajouter(
      'bloc',
      () => new THREE.DodecahedronGeometry(1.1, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x74705f, roughness: 1, flatShading: true }),
      blocs,
      true
    );
    this.ajouter(
      'neve',
      () => new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      () => new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.75 }),
      neiges
    );
  }

  private champs(z: Zone, rand: () => number): void {
    // haies et bottes de foin : de quoi meubler sans surcharger
    const bottes: Placement[] = [];
    const piquets: Placement[] = [];
    const pas = 34 / Math.max(0.3, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() < 0.4) {
          const lat = side * (20 + rand() * 60);
          const dist = x + rand() * pas;
          bottes.push({
            dist,
            lat,
            y: this.piste.groundAt(dist, lat),
            rotY: rand() * 6.28,
            scale: new THREE.Vector3(1, 1, 1)
          });
        }
      }
    }
    for (let x = z.from; x < z.to; x += 4.5) {
      for (const side of [-1, 1]) {
        const lat = side * 11;
        piquets.push({
          dist: x,
          lat,
          y: this.piste.groundAt(x, lat),
          rotY: 0,
          scale: new THREE.Vector3(1, 1, 1)
        });
      }
    }
    this.ajouter(
      'botte',
      () => new THREE.CylinderGeometry(0.85, 0.85, 1.3, 9).rotateZ(Math.PI / 2).translate(0, 0.85, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xc9a94e, roughness: 1 }),
      bottes,
      true
    );
    this.ajouter(
      'piquet',
      () => new THREE.CylinderGeometry(0.055, 0.055, 1.1, 4).translate(0, 0.55, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x6b5637, roughness: 1 }),
      piquets
    );
  }

  /* ---------------- rivière et pont ---------------- */

  private riviere(z: Zone, rand: () => number): void {
    const centre = (z.from + z.to) / 2;
    // une rivière étroite passait inaperçue à la vitesse d'un coureur :
    // on l'élargit franchement pour qu'elle se remarque au passage
    const largeur = 42 + rand() * 30;

    /*
     * La rivière est une bande posée sous la route, orientée perpendiculairement
     * à celle-ci. On la dessine plus basse que le terrain pour qu'elle se lise
     * comme un lit encaissé, et on la prolonge largement de part et d'autre :
     * une rivière qui s'arrête au bord de l'écran ne trompe personne.
     */
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();
    this.piste.pose(centre, 0, pos, tan);
    const cap = Math.atan2(tan.x, tan.z);

    const eau = new THREE.Mesh(
      new THREE.PlaneGeometry(420, largeur, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x2b5f7a,
        roughness: 0.16,
        metalness: 0.5,
        transparent: true,
        opacity: 0.92
      })
    );
    eau.rotation.x = -Math.PI / 2;
    eau.rotation.z = -cap;
    eau.position.set(pos.x, pos.y - 4.2, pos.z);
    this.group.add(eau);
    this.jetables.push(eau.geometry, eau.material as THREE.Material);

    // berges : deux bandes de terre le long de l'eau
    const berge = new THREE.Mesh(
      new THREE.PlaneGeometry(420, largeur + 26),
      new THREE.MeshStandardMaterial({ color: 0x53503f, roughness: 1 })
    );
    berge.rotation.x = -Math.PI / 2;
    berge.rotation.z = -cap;
    berge.position.set(pos.x, pos.y - 4.9, pos.z);
    this.group.add(berge);
    this.jetables.push(berge.geometry, berge.material as THREE.Material);

    /* --- le pont --- */
    const demi = largeur / 2 + 9;

    // parapets de part et d'autre de la chaussée
    const parapets: Placement[] = [];
    for (let d = centre - demi; d <= centre + demi; d += 2.2) {
      for (const side of [-1, 1]) {
        parapets.push({
          dist: d,
          lat: side * 5.2,
          y: 0.02,
          rotY: this.capAt(d),
          scale: new THREE.Vector3(1, 1, 1)
        });
      }
    }
    // parapets hauts et massifs : ce sont eux qui signalent le pont de loin
    this.ajouter(
      'parapet',
      () => new THREE.BoxGeometry(0.5, 1.35, 2.2).translate(0, 0.67, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.95 }),
      parapets,
      true
    );

    /*
     * Structure du pont.
     *
     * Un premier essai plaçait des arches en tore centrées sur l'axe de la
     * route : d'un rayon supérieur à la hauteur disponible, elles traversaient
     * la chaussée et bouchaient la vue. On s'en tient donc à un tablier plein
     * et à des piles franchement sous le niveau de la route, seuls éléments
     * réellement visibles depuis la selle et depuis les abords.
     */
    /*
     * Tablier et piles sont instanciés comme le reste : construits en objets
     * séparés, un seul pont ajoutait une vingtaine d'appels de rendu, et deux
     * rivières par étape suffisaient à faire décoller la facture.
     */
    const dalles: Placement[] = [];
    for (let d = centre - demi; d <= centre + demi; d += 4) {
      dalles.push({ dist: d, lat: 0, y: -0.75, rotY: this.capAt(d), scale: new THREE.Vector3(1, 1, 1) });
    }
    this.ajouter(
      'tablier',
      () => new THREE.BoxGeometry(13, 1.4, 4.2),
      () => new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.95 }),
      dalles,
      true
    );

    const piles: Placement[] = [];
    const becs: Placement[] = [];
    const nb = largeur > 56 ? 3 : 2;
    for (let i = 0; i < nb; i++) {
      const t = (i + 0.5) / nb;
      const d = centre - demi + t * demi * 2;
      const p = { dist: d, lat: 0, y: -5.4, rotY: this.capAt(d), scale: new THREE.Vector3(1, 1, 1) };
      piles.push(p);
      becs.push({ ...p });
    }
    this.ajouter(
      'pile',
      () => new THREE.BoxGeometry(3.4, 8, 10.5),
      () => new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.95 }),
      piles,
      true
    );
    this.ajouter(
      'avant-bec',
      () => new THREE.ConeGeometry(2.4, 8, 3),
      () => new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.95 }),
      becs,
      true
    );
  }

  /* ---------------- monuments ---------------- */

  /**
   * Un ou deux ouvrages remarquables par étape, posés à des endroits qu'on
   * regarde : le dernier kilomètre et le milieu de course. Ils servent de
   * repère et donnent son identité à l'étape.
   */
  private monuments(stage: StageDef, rand: () => number): void {
    const choix: ((d: number, lat: number) => void)[] = [
      (d, lat) => this.chateau(d, lat),
      (d, lat) => this.cathedrale(d, lat),
      (d, lat) => this.phare(d, lat),
      (d, lat) => this.arche(d, lat)
    ];
    const emplacements = [this.piste.length * (0.42 + rand() * 0.16), this.piste.length - 210];
    const utilises = new Set<number>();
    for (const d of emplacements) {
      let i = Math.floor(rand() * choix.length);
      let garde = 0;
      while (utilises.has(i) && garde++ < 6) i = (i + 1) % choix.length;
      utilises.add(i);
      const lat = (rand() > 0.5 ? 1 : -1) * (34 + rand() * 22);
      choix[i](d, lat);
    }
  }

  private poser(d: number, lat: number, obj: THREE.Object3D): void {
    this.piste.pose(d, lat, this.tmp);
    obj.position.set(this.tmp.x, this.tmp.y + this.piste.groundAt(d, lat), this.tmp.z);
    obj.rotation.y = this.capAt(d) + Math.PI / 2;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = this.q.shadows;
    });
    this.group.add(obj);
  }

  private chateau(d: number, lat: number): void {
    const g = new THREE.Group();
    const pierre = new THREE.MeshStandardMaterial({ color: 0xa39c8c, roughness: 0.95 });
    const toit = new THREE.MeshStandardMaterial({ color: 0x3f4a5c, roughness: 0.9, flatShading: true });
    const corps = new THREE.Mesh(new THREE.BoxGeometry(20, 11, 11), pierre);
    corps.position.y = 5.5;
    g.add(corps);
    for (const x of [-10, 10]) {
      const tour = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.4, 17, 10), pierre);
      tour.position.set(x, 8.5, 0);
      g.add(tour);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.9, 6, 10), toit);
      cone.position.set(x, 20, 0);
      g.add(cone);
    }
    const faite = new THREE.Mesh(new THREE.BoxGeometry(20.6, 1.2, 11.6), toit);
    faite.position.y = 11.4;
    g.add(faite);
    this.jetables.push(pierre, toit);
    this.poser(d, lat, g);
  }

  private cathedrale(d: number, lat: number): void {
    const g = new THREE.Group();
    const pierre = new THREE.MeshStandardMaterial({ color: 0xb6ad9b, roughness: 0.96 });
    const ardoise = new THREE.MeshStandardMaterial({ color: 0x4a5260, roughness: 0.9, flatShading: true });
    const nef = new THREE.Mesh(new THREE.BoxGeometry(26, 13, 12), pierre);
    nef.position.y = 6.5;
    g.add(nef);
    const comble = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 26, 3).rotateZ(Math.PI / 2), ardoise);
    comble.position.y = 15;
    g.add(comble);
    const clocher = new THREE.Mesh(new THREE.BoxGeometry(6.5, 26, 6.5), pierre);
    clocher.position.set(-12, 13, 0);
    g.add(clocher);
    const fleche = new THREE.Mesh(new THREE.ConeGeometry(4.6, 13, 4), ardoise);
    fleche.position.set(-12, 32, 0);
    fleche.rotation.y = Math.PI / 4;
    g.add(fleche);
    this.jetables.push(pierre, ardoise);
    this.poser(d, lat, g);
  }

  private phare(d: number, lat: number): void {
    const g = new THREE.Group();
    const blanc = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.85 });
    const rouge = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.85 });
    const fut = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.8, 26, 12), blanc);
    fut.position.y = 13;
    g.add(fut);
    for (let i = 0; i < 3; i++) {
      const bande = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.3, 3.2, 12), rouge);
      bande.position.y = 5 + i * 8;
      g.add(bande);
    }
    const lanterne = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.4, 10), rouge);
    lanterne.position.y = 27.4;
    g.add(lanterne);
    const feu = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    feu.position.y = 27.4;
    g.add(feu);
    this.jetables.push(blanc, rouge, feu.material as THREE.Material);
    this.poser(d, lat, g);
  }

  /** arche commémorative enjambant la route, sous laquelle on passe */
  private arche(d: number, _lat: number): void {
    const g = new THREE.Group();
    const pierre = new THREE.MeshStandardMaterial({ color: 0xb9b0a0, roughness: 0.94 });
    for (const x of [-7.5, 7.5]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(4.4, 13, 5.5), pierre);
      pied.position.set(x, 6.5, 0);
      g.add(pied);
    }
    const linteau = new THREE.Mesh(new THREE.BoxGeometry(19.4, 4.6, 5.5), pierre);
    linteau.position.y = 15.3;
    g.add(linteau);
    const attique = new THREE.Mesh(new THREE.BoxGeometry(15, 2.4, 4.6), pierre);
    attique.position.y = 18.6;
    g.add(attique);
    const voute = new THREE.Mesh(new THREE.TorusGeometry(5.3, 1.5, 6, 16, Math.PI), pierre);
    voute.position.y = 10.2;
    voute.rotation.y = Math.PI / 2;
    g.add(voute);
    this.jetables.push(pierre);
    // posée sur l'axe : on passe dessous
    this.poser(d, 0, g);
    g.rotation.y = this.capAt(d);
  }

  /* ---------------- mobilier de course ---------------- */

  /**
   * Panneaux publicitaires le long de la route.
   *
   * Les noms affichés sont ceux des équipes du jeu et quelques annonceurs
   * inventés : c'est ce qui donne à la route son air de course plutôt que de
   * sortie du dimanche. Une seule texture porte tous les panneaux, chaque
   * instance en prélevant une bande — sinon il faudrait autant de matériaux
   * que d'annonceurs.
   */
  private panneaux(stage: StageDef, rand: () => number): void {
    const noms = [
      'MISTRAL SUD', 'GRANIT', 'AURORA', 'NORDKAP', 'ALPE-PRO',
      'VOLCANIA', 'SOLMAGNE', 'BRUMELAC', 'CEYRAT', 'PIC CORBEAU'
    ];
    const teintes = ['#d6382c', '#1f5fbf', '#1f8f4d', '#e08a1f', '#7a3fbf', '#0f9fa8'];

    const W = 256;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const bandes = 8;
    for (let i = 0; i < bandes; i++) {
      const y = (i * H) / bandes;
      g.fillStyle = teintes[i % teintes.length];
      g.fillRect(0, y, W, H / bandes);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.font = 'bold 30px "Barlow Condensed", Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(noms[i % noms.length], W / 2, y + H / bandes / 2);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 3;
      g.strokeRect(1.5, y + 1.5, W - 3, H / bandes - 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.jetables.push(tex);

    /*
     * Chaque instance affiche une bande différente en décalant ses UV. Une
     * géométrie par bande resterait raisonnable ici, mais le décalage évite de
     * multiplier les lots de rendu.
     */
    const places: Placement[] = [];
    const pas = 38 / Math.max(0.35, this.q.densiteDecor);
    for (let x = 60; x < this.piste.length - 60; x += pas) {
      if (rand() > 0.62) continue;
      const side = rand() > 0.5 ? 1 : -1;
      /*
       * Les panneaux sont inclinés vers les coureurs plutôt que posés
       * parallèlement à la route : à plat, on n'en voyait que la tranche
       * depuis la selle, et l'effet tombait à l'eau.
       */
      places.push({
        dist: x,
        lat: side * 8.6,
        y: 0,
        rotY: this.capAt(x) + side * 1.05,
        scale: new THREE.Vector3(1, 1, 1)
      });
    }
    this.ajouter(
      'panneau',
      () => {
        // panneau plus grand : lisible au passage, à 45 km/h
        return new THREE.PlaneGeometry(4.2, 1.4).translate(0, 1.3, 0);
      },
      () =>
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.85,
          side: THREE.DoubleSide
        }),
      places
    );
    // pieds des panneaux
    this.ajouter(
      'pied-panneau',
      () => new THREE.BoxGeometry(0.09, 1.2, 0.09).translate(0, 0.6, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.8 }),
      places.flatMap((p) => [
        { ...p, dist: p.dist - 1.6 },
        { ...p, dist: p.dist + 1.6 }
      ])
    );
  }

  /**
   * Bornes des derniers kilomètres et flèches de direction. Ce sont de petits
   * repères, mais ce sont eux qui font qu'on se sent sur une course balisée.
   */
  private bornes(stage: StageDef): void {
    const bornes: Placement[] = [];
    for (let k = 1; k <= 5; k++) {
      const d = this.piste.length - (k * this.piste.length) / (stage.displayKm / 1);
      const dist = this.piste.length - k * (this.piste.length / stage.displayKm);
      void d;
      if (dist < 30) continue;
      bornes.push({
        dist,
        lat: 7.2,
        y: 0,
        rotY: this.capAt(dist) + Math.PI / 2,
        scale: new THREE.Vector3(1, 1, 1)
      });
    }
    this.ajouter(
      'borne',
      () => new THREE.BoxGeometry(0.8, 0.95, 0.1).translate(0, 0.95, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xd63b2c, roughness: 0.8 }),
      bornes
    );

    // flèches jaunes de signalisation, régulièrement le long du parcours
    const fleches: Placement[] = [];
    for (let x = 120; x < this.piste.length - 40; x += 180) {
      fleches.push({
        dist: x,
        lat: 7.6,
        y: 0,
        rotY: this.capAt(x) + Math.PI / 2,
        scale: new THREE.Vector3(1, 1, 1)
      });
    }
    this.ajouter(
      'fleche',
      () => new THREE.BoxGeometry(0.62, 0.42, 0.06).translate(0, 1.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xffd633, roughness: 0.7 }),
      fleches
    );
    this.ajouter(
      'poteau-fleche',
      () => new THREE.CylinderGeometry(0.045, 0.045, 1.5, 5).translate(0, 0.75, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x585d66, roughness: 0.8 }),
      fleches
    );
  }

  /** nom lisible de la zone traversée à une distance donnée */
  zoneA(dist: number): ZoneType {
    for (const z of this.zones) if (dist >= z.from && dist < z.to) return z.type;
    return 'campagne';
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    for (const j of this.jetables) j.dispose();
  }
}
