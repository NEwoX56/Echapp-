import * as THREE from 'three';
import type { StageDef, ClimbDef, SprintDef } from '../data/types';
import type { SceneryAssets, SceneryPiece } from '../core/SceneryAssets';
import type { BuildingKit } from './BuildingKit';
import { Poseur } from '../monde/Poseur';
import type { QualitySettings } from '../core/Quality';
import { Decor } from './Decor';

const ROAD_WIDTH = 9;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** bruit fractal 2D bon marché, déterministe */
function fbm(x: number, y: number, seed: number): number {
  let v = 0;
  let amp = 1;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    v +=
      amp *
      Math.sin(x * f * 0.9 + seed * 1.7 + Math.cos(y * f * 0.7 + seed)) *
      Math.cos(y * f * 0.8 + seed * 2.3 + Math.sin(x * f * 0.6));
    amp *= 0.5;
    f *= 2.1;
  }
  return v * 0.53;
}

export interface ClimbMarker extends ClimbDef {
  dist: number;
}
export interface SprintMarker extends SprintDef {
  dist: number;
}
export interface PaveMarker {
  from: number;
  to: number;
  name: string;
}
export interface VentMarker {
  from: number;
  to: number;
  name: string;
}

export class Track {
  readonly stage: StageDef;
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly group = new THREE.Group();
  /** distance de la zone de ravitaillement (-1 si étape trop courte) */
  feedZoneDist = -1;
  readonly climbs: ClimbMarker[] = [];
  readonly sprints: SprintMarker[] = [];
  readonly paveZones: PaveMarker[] = [];
  readonly ventZones: VentMarker[] = [];
  /**
   * Étapes de montagne : un côté de la route est un vide, l'autre une paroi.
   * -1 = le vide est à gauche, 1 = à droite, 0 = pas d'étape de montagne
   * (relief symétrique classique).
   */
  private coteVide = 0;
  /** étapes littorales : -1/1 = côté où la mer borde la route, 0 = pas de mer */
  private coteMer = 0;
  /** altitude monde absolue du niveau de la mer, quand coteMer != 0 */
  private seaLevel = 0;
  /** grand arrière-plan d'horizon, toujours visible côté mer quel que soit le virage */
  private merHorizon: THREE.Mesh | null = null;
  /** chaîne de sommets lointains : suit le coureur comme un décor de fond */
  private distantRange: THREE.Mesh | null = null;
  /** courbure signée échantillonnée le long du parcours (voir courbureAt) */
  private courbures = new Float32Array(0);

  private tmpP = new THREE.Vector3();
  private tmpT = new THREE.Vector3();
  private disposables: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = [];

  private scenery: SceneryAssets | null;

  /** densité de foule, 0..1 : réduite sur les machines modestes */
  private densiteFoule: number;
  private q: QualitySettings;
  /** paysages traversés */
  decor!: Decor;
  /** meubles posés à la main dans l'atelier (onglet Test) */
  objets!: Poseur;
  /** horloge transmise au shader d'animation de la foule */
  private horlogeFoule: { value: number } | null = null;
  /** position de la course transmise au shader : le public s'anime à son passage */
  private positionCoureurFoule: { value: number } | null = null;

  /** fait vivre la foule ; à appeler à chaque image */
  animer(dt: number, distCourse?: number): void {
    if (this.horlogeFoule) this.horlogeFoule.value += dt;
    if (this.positionCoureurFoule && distCourse !== undefined) {
      this.positionCoureurFoule.value = distCourse;
    }
  }

  constructor(
    stage: StageDef,
    scenery: SceneryAssets | null = null,
    quality?: QualitySettings,
    buildings: BuildingKit | null = null
  ) {
    this.stage = stage;
    this.scenery = scenery;
    this.q =
      quality ??
      ({
        densiteFoule: 1,
        pasTerrain: 9,
        segmentsRoute: 520,
        densiteDecor: 1,
        shadows: true
      } as QualitySettings);
    this.densiteFoule = THREE.MathUtils.clamp(this.q.densiteFoule ?? 1, 0.1, 1);
    // le vide change de côté d'une étape de montagne à l'autre, sans consommer
    // le tirage déterministe des autres éléments du parcours
    this.coteVide = stage.type === 'montagne' ? (stage.seed % 2 === 0 ? 1 : -1) : 0;
    this.coteMer = stage.mer ? (stage.seed % 2 === 0 ? -1 : 1) : 0;
    if (this.coteMer !== 0) {
      this.seaLevel = Math.min(...stage.profile.map((p) => p[1])) - 3;
    }
    const rand = mulberry32(stage.seed);

    this.curve = this.construireCourbe(stage, rand);
    this.length = this.curve.getLength();
    this.construireTableCourbure();

    for (const c of stage.climbs ?? []) this.climbs.push({ ...c, dist: c.at * this.length });
    for (const s of stage.sprints ?? []) this.sprints.push({ ...s, dist: s.at * this.length });
    for (const p of stage.paves ?? []) {
      this.paveZones.push({ from: p.from * this.length, to: p.to * this.length, name: p.name });
    }
    for (const v of stage.vent ?? []) {
      this.ventZones.push({ from: v.from * this.length, to: v.to * this.length, name: v.name });
    }

    this.buildRoad();
    this.buildGuardrail();
    this.buildTerrain(stage.seed);
    this.buildSeaHorizon();
    this.buildDistantRange(stage.seed);
    /*
     * Le décor traversé : villages, villes, forêts, rivières et monuments.
     * Il remplace le semis d'arbres uniforme dans les zones qu'il couvre, la
     * végétation générique étant réservée aux abords lointains.
     */
    this.decor = new Decor(this, stage, {
      densiteDecor: this.q.densiteDecor ?? 1,
      shadows: this.q.shadows !== false
    }, rand, buildings, scenery);
    this.group.add(this.decor.group);

    this.buildScenery(rand);
    this.buildCrowds(rand);
    this.buildBanners();
    this.buildFinish();

    /*
     * Les meubles de l'atelier viennent par-dessus tout le reste. Ils ne
     * passent pas par le filtre de constructibilité du décor automatique :
     * c'est le joueur qui décide, y compris de planter un phare au bord du
     * vide s'il trouve que ça rend bien.
     */
    this.objets = new Poseur(this, stage.objets ?? [], this.q.shadows !== false);
    this.group.add(this.objets.group);
  }

  /* ------------------------------------------------------------ */
  /* tracé : de vrais virages, pas une ligne droite qui ondule     */
  /* ------------------------------------------------------------ */

