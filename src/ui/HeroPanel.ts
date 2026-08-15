/**
 * Panneau visuel du menu principal.
 *
 * Une bande d'images défile lentement sur le côté et la teinte de toute
 * l'interface s'accorde à l'image affichée. La couleur n'est pas écrite en
 * dur : elle est extraite de l'image elle-même, ce qui permet d'ajouter ses
 * propres visuels sans toucher au code.
 *
 * L'extraction se fait sur une miniature de 32 pixels de côté dessinée dans un
 * canvas. Analyser l'image à sa taille réelle coûterait des centaines de
 * milliers de lectures de pixels à chaque changement, pour un résultat
 * identique — la couleur dominante d'une photo ne dépend pas de sa définition.
 *
 * Les pixels très sombres, très clairs ou grisâtres sont écartés : ce sont le
 * ciel, l'asphalte et les ombres, qui donneraient une teinte terne alors qu'on
 * cherche la couleur qui caractérise l'image.
 */

export interface VisuelMenu {
  /** adresse de l'image */
  src: string;
  /** légende affichée en bas du panneau */
  legende?: string;
}

const DUREE = 7000;
const FONDU = 1200;

export class HeroPanel {
  private conteneur: HTMLElement;
  private visuels: VisuelMenu[] = [];
  private index = 0;
  private minuteur: number | null = null;
  private couches: HTMLElement[] = [];
  private legende: HTMLElement | null = null;
  private couche = 0;
  /** teintes déjà calculées, pour ne pas refaire l'analyse à chaque passage */
  private cache = new Map<string, string>();

  onTeinte: ((couleur: string) => void) | null = null;

  constructor(conteneur: HTMLElement) {
    this.conteneur = conteneur;
    this.conteneur.className = 'hero-interne';
  }

  get element(): HTMLElement {
    return this.conteneur;
  }

  /**
   * Cherche les visuels disponibles. Chaque fichier absent est simplement
   * ignoré : le panneau s'adapte à ce qui existe, y compris rien du tout.
   */
  async charger(candidats: VisuelMenu[]): Promise<void> {
    const trouves: VisuelMenu[] = [];
    await Promise.all(
      candidats.map(
        (v) =>
          new Promise<void>((res) => {
            const img = new Image();
            img.onload = () => {
              trouves.push(v);
              res();
            };
            img.onerror = () => res();
            img.src = v.src;
          })
      )
    );
    // l'ordre des chargements n'est pas garanti : on rétablit celui d'origine
    this.visuels = candidats.filter((c) => trouves.some((t) => t.src === c.src));
    if (this.visuels.length) this.demarrer();
  }

  private construire(): void {
    this.conteneur.innerHTML = `
      <div class="hero-couche"></div>
      <div class="hero-couche"></div>
      <div class="hero-voile"></div>
      <div class="hero-legende"></div>
      <div class="hero-points"></div>`;
    this.couches = [...this.conteneur.querySelectorAll<HTMLElement>('.hero-couche')];
    this.legende = this.conteneur.querySelector('.hero-legende');
    const points = this.conteneur.querySelector('.hero-points');
    if (points) {
      points.innerHTML = this.visuels.map(() => '<i></i>').join('');
    }
  }

  private demarrer(): void {
    this.construire();
    void this.afficher(0, true);
    if (this.visuels.length < 2) return;
    this.minuteur = window.setInterval(() => {
      this.index = (this.index + 1) % this.visuels.length;
      void this.afficher(this.index, false);
    }, DUREE);
  }

