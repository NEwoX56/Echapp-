import * as THREE from 'three';
import type { Rider } from '../race/Rider';

/**
 * Noms affichés au-dessus des coureurs.
 *
 * Les étiquettes sont des éléments HTML positionnés par projection de la
 * position 3D vers l'écran, plutôt que des sprites dans la scène. Le texte
 * reste ainsi net à toute distance, sans texture à générer par coureur, et le
 * coût GPU est nul — ce qui compte sur le navigateur d'une console.
 *
 * Pour ne pas encombrer l'écran, seuls les coureurs proches et devant la
 * caméra sont étiquetés, et l'opacité décroît avec la distance.
 *
 * Le conteneur est volontairement placé en dehors de l'élément du HUD : ce
 * dernier reconstruit tout son contenu au départ de chaque étape, ce qui
 * effacerait les étiquettes.
 */

const MAX_ETIQUETTES = 9;
const DISTANCE_MAX = 46;
const HAUTEUR = 1.95;

export class NameTags {
  private conteneur: HTMLElement;
  private pool: HTMLElement[] = [];
  private actif = false;
  private tmp = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camDir = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.conteneur = document.createElement('div');
    this.conteneur.className = 'name-tags';
    parent.appendChild(this.conteneur);
  }

  private enCourse = false;

  setActif(v: boolean): void {
    this.actif = v;
    this.majVisibilite();
    if (!v) this.cacherTout();
  }

  /** les étiquettes ne s'affichent qu'en course */
  setEnCourse(v: boolean): void {
    this.enCourse = v;
    this.majVisibilite();
    if (!v) this.cacherTout();
  }

  private majVisibilite(): void {
    this.conteneur.style.display = this.actif && this.enCourse ? '' : 'none';
  }

  private cacherTout(): void {
    for (const el of this.pool) el.style.display = 'none';
  }

  private etiquette(i: number): HTMLElement {
    while (this.pool.length <= i) {
      const el = document.createElement('div');
      el.className = 'name-tag';
      el.innerHTML = '<i></i><span></span>';
      this.conteneur.appendChild(el);
      this.pool.push(el);
    }
    return this.pool[i];
  }

  /**
   * Met à jour les étiquettes. `joueur` est exclu : on sait qui on est, et une
   * étiquette collée à la caméra masquerait la route.
   */
  update(riders: Rider[], joueur: Rider, camera: THREE.PerspectiveCamera): void {
    if (!this.actif) return;

    camera.getWorldPosition(this.camPos);
    camera.getWorldDirection(this.camDir);

    const largeur = this.conteneur.clientWidth || window.innerWidth;
    const hauteur = this.conteneur.clientHeight || window.innerHeight;

    // candidats : devant la caméra et assez proches
    const candidats: { r: Rider; d: number; x: number; y: number }[] = [];
    for (const r of riders) {
      if (r === joueur) continue;
      r.visual.group.getWorldPosition(this.tmp);
      this.tmp.y += HAUTEUR;
      const versRider = this.tmp.clone().sub(this.camPos);
      const d = versRider.length();
      if (d > DISTANCE_MAX || d < 1.2) continue;
      // produit scalaire : écarte tout ce qui est derrière la caméra
      if (versRider.dot(this.camDir) <= 0) continue;

      const p = this.tmp.clone().project(camera);
      if (p.x < -1.05 || p.x > 1.05 || p.y < -1.05 || p.y > 1.05) continue;
      candidats.push({
        r,
        d,
        x: (p.x * 0.5 + 0.5) * largeur,
        y: (-p.y * 0.5 + 0.5) * hauteur
      });
    }

    candidats.sort((a, b) => a.d - b.d);
    const retenus = candidats.slice(0, MAX_ETIQUETTES);

    retenus.forEach((c, i) => {
      const el = this.etiquette(i);
      const nom = el.querySelector('span')!;
      const pastille = el.querySelector('i')!;
      // le nom de famille suffit et tient dans la largeur
      const court = c.r.name.split(' ').slice(-1)[0];
      if (nom.textContent !== court) nom.textContent = court;
      const couleur = '#' + c.r.color.toString(16).padStart(6, '0');
      if (pastille.style.background !== couleur) pastille.style.background = couleur;

      // fondu avec la distance, et taille légèrement réduite au loin
      const t = Math.min(1, c.d / DISTANCE_MAX);
      const opacite = (1 - t * t) * 0.92 + 0.08;
      const echelle = 1 - t * 0.3;
      el.style.display = '';
      el.style.transform = `translate(-50%, -100%) translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px) scale(${echelle.toFixed(2)})`;
      el.style.opacity = opacite.toFixed(2);
    });

    for (let i = retenus.length; i < this.pool.length; i++) {
      this.pool[i].style.display = 'none';
    }
  }

  dispose(): void {
    this.conteneur.remove();
  }
}
