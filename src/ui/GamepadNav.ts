import type { Input } from '../core/Input';

/**
 * Navigation des menus à la manette.
 *
 * Le curseur se déplace dans l'espace plutôt que dans l'ordre du document :
 * on cherche l'élément le plus proche dans la direction demandée, en tenant
 * compte de l'alignement. C'est indispensable ici, car l'atelier présente des
 * grilles de pastilles de couleur sur plusieurs rangées — un parcours
 * séquentiel obligerait à traverser seize pastilles pour descendre d'une
 * ligne.
 *
 * Les éléments ne réagissent pas tous de la même façon au bouton A : un
 * bouton se déclenche, une case à cocher bascule, un champ texte prend le
 * focus, ce qui fait apparaître le clavier virtuel de la console. Les
 * curseurs, eux, se règlent avec gauche et droite sans validation.
 */

const SELECTEUR = [
  'button:not([disabled])',
  'input[type="text"]',
  'input[type="number"]',
  'input[type="range"]',
  'input[type="checkbox"]',
  'input[type="file"] + *',
  'select',
  '[data-nav]'
].join(',');

interface Cible {
  el: HTMLElement;
  rect: DOMRect;
}

export class GamepadNav {
  private root: HTMLElement;
  /** exposés pour les tests automatisés */
  index = -1;
  cibles: Cible[] = [];
  actif = false;
  /** temporisation de la répétition quand une direction est maintenue */
  private repeat = 0;
  private dernierAxe = 0;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /** la navigation ne s'affiche qu'une fois la manette utilisée */
  get estActif(): boolean {
    return this.actif;
  }

  desactiver(): void {
    this.actif = false;
    this.index = -1;
    this.nettoyer();
  }

  /** B : revient en haut de l'écran, puis rend la main */
  retour(): void {
    if (!this.actif) return;
    if (this.index > 0) {
      this.collecter();
      this.index = 0;
      this.appliquer();
    } else {
      this.desactiver();
    }
  }

  /** à rappeler après chaque reconstruction du menu */
  rafraichir(): void {
    const avant = this.index >= 0 ? this.cibles[this.index]?.el : null;
    const signature = avant ? this.signature(avant) : null;
    this.collecter();
    if (!this.actif) return;
    // on tente de retrouver l'élément équivalent après re-rendu, sinon on
    // repart du premier : sans cela le curseur saute à chaque modification
    if (signature) {
      const i = this.cibles.findIndex((c) => this.signature(c.el) === signature);
      this.index = i >= 0 ? i : Math.min(this.index, this.cibles.length - 1);
    }
    if (this.index < 0 && this.cibles.length) this.index = 0;
    this.appliquer();
  }

  private signature(el: HTMLElement): string {
    const d = el.dataset;
    return [
      el.tagName,
      el.id,
      d.tab,
      d.atelier,
      d.action,
      d.colorField,
      d.color,
      d.pattern,
      d.wheels,
      d.quality,
      d.difficulty,
      d.import,
      d.suppr,
      d.roster,
      d.ouvrir,
      d.stat,
      d.id,
      el.textContent?.slice(0, 18)
    ].join('|');
  }

  collecter(): void {
    const els = [...this.root.querySelectorAll<HTMLElement>(SELECTEUR)];
    this.cibles = els
      .filter((el) => {
        if (el.hasAttribute('hidden')) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const st = getComputedStyle(el);
        return st.visibility !== 'hidden' && st.display !== 'none';
      })
      .map((el) => ({ el, rect: el.getBoundingClientRect() }));
  }

  private nettoyer(): void {
    this.root.querySelectorAll('.nav-focus').forEach((e) => e.classList.remove('nav-focus'));
  }