  private async afficher(i: number, immediat: boolean): Promise<void> {
    const v = this.visuels[i];
    if (!v || !this.couches.length) return;

    const suivante = this.couches[1 - this.couche];
    suivante.style.backgroundImage = `url("${v.src}")`;
    suivante.style.transition = immediat ? 'none' : `opacity ${FONDU}ms ease`;
    // un léger recadrage progressif donne de la vie sans animer d'image
    suivante.classList.remove('zoom');
    void suivante.offsetWidth;
    suivante.classList.add('zoom');
    suivante.style.opacity = '1';
    this.couches[this.couche].style.opacity = '0';
    this.couche = 1 - this.couche;

    if (this.legende) {
      this.legende.textContent = v.legende ?? '';
      this.legende.classList.toggle('vide', !v.legende);
    }
    this.conteneur.querySelectorAll('.hero-points i').forEach((p, k) => {
      p.classList.toggle('actif', k === i);
    });

    const teinte = await this.teinteDe(v.src);
    this.onTeinte?.(teinte);
  }

  /** couleur dominante saturée d'une image */
  private async teinteDe(src: string): Promise<string> {
    const enCache = this.cache.get(src);
    if (enCache) return enCache;

    const couleur = await new Promise<string>((res) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const T = 32;
          const c = document.createElement('canvas');
          c.width = T;
          c.height = T;
          const g = c.getContext('2d', { willReadFrequently: true });
          if (!g) return res('#ffd633');
          g.drawImage(img, 0, 0, T, T);
          const d = g.getImageData(0, 0, T, T).data;

          /*
           * On regroupe les pixels par teinte plutôt que de faire une moyenne :
           * une moyenne de rouge et de bleu donne du gris, alors que la couleur
           * qui caractérise l'image est celle qui revient le plus souvent.
           */
          const paniers = new Array(24).fill(0);
          const sommeS = new Array(24).fill(0);
          const sommeL = new Array(24).fill(0);
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i] / 255;
            const v = d[i + 1] / 255;
            const b = d[i + 2] / 255;
            const max = Math.max(r, v, b);
            const min = Math.min(r, v, b);
            const l = (max + min) / 2;
            if (l < 0.14 || l > 0.93) continue; // ombres et blancs
            const delta = max - min;
            if (delta < 0.12) continue; // gris : asphalte, ciel voilé
            const s = delta / (1 - Math.abs(2 * l - 1));
            let h: number;
            if (max === r) h = ((v - b) / delta) % 6;
            else if (max === v) h = (b - r) / delta + 2;
            else h = (r - v) / delta + 4;
            h = (h * 60 + 360) % 360;
            const k = Math.floor(h / 15);
            // pondéré par la saturation : une couleur franche pèse davantage
            paniers[k] += s;
            sommeS[k] += s;
            sommeL[k] += l;
          }
          let best = -1;
          let bestVal = 0;
          for (let k = 0; k < 24; k++) {
            if (paniers[k] > bestVal) {
              bestVal = paniers[k];
              best = k;
            }
          }
          if (best < 0) return res('#ffd633');
          const n = Math.max(1, paniers[best]);
          const h = best * 15 + 7.5;
          // on relève saturation et luminosité : la teinte sert d'accent sur
          // fond sombre, elle doit rester lisible
          const s = Math.min(0.85, Math.max(0.45, sommeS[best] / n));
          const l = Math.min(0.68, Math.max(0.5, sommeL[best] / n));
          res(hslVersHex(h, s, l));
        } catch {
          res('#ffd633');
        }
      };
      img.onerror = () => res('#ffd633');
      img.src = src;
    });

    this.cache.set(src, couleur);
    return couleur;
  }

  arreter(): void {
    if (this.minuteur !== null) {
      window.clearInterval(this.minuteur);
      this.minuteur = null;
    }
  }
}

function hslVersHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let v = 0;
  let b = 0;
  if (h < 60) [r, v, b] = [c, x, 0];
  else if (h < 120) [r, v, b] = [x, c, 0];
  else if (h < 180) [r, v, b] = [0, c, x];
  else if (h < 240) [r, v, b] = [0, x, c];
  else if (h < 300) [r, v, b] = [x, 0, c];
  else [r, v, b] = [c, 0, x];
  const t = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${t(r)}${t(v)}${t(b)}`;
}
