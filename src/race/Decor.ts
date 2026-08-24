import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StageDef, StageType } from '../data/types';
import { conditionsDeEtape } from './Atmosphere';
import type { BuildingKit } from './BuildingKit';
import type { SceneryAssets, SceneryPiece } from '../core/SceneryAssets';

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
  | 'littoral'
  /** champ en fleur : tournesols au nord, lavande au sud */
  | 'fleurs'
  /** parc éolien : grandes turbines blanches qui tournent */
  | 'eoliennes'
  /** tunnel : on passe sous la roche, lumière coupée */
  | 'tunnel'
  /** château fort sur son promontoire */
  | 'chateau'
  /** zone industrielle : halles, silos, cheminées */
  | 'industriel'
  /** plateau aride : rocaille, buissons secs */
  | 'desert'
  /** marais : roselières, plans d'eau, pontons */
  | 'marais'
  /** oliveraie en terrasses */
  | 'oliviers'
  /** bocage : haies, prés clos, troupeaux */
  | 'bocage'
  /** station de montagne : chalets et remontées mécaniques */
  | 'station'
  /** verger en rangs */
  | 'verger'
  /** lac de barrage */
  | 'lac'
  /** gorges : parois rocheuses des deux côtés */
  | 'gorges'
  /** carrière : gradins de roche et engins */
  | 'carriere'
  /** aérodrome : hangars, manche à air */
  | 'aerodrome';

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
  /** faux dans le vide et sur l'eau : rien ne doit s'y poser */
  constructible(dist: number, lat: number): boolean;
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
  plaine: [
    'campagne', 'village', 'fleurs', 'eoliennes', 'vignes', 'ville', 'riviere',
    'bocage', 'fleurs', 'marais', 'campagne', 'verger', 'littoral', 'industriel',
    'aerodrome', 'village'
  ],
  vallonnee: [
    'campagne', 'foret', 'vignes', 'chateau', 'village', 'fleurs', 'riviere',
    'bocage', 'campagne', 'oliviers', 'foret', 'lac', 'carriere', 'verger', 'ville'
  ],
  montagne: [
    'foret', 'village', 'gorges', 'foret', 'sommet', 'tunnel', 'riviere',
    'station', 'sommet', 'foret', 'lac', 'fleurs', 'desert', 'campagne'
  ],
  clm: [
    'ville', 'campagne', 'fleurs', 'vignes', 'village', 'industriel', 'riviere',
    'eoliennes', 'littoral', 'bocage', 'ville'
  ]
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
  /** roulis autour de l'axe de la route ; sert aux pales d'éolienne */
  rotZ?: number;
}

export class Decor {
  readonly group = new THREE.Group();
  private jetables: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = [];
  /** meshes utilisant une géométrie/matériau partagé (BuildingKit) : à ne pas disposer ici */
  private meshesPartages = new Set<THREE.InstancedMesh>();
  private piste: PisteDecor;
  private q: ReglagesDecor;
  readonly zones: Zone[];

  private tmp = new THREE.Vector3();
  private tan = new THREE.Vector3();
  private buildings: BuildingKit | null;
  private scenery: SceneryAssets | null;
  private readonly med: boolean;
  /** -1/1 = côté mer de la route (même tirage que Track), 0 = étape sans mer */
  private readonly coteMer: number;
  /** étape courue de nuit : déclenche l'éclairage public sur tout le parcours */
  private readonly nuit: boolean;

  constructor(
    piste: PisteDecor,
    stage: StageDef,
    q: ReglagesDecor,
    rand: () => number,
    buildings: BuildingKit | null = null,
    scenery: SceneryAssets | null = null
  ) {
    this.piste = piste;
    this.q = q;
    this.med = stage.biome === 'mediterraneen';
    // même formule que Track.ts : les deux doivent tomber d'accord sur le côté
    this.coteMer = stage.mer ? (stage.seed % 2 === 0 ? -1 : 1) : 0;
    this.nuit = conditionsDeEtape(stage).periode === 'nuit';
    this.buildings = buildings?.available ? buildings : null;
    this.scenery = scenery?.hasAny ? scenery : null;
    this.zones = decouperZones(stage, rand);

    for (const z of this.zones) {
      switch (z.type) {
        case 'ville':
          this.batir(z, rand, true);
          this.lampadaires(z, rand);
          // rond-point d'entrée d'agglomération
          this.rondPoint(z.from + 24 + rand() * 40, rand);
          break;
        case 'village':
          this.batir(z, rand, false);
          if (rand() < 0.5) this.rondPoint(z.from + 20 + rand() * 30, rand);
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
        case 'fleurs':
          this.champsFleuris(z, rand);
          break;
        case 'eoliennes':
          this.parcEolien(z, rand);
          break;
        case 'tunnel':
          this.tunnel(z, rand);
          break;
        case 'chateau':
          this.forteresse(z, rand);
          break;
        case 'industriel':
          this.industriel(z, rand);
          break;
        case 'desert':
          this.plateauAride(z, rand);
          break;
        case 'marais':
          this.marais(z, rand);
          break;
        case 'oliviers':
          this.oliveraie(z, rand);
          break;
        case 'bocage':
          this.bocage(z, rand);
          break;
        case 'station':
          this.station(z, rand);
          break;
        case 'verger':
          this.verger(z, rand);
          break;
        case 'lac':
          this.lac(z, rand);
          break;
        case 'gorges':
          this.gorges(z, rand);
          break;
        case 'carriere':
          this.carriere(z, rand);
          break;
        case 'aerodrome':
          this.aerodrome(z, rand);
          break;
        case 'sommet':
          this.hauteMontagne(z, rand);
          break;
        default:
          break;
      }
    }

    if (this.nuit) this.eclairageNuit();
    this.monuments(stage, rand);
    this.panneaux(stage, rand);
    this.bornes(stage);
    this.finaliser();
  }