  appliquer(): void {
    this.nettoyer();
    const c = this.cibles[this.index];
    if (!c) return;
    c.el.classList.add('nav-focus');
    c.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /**
   * Meilleure cible dans une direction : parmi les éléments réellement situés
   * du bon côté, on retient celui qui minimise la distance dans l'axe de
   * déplacement, pondérée par l'écart latéral. Le facteur 2 sur l'écart
   * latéral privilégie l'alignement, ce qui donne un déplacement prévisible.
   */
  private meilleure(dx: number, dy: number): number {
    const cur = this.cibles[this.index];
    if (!cur) return this.cibles.length ? 0 : -1;
    const cx = cur.rect.left + cur.rect.width / 2;
    const cy = cur.rect.top + cur.rect.height / 2;

    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.cibles.length; i++) {
      if (i === this.index) continue;
      const r = this.cibles[i].rect;
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ax = x - cx;
      const ay = y - cy;
      const avant = dx !== 0 ? ax * dx : ay * dy;
      if (avant <= 4) continue; // pas dans la bonne direction
      const lateral = dx !== 0 ? Math.abs(ay) : Math.abs(ax);
      const score = avant + lateral * 2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  private deplacer(dx: number, dy: number): void {
    const i = this.meilleure(dx, dy);
    if (i >= 0) {
      this.index = i;
      this.appliquer();
    }
  }

  /** action du bouton A selon la nature de l'élément */
  private activer(): void {
    const el = this.cibles[this.index]?.el as
      | HTMLElement
      | HTMLInputElement
      | HTMLButtonElement
      | undefined;
    if (!el) return;

    const input = el as HTMLInputElement;
    if (el.tagName === 'INPUT') {
      if (input.type === 'checkbox') {
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (input.type === 'range') return; // se règle avec gauche/droite
      // texte et nombre : donner le focus fait apparaître le clavier virtuel
      // de la console
      input.focus();
      input.select?.();
      return;
    }
    el.click();
  }

  /** curseurs : gauche et droite modifient la valeur */
  private ajusterCurseur(sens: number): boolean {
    const el = this.cibles[this.index]?.el as HTMLInputElement | undefined;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'range') return false;
    const pas = Number(el.step || 1) || 1;
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const v = Math.min(max, Math.max(min, Number(el.value) + sens * pas * 2));
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  /**
   * À appeler chaque frame. Retourne true si la manette a été utilisée, ce
   * qui permet à l'appelant de n'afficher l'aide correspondante qu'à ce
   * moment-là.
   */
  update(input: Input, dt: number): void {
    if (!input.gamepadConnected) {
      if (this.actif) this.desactiver();
      return;
    }

    const dirX = input.navX;
    const dirY = input.navYAnalog;
    const bouge = dirX !== 0 || dirY !== 0;
    // lu une seule fois : la lecture consomme l'appui, une seconde lecture
    // dans la même frame ne verrait plus rien
    const valider = input.confirm;

    if (bouge && !this.actif) {
      // premier mouvement : on prend la main et on affiche le curseur
      this.actif = true;
      this.collecter();
      this.index = 0;
      this.appliquer();
      this.repeat = 0.35;
      return;
    }
    if (valider && !this.actif) {
      this.actif = true;
      this.collecter();
      this.index = 0;
      this.appliquer();
      return;
    }
    if (!this.actif) return;

    // les positions changent au défilement : on les relit avant de comparer
    if (bouge && this.repeat <= 0) {
      this.collecter();
      if (this.index >= this.cibles.length) this.index = this.cibles.length - 1;
    }

    if (!bouge) {
      this.repeat = 0;
      this.dernierAxe = 0;
    } else {
      this.repeat -= dt;
      const change = dirX !== 0 ? dirX : dirY * 2;
      if (this.repeat <= 0 || change !== this.dernierAxe) {
        this.dernierAxe = change;
        // première impulsion plus longue, puis répétition rapide
        this.repeat = this.repeat <= 0 && change === this.dernierAxe ? 0.11 : 0.32;
        if (dirX !== 0 && this.ajusterCurseur(dirX)) {
          // curseur réglé : on ne déplace pas le focus
        } else {
          this.deplacer(dirX, dirY);
        }
      }
    }

    if (valider) this.activer();
  }
}
