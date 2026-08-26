import * as THREE from 'three';
import { CATALOGUE, geometrie, materiauObjets } from './Catalogue';

/**
 * Vignettes de la palette.
 *
 * Une liste de noms ne dit pas à quoi ressemble un « pylône ». Chaque modèle
 * est donc photographié une fois, hors écran, dans un rendu minuscule ; les
 * images obtenues sont des data-URL réutilisées pour toute la session.
 *
 * Le rendu se fait dans son propre contexte WebGL, créé puis relâché
 * immédiatement : les navigateurs limitent le nombre de contextes vivants, et
 * celui du jeu ne doit surtout pas en pâtir.
 */

const cache = new Map<string, string>();
let faites = false;

export function vignette(id: string): string | null {
  return cache.get(id) ?? null;
}

/** photographie tout le catalogue ; sans effet si c'est déjà fait */
export function preparerVignettes(): void {
  if (faites) return;
  faites = true;
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(128, 96, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const cle = new THREE.DirectionalLight(0xfff4e0, 2.1);
    cle.position.set(4, 6, 5);
    scene.add(cle, new THREE.HemisphereLight(0xbfd7ff, 0x4a4034, 1.5));

    const camera = new THREE.PerspectiveCamera(32, 128 / 96, 0.1, 400);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materiauObjets());
    scene.add(mesh);
    const boite = new THREE.Box3();
    const taille = new THREE.Vector3();
    const centre = new THREE.Vector3();

    for (const m of CATALOGUE) {
      const geo = geometrie(m.id);
      if (!geo) continue;
      mesh.geometry = geo;
      geo.computeBoundingBox();
      boite.copy(geo.boundingBox!);
      boite.getSize(taille);
      boite.getCenter(centre);
      // cadrage : on recule d'autant que l'objet est grand, en trois quarts
      const rayon = Math.max(taille.x, taille.y, taille.z) * 0.62 + 0.4;
      const d = rayon / Math.tan((camera.fov * Math.PI) / 360) + rayon;
      camera.position.set(centre.x + d * 0.62, centre.y + d * 0.42, centre.z + d * 0.66);
      camera.lookAt(centre);
      renderer.render(scene, camera);
      cache.set(m.id, canvas.toDataURL('image/png'));
    }
    mesh.geometry = new THREE.BufferGeometry();
  } catch {
    // pas de second contexte WebGL disponible : la palette reste en texte
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss?.();
  }
}