  /**
   * Éclairage public des étapes de nuit.
   *
   * Sans lui la route disparaissait purement et simplement : l'étape était
   * injouable. Les têtes de lampadaire sont émissives plutôt que de vraies
   * sources lumineuses — elles brillent, et le post-traitement leur donne un
   * halo, sans qu'il faille payer une centaine de lumières dynamiques que le
   * navigateur d'une console ne suivrait pas.
   */
  private eclairageNuit(): void {
    const mats: Placement[] = [];
    const bras: Placement[] = [];
    const tetes: Placement[] = [];
    const pas = 34 / Math.max(0.5, this.q.densiteDecor);
    let side = 1;
    for (let x = 0; x < this.piste.length; x += pas) {
      const lat = side * 7.6;
      const y = this.piste.groundAt(x, lat);
      const rotY = this.capAt(x);
      const un = new THREE.Vector3(1, 1, 1);
      mats.push({ dist: x, lat, y, rotY, scale: un });
      // potence : le bras se penche au-dessus de la chaussée
      bras.push({ dist: x, lat: lat - side * 0.85, y: y + 6.15, rotY, scale: new THREE.Vector3(side, 1, 1) });
      tetes.push({ dist: x, lat: lat - side * 1.7, y: y + 6.0, rotY, scale: un });
      side = -side;
    }
    this.ajouter(
      'lampadaire-nuit-mat',
      () => new THREE.CylinderGeometry(0.09, 0.14, 6.3, 5).translate(0, 3.15, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, metalness: 0.5 }),
      mats
    );
    this.ajouter(
      'lampadaire-nuit-bras',
      () => new THREE.BoxGeometry(1.8, 0.1, 0.1).translate(-0.9, 0, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, metalness: 0.5 }),
      bras,
      true
    );
    this.ajouter(
      'lampadaire-nuit-tete',
      () => new THREE.BoxGeometry(0.62, 0.16, 0.3),
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xffe6b0,
          emissive: 0xffca6a,
          emissiveIntensity: 2.6,
          roughness: 0.4
        }),
      tetes,
      true
    );
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
    {
      geo: () => THREE.BufferGeometry;
      mat: () => THREE.Material;
      places: Placement[];
      ombre: boolean;
      partage: boolean;
    }
  >();

  private ajouter(
    cle: string,
    geo: () => THREE.BufferGeometry,
    mat: () => THREE.Material,
    places: Placement[],
    ombre = false,
    partage = false
  ): void {
    if (!places.length) return;
    const lot = this.lots.get(cle);
    if (lot) lot.places.push(...places);
    else this.lots.set(cle, { geo, mat, places: [...places], ombre, partage });
  }

  /** construit un lot d'instances par type d'objet accumulé */
  private finaliser(): void {
    for (const [cle, lot] of this.lots) {
      this.instancier(lot.geo(), lot.mat(), lot.places, lot.ombre, lot.partage, cle);
    }
    this.lots.clear();
  }

  /**
   * Pose une série d'instances à partir d'une géométrie unique.
   *
   * `partage` marque une géométrie/matériau qui n'appartient pas à ce
   * Decor — typiquement une pièce de BuildingKit, chargée une fois pour
   * toute la session et réutilisée d'étape en étape. La disposer à la fin
   * de celle-ci casserait le rendu des étapes suivantes.
   */
  private instancier(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    places: Placement[],
    ombre = false,
    partage = false,
    cle = ''
  ): void {
    /*
     * Point de passage unique de tout le décor : c'est ici qu'on écarte ce qui
     * tomberait dans le vide ou dans l'eau, plutôt que de répéter le test dans
     * chaque générateur de paysage — et d'en oublier un.
     */
    places = places.filter((p) => this.piste.constructible(p.dist, p.lat));
    if (!places.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, places.length);
    mesh.name = cle;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const qRoulis = new THREE.Quaternion();
    const avant = new THREE.Vector3(0, 0, 1);
    places.forEach((p, i) => {
      this.piste.pose(p.dist, p.lat, pos);
      q.setFromAxisAngle(up, p.rotY);
      // roulis facultatif, appliqué après le cap et donc autour de l'axe de l'objet
      if (p.rotZ) q.multiply(qRoulis.setFromAxisAngle(avant, p.rotZ));
      m.compose(new THREE.Vector3(pos.x, pos.y + p.y, pos.z), q, p.scale);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = ombre && this.q.shadows && this.q.densiteDecor >= 1;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    if (partage) this.meshesPartages.add(mesh);
    else this.jetables.push(geo, mat);
  }

  /** orientation d'un objet aligné sur la route */
  private capAt(dist: number): number {
    this.piste.pose(dist, 0, this.tmp, this.tan);
    return Math.atan2(this.tan.x, this.tan.z);
  }

  /** citerne ou antenne posée au hasard sur un toit de tour, GLB ou procédural */
  private toitureExtra(
    rand: () => number,
    dist: number,
    lat: number,
    yToit: number,
    rotY: number,
    largeur: number,
    profondeur: number,
    citernes: Placement[],
    antennes: Placement[]
  ): void {
    const toit = rand();
    if (toit < 0.28) {
      citernes.push({
        dist: dist + (rand() - 0.5) * largeur * 0.4,
        lat: lat + (rand() - 0.5) * profondeur * 0.4,
        y: yToit + 0.9,
        rotY,
        scale: new THREE.Vector3(1.1, 1.5 + rand(), 1.1)
      });
    } else if (toit < 0.55) {
      antennes.push({ dist, lat, y: yToit + 0.9, rotY, scale: new THREE.Vector3(1, 3 + rand() * 2.5, 1) });
    }
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
  /** région méditerranéenne : pierre claire, façades ocres, toits en tuile */
  private static readonly TEINTES_HAUTS_MED = ['#8a7a63', '#a99378', '#c2a878', '#8c8270'];
  private static readonly TEINTES_MOYENS_MED = ['#d9c39a', '#c9a876', '#e0cfa0', '#b89468'];
  private static readonly TEINTES_TOIT_MED = [0xb5651d, 0xc17a3d, 0xa8562a];
  /*
   * La face habitée (fenêtres/porte) de chaque pièce du kit modulaire
   * regarde vers -X dans le fichier source. Un immeuble assemblé est
   * toujours en bord de route, avec la route sur l'un ou l'autre côté selon
   * `side` : cette constante aligne -X vers la route pour side<0, et
   * BUILDING_FACE_OFFSET + PI fait l'inverse pour side>0.
   */
  private static readonly BUILDING_FACE_OFFSET = 0;

  /**
   * Rond-point à l'entrée d'une agglomération.
   *
   * Le peloton ne fait pas le tour de l'îlot : il le longe, comme sur une
   * vraie course où la route se dédouble un instant. L'îlot planté et son
   * ouvrage central sont un repère fort — on sait qu'on entre dans une ville
   * avant même d'en voir les immeubles.
   */
  private rondPoint(dist: number, rand: () => number): void {
    const cote = rand() > 0.5 ? 1 : -1;
    const lat = cote * 15.5;
    const y = this.piste.groundAt(dist, lat);
    if (!this.piste.constructible(dist, lat)) return;
    const rotY = this.capAt(dist);
    /*
     * Rayon fixe : tous les ronds-points de l'étape partagent alors la même
     * géométrie et se regroupent dans un seul lot d'instances. Un rayon tiré
     * au sort obligerait à une géométrie — donc un appel de rendu — par
     * rond-point, pour une variation que personne ne remarque en roulant.
     * L'échelle, elle, reste libre.
     */
    const RAYON = 6;
    const ech = 0.9 + rand() * 0.35;
    const un = new THREE.Vector3(ech, ech, ech);

    this.ajouter(
      'rp-ilot',
      () => new THREE.CylinderGeometry(RAYON, RAYON + 0.35, 0.5, 18).translate(0, 0.25, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x6f9350, roughness: 1 }),
      [{ dist, lat, y, rotY, scale: un }]
    );
    // bordure de trottoir claire, qui détache l'îlot de la chaussée
    this.ajouter(
      'rp-bordure',
      () => new THREE.TorusGeometry(RAYON + 0.3, 0.22, 5, 20).rotateX(Math.PI / 2),
      () => new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.8 }),
      [{ dist, lat, y: y + 0.42 * ech, rotY, scale: un }]
    );
    // ouvrage central : stèle, ou bosquet selon le tirage
    if (rand() < 0.55) {
      this.ajouter(
        'rp-stele',
        () => new THREE.ConeGeometry(0.9, 4.6, 6).translate(0, 2.3, 0),
        () => new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.9, flatShading: true }),
        [{ dist, lat, y: y + 0.5 * ech, rotY, scale: un }],
        true
      );
    } else {
      const piece = this.scenery?.getRandom('treeBroadleaf', rand);
      const place = { dist, lat, y: y + 0.5 * ech, rotY, scale: new THREE.Vector3(1.3, 1.3, 1.3) };
      if (piece) {
        this.ajouter('rp-arbre', () => piece.geometry, () => piece.material, [place], true, true);
      } else {
        this.ajouter(
          'rp-buisson',
          () => new THREE.SphereGeometry(1.6, 8, 6),
          () => new THREE.MeshStandardMaterial({ color: 0x4a8c46, roughness: 1, flatShading: true }),
          [{ ...place, y: y + 2 }],
          true
        );
      }
    }
    // fleurs de l'îlot
    const fleurs: Placement[] = [];
    for (let i = 0; i < 10; i++) {
      const a = rand() * 6.28;
      const r = RAYON * ech * 0.55 * Math.sqrt(rand());
      fleurs.push({
        dist: dist + Math.cos(a) * r,
        lat: lat + Math.sin(a) * r,
        y: y + 0.5 * ech,
        rotY: rand() * 6.28,
        scale: new THREE.Vector3(1, 1, 1)
      });
    }
    this.ajouter(
      'rp-fleurs',
      () => new THREE.SphereGeometry(0.34, 6, 5),
      () => new THREE.MeshStandardMaterial({ color: 0xd6425c, roughness: 0.9, flatShading: true }),
      fleurs
    );
  }

  private batir(z: Zone, rand: () => number, urbain: boolean): void {
    const d = this.q.densiteDecor;
    const pas = (urbain ? 13 : 22) / Math.max(0.3, d);
    const teintesHauts = this.med ? Decor.TEINTES_HAUTS_MED : Decor.TEINTES_HAUTS;
    const teintesMoyens = this.med ? Decor.TEINTES_MOYENS_MED : Decor.TEINTES_MOYENS;
    const teintesToit = this.med ? Decor.TEINTES_TOIT_MED : Decor.TEINTES_TOIT;
    const nHauts = teintesHauts.length;
    const nMoyens = teintesMoyens.length;
    const hauts: Placement[][] = Array.from({ length: nHauts }, () => []);
    const moyens: Placement[][] = Array.from({ length: nMoyens }, () => []);
    const maisons: Placement[] = [];
    const toits: Placement[][] = teintesToit.map(() => []);
    // couronnement des tours : muret en retrait, et parfois citerne ou antenne
    const casquettes: Placement[] = [];
    const citernes: Placement[] = [];
    const antennes: Placement[] = [];
    // rez-de-chaussée commerçant des immeubles moyens : sans lui, le mur de
    // façade descendait tel quel jusqu'au trottoir
    const socles: Placement[] = [];
    const COULEURS_MARQUISE = [0xb23b32, 0x2f6b4f, 0x2c4f7a, 0xc79a3b];
    const marquises: Placement[][] = COULEURS_MARQUISE.map(() => []);
    // tours assemblées à partir de vrais modèles 3D (BuildingKit), quand
    // disponibles : un lot par pièce (étages, rez-de-chaussée, toit), rempli
    // seulement si this.buildings est chargé
    const glbWalls: Placement[][] = this.buildings ? this.buildings.walls.map(() => []) : [];
    const glbGround: Placement[] = [];
    const glbRoof: Placement[] = [];

    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() > (urbain ? 0.92 : 0.6)) continue;
        const dist = x + rand() * pas * 0.7;
        const lat = side * (14 + rand() * (urbain ? 26 : 34));
        const y = this.piste.groundAt(dist, lat);
        const rotY = this.capAt(dist) + (rand() - 0.5) * 0.5;

        const tourIci = urbain && rand() < 0.42;
        if (tourIci && this.buildings) {
          // tour assemblée à partir de vrais modèles 3D : étages empilés,
          // rez-de-chaussée à l'entrée, toit plat en couronnement
          const bk = this.buildings;
          const echelle = 6 + rand() * 4;
          const storyH = bk.walls[0].height * echelle;
          const floors = Math.max(3, Math.round((14 + rand() * 22) / storyH));
          const h = floors * storyH;
          const bScale = new THREE.Vector3(echelle, echelle, echelle);
          const faceRot = rotY + (side > 0 ? Decor.BUILDING_FACE_OFFSET + Math.PI : Decor.BUILDING_FACE_OFFSET);
          for (let f = 0; f < floors; f++) {
            if (f === 0 && bk.ground) {
              glbGround.push({ dist, lat, y, rotY: faceRot, scale: bScale });
            } else {
              const wi = Math.floor(rand() * bk.walls.length);
              glbWalls[wi].push({ dist, lat, y: y + f * storyH, rotY: faceRot, scale: bScale });
            }
          }
          if (bk.roof) glbRoof.push({ dist, lat, y: y + h, rotY: faceRot, scale: bScale });
          this.toitureExtra(rand, dist, lat, y + h, rotY, bScale.x, bScale.z, citernes, antennes);
        } else if (tourIci) {
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
          this.toitureExtra(rand, dist, lat, y + h, rotY, scale.x, scale.z, citernes, antennes);
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
          toits[Math.floor(rand() * teintesToit.length)].push({
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

    teintesHauts.forEach((teinte, i) =>
      this.ajouter(`imm-haut-${i}`, cube, facade(teinte, true, 2, 4), hauts[i], true)
    );
    teintesMoyens.forEach((teinte, i) =>
      this.ajouter(`imm-moyen-${i}`, cube, facade(teinte, true, 2, 2.4), moyens[i], true)
    );
    this.ajouter('maison', cube, facade(this.med ? '#e8d5a8' : '#c9bda8', false, 1.6, 1.2), maisons, true);
    teintesToit.forEach((couleur, i) =>
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
    if (this.buildings) {
      const bk = this.buildings;
      bk.walls.forEach((piece, i) =>
        this.ajouter(`glb-mur-${i}`, () => piece.geometry, () => piece.material, glbWalls[i], true, true)
      );
      if (bk.ground) {
        const ground = bk.ground;
        this.ajouter('glb-rdc', () => ground.geometry, () => ground.material, glbGround, true, true);
      }
      if (bk.roof) {
        const roof = bk.roof;
        this.ajouter('glb-toit', () => roof.geometry, () => roof.material, glbRoof, true, true);
      }
    }
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
    // vrais modèles 3D, quand disponibles : un lot par pièce piochée, sans
    // quoi un bosquet entier répète le même arbre
    const glbEpiceas = new Map<SceneryPiece, Placement[]>();
    const glbFeuillus = new Map<SceneryPiece, Placement[]>();
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
        if (tirage < 0.12 + 0.5 * altitude + 0.18) {
          const piece = this.scenery?.getRandom('treePine', rand);
          if (piece) {
            const liste = glbEpiceas.get(piece) ?? [];
            liste.push(base);
            glbEpiceas.set(piece, liste);
          } else {
            troncs.push(base);
            epiceas.push({ ...base, y: y + 1.4 * s, scale: new THREE.Vector3(s, s * (1 + rand() * 0.5), s) });
          }
        } else if (tirage < 0.62) {
          const piece = this.scenery?.getRandom('treeBroadleaf', rand);
          if (piece) {
            const liste = glbFeuillus.get(piece) ?? [];
            liste.push(base);
            glbFeuillus.set(piece, liste);
          } else {
            troncs.push(base);
            feuillus.push({ ...base, y: y + 1.9 * s, scale: new THREE.Vector3(s, s * (1 + rand() * 0.5), s) });
          }
        } else {
          troncs.push(base);
          cypres.push({ ...base, y: y + 1.4 * s, scale: new THREE.Vector3(s, s * (1 + rand() * 0.5), s) });
        }
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
    let gi = 0;
    for (const [piece, places] of glbEpiceas) {
      this.ajouter(`glb-epicea-${gi++}`, () => piece.geometry, () => piece.material, places, true, true);
    }
    for (const [piece, places] of glbFeuillus) {
      this.ajouter(`glb-feuillu-${gi++}`, () => piece.geometry, () => piece.material, places, true, true);
    }
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

  /**
   * Champ en fleur — tournesols dans le nord, lavande en Méditerranée.
   *
   * C'est le paysage qui change le plus la couleur d'une étape : une nappe
   * jaune ou violette là où tout le reste est vert. Deux échelles de détail :
   * une masse de rangs qui porte la couleur jusqu'à l'horizon, et de vraies
   * fleurs individuelles seulement dans la bande que l'on voit vraiment
   * depuis la route — au-delà, elles coûteraient des milliers d'instances
   * pour un ou deux pixels chacune.
   */
  private champsFleuris(z: Zone, rand: () => number): void {
    const rangs: Placement[] = [];
    const tiges: Placement[] = [];
    const corolles: Placement[] = [];
    const d = Math.max(0.35, this.q.densiteDecor);
    const pasRang = 4.2 / d;

    for (let x = z.from; x < z.to; x += pasRang) {
      const rotY = this.capAt(x);
      for (const side of [-1, 1]) {
        // la masse de rangs commence au-delà de la bande où l'on distingue les
        // fleurs une à une : au premier plan, ce sont elles qu'on doit voir
        for (let k = 0; k < 8; k++) {
          const lat = side * (34 + k * 8);
          const y = this.piste.groundAt(x, lat);
          if (y > 90) continue;
          rangs.push({ dist: x, lat, y, rotY, scale: new THREE.Vector3(1, 1, 1) });
        }
      }
    }
    /*
     * Fleurs détaillées uniquement là où l'œil les distingue — et seulement
     * si la machine suit. Elles se comptent en milliers : sur le navigateur
     * d'une console, la nappe de rangs porte déjà la couleur du champ, qui
     * est ce qui compte.
     */
    const pasFleur = 1.7 / d;
    if (d < 0.6) {
      this.poserChamp(rangs, tiges, corolles);
      return;
    }
    for (let x = z.from; x < z.to; x += pasFleur) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          if (rand() > 0.78) continue;
          const lat = side * (15 + k * 4 + rand() * 3.5);
          const y = this.piste.groundAt(x, lat);
          if (y > 90) continue;
          const h = this.med ? 0.45 + rand() * 0.2 : 1.5 + rand() * 0.45;
          const un = new THREE.Vector3(1, h, 1);
          tiges.push({ dist: x, lat, y, rotY: 0, scale: un });
          corolles.push({
            dist: x,
            lat,
            y: y + h,
            rotY: rand() * 6.28,
            scale: new THREE.Vector3(1, 1, 1)
          });
        }
      }
    }

    this.poserChamp(rangs, tiges, corolles);
  }

  /** matériaux et géométries du champ en fleur, communs aux deux niveaux de détail */
  private poserChamp(rangs: Placement[], tiges: Placement[], corolles: Placement[]): void {
    const teinteRang = this.med ? 0x8d7bbf : 0xb9a233;
    const teinteCorolle = this.med ? 0x9b7fd4 : 0xf2c318;
    this.ajouter(
      'rang-fleuri',
      () => new THREE.BoxGeometry(6.2, this.med ? 0.45 : 0.8, 2.6).translate(0, 0.3, 0),
      () => new THREE.MeshStandardMaterial({ color: teinteRang, roughness: 1, flatShading: true }),
      rangs
    );
    if (!tiges.length) return;
    this.ajouter(
      'tige-fleur',
      () => new THREE.CylinderGeometry(0.035, 0.05, 1, 4).translate(0, 0.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x4a7a34, roughness: 1 }),
      tiges
    );
    this.ajouter(
      'corolle',
      () =>
        this.med
          ? new THREE.ConeGeometry(0.11, 0.5, 5).translate(0, 0.25, 0)
          : new THREE.CylinderGeometry(0.32, 0.32, 0.09, 8).rotateX(Math.PI / 2.6),
      () =>
        new THREE.MeshStandardMaterial({
          color: teinteCorolle,
          roughness: 0.85,
          flatShading: true,
          side: THREE.DoubleSide
        }),
      corolles,
      true
    );
  }

  /* ---------------- paysages ajoutés ---------------- */

  /** un vecteur d'échelle neutre, relu à chaque instance sans être conservé */
  private static readonly UN = new THREE.Vector3(1, 1, 1);

  /**
   * Parc éolien. Les mâts se voient de très loin et donnent l'échelle du
   * paysage : c'est ce qui rend une plaine autrement vide reconnaissable.
   * Les pales sont figées à des angles différents d'une machine à l'autre —
   * à la vitesse d'un coureur, la lecture est la même que si elles
   * tournaient, sans avoir à animer une instance par image.
   */
  private parcEolien(z: Zone, rand: () => number): void {
    const mats: Placement[] = [];
    const nacelles: Placement[] = [];
    const pales: Placement[] = [];
    const pas = 95 / Math.max(0.4, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() < 0.35) continue;
        const lat = side * (70 + rand() * 190);
        const y = this.piste.groundAt(x, lat);
        const h = 26 + rand() * 16;
        const ech = new THREE.Vector3(1, h / 30, 1);
        const rotY = rand() * 6.28;
        mats.push({ dist: x, lat, y, rotY, scale: ech });
        nacelles.push({ dist: x, lat, y: y + h, rotY, scale: Decor.UN });
        // trois pales à 120°, calage propre à chaque machine
        const cal = rand() * 2.1;
        for (let k = 0; k < 3; k++) {
          pales.push({
            dist: x,
            lat,
            y: y + h,
            rotY,
            scale: new THREE.Vector3(1, 1, 1),
            rotZ: cal + (k * Math.PI * 2) / 3
          } as Placement);
        }
      }
    }
    const blanc = () => new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.55 });
    this.ajouter('eol-mat', () => new THREE.CylinderGeometry(0.5, 1.1, 30, 8).translate(0, 15, 0), blanc, mats, true);
    this.ajouter('eol-nacelle', () => new THREE.BoxGeometry(1.5, 1.3, 3.6), blanc, nacelles, true);
    this.ajouter(
      'eol-pale',
      () => new THREE.BoxGeometry(0.5, 15, 0.16).translate(0, 7.5, 0),
      blanc,
      pales,
      true
    );
  }

  /**
   * Tunnel. Le passage sous la roche coupe brutalement la lumière et le
   * paysage : c'est le décor qui marque le plus une étape de montagne, parce
   * qu'il change tout pendant quelques secondes au lieu de défiler à côté.
   * La voûte est faite d'anneaux courts posés le long de la route, seule
   * façon d'épouser une chaussée qui tourne.
   */
  private tunnel(z: Zone, rand: () => number): void {
    void rand;
    const anneaux: Placement[] = [];
    const lampes: Placement[] = [];
    const tetes: Placement[] = [];
    const pas = 7;
    for (let x = z.from; x < z.to; x += pas) {
      const y = this.piste.groundAt(x, 0);
      const rotY = this.capAt(x);
      anneaux.push({ dist: x, lat: 0, y, rotY, scale: Decor.UN });
      if (Math.round(x / pas) % 2 === 0) {
        lampes.push({ dist: x, lat: 0, y: y + 6.2, rotY, scale: Decor.UN });
        tetes.push({ dist: x, lat: 0, y: y + 6.05, rotY, scale: Decor.UN });
      }
    }
    // tube ouvert : la moitié basse est enterrée sous la chaussée
    this.ajouter(
      'tunnel-voute',
      () =>
        new THREE.CylinderGeometry(7.2, 7.2, pas + 0.4, 14, 1, true).rotateX(Math.PI / 2),
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x4a4640,
          roughness: 0.98,
          side: THREE.BackSide,
          flatShading: true
        }),
      anneaux
    );
    this.ajouter(
      'tunnel-boitier',
      () => new THREE.BoxGeometry(0.5, 0.18, 0.5),
      () => new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 }),
      lampes
    );
    this.ajouter(
      'tunnel-lampe',
      () => new THREE.BoxGeometry(0.42, 0.1, 0.42),
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xfff0c8,
          emissive: 0xffcf7a,
          emissiveIntensity: 3.2,
          roughness: 0.4
        }),
      tetes
    );
  }

  /** château fort sur son promontoire : un repère qu'on voit venir de loin */
  private forteresse(z: Zone, rand: () => number): void {
    const centre = (z.from + z.to) / 2;
    const side = rand() > 0.5 ? 1 : -1;
    const lat = side * (95 + rand() * 55);
    const y = this.piste.groundAt(centre, lat);
    if (!this.piste.constructible(centre, lat)) return;
    const rotY = this.capAt(centre) + (rand() - 0.5);
    const pierre = () =>
      new THREE.MeshStandardMaterial({ color: 0x9c9382, roughness: 0.95, flatShading: true });
    const ardoise = () =>
      new THREE.MeshStandardMaterial({ color: 0x4a4f5c, roughness: 0.9, flatShading: true });

    // donjon central
    this.ajouter('ch-donjon', () => new THREE.BoxGeometry(11, 22, 11).translate(0, 11, 0), pierre, [
      { dist: centre, lat, y, rotY, scale: Decor.UN }
    ], true);
    this.ajouter('ch-toit-donjon', () => new THREE.ConeGeometry(8.6, 9, 4).translate(0, 4.5, 0), ardoise, [
      { dist: centre, lat, y: y + 22, rotY: rotY + Math.PI / 4, scale: Decor.UN }
    ], true);

    // quatre tours d'angle et la courtine qui les relie
    const tours: Placement[] = [];
    const toits: Placement[] = [];
    const murs: Placement[] = [];
    const R = 17;
    for (let k = 0; k < 4; k++) {
      const a = rotY + (k * Math.PI) / 2 + Math.PI / 4;
      const dx = Math.sin(a) * R;
      const dz = Math.cos(a) * R;
      tours.push({ dist: centre + dz, lat: lat + dx, y, rotY, scale: Decor.UN });
      toits.push({ dist: centre + dz, lat: lat + dx, y: y + 16, rotY, scale: Decor.UN });
      const b = a + Math.PI / 4;
      murs.push({
        dist: centre + Math.cos(b) * R * 0.92,
        lat: lat + Math.sin(b) * R * 0.92,
        y,
        rotY: b,
        scale: Decor.UN
      });
    }
    this.ajouter('ch-tour', () => new THREE.CylinderGeometry(3.4, 3.9, 16, 8).translate(0, 8, 0), pierre, tours, true);
    this.ajouter('ch-toit-tour', () => new THREE.ConeGeometry(4.2, 6, 8).translate(0, 3, 0), ardoise, toits, true);
    this.ajouter('ch-courtine', () => new THREE.BoxGeometry(2.2, 9, 24).translate(0, 4.5, 0), pierre, murs, true);
  }

  /** zone industrielle : halles, silos et cheminées en bord de route */
  private industriel(z: Zone, rand: () => number): void {
    const halles: Placement[] = [];
    const toits: Placement[] = [];
    const silos: Placement[] = [];
    const chapeaux: Placement[] = [];
    const cheminees: Placement[] = [];
    const pas = 62 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() < 0.3) continue;
        const lat = side * (26 + rand() * 34);
        const y = this.piste.groundAt(x, lat);
        const rotY = this.capAt(x) + (rand() - 0.5) * 0.3;
        const tirage = rand();
        if (tirage < 0.5) {
          const ech = new THREE.Vector3(1 + rand() * 0.6, 0.8 + rand() * 0.5, 1 + rand() * 0.8);
          halles.push({ dist: x, lat, y, rotY, scale: ech });
          toits.push({ dist: x, lat, y: y + 7 * ech.y, rotY, scale: ech });
        } else if (tirage < 0.85) {
          for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
            const dl = (k - 1) * 5.4;
            silos.push({ dist: x + dl * 0.2, lat: lat + dl, y, rotY, scale: Decor.UN });
            chapeaux.push({ dist: x + dl * 0.2, lat: lat + dl, y: y + 13, rotY, scale: Decor.UN });
          }
        } else {
          cheminees.push({ dist: x, lat, y, rotY, scale: new THREE.Vector3(1, 1 + rand() * 0.7, 1) });
        }
      }
    }
    this.ajouter(
      'ind-halle',
      () => new THREE.BoxGeometry(16, 7, 26).translate(0, 3.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.85, metalness: 0.25 }),
      halles,
      true
    );
    this.ajouter(
      'ind-toit',
      () => new THREE.CylinderGeometry(8.4, 8.4, 26, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),
      () => new THREE.MeshStandardMaterial({ color: 0x6d747c, roughness: 0.8, metalness: 0.3 }),
      toits,
      true
    );
    this.ajouter(
      'ind-silo',
      () => new THREE.CylinderGeometry(2.4, 2.4, 13, 12).translate(0, 6.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xd3d0c8, roughness: 0.7 }),
      silos,
      true
    );
    this.ajouter(
      'ind-chapeau',
      () => new THREE.ConeGeometry(2.7, 1.8, 12).translate(0, 0.9, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6, metalness: 0.4 }),
      chapeaux
    );
    this.ajouter(
      'ind-cheminee',
      () => new THREE.CylinderGeometry(1.1, 1.8, 30, 10).translate(0, 15, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xb4665a, roughness: 0.92 }),
      cheminees,
      true
    );
  }

  /** plateau aride : rocaille claire et buissons secs */
  private plateauAride(z: Zone, rand: () => number): void {
    const cailloux: Placement[] = [];
    const buissons: Placement[] = [];
    const pas = 9 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() < 0.42) continue;
        const lat = side * (16 + rand() * 90);
        const y = this.piste.groundAt(x, lat);
        const s = 0.4 + rand() * 1.5;
        const cible = rand() < 0.55 ? cailloux : buissons;
        cible.push({
          dist: x,
          lat,
          y,
          rotY: rand() * 6.28,
          scale: new THREE.Vector3(s, s * (0.5 + rand() * 0.6), s)
        });
      }
    }
    this.ajouter(
      'ar-caillou',
      () => new THREE.DodecahedronGeometry(1.1, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xa89878, roughness: 1, flatShading: true }),
      cailloux
    );
    this.ajouter(
      'ar-buisson',
      () => new THREE.IcosahedronGeometry(0.95, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x8a8556, roughness: 1, flatShading: true }),
      buissons
    );
  }

  /** marais : roselières, nappes d'eau sombres et pontons de bois */
  private marais(z: Zone, rand: () => number): void {
    const roseaux: Placement[] = [];
    const nappes: Placement[] = [];
    const pieux: Placement[] = [];
    const pas = 5 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          if (rand() < 0.45) continue;
          const lat = side * (16 + k * 16 + rand() * 12);
          const y = this.piste.groundAt(x, lat);
          const s = 0.7 + rand() * 0.8;
          roseaux.push({ dist: x, lat, y, rotY: rand() * 6.28, scale: new THREE.Vector3(s, s, s) });
        }
      }
      if (rand() < 0.3) {
        const side = rand() > 0.5 ? 1 : -1;
        const lat = side * (30 + rand() * 45);
        nappes.push({
          dist: x,
          lat,
          y: this.piste.groundAt(x, lat) + 0.06,
          rotY: rand() * 6.28,
          scale: new THREE.Vector3(1 + rand(), 1, 1 + rand())
        });
      }
      if (rand() < 0.12) {
        const side = rand() > 0.5 ? 1 : -1;
        const lat = side * (18 + rand() * 10);
        pieux.push({ dist: x, lat, y: this.piste.groundAt(x, lat), rotY: 0, scale: Decor.UN });
      }
    }
    this.ajouter(
      'ma-roseau',
      () => new THREE.ConeGeometry(0.5, 2.4, 4).translate(0, 1.2, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x7d8a4a, roughness: 1, flatShading: true }),
      roseaux
    );
    this.ajouter(
      'ma-eau',
      () => new THREE.CircleGeometry(9, 12).rotateX(-Math.PI / 2),
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x2c4a52,
          roughness: 0.25,
          metalness: 0.1,
          transparent: true,
          opacity: 0.92
        }),
      nappes
    );
    this.ajouter(
      'ma-pieu',
      () => new THREE.CylinderGeometry(0.11, 0.13, 2.2, 5).translate(0, 1.1, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x6b5a42, roughness: 1 }),
      pieux
    );
  }

  /** oliveraie : troncs noueux et frondaisons gris-vert, en rangs larges */
  private oliveraie(z: Zone, rand: () => number): void {
    const troncs: Placement[] = [];
    const frondaisons: Placement[] = [];
    const pas = 9 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const lat = side * (17 + k * 11 + (rand() - 0.5) * 3);
          const y = this.piste.groundAt(x, lat);
          if (y > 90) continue;
          const s = 0.85 + rand() * 0.4;
          const rotY = rand() * 6.28;
          troncs.push({ dist: x, lat, y, rotY, scale: new THREE.Vector3(s, s, s) });
          frondaisons.push({ dist: x, lat, y: y + 1.7 * s, rotY, scale: new THREE.Vector3(s, s * 0.8, s) });
        }
      }
    }
    this.ajouter(
      'ol-tronc',
      () => new THREE.CylinderGeometry(0.22, 0.34, 1.9, 6).translate(0, 0.95, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x6e6152, roughness: 1 }),
      troncs
    );
    this.ajouter(
      'ol-frondaison',
      () => new THREE.IcosahedronGeometry(1.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x7d8f6a, roughness: 1, flatShading: true }),
      frondaisons,
      true
    );
  }

  /** bocage : haies vives fermant de petits prés, et des vaches dedans */
  private bocage(z: Zone, rand: () => number): void {
    const haies: Placement[] = [];
    const vaches: Placement[] = [];
    const pas = 4 / Math.max(0.35, this.q.densiteDecor);
    // haies parallèles à la route, puis quelques-unes en travers
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        for (const lat of [side * 17, side * 46, side * 82]) {
          if (rand() < 0.12) continue;
          haies.push({
            dist: x,
            lat,
            y: this.piste.groundAt(x, lat),
            rotY: this.capAt(x),
            scale: new THREE.Vector3(1, 0.85 + rand() * 0.4, 1)
          });
        }
      }
    }
    for (let x = z.from; x < z.to; x += 34 / Math.max(0.35, this.q.densiteDecor)) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 7; k++) {
          const lat = side * (20 + k * 9);
          haies.push({
            dist: x,
            lat,
            y: this.piste.groundAt(x, lat),
            rotY: this.capAt(x) + Math.PI / 2,
            scale: new THREE.Vector3(1, 0.9, 1)
          });
        }
      }
      // le troupeau
      if (rand() < 0.7) {
        const side = rand() > 0.5 ? 1 : -1;
        const n = 2 + Math.floor(rand() * 5);
        for (let i = 0; i < n; i++) {
          const lat = side * (24 + rand() * 45);
          const d = x + (rand() - 0.5) * 26;
          vaches.push({
            dist: d,
            lat,
            y: this.piste.groundAt(d, lat),
            rotY: rand() * 6.28,
            scale: Decor.UN
          });
        }
      }
    }
    this.ajouter(
      'bo-haie',
      () => new THREE.BoxGeometry(4.4, 1.8, 1.1).translate(0, 0.9, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x3f6b34, roughness: 1, flatShading: true }),
      haies
    );
    this.ajouter(
      'bo-vache',
      () => new THREE.BoxGeometry(0.75, 0.85, 1.7).translate(0, 0.75, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.95, flatShading: true }),
      vaches,
      true
    );
  }

  /** station de montagne : chalets et remontées mécaniques */
  private station(z: Zone, rand: () => number): void {
    const chalets: Placement[] = [];
    const toits: Placement[] = [];
    const pylones: Placement[] = [];
    const bras: Placement[] = [];
    const pas = 26 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() < 0.35) continue;
        const lat = side * (19 + rand() * 30);
        const y = this.piste.groundAt(x, lat);
        if (y > 120) continue;
        const rotY = this.capAt(x) + (rand() - 0.5) * 0.6;
        const s = 0.9 + rand() * 0.5;
        const ech = new THREE.Vector3(s, s, s);
        chalets.push({ dist: x, lat, y, rotY, scale: ech });
        toits.push({ dist: x, lat, y: y + 4.2 * s, rotY, scale: ech });
      }
    }
    // la ligne de pylônes grimpe le flanc, perpendiculairement à la route
    const cote = rand() > 0.5 ? 1 : -1;
    for (let k = 0; k < 7; k++) {
      const d = z.from + 30 + k * 12;
      const lat = cote * (40 + k * 34);
      if (d > z.to) break;
      const y = this.piste.groundAt(d, lat);
      pylones.push({ dist: d, lat, y, rotY: 0, scale: Decor.UN });
      bras.push({ dist: d, lat, y: y + 11.5, rotY: this.capAt(d) + Math.PI / 2, scale: Decor.UN });
    }
    this.ajouter(
      'st-chalet',
      () => new THREE.BoxGeometry(6.5, 4.2, 8).translate(0, 2.1, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95, flatShading: true }),
      chalets,
      true
    );
    this.ajouter(
      'st-toit',
      () => new THREE.CylinderGeometry(4.6, 4.6, 8.6, 3).rotateZ(Math.PI / 2).translate(0, 1.4, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x3d4249, roughness: 0.9, flatShading: true }),
      toits,
      true
    );
    this.ajouter(
      'st-pylone',
      () => new THREE.CylinderGeometry(0.3, 0.45, 12, 6).translate(0, 6, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.5, metalness: 0.6 }),
      pylones,
      true
    );
    this.ajouter(
      'st-bras',
      () => new THREE.BoxGeometry(4.6, 0.28, 0.28),
      () => new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.5, metalness: 0.6 }),
      bras
    );
  }

  /** verger : petits arbres fruitiers en quinconce régulier */
  private verger(z: Zone, rand: () => number): void {
    const troncs: Placement[] = [];
    const houppiers: Placement[] = [];
    const pas = 5.5 / Math.max(0.35, this.q.densiteDecor);
    let rang = 0;
    for (let x = z.from; x < z.to; x += pas, rang++) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const lat = side * (16 + k * 8 + (rang % 2) * 4);
          const y = this.piste.groundAt(x, lat);
          if (y > 90) continue;
          const s = 0.8 + rand() * 0.25;
          troncs.push({ dist: x, lat, y, rotY: 0, scale: new THREE.Vector3(s, s, s) });
          houppiers.push({ dist: x, lat, y: y + 1.5 * s, rotY: rand() * 6.28, scale: new THREE.Vector3(s, s, s) });
        }
      }
    }
    this.ajouter(
      've-tronc',
      () => new THREE.CylinderGeometry(0.13, 0.18, 1.6, 5).translate(0, 0.8, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x6d5238, roughness: 1 }),
      troncs
    );
    this.ajouter(
      've-houppier',
      () => new THREE.SphereGeometry(1.25, 7, 5),
      () => new THREE.MeshStandardMaterial({ color: 0x4f8f42, roughness: 1, flatShading: true }),
      houppiers,
      true
    );
  }

  /**
   * Lac. La nappe commence au-delà de la portée du semis d'arbres de Track,
   * sinon on verrait des troncs pousser au milieu de l'eau — le décor de zone
   * et le semis général s'ignorent l'un l'autre.
   */
  private lac(z: Zone, rand: () => number): void {
    const cote = rand() > 0.5 ? 1 : -1;
    const nappes: Placement[] = [];
    const roseaux: Placement[] = [];
    const pontons: Placement[] = [];
    for (let x = z.from; x < z.to; x += 26) {
      const lat = cote * 190;
      nappes.push({
        dist: x,
        lat,
        y: this.piste.groundAt(x, lat) - 1.4,
        rotY: this.capAt(x),
        scale: Decor.UN
      });
      for (let k = 0; k < 5; k++) {
        if (rand() < 0.4) continue;
        const l = cote * (88 + rand() * 14);
        const d = x + rand() * 26;
        roseaux.push({
          dist: d,
          lat: l,
          y: this.piste.groundAt(d, l),
          rotY: rand() * 6.28,
          scale: new THREE.Vector3(1, 0.8 + rand() * 0.6, 1)
        });
      }
      if (rand() < 0.18) {
        pontons.push({
          dist: x,
          lat: cote * 100,
          y: this.piste.groundAt(x, cote * 100) + 0.4,
          rotY: this.capAt(x) + Math.PI / 2,
          scale: Decor.UN
        });
      }
    }
    this.ajouter(
      'lc-eau',
      () => new THREE.PlaneGeometry(230, 30).rotateX(-Math.PI / 2),
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x2f6f8a,
          roughness: 0.18,
          metalness: 0.15,
          side: THREE.DoubleSide
        }),
      nappes
    );
    this.ajouter(
      'lc-roseau',
      () => new THREE.ConeGeometry(0.45, 2.1, 4).translate(0, 1.05, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x76854a, roughness: 1, flatShading: true }),
      roseaux
    );
    this.ajouter(
      'lc-ponton',
      () => new THREE.BoxGeometry(2.2, 0.16, 11),
      () => new THREE.MeshStandardMaterial({ color: 0x7a6446, roughness: 1 }),
      pontons,
      true
    );
  }

  /** gorges : deux parois qui se resserrent sur la route */
  private gorges(z: Zone, rand: () => number): void {
    const parois: Placement[] = [];
    const blocs: Placement[] = [];
    const pas = 11 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        const lat = side * (21 + rand() * 5);
        const h = 16 + rand() * 26;
        parois.push({
          dist: x,
          lat,
          y: this.piste.groundAt(x, lat),
          rotY: this.capAt(x) + (rand() - 0.5) * 0.25,
          scale: new THREE.Vector3(1, h / 20, 1)
        });
        if (rand() < 0.3) {
          const l = side * (15 + rand() * 4);
          const s = 0.6 + rand() * 1.3;
          blocs.push({
            dist: x + rand() * pas,
            lat: l,
            y: this.piste.groundAt(x, l),
            rotY: rand() * 6.28,
            scale: new THREE.Vector3(s, s, s)
          });
        }
      }
    }
    this.ajouter(
      'go-paroi',
      () => new THREE.BoxGeometry(7, 20, 12).translate(0, 10, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x746a5c, roughness: 1, flatShading: true }),
      parois,
      true
    );
    this.ajouter(
      'go-bloc',
      () => new THREE.DodecahedronGeometry(1.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x837868, roughness: 1, flatShading: true }),
      blocs,
      true
    );
  }

  /** carrière : gradins de roche, tas de gravier et un engin */
  private carriere(z: Zone, rand: () => number): void {
    const cote = rand() > 0.5 ? 1 : -1;
    const gradins: Placement[] = [];
    const tas: Placement[] = [];
    const engins: Placement[] = [];
    for (let k = 0; k < 5; k++) {
      for (let x = z.from; x < z.to; x += 16) {
        gradins.push({
          dist: x,
          lat: cote * (34 + k * 15),
          y: this.piste.groundAt(x, cote * (34 + k * 15)) + k * 4.5,
          rotY: this.capAt(x),
          scale: Decor.UN
        });
      }
    }
    for (let x = z.from; x < z.to; x += 40) {
      if (rand() < 0.45) continue;
      const lat = cote * (22 + rand() * 8);
      const s = 1 + rand() * 1.4;
      tas.push({
        dist: x,
        lat,
        y: this.piste.groundAt(x, lat),
        rotY: rand() * 6.28,
        scale: new THREE.Vector3(s, s * 0.7, s)
      });
      if (rand() < 0.4) {
        engins.push({
          dist: x + 12,
          lat: cote * 25,
          y: this.piste.groundAt(x + 12, cote * 25),
          rotY: this.capAt(x) + rand(),
          scale: Decor.UN
        });
      }
    }
    this.ajouter(
      'ca-gradin',
      () => new THREE.BoxGeometry(14, 4.5, 17).translate(0, 2.25, 0),
      () => new THREE.MeshStandardMaterial({ color: 0x9c9081, roughness: 1, flatShading: true }),
      gradins,
      true
    );
    this.ajouter(
      'ca-tas',
      () => new THREE.ConeGeometry(3.4, 4, 9),
      () => new THREE.MeshStandardMaterial({ color: 0x8a8175, roughness: 1, flatShading: true }),
      tas,
      true
    );
    this.ajouter(
      'ca-engin',
      () => new THREE.BoxGeometry(2.6, 2.4, 5.2).translate(0, 1.2, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xd8a72c, roughness: 0.75, metalness: 0.25 }),
      engins,
      true
    );
  }

  /** aérodrome : hangars en berceau, manche à air et un avion léger */
  private aerodrome(z: Zone, rand: () => number): void {
    const cote = rand() > 0.5 ? 1 : -1;
    const piste: Placement[] = [];
    const hangars: Placement[] = [];
    const manches: Placement[] = [];
    const fuselages: Placement[] = [];
    const ailes: Placement[] = [];
    for (let x = z.from; x < z.to; x += 30) {
      const lat = cote * 75;
      piste.push({
        dist: x,
        lat,
        y: this.piste.groundAt(x, lat) + 0.08,
        rotY: this.capAt(x),
        scale: Decor.UN
      });
    }
    for (let x = z.from + 20; x < z.to; x += 70 / Math.max(0.4, this.q.densiteDecor)) {
      const lat = cote * (34 + rand() * 12);
      const y = this.piste.groundAt(x, lat);
      const rotY = this.capAt(x);
      hangars.push({ dist: x, lat, y, rotY, scale: new THREE.Vector3(1, 1, 1 + rand() * 0.5) });
      if (rand() < 0.5) {
        manches.push({ dist: x + 16, lat: cote * 26, y: this.piste.groundAt(x + 16, cote * 26), rotY, scale: Decor.UN });
      }
      if (rand() < 0.55) {
        const d = x + 8;
        const l = cote * 58;
        const yy = this.piste.groundAt(d, l);
        fuselages.push({ dist: d, lat: l, y: yy, rotY: rotY + rand() * 0.6, scale: Decor.UN });
        ailes.push({ dist: d, lat: l, y: yy + 1.1, rotY: rotY + rand() * 0.6, scale: Decor.UN });
      }
    }
    this.ajouter(
      'ae-piste',
      () => new THREE.BoxGeometry(26, 0.12, 32),
      () => new THREE.MeshStandardMaterial({ color: 0x555a5f, roughness: 0.95 }),
      piste
    );
    this.ajouter(
      'ae-hangar',
      () => new THREE.CylinderGeometry(6, 6, 15, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),
      () => new THREE.MeshStandardMaterial({ color: 0xa9aeb4, roughness: 0.7, metalness: 0.35 }),
      hangars,
      true
    );
    this.ajouter(
      'ae-manche',
      () => new THREE.CylinderGeometry(0.07, 0.09, 7, 5).translate(0, 3.5, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.6 }),
      manches
    );
    this.ajouter(
      'ae-fuselage',
      () => new THREE.CapsuleGeometry(0.55, 4.4, 3, 7).rotateX(Math.PI / 2).translate(0, 1, 0),
      () => new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.5 }),
      fuselages,
      true
    );
    this.ajouter(
      'ae-aile',
      () => new THREE.BoxGeometry(9.5, 0.16, 1.3),
      () => new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.5 }),
      ailes,
      true
    );
  }

  /** bord de mer : palmiers, sable et rochers */
  private littoral(z: Zone, rand: () => number): void {
    const troncs: Placement[] = [];
    const palmes: Placement[] = [];
    const rochers: Placement[] = [];
    const glbRochers = new Map<SceneryPiece, Placement[]>();
    const pas = 16 / Math.max(0.35, this.q.densiteDecor);
    // quand une vraie mer borde la route, les palmiers restent du côté terre :
    // sur le côté mer ils finiraient les pieds dans l'eau, la vue doit rester dégagée
    const cotesPalmiers = this.coteMer !== 0 ? [-this.coteMer] : [-1, 1];
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of cotesPalmiers) {
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
        const place = {
          dist: x,
          lat,
          y: this.piste.groundAt(x, lat),
          rotY: rand() * 6.28,
          scale: new THREE.Vector3(1 + rand(), 0.7 + rand() * 0.6, 1 + rand())
        };
        const piece = this.scenery?.getRandom('rock', rand);
        if (piece) {
          const liste = glbRochers.get(piece) ?? [];
          liste.push(place);
          glbRochers.set(piece, liste);
        } else {
          rochers.push(place);
        }
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
    let gri = 0;
    for (const [piece, places] of glbRochers) {
      this.ajouter(`glb-rocher-cote-${gri++}`, () => piece.geometry, () => piece.material, places, true, true);
    }
  }

  /** haute montagne : éboulis, blocs et névés */
  private hauteMontagne(z: Zone, rand: () => number): void {
    const blocs: Placement[] = [];
    const glbBlocs = new Map<SceneryPiece, Placement[]>();
    const neiges: Placement[] = [];
    const pas = 11 / Math.max(0.35, this.q.densiteDecor);
    for (let x = z.from; x < z.to; x += pas) {
      for (const side of [-1, 1]) {
        if (rand() > 0.62) continue;
        const lat = side * (11 + rand() * 60);
        const y = this.piste.groundAt(x, lat);
        const s = 0.5 + rand() * 1.6;
        const blocPlace = {
          dist: x,
          lat,
          y,
          rotY: rand() * 6.28,
          scale: new THREE.Vector3(s, s * (0.6 + rand() * 0.6), s)
        };
        const blocPiece = this.scenery?.getRandom('rock', rand);
        if (blocPiece) {
          const liste = glbBlocs.get(blocPiece) ?? [];
          liste.push(blocPlace);
          glbBlocs.set(blocPiece, liste);
        } else {
          blocs.push(blocPlace);
        }
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
    let gbi = 0;
    for (const [piece, places] of glbBlocs) {
      this.ajouter(`glb-bloc-${gbi++}`, () => piece.geometry, () => piece.material, places, true, true);
    }
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
      if (m.isMesh && !this.meshesPartages.has(m as THREE.InstancedMesh)) m.geometry?.dispose();
    });
    for (const j of this.jetables) j.dispose();
    this.meshesPartages.clear();
  }
}
