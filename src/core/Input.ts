/**
 * Entrées clavier et manette.
 *
 * La manette utilise l'API Gamepad du navigateur avec le mapping "standard",
 * commun aux manettes Xbox et PlayStation : les navigateurs normalisent les
 * deux vers la même disposition de boutons et d'axes. Aucune configuration
 * n'est donc nécessaire, une DualSense et une manette Xbox se comportent
 * pareil.
 */

/** index des boutons dans le mapping standard */
const BTN = {
  sud: 0, // A (Xbox) / Croix (PlayStation)
  est: 1, // B / Rond
  ouest: 2, // X / Carré
  nord: 3, // Y / Triangle
  l1: 4,
  r1: 5,
  l2: 6, // gâchette gauche
  r2: 7, // gâchette droite
  select: 8,
  start: 9,
  croixHaut: 12,
  croixBas: 13,
  croixGauche: 14,
  croixDroite: 15
} as const;

const DEADZONE = 0.18;
const TRIGGER_SEUIL = 0.2;

export class Input {
  private keys = new Set<string>();
  private pressedOnce = new Set<string>();

  /** état des boutons manette à la frame précédente, pour détecter les appuis */
  private padPrev: boolean[] = [];
  private padNow: boolean[] = [];
  private padAxes: number[] = [];
  private padConnected = false;
  private padName = '';
  /** appuis manette consommables, à la manière de pressedOnce */
  private padPressedOnce = new Set<number>();

  /* ---- souris, pour le vol libre de l'onglet Test ---- */
  private sourisDx = 0;
  private sourisDy = 0;
  private sourisEnfoncee = false;
  /** distance parcourue depuis l'appui : sert à distinguer un clic d'un glissé */
  private sourisTraine = 0;
  private clicEnAttente = false;
  private molette = 0;