  /**
   * Construit le tracé de l'étape.
   *
   * L'ancien générateur intégrait un cap immédiatement rappelé vers zéro
   * (`heading *= 0.82`) : la route ondulait de quelques degrés autour d'une
   * ligne droite et ne tournait jamais vraiment. Ici le cap s'intègre
   * librement le long d'une suite de virages tirés au sort — chacun avec son
   * angle et sa longueur de développement — posés sur un fond de méandres
   * doux. Un virage se voit arriver, se négocie, puis se referme.
   *
   * Le cap reste borné (CAP_MAX) : le parcours doit toujours progresser dans
   * le même sens général. Une route qui se replierait franchement sur
   * elle-même ferait se chevaucher deux tronçons de terrain, celui-ci étant
   * construit comme un ruban paramétré par (distance, écart latéral).
   */
  private construireCourbe(stage: StageDef, rand: () => number): THREE.CatmullRomCurve3 {
    const SEG = 14; // un point tous les 14 m : assez fin pour dessiner un virage
    const n = Math.max(60, Math.round(stage.worldLength / SEG));
    const CAP_MAX = 1.15; // ~66°, au-delà le tracé partirait en crabe

    const virages = this.planifierVirages(stage, rand, n);

    const pts: THREE.Vector3[] = [];
    let heading = 0;
    let x = 0;
    let z = 0;
    let vi = 0;
    let restant = 0; // angle qu'il reste à balayer dans le virage en cours
    let parSegment = 0;

    for (let i = 0; i <= n; i++) {
      pts.push(new THREE.Vector3(x, 0, z));

      // ouverture d'un nouveau virage
      if (restant === 0 && vi < virages.length && virages[vi].from <= i) {
        const v = virages[vi++];
        let angle = v.angle;
        // un virage qui pousserait le cap au-delà de la limite est renvoyé
        // dans l'autre sens : c'est ce qui crée les enchaînements gauche-droite
        if (Math.abs(heading + angle) > CAP_MAX) angle = -angle;
        restant = angle;
        parSegment = angle / v.span;
      }

      if (restant !== 0) {
        // on tourne franchement tant que le virage se développe
        const pas = Math.abs(parSegment) >= Math.abs(restant) ? restant : parSegment;
        heading += pas;
        restant -= pas;
        if (Math.abs(restant) < 1e-6) restant = 0;
      } else {
        // entre deux virages : méandres doux, plus marqués au bord de mer
        const sinuosite = this.coteMer !== 0 ? 1.6 : 1;
        heading += (rand() - 0.5) * 0.05 * sinuosite;
        // rappel très lâche, qui ne s'exerce qu'aux grands écarts
        if (Math.abs(heading) > CAP_MAX * 0.75) heading *= 0.97;
      }

      x += Math.sin(heading) * SEG;
      z += Math.cos(heading) * SEG;
    }

    /*
     * Une route qui tourne est plus longue qu'une route droite. Sans
     * renormalisation, une étape de montagne bien sinueuse durerait beaucoup
     * plus longtemps que le calibrage prévu (3 à 5 min). On ramène donc la
     * longueur développée à worldLength, ce qui resserre aussi les rayons de
     * virage dans les mêmes proportions.
     */
    const brute = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
    const k = stage.worldLength / Math.max(1, brute.getLength());
    for (const p of pts) {
      p.x *= k;
      p.z *= k;
    }

    // l'altitude se pose à la fin, en fonction de l'avancement le long du tracé
    const cumul: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      cumul.push(cumul[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
    const total = cumul[cumul.length - 1] || 1;
    for (let i = 0; i < pts.length; i++) {
      pts[i].y = this.altitudeAtFraction(cumul[i] / total);
    }

    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  }

  /**
   * Répartit les virages de l'étape. Le profil décide de leur fréquence et de
   * leur sévérité : une plaine enchaîne de grandes courbes rapides, une étape
   * de montagne des virages serrés qu'il faut négocier.
   */
  private planifierVirages(
    stage: StageDef,
    rand: () => number,
    n: number
  ): { from: number; span: number; angle: number }[] {
    const cfg = {
      plaine: { tous: 24, angleMin: 0.22, angleMax: 0.6, spanMin: 4, spanMax: 8 },
      vallonnee: { tous: 17, angleMin: 0.3, angleMax: 1.0, spanMin: 3, spanMax: 7 },
      montagne: { tous: 12, angleMin: 0.45, angleMax: 1.5, spanMin: 2, spanMax: 6 },
      clm: { tous: 26, angleMin: 0.2, angleMax: 0.55, spanMin: 4, spanMax: 9 }
    }[stage.type];

    const out: { from: number; span: number; angle: number }[] = [];
    let i = 6;
    let sens = rand() > 0.5 ? 1 : -1;
    while (i < n - 6) {
      const span = cfg.spanMin + Math.floor(rand() * (cfg.spanMax - cfg.spanMin + 1));
      const angle = (cfg.angleMin + rand() * (cfg.angleMax - cfg.angleMin)) * sens;
      out.push({ from: i, span, angle });
      // alterner majoritairement gauche/droite donne des enchaînements lisibles
      if (rand() < 0.72) sens = -sens;
      i += span + Math.max(2, Math.round(cfg.tous * (0.5 + rand())));
    }
    return out;
  }

  /** pas d'échantillonnage de la table de courbure, en unités monde */
  private static readonly PAS_COURBURE = 8;

  /**
   * Table de courbure signée le long du parcours. Elle sert au penché des
   * coureurs, au roulis de la caméra et à la perte de vitesse en virage :
   * autant de lectures par image, qu'on ne veut pas payer en échantillonnage
   * de courbe à chaque fois.
   */
  private construireTableCourbure(): void {
    const n = Math.ceil(this.length / Track.PAS_COURBURE) + 2;
    this.courbures = new Float32Array(n);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const d = 7;
    for (let i = 0; i < n; i++) {
      const dist = i * Track.PAS_COURBURE;
      const t0 = THREE.MathUtils.clamp((dist - d) / this.length, 0, 1);
      const t1 = THREE.MathUtils.clamp((dist + d) / this.length, 0, 1);
      const run = (t1 - t0) * this.length;
      if (run < 0.001) continue;
      this.curve.getTangentAt(t0, a);
      this.curve.getTangentAt(t1, b);
      let delta = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      /*
       * Signe. Le cap croît quand la direction tourne de +Z vers +X ; or le
       * vecteur « droite » du jeu vaut (-tz, tx), soit -X quand on regarde
       * vers +Z (voir pose). Un cap croissant est donc un virage à GAUCHE, et
       * il faut inverser pour que la convention annoncée — positif = à droite
       * — soit la bonne. Sans cette inversion les coureurs se penchaient à
       * l'extérieur de la courbe, et la bride du terrain rognait le mauvais
       * côté.
       */
      this.courbures[i] = -delta / run;
    }
  }

  /** courbure signée en radians par unité ; positif = la route tourne à droite */
  courbureAt(dist: number): number {
    if (!this.courbures.length) return 0;
    const x = THREE.MathUtils.clamp(dist / Track.PAS_COURBURE, 0, this.courbures.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = this.courbures[i];
    const b = this.courbures[Math.min(this.courbures.length - 1, i + 1)];
    return a + (b - a) * f;
  }

  altitudeAtFraction(t: number): number {
    const p = this.stage.profile;
    if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (t <= p[i][0]) {
        const [t0, a0] = p[i - 1];
        const [t1, a1] = p[i];
        const k = (t - t0) / (t1 - t0);
        const s = (1 - Math.cos(k * Math.PI)) / 2;
        return a0 + (a1 - a0) * s;
      }
    }
    return p[p.length - 1][1];
  }

  /** vrai si la distance donnée tombe dans un secteur pavé */
  isPave(dist: number): boolean {
    for (const z of this.paveZones) if (dist >= z.from && dist <= z.to) return true;
    return false;
  }

  /** vrai si la distance donnée tombe dans un secteur exposé au vent de côté */
  isVent(dist: number): boolean {
    for (const z of this.ventZones) if (dist >= z.from && dist <= z.to) return true;
    return false;
  }

  gradeAt(dist: number): number {
    const d = 12;
    const t0 = Math.max(0, (dist - d) / this.length);
    const t1 = Math.min(1, (dist + d) / this.length);
    const a0 = this.altitudeAtFraction(t0);
    const a1 = this.altitudeAtFraction(t1);
    const run = (t1 - t0) * this.length;
    return run > 0 ? ((a1 - a0) / run) * 100 : 0;
  }

  /**
   * Position monde pour une distance + décalage latéral.
   *
   * Au-delà de la ligne d'arrivée — et avant la ligne de départ — la courbe
   * n'existe plus. On prolonge donc en ligne droite dans l'axe. Sans cela tout
   * ce qui dépassait s'écrasait sur le dernier point : la caméra d'arrivée se
   * retrouvait collée au coureur, les voitures de tête s'empilaient sur la
   * ligne, et le coureur ne pouvait pas rouler après avoir gagné.
   */
  pose(dist: number, lateral: number, outPos: THREE.Vector3, outTangent?: THREE.Vector3): void {
    const t = THREE.MathUtils.clamp(dist / this.length, 0, 1);
    this.curve.getPointAt(t, this.tmpP);
    this.curve.getTangentAt(t, this.tmpT);
    const debord = dist > this.length ? dist - this.length : dist < 0 ? dist : 0;
    if (debord !== 0) {
      this.tmpP.addScaledVector(this.tmpT, debord);
    }
    // vecteur "droite" vu depuis la caméra (derrière le coureur, regard vers +tangente)
    const nx = -this.tmpT.z;
    const nz = this.tmpT.x;
    const nl = Math.hypot(nx, nz) || 1;
    outPos.set(this.tmpP.x + (nx / nl) * lateral, this.tmpP.y, this.tmpP.z + (nz / nl) * lateral);
    if (outTangent) outTangent.copy(this.tmpT);
  }

  /* ------------------------------------------------------------ */
  /* route                                                        */
  /* ------------------------------------------------------------ */

  /** longueur de route conservée au-delà de la ligne, pour la décélération */
  static readonly DEGAGEMENT = 150;

  private buildRoad(): void {
    const segments = this.q.segmentsRoute ?? 520;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const paveSegments: boolean[] = [];
    const p = new THREE.Vector3();

    // la route déborde après la ligne : c'est là qu'on décélère et qu'on fête
    const totale = this.length + Track.DEGAGEMENT;
    for (let i = 0; i <= segments; i++) {
      const dist = (i / segments) * totale;
      this.pose(dist, -ROAD_WIDTH / 2, p);
      positions.push(p.x, p.y + 0.01, p.z);
      this.pose(dist, ROAD_WIDTH / 2, p);
      positions.push(p.x, p.y + 0.01, p.z);
      uvs.push(0, dist / 8, 1, dist / 8);
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        const mid = ((i + 0.5) / segments) * totale;
        paveSegments.push(this.isPave(mid));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();

    const tex = this.makeAsphaltTexture();
    const matAsphalte = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, side: THREE.DoubleSide });
    this.disposables.push(matAsphalte, tex);

    let materials: THREE.Material | THREE.Material[] = matAsphalte;
    if (this.paveZones.length > 0) {
      // groupes de matériaux : un groupe par plage de segments consécutifs du
      // même revêtement (6 indices par segment), asphalte = 0, pavés = 1
      let start = 0;
      let current = paveSegments[0];
      for (let i = 1; i <= paveSegments.length; i++) {
        if (i === paveSegments.length || paveSegments[i] !== current) {
          g.addGroup(start * 6, (i - start) * 6, current ? 1 : 0);
          start = i;
          if (i < paveSegments.length) current = paveSegments[i];
        }
      }
      const paveTex = this.makePaveTexture();
      const matPave = new THREE.MeshStandardMaterial({ map: paveTex, roughness: 1, side: THREE.DoubleSide });
      this.disposables.push(matPave, paveTex);
      materials = [matAsphalte, matPave];
    }
    const road = new THREE.Mesh(g, materials);
    road.receiveShadow = true;
    this.group.add(road);
    this.disposables.push(g);

    // bandes de bas-côté (terre / gravier) qui adoucissent la transition
    // bas-côté large : gravier puis herbe, il recouvre le décaissement du terrain
    this.group.add(
      this.buildRibbon(
        ROAD_WIDTH / 2,
        ROAD_WIDTH / 2 + 1.8,
        0.006,
        -0.06,
        new THREE.MeshStandardMaterial({ color: this.biome().bordChemin, roughness: 1 })
      )
    );
    this.group.add(
      this.buildRibbon(
        ROAD_WIDTH / 2 + 1.8,
        15,
        -0.054,
        -0.55,
        new THREE.MeshStandardMaterial({
          color: this.biome().herbe,
          roughness: 1
        })
      )
    );
  }

  /**
   * Balises basses le long du versant vide, en montagne : sans ce liseré au
   * bord de la route, le vide qu'on vient de creuser dans le terrain ne se
   * remarque même pas — l'œil a besoin d'un repère net au ras de la chaussée
   * pour comprendre qu'il n'y a plus rien juste après.
   */
  private buildGuardrail(): void {
    if (this.coteVide === 0) return;
    const pas = 15;
    const n = Math.max(1, Math.floor(this.length / pas));
    const postGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.65 });
    const capGeo = new THREE.BoxGeometry(0.1, 0.13, 0.03);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xd6382c,
      roughness: 0.5,
      emissive: 0x3a0c08,
      emissiveIntensity: 0.4
    });
    const posts = new THREE.InstancedMesh(postGeo, postMat, n);
    const caps = new THREE.InstancedMesh(capGeo, capMat, n);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const lat = this.coteVide * (ROAD_WIDTH / 2 + 1.05);
    for (let i = 0; i < n; i++) {
      const dist = i * pas + pas * 0.5;
      this.pose(dist, lat, p);
      m.compose(new THREE.Vector3(p.x, p.y + 0.4, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      posts.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(p.x, p.y + 0.75, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      caps.setMatrixAt(i, m);
    }
    posts.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    this.group.add(posts, caps);
    this.disposables.push(postGeo, postMat, capGeo, capMat);
  }

  /**
   * Horizon de mer : un large éventail toujours centré sur le coureur, comme
   * la chaîne de sommets lointains. Le terrain lui-même se colore en eau côté
   * mer jusqu'à sa limite (voir buildTerrain, maxLat=520) ; cet éventail
   * prend le relais au-delà, pour que l'horizon reste bleu jusqu'au ciel.
   */
  private buildSeaHorizon(): void {
    if (this.coteMer === 0) return;
    /*
     * L'angle est construit en repère local, centré sur le côté mer
     * (perpendiculaire au cap du moment) : la rotation qui recale ce repère
     * sur le cap RÉEL du coureur est appliquée image par image dans
     * updateDistant, pas figée ici. Sans ça, sur une route qui tourne
     * beaucoup, l'horizon fixé au cap de départ finit par pointer n'importe
     * où après quelques virages.
     */
    const theta0 = this.coteMer * (Math.PI / 2);
    const demiAngle = (100 * Math.PI) / 180;
    // prend le relais juste après la limite du terrain (maxLat=520 dans buildTerrain)
    const anneaux = [500, 650, 850, 1100];
    const segs = 28;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const clair = new THREE.Color(0x3fa0b8);
    const profond = new THREE.Color(0x123a52);
    const c = new THREE.Color();
    const y = this.seaLevel - 0.1;
    for (let ri = 0; ri < anneaux.length; ri++) {
      const r = anneaux[ri];
      c.copy(clair).lerp(profond, ri / (anneaux.length - 1));
      for (let s = 0; s <= segs; s++) {
        const a = theta0 - demiAngle + (s / segs) * demiAngle * 2;
        positions.push(Math.sin(a) * r, y, Math.cos(a) * r);
        colors.push(c.r, c.g, c.b);
      }
    }
    const stride = segs + 1;
    for (let ri = 0; ri < anneaux.length - 1; ri++) {
      for (let s = 0; s < segs; s++) {
        const a0 = ri * stride + s;
        const a1 = a0 + 1;
        const b0 = a0 + stride;
        const b1 = b0 + 1;
        indices.push(a0, b0, a1, a1, b0, b1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      fog: true,
      transparent: true,
      opacity: 0.92
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    this.merHorizon = mesh;
    this.group.add(mesh);
    this.disposables.push(g, mat);
  }

  /** palette régionale : deux ambiances de terrain, tempérée ou méditerranéenne */
  private biome(): { herbe: number; seche: number; roche: number; bordChemin: number } {
    if (this.stage.biome === 'mediterraneen') {
      return {
        herbe: this.stage.type === 'montagne' ? 0x8a8258 : 0xa8a45c,
        seche: 0xc4a35f,
        roche: 0x8a7a63,
        bordChemin: 0x7a6a52
      };
    }
    return {
      herbe: this.stage.type === 'montagne' ? 0x5d6b46 : 0x6f9350,
      seche: 0x8a8a63,
      roche: 0x6b6558,
      bordChemin: 0x6a6357
    };
  }

  private buildRibbon(
    latA: number,
    latB: number,
    yA: number,
    yB: number,
    mat: THREE.Material
  ): THREE.Group {
    const grp = new THREE.Group();
    const segments = Math.min(460, Math.max(120, Math.round(this.length / (this.q.pasTerrain ?? 9))));
    for (const side of [-1, 1]) {
      const positions: number[] = [];
      const indices: number[] = [];
      const p = new THREE.Vector3();
      for (let i = 0; i <= segments; i++) {
        const dist = (i / segments) * this.length;
        this.pose(dist, side * latA, p);
        positions.push(p.x, p.y + yA, p.z);
        this.pose(dist, side * latB, p);
        positions.push(p.x, p.y + yB, p.z);
        if (i < segments) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      grp.add(new THREE.Mesh(g, mat));
      this.disposables.push(g);
    }
    this.disposables.push(mat);
    return grp;
  }

  private makeAsphaltTexture(): THREE.CanvasTexture {
    const w = 256;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#34363c');
    grad.addColorStop(0.5, '#3e4148');
    grad.addColorStop(1, '#34363c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const l = 40 + Math.random() * 45;
      ctx.fillStyle = `rgba(${l + 20},${l + 22},${l + 26},${0.25 + Math.random() * 0.3})`;
      ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }
    for (let i = 0; i < 7; i++) {
      const x = 20 + Math.random() * (w - 60);
      const y = Math.random() * h;
      ctx.fillStyle = 'rgba(20,21,24,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + Math.random() * 22, 20 + Math.random() * 50, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(18,19,22,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 26;
        y += 10 + Math.random() * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const edge = 10;
    ctx.fillStyle = 'rgba(222,220,210,0.92)';
    ctx.fillRect(edge, 0, 5, h);
    ctx.fillRect(w - edge - 5, 0, 5, h);
    for (let i = 0; i < 90; i++) {
      ctx.clearRect(edge + Math.random() * 5, Math.random() * h, 1.5, 2);
      ctx.clearRect(w - edge - 5 + Math.random() * 5, Math.random() * h, 1.5, 2);
    }
    ctx.fillStyle = 'rgba(226,224,214,0.9)';
    for (let y = 0; y < h; y += 96) {
      ctx.fillRect(w / 2 - 2.5, y, 5, 44);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** pavés façon Paris-Roubaix : blocs irréguliers en quinconce, joints sombres */
  private makePaveTexture(): THREE.CanvasTexture {
    const w = 256;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#332f2a';
    ctx.fillRect(0, 0, w, h);

    const bw = 22;
    const bh = 16;
    for (let row = 0, y = -bh; y < h + bh; row++, y += bh) {
      const decale = row % 2 === 0 ? 0 : bw / 2;
      for (let x = -bw + decale; x < w + bw; x += bw) {
        const jitter = 2.2;
        const gx = x + (Math.random() - 0.5) * jitter;
        const gy = y + (Math.random() - 0.5) * jitter;
        const l = 96 + Math.random() * 60;
        ctx.fillStyle = `rgb(${l},${l - 5},${l - 12})`;
        ctx.fillRect(gx + 1.5, gy + 1.5, bw - 3, bh - 3);
      }
    }
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(20,18,16,${0.08 + Math.random() * 0.18})`;
      ctx.fillRect(x, y, 1, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ------------------------------------------------------------ */
  /* terrain : relief continu des DEUX côtés                      */
  /* ------------------------------------------------------------ */

  /** amplitude du relief selon le type d'étape */
  /**
   * Hauteur du sol effectivement visible à une position latérale donnée :
   * chaussée, puis gravier, puis herbe, puis terrain. Utilisée pour poser
   * arbres, spectateurs et barrières exactement sur la surface.
   */
  /** écart latéral où le sol rompt : bord du vide en montagne, rivage en bord de mer */
  private static readonly RUPTURE = 20;

  /**
   * Bride l'écart latéral à l'intérieur des virages.
   *
   * Le terrain est un ruban paramétré par (distance, écart) : à l'intérieur
   * d'une courbe de rayon R, les lignes d'écart se croisent dès que l'écart
   * atteint R et le maillage se replie sur lui-même. On borne donc bien avant
   * ce rayon critique. La même bride doit s'appliquer au décor : sinon un
   * arbre serait posé à un écart que le terrain, lui, a ramené plus près.
   */
  private brider(lat: number, dist: number): number {
    const kappa = this.courbureAt(Math.min(Math.max(dist, 0), this.length));
    if (Math.abs(kappa) < 1e-5) return lat;
    const coteInterieur = kappa > 0 ? 1 : -1;
    if (Math.sign(lat) !== coteInterieur) return lat;
    const bride = (1 / Math.abs(kappa)) * 0.75;
    return Math.abs(lat) > bride ? coteInterieur * bride : lat;
  }

  /**
   * Peut-on poser quelque chose ici ?
   *
   * Non au-delà de la rupture du côté du vide, ni du côté de la mer : là, le
   * sol rendu par groundAt est le fond du ravin ou la surface de l'eau. Le
   * décor s'y posait quand même — on voyait des arbres pousser dans la mer et
   * des maisons accrochées à l'à-pic. Rien ne s'installe sur un versant qui
   * tombe ou sur de l'eau.
   */
  constructible(dist: number, lat: number): boolean {
    if (Math.abs(lat) <= Track.RUPTURE) return true;
    const cote = Math.sign(lat);
    if (this.coteVide !== 0 && cote === this.coteVide) return false;
    if (this.coteMer !== 0 && cote === this.coteMer) return false;
    return true;
  }

  groundAt(dist: number, lat: number): number {
    lat = this.brider(lat, dist);
    const a = Math.abs(lat);
    if (a <= ROAD_WIDTH / 2) return 0.01;
    if (a <= ROAD_WIDTH / 2 + 1.8) {
      const k = (a - ROAD_WIDTH / 2) / 1.8;
      return 0.006 + k * (-0.06 - 0.006);
    }
    if (a <= 15) {
      const k = (a - (ROAD_WIDTH / 2 + 1.8)) / (15 - ROAD_WIDTH / 2 - 1.8);
      return -0.054 + k * (-0.55 + 0.054);
    }
    return this.reliefAt(dist, lat, this.stage.seed);
  }

  private reliefScale(): number {
    switch (this.stage.type) {
      case 'montagne':
        // les sommets alentour montent bien plus haut que la route : c'est ce
        // rapport, et non la pente, qui donne le sentiment d'être en altitude
        return 1.45;
      case 'vallonnee':
        return 0.55;
      case 'clm':
        return 0.3;
      default:
        return 0.28;
    }
  }

  /**
   * Hauteur du terrain par rapport à l'altitude de la route.
   *
   * La bande centrale est volontairement CREUSÉE sous le niveau de la route :
   * comme le terrain est échantillonné moins finement que le ruban d'asphalte,
   * une interpolation linéaire entre deux points pourrait sinon passer
   * au-dessus de la chaussée dans les virages en devers (l'herbe "coupait"
   * la route en montagne). Ce décaissement garantit que l'asphalte reste
   * toujours visible.
   */
  private reliefAt(dist: number, lat: number, seed: number): number {
    const a = Math.abs(lat);
    const TRENCH = -0.55; // décaissement sous la chaussée
    const FLAT_TO = 14; // fin de la zone plate creusée
    const RISE_FROM = Track.RUPTURE; // début du relief — et bord du vide

    if (a <= FLAT_TO) return TRENCH;

    // raccord doux entre la zone creusée et le relief, commun aux deux formules
    if (a < RISE_FROM) {
      const k = (a - FLAT_TO) / (RISE_FROM - FLAT_TO);
      const smooth = k * k * (3 - 2 * k);
      return TRENCH * (1 - smooth);
    }

    /*
     * Versant du vide, en montagne : la route longe une falaise plutôt que de
     * remonter symétriquement des deux côtés. Sans ce plongeon, un col n'a
     * jamais l'air d'un vrai col — juste d'une vallée verte des deux côtés.
     */
    if (this.coteVide !== 0 && Math.sign(lat) === this.coteVide) {
      const far = Math.min(1, (a - RISE_FROM) / 150);
      const plancher = fbm(dist * 0.0016, a * 0.003, seed + 91) * 28;
      // le fond de vallée est loin en dessous : un vide peu profond se lit
      // comme un talus, pas comme un à-pic
      return -(42 + far * (290 + plancher));
    }

    /*
     * Versant de la mer : le terrain s'aplatit vers le niveau de la mer
     * (constant, absolu) plutôt que de suivre le relief habituel — sans quoi
     * la plaque d'eau posée plus loin flotterait au-dessus d'une colline ou
     * s'enfoncerait dedans selon l'altitude du profil à cet endroit.
     */
    if (this.coteMer !== 0 && Math.sign(lat) === this.coteMer) {
      const flatten = Math.min(1, (a - RISE_FROM) / 18);
      const dune = fbm(dist * 0.006, a * 0.01, seed + 53) * 2.3 * (1 - flatten);
      const cible = this.seaLevel - this.altitudeAtFraction(dist / this.length);
      return cible + dune;
    }

    const s = this.reliefScale();
    const base = fbm(dist * 0.0022, lat * 0.0035, seed) * 26 * s;
    const far = Math.min(1, (a - RISE_FROM) / 340);
    const ridges = Math.abs(fbm(dist * 0.0009, lat * 0.0016, seed + 31)) * 190 * s * far;
    const local = fbm(dist * 0.012, lat * 0.02, seed + 77) * 2.4;
    const ramp = Math.min(1, Math.max(0, (a - RISE_FROM) / 90));
    // paroi plus marquée côté montagne quand l'autre versant est un vide
    const boost = this.coteVide !== 0 ? 1.25 : 1;
    return ramp * (base + ridges * boost + local * ramp);
  }

  /**
   * Texture de détail du terrain : touffes d'herbe, cailloux, variations.
   *
   * Elle est répétée sur toute la surface et multipliée par les couleurs de
   * sommets, qui portent déjà l'information d'altitude (herbe, roche, neige).
   * Une seule texture de 256 px suffit donc à casser l'aspect lisse sans
   * peser sur la mémoire vidéo — ce qui compte sur le navigateur d'une console.
   */
  private makeTerrainTexture(): THREE.CanvasTexture {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = '#b4b4b4';
    g.fillRect(0, 0, S, S);

    // grain général
    const img = g.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 176 + (Math.random() - 0.5) * 46;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
    }
    g.putImageData(img, 0, 0);

    // touffes : petits traits orientés, plus clairs
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const a = Math.random() * Math.PI;
      const l = 2 + Math.random() * 5;
      g.strokeStyle = `rgba(${200 + Math.random() * 40},${205 + Math.random() * 40},${190 + Math.random() * 40},0.5)`;
      g.lineWidth = 0.8 + Math.random();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // cailloux
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 0.7 + Math.random() * 2.2;
      g.fillStyle = `rgba(${110 + Math.random() * 60},${108 + Math.random() * 55},${100 + Math.random() * 50},0.55)`;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.7, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // plaques d'ombre douces : donne du volume au relief
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 14 + Math.random() * 40;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(90,88,80,0.20)');
      grad.addColorStop(1, 'rgba(90,88,80,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  private buildTerrain(seed: number): void {
    // le pas suit la qualité : assez fin pour épouser les virages sans
    // multiplier les sommets sur une machine modeste
    const pas = this.q.pasTerrain ?? 9;
    const nLong = Math.min(460, Math.max(90, Math.round(this.length / pas)));
    const nCol = pas > 18 ? 30 : pas > 12 ? 38 : 46;
    const maxLat = 520;

    /*
     * Écarts latéraux échantillonnés.
     *
     * La répartition de base est dense près de la route et large au loin. On y
     * ajoute de force deux colonnes serrées de part et d'autre de RUPTURE : au
     * bord d'un vide de montagne ou d'un rivage, le sol tombe d'un coup de
     * plusieurs dizaines de mètres à cet écart précis. Sans colonne juste
     * avant et juste après, le maillage tirait un seul long triangle par-dessus
     * la rupture, alors que groundAt — dont se sert tout le décor — la voyait,
     * elle. Arbres et maisons se retrouvaient posés sur un sol qui n'existait
     * pas à cet endroit : ils flottaient au-dessus du vide.
     */
    const lats: number[] = [];
    for (let j = 0; j <= nCol; j++) {
      const u = (j / nCol) * 2 - 1;
      lats.push(Math.sign(u) * Math.pow(Math.abs(u), 2.1) * maxLat);
    }
    for (const bord of [-Track.RUPTURE - 1.4, -Track.RUPTURE + 0.4, Track.RUPTURE - 0.4, Track.RUPTURE + 1.4]) {
      lats.push(bord);
    }
    lats.sort((a, b) => a - b);
    const nLat = lats.length - 1;
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const p = new THREE.Vector3();

    const palette = this.biome();
    const rock = new THREE.Color(palette.roche);
    const grass = new THREE.Color(palette.herbe);
    const snow = new THREE.Color(0xdfe6ee);
    const dry = new THREE.Color(palette.seche);
    const sable = new THREE.Color(0xd9c48f);
    const eauClaire = new THREE.Color(0x4aa8bf);
    const eauProfonde = new THREE.Color(0x14415c);
    const c = new THREE.Color();

    // le terrain accompagne la route jusque dans le dégagement d'arrivée
    const totaleT = this.length + Track.DEGAGEMENT;
    for (let i = 0; i <= nLong; i++) {
      const dist = (i / nLong) * totaleT;
      /*
       * Bride de l'intérieur des virages. Le terrain est un ruban paramétré
       * par (distance, écart latéral) : à l'intérieur d'une courbe de rayon R,
       * les lignes d'écart se croisent dès que l'écart atteint R, et le
       * maillage se replie sur lui-même. On borne donc l'écart intérieur bien
       * avant ce rayon critique. Sans cette bride, tout virage un peu franc
       * produisait des triangles retournés en travers de la route.
       */
      for (let j = 0; j <= nLat; j++) {
        // même bride que groundAt, pour que décor et maillage restent d'accord
        const lat = this.brider(lats[j], dist);
        const rel = this.reliefAt(dist, lat, seed);
        this.pose(dist, lat, p);
        const y = p.y + rel;
        positions.push(p.x, y, p.z);
        // UV en coordonnées monde : la texture garde la même échelle partout,
        // sans étirement là où le maillage s'élargit au loin
        uvs.push(dist / 26, lat / 26);

        // coloration par altitude relative
        const altAbs = y;
        const merIci = this.coteMer !== 0 && Math.sign(lat) === this.coteMer && Math.abs(lat) > 20;
        if (merIci) {
          // plage puis mer : le maillage du terrain EST l'eau ici, sans
          // nappe séparée qui flotterait ou se ferait recouvrir par lui
          const flatten = Math.min(1, (Math.abs(lat) - 20) / 18);
          c.copy(sable).lerp(eauClaire, Math.min(1, flatten * 1.6));
          if (flatten > 0.6) c.lerp(eauProfonde, (flatten - 0.6) / 0.4);
        } else {
          if (rel < 1.5) c.copy(grass);
          else if (rel < 30) c.copy(grass).lerp(dry, Math.min(1, rel / 30));
          else if (rel < 95) c.copy(dry).lerp(rock, Math.min(1, (rel - 30) / 65));
          else c.copy(rock);
          // neige sur les sommets des étapes de montagne
          if (this.stage.type === 'montagne' && altAbs > 190) {
            c.lerp(snow, Math.min(1, (altAbs - 190) / 90));
          }
        }
        // variation locale
        const n = fbm(dist * 0.03, lat * 0.05, seed + 5) * 0.06;
        c.offsetHSL(0, 0, n);
        colors.push(c.r, c.g, c.b);
      }
    }
    const stride = nLat + 1;
    for (let i = 0; i < nLong; i++) {
      for (let j = 0; j < nLat; j++) {
        const a = i * stride + j;
        indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const tex = this.makeTerrainTexture();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: tex,
      roughness: 1,
      flatShading: this.stage.type === 'montagne'
    });
    this.disposables.push(tex);
    const terrain = new THREE.Mesh(g, mat);
    terrain.receiveShadow = true;
    this.group.add(terrain);
    this.disposables.push(g, mat);
  }

  /**
   * Chaîne de sommets lointains, au-delà du terrain jouable.
   *
   * C'est une couronne de pics posée à 1 100 m du centre de l'étape, hors du
   * champ de la simulation. Elle ferme l'horizon et donne l'échelle : sans
   * elle, une étape de montagne se termine sur une ligne plate de ciel, ce
   * qui écrase tout le relief construit en avant-plan.
   */
  private buildDistantRange(seed: number): void {
    const scale = this.reliefScale();
    if (scale < 0.5) return; // inutile en plaine

    const rand = mulberry32(seed + 991);
    const R = 1150;
    // construite autour de l'origine : elle sera repositionnée sur le coureur
    // à chaque frame, sinon il finirait par traverser ses propres montagnes
    const centre = new THREE.Vector3(0, 0, 0);

    const positions: number[] = [];
    const colors: number[] = [];
    const rock = new THREE.Color(0x5c5a52);
    const far = new THREE.Color(0x7d8798);
    const snow = new THREE.Color(0xeef3f8);
    const c = new THREE.Color();

    const peaks = 46;
    for (let i = 0; i < peaks; i++) {
      const a0 = (i / peaks) * Math.PI * 2;
      const spread = (Math.PI * 2) / peaks;
      // chaque pic est un triangle large, légèrement en avant ou en arrière
      const r = R * (0.82 + rand() * 0.36);
      const h = (210 + rand() * 430) * scale;
      const half = spread * (0.75 + rand() * 0.7);
      const base = centre.y - 40;

      const pL = new THREE.Vector3(
        centre.x + Math.cos(a0 - half) * r,
        base,
        centre.z + Math.sin(a0 - half) * r
      );
      const pR = new THREE.Vector3(
        centre.x + Math.cos(a0 + half) * r,
        base,
        centre.z + Math.sin(a0 + half) * r
      );
      const pT = new THREE.Vector3(
        centre.x + Math.cos(a0) * r,
        base + h,
        centre.z + Math.sin(a0) * r
      );
      positions.push(pL.x, pL.y, pL.z, pR.x, pR.y, pR.z, pT.x, pT.y, pT.z);

      // pied gris-bleu (perspective atmosphérique), sommet enneigé
      c.copy(rock).lerp(far, 0.55 + rand() * 0.25);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      const snowy = h > 330 * scale;
      c.copy(far);
      if (snowy) c.lerp(snow, 0.75);
      colors.push(c.r, c.g, c.b);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    // la brume s'applique : les sommets lointains se fondent dans l'horizon
    // au lieu de se découper au couteau sur la photo du ciel
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      fog: true
    });
    const range = new THREE.Mesh(g, mat);
    range.renderOrder = -1;
    range.frustumCulled = false;
    this.distantRange = range;
    this.group.add(range);
    this.disposables.push(g, mat);
  }

  /** recentre les sommets lointains sur le coureur (décor de fond) */
  updateDistant(playerPos: THREE.Vector3, tangent?: THREE.Vector3): void {
    if (this.distantRange) this.distantRange.position.set(playerPos.x, 0, playerPos.z);
    if (this.merHorizon) {
      this.merHorizon.position.set(playerPos.x, 0, playerPos.z);
      // tourne avec le cap du moment : sur une route sinueuse, l'horizon de
      // mer doit rester du même côté relatif que la route qu'on longe
      if (tangent) this.merHorizon.rotation.y = Math.atan2(tangent.x, tangent.z);
    }
  }

  /* ------------------------------------------------------------ */
  /* décor : arbres, rochers                                      */
  /* ------------------------------------------------------------ */

  /**
   * Instancie un modèle de décor externe. Une seule InstancedMesh par type :
   * c'est ce qui permet d'afficher des milliers d'éléments en un draw call.
   */
  private placeInstances(
    piece: { geometry: THREE.BufferGeometry; material: THREE.Material },
    placements: { dist: number; lat: number; y: number; scale: number; rotY: number }[],
    castShadow = true
  ): void {
    // même règle que pour le décor : rien dans le vide ni sur l'eau
    placements = placements.filter((p) => this.constructible(p.dist, p.lat));
    if (!placements.length) return;
    const mesh = new THREE.InstancedMesh(piece.geometry, piece.material, placements.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    placements.forEach((p, i) => {
      this.pose(p.dist, p.lat, pos);
      q.setFromAxisAngle(up, p.rotY);
      sc.set(p.scale, p.scale, p.scale);
      m.compose(new THREE.Vector3(pos.x, pos.y + p.y, pos.z), q, sc);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow;
    this.group.add(mesh);
    // géométrie et matériau appartiennent à SceneryAssets : pas de dispose ici
  }

  /** écorce : fibres verticales sombres */
  private makeBarkTexture(): THREE.CanvasTexture {
    const W = 64;
    const H = 128;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8a6a4c';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * W;
      g.strokeStyle = `rgba(${60 + Math.random() * 70},${44 + Math.random() * 50},${30 + Math.random() * 36},0.5)`;
      g.lineWidth = 0.6 + Math.random() * 2.2;
      g.beginPath();
      let y = 0;
      let xx = x;
      g.moveTo(xx, y);
      while (y < H) {
        y += 8 + Math.random() * 14;
        xx += (Math.random() - 0.5) * 3.5;
        g.lineTo(xx, y);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** feuillage : amas irréguliers pour casser la surface lisse du cône */
  private makeFoliageTexture(mountain: boolean): THREE.CanvasTexture {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = mountain ? '#89b489' : '#93c48f';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 520; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 2 + Math.random() * 7;
      const l = Math.random();
      const v = l > 0.62 ? 215 + Math.random() * 40 : 90 + Math.random() * 80;
      g.fillStyle = `rgba(${v * 0.72},${v},${v * 0.62},${0.28 + Math.random() * 0.4})`;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.55 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildScenery(rand: () => number): void {
    const seed = this.stage.seed;
    const mountain = this.stage.type === 'montagne';
    const dd = this.q.densiteDecor ?? 1;
    const count = Math.floor((this.length / (mountain ? 30 : 20)) * dd);

    // modèles externes fournis ? ils remplacent le cône procédural — plusieurs
    // variantes tirées au hasard par arbre, sans quoi la forêt entière répète
    // le même modèle et ça se voit immédiatement sur un flanc de montagne
    const cle = mountain ? 'treePine' : 'treeBroadleaf';
    if (this.scenery?.get(cle)) {
      const parPiece = new Map<SceneryPiece, { dist: number; lat: number; y: number; scale: number; rotY: number }[]>();
      for (let i = 0; i < count; i++) {
        const dist = rand() * this.length;
        for (const side of [-1, 1]) {
          const lat = side * (ROAD_WIDTH / 2 + 4.5 + rand() * (mountain ? 70 : 40));
          const y = this.groundAt(dist, lat);
          if (y > 120) continue; // pas d'arbres sur les hauts sommets
          if (!this.constructible(dist, lat)) continue; // ni dans le vide, ni dans l'eau
          const piece = this.scenery!.getRandom(cle, rand)!;
          const liste = parPiece.get(piece) ?? [];
          liste.push({ dist, lat, y, scale: 0.72 + rand() * 0.6, rotY: rand() * 6.28 });
          parPiece.set(piece, liste);
        }
      }
      for (const [piece, spots] of parPiece) this.placeInstances(piece, spots);
      this.buildRocks(rand, mountain);
      return;
    }

    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.5, 5);
    const crownGeo = mountain
      ? new THREE.ConeGeometry(1.0, 3.4, 6)
      : new THREE.ConeGeometry(1.3, 2.7, 7);
    const bark = this.makeBarkTexture();
    const foliage = this.makeFoliageTexture(mountain);
    foliage.repeat.set(2, 1.4);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6d5238,
      map: bark,
      roughness: 1
    });
    const crownMat = new THREE.MeshStandardMaterial({
      color: mountain ? 0x3d7040 : 0x4a8c46,
      map: foliage,
      roughness: 1,
      flatShading: true
    });
    this.disposables.push(bark, foliage);
    const total = count * 2;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, total);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, total);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    let idx = 0;
    for (let i = 0; i < count; i++) {
      const dist = rand() * this.length;
      for (const side of [-1, 1]) {
        const lateral = side * (ROAD_WIDTH / 2 + 4.5 + rand() * (mountain ? 70 : 40));
        const rel = this.groundAt(dist, lateral);
        // pas d'arbres sur les hauts sommets, ni dans le vide, ni dans l'eau
        if (rel > 120 || !this.constructible(dist, lateral)) {
          idx++;
          continue;
        }
        this.pose(dist, lateral, pos);
        const s = 0.75 + rand() * 1.1;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
        sc.set(s, s * (0.85 + rand() * 0.4), s);
        m.compose(new THREE.Vector3(pos.x, pos.y + rel + 0.75 * sc.y, pos.z), q, sc);
        trunks.setMatrixAt(idx, m);
        m.compose(
          new THREE.Vector3(pos.x, pos.y + rel + (1.5 + (mountain ? 1.5 : 1.1)) * sc.y, pos.z),
          q,
          sc
        );
        crowns.setMatrixAt(idx, m);
        idx++;
      }
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    // le décor ne projette d'ombre qu'en qualité élevée : ces ombres sont
    // hors de la route et n'apportent presque rien à la lisibilité
    const ombreDecor = (this.q.densiteDecor ?? 1) >= 1 && this.q.shadows !== false;
    trunks.castShadow = ombreDecor;
    crowns.castShadow = ombreDecor;
    this.group.add(trunks, crowns);
    this.disposables.push(trunkGeo, crownGeo, trunkMat, crownMat);

    this.buildRocks(rand, mountain);
  }

  private buildRocks(rand: () => number, mountain: boolean): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();

    if (mountain || this.stage.type === 'vallonnee') {
      if (this.scenery?.get('rock')) {
        const n = Math.floor((this.length / 55) * (this.q.densiteDecor ?? 1));
        const parPiece = new Map<SceneryPiece, { dist: number; lat: number; y: number; scale: number; rotY: number }[]>();
        for (let i = 0; i < n; i++) {
          const dist = rand() * this.length;
          for (const side of [-1, 1]) {
            const lat = side * (ROAD_WIDTH / 2 + 6 + rand() * 120);
            const piece = this.scenery!.getRandom('rock', rand)!;
            const liste = parPiece.get(piece) ?? [];
            liste.push({ dist, lat, y: this.groundAt(dist, lat), scale: 0.45 + rand() * 1.9, rotY: rand() * 6.28 });
            parPiece.set(piece, liste);
          }
        }
        for (const [piece, spots] of parPiece) this.placeInstances(piece, spots);
        return;
      }
      const rockGeo = new THREE.DodecahedronGeometry(1, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x7a7466,
        roughness: 1,
        flatShading: true
      });
      const n = Math.floor((this.length / 55) * (this.q.densiteDecor ?? 1));
      const rocks = new THREE.InstancedMesh(rockGeo, rockMat, n * 2);
      let ri = 0;
      for (let i = 0; i < n; i++) {
        const dist = rand() * this.length;
        for (const side of [-1, 1]) {
          const lateral = side * (ROAD_WIDTH / 2 + 6 + rand() * 120);
          const rel = this.groundAt(dist, lateral);
          this.pose(dist, lateral, pos);
          const s = 0.6 + rand() * 2.4;
          q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 6, rand() * 3));
          sc.set(s, s * 0.8, s);
          m.compose(new THREE.Vector3(pos.x, pos.y + rel + s * 0.3, pos.z), q, sc);
          rocks.setMatrixAt(ri++, m);
        }
      }
      rocks.instanceMatrix.needsUpdate = true;
      this.group.add(rocks);
      this.disposables.push(rockGeo, rockMat);
    }
  }

  /* ------------------------------------------------------------ */
  /* spectateurs + barrières                                      */
  /* ------------------------------------------------------------ */

  /** zones de foule : arrivée, cols, sprints, plus quelques groupes épars */
  private crowdZones(): { from: number; to: number; density: number }[] {
    const z: { from: number; to: number; density: number }[] = [];
    const d = this.densiteFoule;
    z.push({ from: Math.max(0, this.length - 420), to: this.length, density: 1 * d });
    for (const c of this.climbs) {
      const span = 150 + (4 - c.category) * 40;
      z.push({
        from: Math.max(0, c.dist - span),
        to: Math.min(this.length, c.dist + 60),
        density: 0.85 * d
      });
    }
    for (const s of this.sprints) {
      z.push({
        from: Math.max(0, s.dist - 120),
        to: Math.min(this.length, s.dist + 40),
        density: 0.7 * d
      });
    }
    /*
     * Le public se masse dans les virages serrés : c'est là qu'on ralentit,
     * qu'on voit les coureurs de près et qu'on les entend souffler. Les
     * lacets noirs de monde sont l'image même d'une étape de montagne, et
     * sans eux un virage bien dessiné reste une portion de route vide.
     */
    const pas = 12;
    let debut = -1;
    for (let dist = 0; dist <= this.length; dist += pas) {
      const serre = Math.abs(this.courbureAt(dist)) > 0.011;
      if (serre && debut < 0) debut = dist;
      if ((!serre || dist + pas > this.length) && debut >= 0) {
        z.push({
          from: Math.max(0, debut - 35),
          to: Math.min(this.length, dist + 35),
          density: 0.8 * d
        });
        debut = -1;
      }
    }
    return z;
  }

  private buildCrowds(rand: () => number): void {
    const zones = this.crowdZones();
    const seed = this.stage.seed;
    void seed;

    // spectateurs : modèle externe s'il existe
    const specPiece = this.scenery?.get('spectator') ?? null;
    if (specPiece) {
      const spots: { dist: number; lat: number; y: number; scale: number; rotY: number }[] = [];
      const tanTmp = new THREE.Vector3();
      const posTmp = new THREE.Vector3();
      const add = (dist: number, side: number, base: number) => {
        const lat = side * (base + rand() * 3.2);
        this.pose(dist, lat, posTmp, tanTmp);
        spots.push({
          dist,
          lat,
          y: this.groundAt(dist, lat),
          scale: 0.9 + rand() * 0.22,
          // face à la route, avec un peu de désordre
          rotY: Math.atan2(tanTmp.x, tanTmp.z) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.7
        });
      };
      for (const z of zones) {
        const step = 1.9 / Math.max(0.15, z.density);
        for (let d = z.from; d < z.to; d += step) {
          for (const side of [-1, 1]) {
            if (rand() > z.density) continue;
            add(d + rand() * step, side, ROAD_WIDTH / 2 + 1.5);
            if (rand() < z.density * 0.55) add(d + rand() * step, side, ROAD_WIDTH / 2 + 3.1);
          }
        }
      }
      for (let d = 60; d < this.length - 60; d += 90) {
        if (rand() < 0.55) {
          const side = rand() > 0.5 ? 1 : -1;
          const k = 2 + Math.floor(rand() * 5);
          for (let i = 0; i < k; i++) add(d + rand() * 18, side, ROAD_WIDTH / 2 + 1.6);
        }
      }
      this.placeInstances(specPiece, spots);
      this.buildBarriers(zones);
      return;
    }

    const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.62, 3, 6);
    const headGeo = new THREE.SphereGeometry(0.115, 6, 5);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: false });
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: false });

    /*
     * Foule animée.
     *
     * Recalculer la matrice de trois mille spectateurs à chaque image coûterait
     * plus cher que tout le reste de la scène réunie. L'animation est donc
     * confiée au shader : chaque instance reçoit une phase tirée au sort, et le
     * sommet est déplacé directement sur la carte graphique. Le processeur n'a
     * qu'un nombre à mettre à jour, le temps.
     *
     * Le mouvement mêle un balancement latéral et un petit saut, décalés d'une
     * instance à l'autre. Une foule qui bougerait à l'unisson ferait
     * chorégraphie ; ce sont les décalages qui donnent l'impression d'une
     * assemblée de gens.
     */
    const uTemps = { value: 0 };
    const uCoureur = { value: -9999 };
    const animerFoule = (mat: THREE.MeshStandardMaterial, ampleur: number) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTemps = uTemps;
        shader.uniforms.uCoureur = uCoureur;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uTemps;
             uniform float uCoureur;
             attribute float phase;
             attribute float ferveur;
             attribute float jalon;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             /*
              * Ferveur locale : le public s'enflamme quand la course lui
              * arrive dessus, et retombe une fois qu'elle est passée. Un
              * public qui s'agiterait autant à trois kilomètres de là ne
              * regarderait rien du tout.
              */
             float ecart = jalon - uCoureur;
             float venue = 1.0 - smoothstep(0.0, 70.0, abs(ecart));
             /*
              * On crie encore un moment derrière le peloton, jamais loin
              * devant. Le facteur estDerriere est indispensable : sans lui
              * la traînée valait son maximum pour tout public situé en
              * AVAL, et la foule s'agitait déjà à un kilomètre de la course.
              */
             float estDerriere = step(ecart, 0.0);
             float trainee = estDerriere * (1.0 - smoothstep(0.0, 130.0, -ecart)) * 0.45;
             float chauffe = 0.3 + 1.5 * max(venue, trainee);
             float f = ferveur * chauffe;

             float t = uTemps * 2.2 + phase * 6.283;
             float saut = max(0.0, sin(t)) * ${ampleur.toFixed(3)} * f;
             float balance = sin(t * 0.5) * 0.09 * f;
             // les bras montent : le haut du corps s'étire quand ça hurle
             float leve = max(0.0, position.y) * 0.34 * max(0.0, f - 0.75);
             transformed.y += saut + leve;
             transformed.x += balance;`
          );
      };
      // sans cette clé, Three réutiliserait le programme d'un matériau
      // standard ordinaire et l'animation ne s'appliquerait jamais
      mat.customProgramCacheKey = () => `foule-${ampleur}`;
    };
    animerFoule(bodyMat, 0.11);
    animerFoule(headMat, 0.13);

    // estimation du nombre
    let est = 0;
    for (const z of zones) est += Math.floor(((z.to - z.from) / 1.9) * z.density) * 2;
    est += Math.floor(this.length / 90) * 2;
    est = Math.max(1, est);

    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, est);
    const heads = new THREE.InstancedMesh(headGeo, headMat, est);
    bodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(est * 3), 3);
    heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(est * 3), 3);

    // phase et ferveur propres à chaque spectateur, plus sa position sur le
    // parcours : c'est elle qui lui dit quand le peloton arrive sur lui
    const phases = new Float32Array(est);
    const ferveurs = new Float32Array(est);
    const jalons = new Float32Array(est);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const col = new THREE.Color();
    const skinCols = [0xf2d3bb, 0xe2b48f, 0xc98d63, 0xb07b4f, 0x8d5a34, 0x5f3720];
    let n = 0;

    const place = (dist: number, side: number, lateralBase: number) => {
      if (n >= est) return;
      const lateral = side * (lateralBase + rand() * 3.2);
      this.pose(dist, lateral, pos, tan);
      const rel = this.groundAt(dist, lateral);
      const s = 0.88 + rand() * 0.3;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(tan.x, tan.z) + (rand() - 0.5) * 0.6);
      sc.set(s, s, s);
      m.compose(new THREE.Vector3(pos.x, pos.y + rel + 0.48 * s, pos.z), q, sc);
      bodies.setMatrixAt(n, m);
      m.compose(new THREE.Vector3(pos.x, pos.y + rel + 1.0 * s, pos.z), q, sc);
      heads.setMatrixAt(n, m);
      col.setHSL(rand(), 0.55 + rand() * 0.35, 0.42 + rand() * 0.25);
      bodies.instanceColor!.setXYZ(n, col.r, col.g, col.b);
      col.setHex(skinCols[Math.floor(rand() * skinCols.length)]);
      heads.instanceColor!.setXYZ(n, col.r, col.g, col.b);
      phases[n] = rand();
      // un tiers des spectateurs reste calme : tout le monde ne saute pas
      ferveurs[n] = rand() < 0.34 ? 0.15 + rand() * 0.2 : 0.7 + rand() * 0.5;
      jalons[n] = dist;
      n++;
    };

    for (const z of zones) {
      const step = 1.9 / Math.max(0.15, z.density);
      for (let d = z.from; d < z.to; d += step) {
        for (const side of [-1, 1]) {
          if (rand() > z.density) continue;
          place(d + rand() * step, side, ROAD_WIDTH / 2 + 1.5);
          // deuxième rang par endroits
          if (rand() < z.density * 0.55) place(d + rand() * step, side, ROAD_WIDTH / 2 + 3.1);
        }
      }
    }
    // petits groupes épars tout au long du parcours
    for (let d = 60; d < this.length - 60; d += 90) {
      if (rand() < 0.55) {
        const side = rand() > 0.5 ? 1 : -1;
        const k = 2 + Math.floor(rand() * 5);
        for (let i = 0; i < k; i++) place(d + rand() * 18, side, ROAD_WIDTH / 2 + 1.6);
      }
    }

    const attPhase = new THREE.InstancedBufferAttribute(phases, 1);
    const attFerveur = new THREE.InstancedBufferAttribute(ferveurs, 1);
    const attJalon = new THREE.InstancedBufferAttribute(jalons, 1);
    bodyGeo.setAttribute('phase', attPhase);
    bodyGeo.setAttribute('ferveur', attFerveur);
    bodyGeo.setAttribute('jalon', attJalon);
    headGeo.setAttribute('phase', attPhase);
    headGeo.setAttribute('ferveur', attFerveur);
    headGeo.setAttribute('jalon', attJalon);
    this.horlogeFoule = uTemps;
    this.positionCoureurFoule = uCoureur;

    bodies.count = n;
    heads.count = n;
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    bodies.castShadow = (this.q.densiteDecor ?? 1) >= 1 && this.q.shadows !== false;
    this.group.add(bodies, heads);
    this.disposables.push(bodyGeo, headGeo, bodyMat, headMat);

    this.buildBarriers(zones);
  }

  private buildBarriers(zones: { from: number; to: number; density: number }[]): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();

    // modèle de barrière externe s'il existe
    const barPiece = this.scenery?.get('barrier') ?? null;
    if (barPiece) {
      const spots: { dist: number; lat: number; y: number; scale: number; rotY: number }[] = [];
      for (const z of zones.filter((x) => x.density >= 0.7 * this.densiteFoule)) {
        for (let d = z.from; d < z.to; d += 2.1) {
          for (const side of [-1, 1]) {
            const lat = side * (ROAD_WIDTH / 2 + 0.45);
            this.pose(d, lat, pos, tan);
            spots.push({
              dist: d,
              lat,
              y: this.groundAt(d, lat),
              scale: 1,
              rotY: Math.atan2(tan.x, tan.z)
            });
          }
        }
      }
      this.placeInstances(barPiece, spots);
      return;
    }

    const barGeo = new THREE.BoxGeometry(0.06, 1.0, 2.2);
    const barMat = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.55 });
    const legGeo = new THREE.BoxGeometry(0.05, 0.95, 0.05);
    const barrierZones = zones.filter((z) => z.density >= 0.7 * this.densiteFoule);
    let barCount = 0;
    for (const z of barrierZones) barCount += Math.ceil((z.to - z.from) / 2.35) * 2;
    barCount = Math.max(1, barCount);
    const bars = new THREE.InstancedMesh(barGeo, barMat, barCount);
    const legs = new THREE.InstancedMesh(legGeo, barMat, barCount * 2);
    let bi = 0;
    let li = 0;
    for (const z of barrierZones) {
      for (let d = z.from; d < z.to; d += 2.35) {
        for (const side of [-1, 1]) {
          if (bi >= barCount) break;
          const lateral = side * (ROAD_WIDTH / 2 + 0.45);
          this.pose(d, lateral, pos, tan);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(tan.x, tan.z));
          sc.set(1, 1, 1);
          m.compose(new THREE.Vector3(pos.x, pos.y + 0.52, pos.z), q, sc);
          bars.setMatrixAt(bi++, m);
          for (const off of [-0.9, 0.9]) {
            if (li >= barCount * 2) break;
            this.pose(d + off, lateral, pos);
            m.compose(new THREE.Vector3(pos.x, pos.y + 0.48, pos.z), q, sc);
            legs.setMatrixAt(li++, m);
          }
        }
      }
    }
    bars.count = bi;
    legs.count = li;
    bars.instanceMatrix.needsUpdate = true;
    legs.instanceMatrix.needsUpdate = true;
    this.group.add(bars, legs);
    this.disposables.push(barGeo, legGeo, barMat);
  }

  /* ------------------------------------------------------------ */
  /* banderoles : cols, sprints, ravitaillement, flamme rouge      */
  /* ------------------------------------------------------------ */

  private makeArch(color: number): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 5, 8);
    const pl = new THREE.Mesh(poleGeo, mat);
    pl.position.set(-ROAD_WIDTH / 2 - 0.5, 2.5, 0);
    const pr = new THREE.Mesh(poleGeo, mat);
    pr.position.set(ROAD_WIDTH / 2 + 0.5, 2.5, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH + 1.5, 0.6, 0.15), mat);
    beam.position.set(0, 4.8, 0);
    g.add(pl, pr, beam);
    this.disposables.push(mat, poleGeo);
    return g;
  }

  private makeBanner(text: string, bg: string, fg: string, sub?: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = sub ? 140 : 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 52px Impact, "Barlow Condensed", sans-serif';
    ctx.fillText(text, canvas.width / 2, sub ? 48 : 52);
    if (sub) {
      ctx.font = '32px "Archivo", sans-serif';
      ctx.fillText(sub, canvas.width / 2, 104);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH + 1.4, sub ? 1.7 : 1.3),
      mat
    );
    this.disposables.push(tex, mat);
    return mesh;
  }

  private placeArch(dist: number, color: number, banner: THREE.Mesh): void {
    const arch = this.makeArch(color);
    banner.position.set(0, 4.1, 0);
    banner.rotation.y = Math.PI;
    arch.add(banner);
    const pos = new THREE.Vector3();
    this.pose(dist, 0, pos);
    arch.position.copy(pos);
    this.orientAt(arch, dist);
    this.group.add(arch);
  }

  private buildBanners(): void {
    const CAT: Record<number, string> = { 0: 'HORS CATÉGORIE', 1: '1re CATÉGORIE', 2: '2e CATÉGORIE', 3: '3e CATÉGORIE', 4: '4e CATÉGORIE' };

    for (const c of this.climbs) {
      this.placeArch(
        c.dist,
        0xd6382c,
        this.makeBanner(c.name.toUpperCase(), '#b8271c', '#ffffff', CAT[c.category])
      );
    }
    for (const s of this.sprints) {
      this.placeArch(
        s.dist,
        0x1f8a5c,
        this.makeBanner('SPRINT', '#177a4f', '#eafff0', s.name)
      );
    }
    if (this.length > 2200) {
      this.feedZoneDist = this.length * 0.52;
      this.placeArch(
        this.feedZoneDist,
        0x2f9e5b,
        this.makeBanner('RAVITAILLEMENT', '#1e6e3d', '#eafff0')
      );
    }
    if (this.length > 1100) {
      this.placeArch(
        this.length - 900,
        0xd6382c,
        this.makeBanner('DERNIER KILOMÈTRE', '#b8271c', '#ffffff')
      );
    }
  }

  private orientAt(obj: THREE.Object3D, dist: number): void {
    const t = THREE.MathUtils.clamp(dist / this.length, 0, 1);
    this.curve.getTangentAt(t, this.tmpT);
    obj.rotation.y = Math.atan2(this.tmpT.x, this.tmpT.z);
  }

  private buildFinish(): void {
    const d = this.length - 4;
    this.placeArch(d, 0x1d1f24, this.makeBanner('ARRIVÉE', '#1d1f24', '#ffd633'));

    const pos = new THREE.Vector3();
    // ligne d'arrivée en damier
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#15161a';
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 0.9), mat);
    this.pose(d, 0, pos);
    line.position.set(pos.x, pos.y + 0.03, pos.z);
    line.rotation.x = -Math.PI / 2;
    this.curve.getTangentAt(THREE.MathUtils.clamp(d / this.length, 0, 1), this.tmpT);
    line.rotation.z = Math.atan2(-this.tmpT.x, -this.tmpT.z);
    this.group.add(line);
    this.disposables.push(tex, mat);
  }

  dispose(): void {
    this.decor?.dispose();
    this.objets?.dispose();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry?.dispose();
    });
    this.disposables.forEach((d) => d.dispose());
  }
}

export { ROAD_WIDTH };
