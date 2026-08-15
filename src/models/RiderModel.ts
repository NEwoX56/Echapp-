import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RiderAppearance, JerseyPattern } from '../data/appearance';

export interface RiderVisual {
  group: THREE.Object3D;
  /** dt, vitesse (u/s), danseuse 0..1, effort 0..1 */
  /** dt, vitesse, danseuse 0..1, effort 0..1, célébration 0..1 */
  update: (dt: number, speed: number, standing: number, effort: number, celebration?: number) => void;
  /** articulations exposées, pour les contrôles automatisés */
  articulations?: {
    epaules: THREE.Group[];
    coudes: THREE.Group[];
    /** point de saisie sur le cintre, repère du vélo */
    cintre: { y: number; z: number }[];
  };
  dispose: () => void;
}

const R_WHEEL = 0.335;
const CRANK = 0.1725;
const THIGH_L = 0.44;
const SHIN_L = 0.46;
const BB = new THREE.Vector2(-0.06, 0.272);
const HIP0 = new THREE.Vector2(-0.3, 0.955);

/* ------------------------------------------------------------------ */
/* outils de fusion : un mesh multi-matériaux au lieu de N meshes      */
/* ------------------------------------------------------------------ */

interface Part {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  matrix?: THREE.Matrix4;
}

function makePart(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos?: [number, number, number],
  rot?: [number, number, number],
  scale?: [number, number, number]
): Part {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  if (rot) q.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  m.compose(
    new THREE.Vector3(...(pos ?? [0, 0, 0])),
    q,
    new THREE.Vector3(...(scale ?? [1, 1, 1]))
  );
  return { geo, mat, matrix: m };
}

/** fusionne des parts en un seul mesh (groupes de matériaux) */
function mergeParts(parts: Part[], owned: THREE.BufferGeometry[]): THREE.Mesh | null {
  if (!parts.length) return null;
  const mats: THREE.Material[] = [];
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const p of parts) {
    const g = p.geo.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    // uniformise les attributs pour que la fusion soit possible
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    }
    if (!g.attributes.uv) {
      const n = g.attributes.position.count;
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    const list = byMat.get(p.mat);
    if (list) list.push(g);
    else {
      byMat.set(p.mat, [g]);
      mats.push(p.mat);
    }
  }
  const groups: THREE.BufferGeometry[] = [];
  for (const mat of mats) {
    const list = byMat.get(mat)!;
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!merged) return null;
    if (list.length > 1) list.forEach((g) => g.dispose());
    groups.push(merged);
  }
  const final = mergeGeometries(groups, true);
  groups.forEach((g) => g.dispose());
  if (!final) return null;
  owned.push(final);
  return new THREE.Mesh(final, mats);
}