  /** appelé quand une manette est branchée ou débranchée */
  onGamepadChange: ((connected: boolean, name: string) => void) | null = null;
  private minuteur: number | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressedOnce.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ') this.keys.add('space');
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
      if (e.key === ' ') this.keys.delete('space');
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pressedOnce.clear();
      this.sourisEnfoncee = false;
    });

    /*
     * Souris. Le vol libre s'oriente en glissant, et pose un objet au clic.
     * On distingue les deux à la distance parcourue : sous quelques pixels,
     * c'était un clic ; au-delà, on regardait autour de soi. Pas de capture
     * du pointeur — elle se comporte mal quand une interface HTML est
     * superposée à la 3D, ce qui est exactement le cas de l'atelier.
     */
    const canvas = document.getElementById('game-canvas');
    canvas?.addEventListener('mousedown', (e) => {
      if ((e as MouseEvent).button !== 0) return;
      this.sourisEnfoncee = true;
      this.sourisTraine = 0;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.sourisEnfoncee) return;
      const me = e as MouseEvent;
      this.sourisDx += me.movementX;
      this.sourisDy += me.movementY;
      this.sourisTraine += Math.abs(me.movementX) + Math.abs(me.movementY);
    });
    window.addEventListener('mouseup', (e) => {
      if ((e as MouseEvent).button !== 0 || !this.sourisEnfoncee) return;
      this.sourisEnfoncee = false;
      if (this.sourisTraine < 6 && (e.target as HTMLElement)?.id === 'game-canvas') {
        this.clicEnAttente = true;
      }
    });
    canvas?.addEventListener(
      'wheel',
      (e) => {
        this.molette += Math.sign((e as WheelEvent).deltaY);
      },
      { passive: true }
    );

    // La manette est interrogée à cadence fixe, indépendamment du rendu.
    // Sans cela, sur une machine qui tombe à quelques images par seconde, un
    // appui bref commencé et relâché entre deux images n'est jamais vu.
    this.minuteur = window.setInterval(() => this.poll(), 16);

    window.addEventListener('gamepadconnected', (e) => {
      const g = (e as GamepadEvent).gamepad;
      this.padConnected = true;
      this.padName = this.friendlyName(g.id);
      this.onGamepadChange?.(true, this.padName);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.padConnected = false;
      this.padNow = [];
      this.padPrev = [];
      this.padAxes = [];
      this.onGamepadChange?.(false, this.padName);
    });
  }

  /** nom lisible : on ne garde pas les identifiants USB bruts */
  private friendlyName(id: string): string {
    const l = id.toLowerCase();
    if (l.includes('dualsense') || l.includes('054c')) return 'Manette PlayStation';
    if (l.includes('xbox') || l.includes('045e')) return 'Manette Xbox';
    return 'Manette';
  }

  get gamepadConnected(): boolean {
    return this.padConnected;
  }
  get gamepadName(): string {
    return this.padName;
  }

  /**
   * À appeler une fois par frame, avant de lire les entrées.
   * L'API Gamepad n'émet pas d'événements : il faut interroger l'état.
   */
  poll(): void {
    const pads = navigator.getGamepads?.() ?? [];
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) {
      // plus aucune manette : l'événement gamepaddisconnected n'est pas toujours
      // émis (batterie vide, dongle retiré), donc on le détecte au polling
      if (this.padConnected) {
        this.padConnected = false;
        this.padPrev = [];
        this.padNow = [];
        this.padAxes = [];
        this.padPressedOnce.clear();
        this.onGamepadChange?.(false, this.padName);
      }
      return;
    }
    if (!this.padConnected) {
      // certaines manettes n'émettent l'événement qu'après une première action
      this.padConnected = true;
      this.padName = this.friendlyName(pad.id);
      this.onGamepadChange?.(true, this.padName);
    }

    this.padPrev = this.padNow;
    this.padNow = pad.buttons.map((b) => b.pressed || b.value > TRIGGER_SEUIL);
    this.padAxes = Array.from(pad.axes);

    for (let i = 0; i < this.padNow.length; i++) {
      if (this.padNow[i] && !this.padPrev[i]) this.padPressedOnce.add(i);
    }
  }

  private padDown(i: number): boolean {
    return !!this.padNow[i];
  }

  /** vrai une seule fois par appui manette */
  private takePadPressed(i: number): boolean {
    if (this.padPressedOnce.has(i)) {
      this.padPressedOnce.delete(i);
      return true;
    }
    return false;
  }

  private axis(i: number): number {
    const v = this.padAxes[i] ?? 0;
    return Math.abs(v) < DEADZONE ? 0 : v;
  }

  down(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /** vrai une seule fois par appui (consommé à la lecture) */
  takePressed(key: string): boolean {
    const k = key.toLowerCase();
    if (this.pressedOnce.has(k)) {
      this.pressedOnce.delete(k);
      return true;
    }
    return false;
  }

  /* ---------------- actions de course ---------------- */

  get accelerate(): boolean {
    return (
      this.down('arrowup') ||
      this.down('z') ||
      this.down('w') ||
      this.padDown(BTN.r2) ||
      this.padDown(BTN.croixHaut) ||
      this.axis(1) < -0.4
    );
  }

  get brake(): boolean {
    return (
      this.down('arrowdown') ||
      this.down('s') ||
      this.padDown(BTN.l2) ||
      this.padDown(BTN.croixBas) ||
      this.axis(1) > 0.4
    );
  }

  get left(): boolean {
    return (
      this.down('arrowleft') ||
      this.down('q') ||
      this.down('a') ||
      this.padDown(BTN.croixGauche) ||
      this.axis(0) < -0.3
    );
  }

  get right(): boolean {
    return (
      this.down('arrowright') ||
      this.down('d') ||
      this.padDown(BTN.croixDroite) ||
      this.axis(0) > 0.3
    );
  }

  get sprint(): boolean {
    return this.down('space') || this.down('shift') || this.padDown(BTN.sud);
  }

  /**
   * Bidon : X / Carré, ou LB / L1 en secours.
   *
   * Sur certaines plateformes le navigateur intercepte des boutons de la
   * manette pour sa propre interface — c'est le cas de Y sur Edge Xbox, qui
   * ne parvient jamais à la page. Chaque action de course dispose donc d'une
   * seconde touche, choisie parmi celles que les navigateurs ne réservent
   * jamais. Le plein écran règle le problème à la source, ces secours
   * couvrent le reste.
   */
  get drinkBidon(): boolean {
    return this.takePressed('b') || this.takePadPressed(BTN.ouest) || this.takePadPressed(BTN.l1);
  }

  /** Gel : Y / Triangle, ou RB / R1 en secours */
  get eatGel(): boolean {
    return this.takePressed('g') || this.takePadPressed(BTN.nord) || this.takePadPressed(BTN.r1);
  }

  /** changer d'angle de caméra : C, ou Select / Share en secours */
  get changeCamera(): boolean {
    return this.takePressed('c') || this.takePadPressed(BTN.select);
  }

  /* ---------------- navigation dans les menus ---------------- */

  /** valider : A / Croix, ou Entrée */
  get confirm(): boolean {
    return this.takePressed('enter') || this.takePadPressed(BTN.sud);
  }

  /** revenir en arrière : B / Rond, ou Échap */
  get back(): boolean {
    return this.takePressed('escape') || this.takePadPressed(BTN.est);
  }

  /** plein écran : Start / Options, ou F */
  get toggleFullscreen(): boolean {
    return this.takePressed('f') || this.takePadPressed(BTN.start);
  }

  /** changer d'onglet : L1 / R1 (-1 ou +1, 0 si rien) */
  get tabShift(): number {
    if (this.takePadPressed(BTN.r1)) return 1;
    if (this.takePadPressed(BTN.l1)) return -1;
    return 0;
  }

  /** déplacement dans une liste : croix directionnelle ou stick gauche */
  get navY(): number {
    if (this.takePadPressed(BTN.croixBas)) return 1;
    if (this.takePadPressed(BTN.croixHaut)) return -1;
    return 0;
  }

  /**
   * Direction maintenue pour la navigation des menus : croix directionnelle
   * ou stick gauche, lue en continu et non par impulsion, la répétition étant
   * gérée par le navigateur de menu lui-même.
   */
  get navX(): number {
    if (this.padDown(BTN.croixGauche)) return -1;
    if (this.padDown(BTN.croixDroite)) return 1;
    const a = this.axis(0);
    return Math.abs(a) > 0.45 ? Math.sign(a) : 0;
  }

  get navYAnalog(): number {
    if (this.padDown(BTN.croixHaut)) return -1;
    if (this.padDown(BTN.croixBas)) return 1;
    const a = this.axis(1);
    return Math.abs(a) > 0.45 ? Math.sign(a) : 0;
  }

  /* ---------------- vol libre (onglet Test) ---------------- */

  /** passer de « rouler » à « survoler » : V, ou le clic droit du stick */
  get basculerVol(): boolean {
    return this.takePressed('v') || this.takePadPressed(11);
  }

  /** avancer/reculer dans l'axe du regard : -1..1 */
  get volAvance(): number {
    let v = 0;
    if (this.down('z') || this.down('w') || this.down('arrowup')) v += 1;
    if (this.down('s') || this.down('arrowdown')) v -= 1;
    if (this.padDown(BTN.croixHaut)) v += 1;
    if (this.padDown(BTN.croixBas)) v -= 1;
    const a = this.axis(1);
    if (a) v -= a;
    return Math.max(-1, Math.min(1, v));
  }

  /** pas de côté : -1 (gauche) .. 1 (droite) */
  get volCote(): number {
    let v = 0;
    if (this.down('d') || this.down('arrowright')) v += 1;
    if (this.down('q') || this.down('a') || this.down('arrowleft')) v -= 1;
    if (this.padDown(BTN.croixDroite)) v += 1;
    if (this.padDown(BTN.croixGauche)) v -= 1;
    const a = this.axis(0);
    if (a) v += a;
    return Math.max(-1, Math.min(1, v));
  }

  /** monter / descendre : espace et majuscule, gâchettes à la manette */
  get volVertical(): number {
    let v = 0;
    if (this.down('space') || this.down(' ')) v += 1;
    if (this.down('shift') || this.down('control')) v -= 1;
    if (this.padDown(BTN.r2)) v += 1;
    if (this.padDown(BTN.l2)) v -= 1;
    return Math.max(-1, Math.min(1, v));
  }

  /** rotation du regard demandée à la manette : stick droit */
  get volRegardPad(): { x: number; y: number } {
    return { x: this.axis(2), y: this.axis(3) };
  }

  /** vol rapide : le déplacement est multiplié tant que la touche est tenue */
  get volTurbo(): boolean {
    return this.down('t') || this.padDown(BTN.r1);
  }

  /** poser l'objet visé dans l'atelier : Entrée, ou A / Croix à la manette */
  get poserObjet(): boolean {
    return this.takePressed('enter') || this.takePadPressed(BTN.sud);
  }

  /** retirer l'objet visé dans l'atelier : X, ou Carré / X à la manette */
  get retirerObjet(): boolean {
    return this.takePressed('x') || this.takePadPressed(BTN.ouest);
  }

  /** consomme le glissé de souris accumulé depuis la dernière image */
  prendreSouris(): { dx: number; dy: number } {
    const r = { dx: this.sourisDx, dy: this.sourisDy };
    this.sourisDx = 0;
    this.sourisDy = 0;
    return r;
  }

  /** consomme un clic court sur la vue 3D (pose d'objet dans l'atelier) */
  prendreClic(): boolean {
    if (!this.clicEnAttente) return false;
    this.clicEnAttente = false;
    return true;
  }

  /** consomme les crans de molette accumulés (réglage de la vitesse de vol) */
  prendreMolette(): number {
    const m = this.molette;
    this.molette = 0;
    return m;
  }
}