/* ------------------------------------------------------------------ */
/* texture de maillot procédurale                                      */
/* ------------------------------------------------------------------ */

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function makeJerseyTexture(a: RiderAppearance): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const p = hex(a.jerseyPrimary);
  const s = hex(a.jerseySecondary);

  g.fillStyle = p;
  g.fillRect(0, 0, W, H);

  const pat: JerseyPattern = a.pattern;
  if (pat === 'bande-horizontale') {
    g.fillStyle = s;
    g.fillRect(0, H * 0.44, W, H * 0.16);
  } else if (pat === 'bande-verticale') {
    g.fillStyle = s;
    for (const u of [0.25, 0.75]) g.fillRect(u * W - W * 0.045, 0, W * 0.09, H);
  } else if (pat === 'epaules') {
    g.fillStyle = s;
    g.fillRect(0, 0, W, H * 0.3);
    g.fillStyle = p;
    g.fillRect(0, H * 0.26, W, H * 0.04);
  } else if (pat === 'chevrons') {
    g.strokeStyle = s;
    g.lineWidth = H * 0.075;
    for (let i = -2; i < 10; i++) {
      const y0 = (i / 8) * H;
      g.beginPath();
      g.moveTo(0, y0);
      g.lineTo(W / 4, y0 + H * 0.16);
      g.lineTo(W / 2, y0);
      g.lineTo((W * 3) / 4, y0 + H * 0.16);
      g.lineTo(W, y0);
      g.stroke();
    }
  } else if (pat === 'damier') {
    const n = 12;
    const cw = W / n;
    const ch = H / 6;
    g.fillStyle = s;
    for (let x = 0; x < n; x++)
      for (let y = 0; y < 6; y++) if ((x + y) % 2 === 0) g.fillRect(x * cw, y * ch, cw, ch);
  } else if (pat === 'diagonale') {
    g.strokeStyle = s;
    g.lineWidth = H * 0.14;
    for (let i = -1; i < 8; i++) {
      g.beginPath();
      g.moveTo((i / 6) * W, H);
      g.lineTo(((i + 1.4) / 6) * W, 0);
      g.stroke();
    }
  } else if (pat === 'pois') {
    g.fillStyle = s;
    const cols = 9;
    const rows = 5;
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++) {
        const ox = (x + (y % 2 ? 0.5 : 0)) * (W / cols);
        const oy = (y + 0.5) * (H / rows);
        g.beginPath();
        g.arc(ox, oy, W * 0.026, 0, Math.PI * 2);
        g.fill();
      }
  }

  // dossard épinglé dans le bas du dos (u ≈ 0.75), comme sur une vraie course
  if (a.dossard) {
    const cx = 0.75 * W;
    const cy = H * 0.86;
    const pw = W * 0.115;
    const ph = H * 0.2;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.05);
    g.fillStyle = '#f6f5f0';
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5;
    g.strokeRect(-pw / 2, -ph / 2, pw, ph);
    g.fillStyle = '#15161a';
    g.font = `bold ${Math.round(ph * 0.62)}px Impact, "Barlow Condensed", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(a.dossard), 0, ph * 0.02);
    // épingles
    g.fillStyle = 'rgba(90,90,95,0.8)';
    for (const [px, py] of [
      [-pw / 2 + 4, -ph / 2 + 4],
      [pw / 2 - 4, -ph / 2 + 4],
      [-pw / 2 + 4, ph / 2 - 4],
      [pw / 2 - 4, ph / 2 - 4]
    ]) {
      g.beginPath();
      g.arc(px, py, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  const name = (a.sponsor || '').slice(0, 12).toUpperCase();
  if (name) {
    g.font = `bold ${Math.round(H * 0.15)}px Impact, "Barlow Condensed", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const measure = g.measureText(name).width;
    for (const u of [0.25, 0.75]) {
      const cx = u * W;
      const cy = H * 0.52;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(cx - measure / 2 - W * 0.02, cy - H * 0.11, measure + W * 0.04, H * 0.22);
      g.fillStyle = '#15161a';
      g.fillText(name, cx, cy);
    }
  }

  const shade = g.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.22)');
  shade.addColorStop(0.25, 'rgba(255,255,255,0.05)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0.22)');
  shade.addColorStop(0.75, 'rgba(255,255,255,0.04)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */

function tubePart(
  mat: THREE.Material,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  geoCache: THREE.CylinderGeometry
): Part {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  m.compose(
    a.clone().addScaledVector(dir, 0.5),
    q,
    new THREE.Vector3(radius / 0.021, len, radius / 0.021)
  );
  return { geo: geoCache, mat, matrix: m };
}

export interface RiderOptions {
  /** distance de bascule vers la silhouette simplifiée */
  distanceLod?: number;
  /** le coureur projette-t-il une ombre */
  ombre?: boolean;
}

export function buildRider(a: RiderAppearance, options: RiderOptions = {}): RiderVisual {
  const distanceLod = options.distanceLod ?? 34;
  const ombre = options.ombre ?? true;
  const owned: THREE.BufferGeometry[] = [];
  const disposables: (THREE.Material | THREE.Texture)[] = [];

  const M = {
    frame: new THREE.MeshStandardMaterial({ color: a.bikeFrame, roughness: 0.32, metalness: 0.55 }),
    accent: new THREE.MeshStandardMaterial({ color: a.bikeAccent, roughness: 0.3, metalness: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.35, metalness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.28, metalness: 0.85 }),
    skin: new THREE.MeshStandardMaterial({ color: a.skin, roughness: 0.72 }),
    shorts: new THREE.MeshStandardMaterial({ color: a.shorts, roughness: 0.66 }),
    helmet: new THREE.MeshStandardMaterial({ color: a.helmet, roughness: 0.3, metalness: 0.15 }),
    shoe: new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8d939c, roughness: 0.22, metalness: 0.92 }),
    tape: new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.82 }),
    glasses: new THREE.MeshStandardMaterial({
      color: 0x15181e,
      roughness: 0.08,
      metalness: 0.65,
      envMapIntensity: 1.4
    })
  };
  const jerseyTex = makeJerseyTexture(a);
  const jersey = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.62,
    side: THREE.DoubleSide,
    name: 'Jersey'
  });
  const jerseyPlain = new THREE.MeshStandardMaterial({ color: a.jerseyPrimary, roughness: 0.62 });
  Object.values(M).forEach((m) => disposables.push(m));
  disposables.push(jersey, jerseyPlain, jerseyTex);

  /* --- géométries de base (locales, fusionnées ensuite) --- */
  const gTube = new THREE.CylinderGeometry(0.021, 0.021, 1, 7);
  const gTyre = new THREE.TorusGeometry(R_WHEEL, 0.026, 6, 22);
  const gRimClassic = new THREE.TorusGeometry(R_WHEEL - 0.035, 0.016, 5, 20);
  const gRimDeep = new THREE.CylinderGeometry(R_WHEEL - 0.02, R_WHEEL - 0.02, 0.032, 20, 1, true);
  const gDisc = new THREE.CylinderGeometry(R_WHEEL - 0.03, R_WHEEL - 0.03, 0.022, 20);
  const gSpoke = new THREE.CylinderGeometry(0.0055, 0.0055, (R_WHEEL - 0.05) * 2, 3);
  const gHub = new THREE.CylinderGeometry(0.028, 0.028, 0.1, 6);
  const gSaddle = new THREE.BoxGeometry(0.1, 0.035, 0.27);
  const gBarTop = new THREE.CylinderGeometry(0.014, 0.014, 0.4, 6);
  const gBarDrop = new THREE.TorusGeometry(0.075, 0.014, 5, 9, Math.PI * 1.15);
  const gHood = new THREE.CylinderGeometry(0.018, 0.018, 0.09, 6);
  const gBottle = new THREE.CylinderGeometry(0.031, 0.031, 0.16, 8);
  const gRing = new THREE.CylinderGeometry(0.098, 0.098, 0.008, 16);
  const gCrankArm = new THREE.BoxGeometry(0.022, 0.175, 0.03);
  const gPedal = new THREE.BoxGeometry(0.075, 0.014, 0.07);

  /**
   * Buste.
   *
   * Il était jusqu'ici une surface de révolution : sa section était un cercle
   * parfait, si bien que le coureur avait l'épaisseur d'un tube. Un thorax
   * humain est nettement plus large que profond — trente-six centimètres
   * contre vingt-deux — et il se creuse à la taille avant de s'élargir aux
   * épaules.
   *
   * On empile donc des anneaux elliptiques dont la demi-largeur et la
   * demi-profondeur évoluent séparément. Le dos est en outre plus bombé que
   * la poitrine, ce qui se voit beaucoup en position de course : on décale
   * légèrement le centre de chaque anneau vers l'avant.
   *
   * Les coordonnées de texture reprennent celles d'un tour de révolution — u
   * autour du corps, v le long de la colonne — pour que le maillot existant
   * s'y applique sans retouche.
   */
  function bufferBuste(): THREE.BufferGeometry {
    // [hauteur, demi-largeur, demi-profondeur, décalage avant du centre]
    const profil: [number, number, number, number][] = [
      [0.0, 0.02, 0.024, 0],
      [0.03, 0.118, 0.128, 0.004],
      [0.11, 0.129, 0.134, 0.006],
      [0.2, 0.131, 0.121, 0.004],
      [0.29, 0.147, 0.127, -0.002],
      [0.38, 0.166, 0.136, -0.008],
      [0.45, 0.173, 0.132, -0.012],
      [0.5, 0.149, 0.111, -0.01],
      [0.515, 0.03, 0.03, -0.006]
    ];
    const RADIAL = 18;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];

    for (let i = 0; i < profil.length; i++) {
      const [y, rx, rz, dz] = profil[i];
      for (let j = 0; j <= RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        pos.push(Math.sin(a) * rx, y, Math.cos(a) * rz + dz);
        uv.push(j / RADIAL, y / 0.515);
      }
    }
    for (let i = 0; i < profil.length - 1; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = a + RADIAL + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const gTorso = bufferBuste();
  const gShoulder = new THREE.SphereGeometry(0.088, 10, 8);
  const gHips = new THREE.SphereGeometry(0.145, 12, 9);
  const gNeck = new THREE.CylinderGeometry(0.052, 0.062, 0.1, 8);
  // crâne allongé vers l'arrière, mâchoire marquée
  /*
   * Tête. Une tête humaine mesure environ vingt-deux centimètres de haut, un
   * buste cinquante : le rapport doit se voir. Le casque précédent était aussi
   * large que la cage thoracique et écrasait la silhouette ; il ne dépasse
   * plus le crâne que de l'épaisseur d'une coque.
   */
  const gHead = new THREE.SphereGeometry(0.082, 14, 11);
  const gJaw = new THREE.SphereGeometry(0.054, 10, 8);
  const gHelmet = new THREE.SphereGeometry(0.093, 16, 11, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const gHelmetTail = new THREE.SphereGeometry(0.066, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const gVent = new THREE.BoxGeometry(0.02, 0.042, 0.075);
  const gGlasses = new THREE.SphereGeometry(0.085, 14, 8, 0, Math.PI, Math.PI * 0.4, Math.PI * 0.24);
  const gStrap = new THREE.TorusGeometry(0.062, 0.005, 4, 12, Math.PI);
  // membres : le renflement musculaire vient du scale, la capsule reste bon marché
  const gUpperArm = new THREE.CapsuleGeometry(0.042, 0.19, 3, 7);
  const gForeArm = new THREE.CapsuleGeometry(0.034, 0.2, 3, 7);
  const gHand = new THREE.SphereGeometry(0.042, 7, 6);
  const gThigh = new THREE.CapsuleGeometry(0.072, 0.27, 4, 9);
  const gCalf = new THREE.CapsuleGeometry(0.052, 0.14, 3, 8);
  const gShin = new THREE.CapsuleGeometry(0.036, 0.3, 3, 7);
  const gShoe = new THREE.BoxGeometry(0.08, 0.055, 0.2);
  const gSock = new THREE.CylinderGeometry(0.043, 0.049, 0.11, 8);
  // détails : transmission, freins, guidoline
  const gCassette = new THREE.CylinderGeometry(0.055, 0.032, 0.036, 12);
  const gChainLink = new THREE.BoxGeometry(0.008, 0.012, 0.03);
  const gDerailleurBody = new THREE.BoxGeometry(0.026, 0.07, 0.045);
  const gPulley = new THREE.CylinderGeometry(0.024, 0.024, 0.01, 8);
  const gDerailleurCage = new THREE.BoxGeometry(0.008, 0.075, 0.014);
  const gFrontDer = new THREE.BoxGeometry(0.014, 0.05, 0.035);
  const gBrakeDisc = new THREE.CylinderGeometry(0.082, 0.082, 0.005, 16);
  const gCaliper = new THREE.BoxGeometry(0.022, 0.052, 0.026);
  const gTape = new THREE.TorusGeometry(0.0755, 0.0175, 5, 9, Math.PI * 1.15);
  const gTapeTop = new THREE.CylinderGeometry(0.0165, 0.0165, 0.115, 6);
  const gCable = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 4);
  const gSeatpost = new THREE.CylinderGeometry(0.016, 0.016, 0.13, 8);
  const gCage = new THREE.TorusGeometry(0.034, 0.004, 4, 10, Math.PI * 1.5);
  const gLogo = new THREE.PlaneGeometry(0.19, 0.028);
  const localGeos = [
    gTube, gTyre, gRimClassic, gRimDeep, gDisc, gSpoke, gHub, gSaddle, gBarTop, gBarDrop,
    gHood, gBottle, gRing, gCrankArm, gPedal, gTorso, gShoulder, gHips, gHead, gHelmet,
    gNeck, gJaw, gHelmetTail, gVent, gGlasses, gStrap, gCalf, gSock,
    gUpperArm, gForeArm, gHand, gThigh, gShin, gShoe,
    gCassette, gChainLink, gDerailleurBody, gPulley, gDerailleurCage, gFrontDer,
    gBrakeDisc, gCaliper, gTape, gTapeTop, gCable, gSeatpost, gCage, gLogo
  ];

  const pFrontHub = new THREE.Vector3(0, R_WHEEL, 0.53);
  const pRearHub = new THREE.Vector3(0, R_WHEEL, -0.47);
  const pBB = new THREE.Vector3(0, BB.y, BB.x);
  const pSeatTop = new THREE.Vector3(0, 0.905, -0.315);
  const pHeadTop = new THREE.Vector3(0, 0.86, 0.395);
  const pHeadBot = new THREE.Vector3(0, 0.66, 0.44);

  /* --- niveau de détail élevé --- */
  const hi = new THREE.Group();

  // cadre complet fusionné (1 mesh)
  const frameParts: Part[] = [
    tubePart(M.frame, pBB, pSeatTop, 0.019, gTube),
    tubePart(M.accent, pBB, pHeadBot, 0.026, gTube),
    tubePart(M.frame, pSeatTop, pHeadTop, 0.021, gTube),
    tubePart(M.frame, pHeadBot, pHeadTop, 0.024, gTube),
    makePart(gSaddle, M.dark, [0, pSeatTop.y + 0.03, pSeatTop.z - 0.03], [-0.04, 0, 0]),
    makePart(gBarTop, M.frame, [0, pHeadTop.y + 0.035, pHeadTop.z + 0.03], [0, 0, Math.PI / 2]),
    makePart(gBottle, M.accent, [0, 0.5, 0.03], [0.45, 0, 0])
  ];
  for (const dx of [-0.055, 0.055]) {
    frameParts.push(
      tubePart(M.frame, pBB, new THREE.Vector3(dx, pRearHub.y, pRearHub.z), 0.014, gTube),
      tubePart(
        M.frame,
        new THREE.Vector3(0, pSeatTop.y - 0.06, pSeatTop.z + 0.015),
        new THREE.Vector3(dx, pRearHub.y, pRearHub.z),
        0.012,
        gTube
      ),
      tubePart(
        M.frame,
        new THREE.Vector3(0, pHeadBot.y, pHeadBot.z),
        new THREE.Vector3(dx * 0.85, pFrontHub.y, pFrontHub.z),
        0.014,
        gTube
      )
    );
  }
  const barY = pHeadTop.y + 0.035;
  const barZ = pHeadTop.z + 0.03;
  for (const dx of [-0.195, 0.195]) {
    frameParts.push(
      makePart(gBarDrop, M.frame, [dx, barY - 0.055, barZ + 0.045], [0, Math.PI / 2, -1.15]),
      // guidoline enroulée sur les creux et le haut du cintre
      makePart(gTape, M.tape, [dx, barY - 0.055, barZ + 0.045], [0, Math.PI / 2, -1.15]),
      makePart(gTapeTop, M.tape, [dx * 0.55, barY, barZ], [0, 0, Math.PI / 2]),
      makePart(gHood, M.dark, [dx, barY + 0.01, barZ + 0.075], [1.25, 0, 0])
    );
  }

  /* --- transmission, freins et accessoires --- */
  const dRear = new THREE.Vector3(0.075, pRearHub.y, pRearHub.z);
  frameParts.push(
    // cassette côté droit
    makePart(gCassette, M.steel, [0.075, pRearHub.y, pRearHub.z], [0, 0, Math.PI / 2]),
    // dérailleur arrière sous la cassette
    makePart(gDerailleurBody, M.dark, [0.085, pRearHub.y - 0.075, pRearHub.z + 0.015]),
    makePart(gDerailleurCage, M.steel, [0.085, pRearHub.y - 0.145, pRearHub.z + 0.03]),
    makePart(gPulley, M.steel, [0.085, pRearHub.y - 0.115, pRearHub.z + 0.045], [0, 0, Math.PI / 2]),
    makePart(gPulley, M.steel, [0.085, pRearHub.y - 0.178, pRearHub.z + 0.015], [0, 0, Math.PI / 2]),
    // dérailleur avant sur le tube de selle
    makePart(gFrontDer, M.steel, [0.075, 0.45, -0.2]),
    // disques de frein et étriers
    makePart(gBrakeDisc, M.steel, [-0.06, pFrontHub.y, pFrontHub.z], [0, 0, Math.PI / 2]),
    makePart(gBrakeDisc, M.steel, [-0.06, pRearHub.y, pRearHub.z], [0, 0, Math.PI / 2]),
    makePart(gCaliper, M.dark, [-0.06, pFrontHub.y + 0.085, pFrontHub.z - 0.02]),
    makePart(gCaliper, M.dark, [-0.06, pRearHub.y + 0.06, pRearHub.z + 0.06]),
    // tige de selle apparente
    makePart(gSeatpost, M.dark, [0, pSeatTop.y - 0.02, pSeatTop.z + 0.006]),
    // porte-bidon
    makePart(gCage, M.steel, [0, 0.5, 0.03], [0.45, 0, 0]),
    // décoration : bandeau de couleur sur le tube diagonal
    makePart(gLogo, M.accent, [0.023, 0.47, 0.19], [0, 1.32, -0.62]),
    makePart(gLogo, M.accent, [-0.023, 0.47, 0.19], [0, -1.32, 0.62])
  );
  void dRear;

  // chaîne : brin supérieur tendu du plateau à la cassette, brin inférieur détendu
  {
    const from = new THREE.Vector3(0.075, pBB.y + 0.096, pBB.z);
    const to = new THREE.Vector3(0.075, pRearHub.y + 0.05, pRearHub.z);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      frameParts.push(
        makePart(gChainLink, M.steel, [
          0.075,
          from.y + (to.y - from.y) * t,
          from.z + (to.z - from.z) * t
        ])
      );
    }
    const bFrom = new THREE.Vector3(0.075, pBB.y - 0.096, pBB.z);
    const bTo = new THREE.Vector3(0.075, pRearHub.y - 0.115, pRearHub.z + 0.02);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      frameParts.push(
        makePart(gChainLink, M.steel, [
          0.075,
          bFrom.y + (bTo.y - bFrom.y) * t - Math.sin(t * Math.PI) * 0.012,
          bFrom.z + (bTo.z - bFrom.z) * t
        ])
      );
    }
  }

  // gaines de frein/dérailleur le long du cadre
  {
    const a = new THREE.Vector3(0.02, barY - 0.02, barZ + 0.02);
    const b = new THREE.Vector3(0.02, pHeadBot.y + 0.04, pHeadBot.z - 0.02);
    frameParts.push(tubePart(M.dark, a, b, 0.0035, gCable));
    frameParts.push(
      tubePart(
        M.dark,
        new THREE.Vector3(0.03, pBB.y + 0.02, pBB.z + 0.02),
        new THREE.Vector3(0.075, pRearHub.y - 0.05, pRearHub.z + 0.04),
        0.0035,
        gCable
      )
    );
  }
  const frameMesh = mergeParts(frameParts, owned)!;
  hi.add(frameMesh);

  // roues fusionnées (1 mesh chacune)
  function wheelParts(): Part[] {
    const parts: Part[] = [makePart(gTyre, M.rubber)];
    if (a.wheels === 'pleine') {
      parts.push(makePart(gDisc, M.rim, undefined, [Math.PI / 2, 0, 0]));
    } else if (a.wheels === 'profil') {
      parts.push(makePart(gRimDeep, M.rim, undefined, [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 6; i++) parts.push(makePart(gSpoke, M.metal, undefined, [0, 0, (i / 6) * Math.PI]));
    } else {
      parts.push(makePart(gRimClassic, M.rim));
      for (let i = 0; i < 9; i++) parts.push(makePart(gSpoke, M.metal, undefined, [0, 0, (i / 9) * Math.PI]));
    }
    parts.push(makePart(gHub, M.metal, undefined, [0, 0, Math.PI / 2]));
    return parts;
  }
  const frontWheel = mergeParts(wheelParts(), owned)!;
  frontWheel.position.copy(pFrontHub);
  frontWheel.rotation.y = Math.PI / 2;
  const rearWheel = mergeParts(wheelParts(), owned)!;
  rearWheel.position.copy(pRearHub);
  rearWheel.rotation.y = Math.PI / 2;
  const frontSpin = new THREE.Group();
  const rearSpin = new THREE.Group();
  frontSpin.position.copy(pFrontHub);
  rearSpin.position.copy(pRearHub);
  frontWheel.position.set(0, 0, 0);
  rearWheel.position.set(0, 0, 0);
  frontWheel.rotation.set(0, Math.PI / 2, 0);
  rearWheel.rotation.set(0, Math.PI / 2, 0);
  frontSpin.add(frontWheel);
  rearSpin.add(rearWheel);
  hi.add(frontSpin, rearSpin);

  // pédalier : corps fusionné + 2 pédales articulées
  const crank = new THREE.Group();
  crank.position.copy(pBB);
  const crankBody = mergeParts(
    [
      makePart(gRing, M.metal, [0.055, 0, 0], [0, 0, Math.PI / 2]),
      makePart(gCrankArm, M.metal, [-0.065, -CRANK / 2, 0]),
      makePart(gCrankArm, M.metal, [0.065, CRANK / 2, 0])
    ],
    owned
  )!;
  crank.add(crankBody);
  const pedalPivots: THREE.Group[] = [];
  for (const [i, dx] of [
    [0, -0.065],
    [1, 0.065]
  ] as [number, number][]) {
    const pivot = new THREE.Group();
    const ang = i === 0 ? 0 : Math.PI;
    pivot.position.set(dx, -Math.cos(ang) * CRANK, Math.sin(ang) * CRANK);
    const pedal = new THREE.Mesh(gPedal, M.dark);
    pivot.add(pedal);
    crank.add(pivot);
    pedalPivots.push(pivot);
  }
  hi.add(crank);

  /* --- cycliste --- */
  const hipPivot = new THREE.Group();
  hipPivot.position.set(0, HIP0.y, HIP0.x);
  hi.add(hipPivot);
  const hips = new THREE.Mesh(gHips, M.shorts);
  hips.scale.set(1, 0.78, 0.95);
  hipPivot.add(hips);

  const torsoPivot = new THREE.Group();
  hipPivot.add(torsoPivot);
  // torse : légèrement aplati de profil, comme un dos de coureur en position
  const torsoMesh = mergeParts(
    [
      makePart(gTorso, jersey, [0, 0, 0], undefined, [1, 1, 0.86]),
      // trapèzes / haut du dos
      makePart(gShoulder, jerseyPlain, [0, 0.5, 0.02], undefined, [1.45, 0.85, 1.15]),
      // deltoïdes
      makePart(gShoulder, jerseyPlain, [-0.128, 0.44, 0.005], undefined, [1, 1.05, 1]),
      makePart(gShoulder, jerseyPlain, [0.128, 0.44, 0.005], undefined, [1, 1.05, 1])
    ],
    owned
  )!;
  torsoMesh.position.set(0, 0.02, 0.02);
  torsoPivot.add(torsoMesh);

  const neck = new THREE.Group();
  neck.position.set(0, 0.5, 0.08);
  torsoPivot.add(neck);
  const headMesh = mergeParts(
    [
      // cou incliné : il sort du torse vers l'avant
      makePart(gNeck, M.skin, [0, -0.035, 0.005], [0.5, 0, 0]),
      // crâne allongé vers l'arrière
      makePart(gHead, M.skin, [0, 0.05, 0.042], undefined, [0.9, 1, 1.18]),
      // mâchoire et menton, en retrait sous le crâne
      makePart(gJaw, M.skin, [0, 0.015, 0.076], undefined, [0.86, 0.76, 0.92]),
      // casque : calotte serrée + pointe aéro à l'arrière
      makePart(gHelmet, M.helmet, [0, 0.056, 0.036], [-0.3, 0, 0], [1.02, 0.96, 1.1]),
      makePart(gHelmetTail, M.helmet, [0, 0.066, -0.024], [-1.15, 0, 0], [0.84, 1.55, 0.72]),
      // aérations creusées dans la calotte
      makePart(gVent, M.dark, [0, 0.114, 0.046]),
      makePart(gVent, M.dark, [-0.043, 0.105, 0.034], [0, 0, 0.2]),
      makePart(gVent, M.dark, [0.043, 0.105, 0.034], [0, 0, -0.2]),
      // sangles sous les oreilles
      makePart(gStrap, M.dark, [0, 0.038, 0.036], [0, 0, 0], [1, 1, 0.55]),
      // lunettes enveloppantes
      makePart(gGlasses, M.glasses, [0, 0.046, 0.044], [0.12, 0, 0], [1.05, 1, 1.1])
    ],
    owned
  )!;
  neck.add(headMesh);

  /*
   * Longueurs de bras, mesurées sur la géométrie assemblée. L'IK en a besoin :
   * sans elles, on ne peut pas savoir où placer le coude pour que la main
   * tombe pile sur la cocotte.
   */
  const UPPER_L = 0.28;
  const FORE_L = 0.28;

  const arms: { shoulder: THREE.Group; elbow: THREE.Group; ancre: THREE.Vector2 }[] = [];
  for (const dx of [-0.132, 0.132]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(dx, 0.44, 0.05);
    torsoPivot.add(shoulder);
    // manche de maillot puis biceps nu : la coupure se voit, c'est ce qui fait vrai
    const upper = mergeParts(
      [
        makePart(gUpperArm, jerseyPlain, [0, -0.085, 0], undefined, [1.05, 0.55, 1.05]),
        makePart(gUpperArm, M.skin, [0, -0.185, 0], undefined, [0.92, 0.6, 0.92])
      ],
      owned
    )!;
    /*
     * Deltoïde. Sans lui, le bras sort du buste par une arête franche : le
     * raccord épaule-torse est ce qui trahit le plus un personnage assemblé
     * en morceaux.
     */
    const deltoide = mergeParts(
      [makePart(gShoulder, jerseyPlain, [0, 0.008, 0], undefined, [0.92, 0.82, 0.98])],
      owned
    )!;
    shoulder.add(deltoide);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);
    const foreMesh = mergeParts(
      [makePart(gForeArm, M.skin, [0, -0.14, 0]), makePart(gHand, M.dark, [0, -0.28, 0])],
      owned
    )!;
    elbow.add(foreMesh);
    /*
     * Point de saisie sur le cintre, exprimé dans le repère du vélo. Les mains
     * y sont vissées : c'est ce point qui pilote tout le bras, exactement
     * comme la pédale pilote la jambe.
     */
    arms.push({ shoulder, elbow, ancre: new THREE.Vector2(barZ + 0.075, barY + 0.012) });
  }

  const legs: { hip: THREE.Group; knee: THREE.Group; foot: THREE.Group }[] = [];
  for (const dx of [-0.085, 0.085]) {
    const hip = new THREE.Group();
    hip.position.set(dx, 0, 0.02);
    hipPivot.add(hip);
    // cuisse : cuissard sur les deux tiers, quadriceps qui s'affine vers le genou
    const thigh = mergeParts(
      [
        makePart(gThigh, M.shorts, [0, -0.15, 0.008], undefined, [1.06, 0.72, 1.02]),
        makePart(gThigh, M.skin, [0, -0.33, 0], undefined, [0.8, 0.42, 0.8])
      ],
      owned
    )!;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -THIGH_L;
    hip.add(knee);
    // mollet galbé en haut, cheville fine, chaussette haute
    const shin = mergeParts(
      [
        makePart(gCalf, M.skin, [0, -0.12, -0.012], undefined, [1, 1, 0.92]),
        makePart(gShin, M.skin, [0, -0.28, 0], undefined, [0.94, 0.72, 0.94]),
        makePart(gSock, M.shoe, [0, -0.4, 0.004])
      ],
      owned
    )!;
    knee.add(shin);
    const foot = new THREE.Group();
    foot.position.y = -SHIN_L;
    knee.add(foot);
    const shoe = new THREE.Mesh(gShoe, M.shoe);
    shoe.position.set(0, -0.03, 0.03);
    foot.add(shoe);
    legs.push({ hip, knee, foot });
  }

  /* --- niveau de détail faible : silhouette en 2 meshes --- */
  const lo = new THREE.Group();
  const loBody = mergeParts(
    [
      // vélo simplifié
      tubePart(M.frame, pBB, pSeatTop, 0.03, gTube),
      tubePart(M.accent, pBB, pHeadBot, 0.035, gTube),
      tubePart(M.frame, pSeatTop, pHeadTop, 0.03, gTube),
      tubePart(M.frame, pHeadBot, new THREE.Vector3(0, pFrontHub.y, pFrontHub.z), 0.024, gTube),
      tubePart(M.frame, pBB, new THREE.Vector3(0, pRearHub.y, pRearHub.z), 0.024, gTube),
      // coureur simplifié : bassin, dos, tête
      makePart(gHips, M.shorts, [0, HIP0.y, HIP0.x], undefined, [1, 0.78, 0.95]),
      makePart(gTorso, jersey, [0, HIP0.y + 0.19, HIP0.x + 0.16], [1.02, 0, 0]),
      makePart(gShoulder, jerseyPlain, [0, HIP0.y + 0.35, HIP0.x + 0.4]),
      makePart(gHelmet, M.helmet, [0, HIP0.y + 0.42, HIP0.x + 0.52], [-0.35, 0, 0], [1.1, 1.1, 1.1]),
      makePart(gThigh, M.shorts, [-0.085, HIP0.y - 0.2, HIP0.x + 0.04], [0.5, 0, 0]),
      makePart(gThigh, M.shorts, [0.085, HIP0.y - 0.2, HIP0.x + 0.04], [0.1, 0, 0]),
      makePart(gShin, M.skin, [-0.085, HIP0.y - 0.55, HIP0.x + 0.1], [-0.2, 0, 0]),
      makePart(gShin, M.skin, [0.085, HIP0.y - 0.52, HIP0.x - 0.02], [0.35, 0, 0]),
      makePart(gUpperArm, jerseyPlain, [-0.135, HIP0.y + 0.24, HIP0.x + 0.32], [-0.8, 0, 0]),
      makePart(gUpperArm, jerseyPlain, [0.135, HIP0.y + 0.24, HIP0.x + 0.32], [-0.8, 0, 0]),
      makePart(gForeArm, M.skin, [-0.135, HIP0.y + 0.04, HIP0.x + 0.5], [-1.2, 0, 0]),
      makePart(gForeArm, M.skin, [0.135, HIP0.y + 0.04, HIP0.x + 0.5], [-1.2, 0, 0])
    ],
    owned
  )!;
  lo.add(loBody);
  const loFront = mergeParts(wheelParts(), owned)!;
  loFront.rotation.y = Math.PI / 2;
  const loFrontSpin = new THREE.Group();
  loFrontSpin.position.copy(pFrontHub);
  loFrontSpin.add(loFront);
  const loRear = mergeParts(wheelParts(), owned)!;
  loRear.rotation.y = Math.PI / 2;
  const loRearSpin = new THREE.Group();
  loRearSpin.position.copy(pRearHub);
  loRearSpin.add(loRear);
  lo.add(loFrontSpin, loRearSpin);

  /* --- LOD --- */
  const lod = new THREE.LOD();
  lod.addLevel(hi, 0);
  lod.addLevel(lo, distanceLod);
  lod.autoUpdate = true;
  // sans ombre portée, le coureur semble flotter au-dessus de la chaussée.
  // Seul le niveau détaillé la projette : la silhouette lointaine ne
  // contribue presque rien à l'image mais doublerait le coût de la passe
  // d'ombres.
  hi.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = ombre;
      m.receiveShadow = false;
    }
  });

  localGeos.forEach((g) => g.dispose());

  /* --- animation --- */
  let phase = Math.random() * Math.PI * 2;
  const tmpHip = new THREE.Vector2();
  const tmpPed = new THREE.Vector2();

  function solveLeg(
    leg: { hip: THREE.Group; knee: THREE.Group; foot: THREE.Group },
    hipYZ: THREE.Vector2,
    pedYZ: THREE.Vector2
  ): void {
    const dz = pedYZ.x - hipYZ.x;
    const dy = pedYZ.y - hipYZ.y;
    let d = Math.hypot(dz, dy);
    d = THREE.MathUtils.clamp(d, Math.abs(THIGH_L - SHIN_L) + 0.05, (THIGH_L + SHIN_L) * 0.995);
    const base = Math.atan2(dz, -dy);
    const cosA = (THIGH_L * THIGH_L + d * d - SHIN_L * SHIN_L) / (2 * THIGH_L * d);
    const A = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    leg.hip.rotation.x = -(base + A);
    const cosB = (THIGH_L * THIGH_L + SHIN_L * SHIN_L - d * d) / (2 * THIGH_L * SHIN_L);
    const B = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1));
    leg.knee.rotation.x = Math.PI - B;
    leg.foot.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x) - 0.15;
  }

  /**
   * Bras à cinématique inverse.
   *
   * Les bras étaient jusqu'ici posés à des angles fixes : les mains
   * flottaient à côté du guidon et s'en écartaient dès que le buste bougeait.
   * On procède désormais comme pour les jambes — la main est un point fixe sur
   * la cocotte, et l'on calcule l'angle d'épaule et de coude qui l'y amènent.
   *
   * Le calcul se fait dans le plan vertical du buste. Le pivot du buste ne
   * subit qu'une rotation autour de X, donc convertir un point du repère du
   * vélo vers celui du buste se réduit à une translation suivie d'une rotation
   * plane — bien moins coûteux qu'un passage par les matrices monde, répété
   * pour dix-huit coureurs à chaque image.
   */
  const tmpMain = new THREE.Vector2();
  function solveArm(
    arm: { shoulder: THREE.Group; elbow: THREE.Group; ancre: THREE.Vector2 },
    hipY: number,
    hipZ: number,
    torsoAngle: number
  ): void {
    /*
     * Point de saisie ramené dans le repère du buste.
     *
     * Une rotation autour de X mélange Y et Z ; l'inverse s'écrit
     *   y = vy·cos a + vz·sin a
     *   z = −vy·sin a + vz·cos a
     * Les avoir intervertis plaçait la main à quatre-vingts centimètres du
     * guidon alors que le cintre est à quarante-six centimètres de l'épaule,
     * donc largement à portée.
     */
    const vz = arm.ancre.x - hipZ;
    const vy = arm.ancre.y - hipY;
    const c = Math.cos(torsoAngle);
    const sn = Math.sin(torsoAngle);
    const y = vy * c + vz * sn;
    const z = -vy * sn + vz * c;

    // l'épaule est décalée dans ce même repère
    const dz = z - 0.05;
    const dy = y - 0.44;
    let d = Math.hypot(dz, dy);
    d = THREE.MathUtils.clamp(d, Math.abs(UPPER_L - FORE_L) + 0.04, (UPPER_L + FORE_L) * 0.995);

    /*
     * Les segments pendent vers -Y au repos : un angle négatif les envoie
     * vers l'avant, un angle positif vers l'arrière. Un premier essai avec la
     * branche opposée repliait les bras derrière les épaules.
     */
    /*
     * Choix de la solution.
     *
     * Un triangle bras-avant-bras admet deux positions de coude, l'une
     * au-dessus de la ligne épaule-main, l'autre en dessous. La première
     * donnait un bras tendu à l'horizontale avec le coude pointé en l'air :
     * personne ne roule comme ça. Un cycliste a le coude bas, légèrement
     * fléchi, sous cette ligne — c'est la seconde solution.
     */
    const base = Math.atan2(dz, -dy);
    const cosA = (UPPER_L * UPPER_L + d * d - FORE_L * FORE_L) / (2 * UPPER_L * d);
    const A = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    arm.shoulder.rotation.x = -(base - A);
    const cosB = (UPPER_L * UPPER_L + FORE_L * FORE_L - d * d) / (2 * UPPER_L * FORE_L);
    const B = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1));
    arm.elbow.rotation.x = -(Math.PI - B);
    void tmpMain;
  }

  const update = (
    dt: number,
    speed: number,
    standing: number,
    effort: number,
    celebration = 0
  ): void => {
    const st = THREE.MathUtils.clamp(standing, 0, 1);
    const omega = (speed / R_WHEEL) * dt;
    const cadence = THREE.MathUtils.clamp(speed * 0.42 + effort * 2.2, 0.6, 12) * (1 + st * 0.12);
    phase += cadence * dt;

    // le niveau simplifié ne fait tourner que ses roues
    if (lo.visible) {
      loFrontSpin.rotation.x += omega;
      loRearSpin.rotation.x += omega;
      lo.rotation.z = Math.sin(phase) * st * 0.16;
      return;
    }
    if (!hi.visible) return;

    frontSpin.rotation.x += omega;
    rearSpin.rotation.x += omega;
    crank.rotation.x = phase;
    pedalPivots[0].position.set(-0.065, -Math.cos(phase) * CRANK, Math.sin(phase) * CRANK);
    pedalPivots[1].position.set(0.065, Math.cos(phase) * CRANK, -Math.sin(phase) * CRANK);
    pedalPivots[0].rotation.x = -phase;
    pedalPivots[1].rotation.x = -phase;

    const hipY = HIP0.y + st * 0.115;
    const hipZ = HIP0.x + st * 0.075;
    hipPivot.position.set(0, hipY, hipZ);

    const swayAmp = st * 0.16;
    frameMesh.rotation.z = Math.sin(phase) * swayAmp;
    hi.rotation.z = Math.sin(phase) * swayAmp * 0.35;
    hi.position.y = st * Math.abs(Math.cos(phase)) * 0.022;

    /*
     * Célébration.
     *
     * Le buste se redresse, la tête se relève et les bras quittent le cintre
     * pour s'ouvrir vers le ciel. Le geste se superpose au pédalage : un
     * vainqueur continue de rouler pendant qu'il lève les bras.
     */
    const cel = THREE.MathUtils.clamp(celebration, 0, 1);
    const inclinaison = THREE.MathUtils.lerp(1.02, 0.72, st) + Math.sin(phase * 2) * st * 0.05;
    torsoPivot.rotation.x = THREE.MathUtils.lerp(inclinaison, -0.22, cel);
    neck.rotation.x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-0.62, -0.42, st), 0.34, cel);

    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      const a = arms[i];

      // mains sur le cintre : la position découle du point de saisie
      solveArm(a, hipY, hipZ, torsoPivot.rotation.x);
      const epauleXtenue = a.shoulder.rotation.x;
      const coudeTenue = a.elbow.rotation.x;
      // le coude s'écarte un peu du corps, davantage en danseuse
      const epauleZtenue = sign * (0.13 + st * 0.16);

      /*
       * Célébration. Le bras quitte le cintre, monte au-dessus de l'épaule et
       * s'ouvre vers l'extérieur. Chaque bras a son propre décalage et sa
       * propre vitesse de frémissement : deux bras parfaitement synchrones
       * font marionnette.
       */
      const frisson = Math.sin(phase * 2.6 + i * 1.7) * 0.11 * cel;
      const ouverture = Math.sin(phase * 1.9 + i * 2.4) * 0.09 * cel;
      a.shoulder.rotation.x = THREE.MathUtils.lerp(epauleXtenue, -2.62 + frisson, cel);
      a.shoulder.rotation.z = THREE.MathUtils.lerp(epauleZtenue, sign * (0.62 + ouverture), cel);
      a.elbow.rotation.x = THREE.MathUtils.lerp(coudeTenue, -0.22 + frisson * 0.5, cel);
    }

    for (let i = 0; i < 2; i++) {
      const ang = phase + (i === 0 ? 0 : Math.PI);
      tmpPed.set(BB.x + Math.sin(ang) * CRANK, BB.y - Math.cos(ang) * CRANK);
      tmpHip.set(hipZ, hipY);
      solveLeg(legs[i], tmpHip, tmpPed);
      legs[i].hip.rotation.z = -hi.rotation.z * 0.4;
    }
  };

  update(0, 0, 0, 0.5);

  return {
    group: lod,
    update,
    articulations: {
      epaules: arms.map((a) => a.shoulder),
      coudes: arms.map((a) => a.elbow),
      cintre: arms.map((a) => ({ z: a.ancre.x, y: a.ancre.y }))
    },
    dispose: () => {
      owned.forEach((g) => g.dispose());
      disposables.forEach((d) => d.dispose());
    }
  };
}
