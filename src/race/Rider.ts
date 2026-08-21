import * as THREE from 'three';
import type { RiderStats } from '../data/types';
import type { RiderVisual } from '../models/RiderModel';
import type { Track } from './Track';

export interface RiderInit {
  id: string;
  name: string;
  color: number;
  stats: RiderStats;
  isPlayer: boolean;
  visual: RiderVisual;
  startLane: number;
}

/**
 * Modèle physique simplifié mais lisible :
 * - effort (0..1) contrôle la vitesse cible
 * - la pente pénalise/accélère selon la stat de grimpe
 * - l'aspiration réduit la dépense et donne un léger bonus
 * - l'énergie draine au-dessus du seuil, récupère en-dessous
 */
export class Rider {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly stats: RiderStats;
  readonly isPlayer: boolean;
  readonly visual: RiderVisual;

  dist = 0;
  lane: number; // décalage latéral courant
  targetLane: number;
  speed = 0;
  energy = 100;
  effort = 0.55;
  sprinting = false;
  drafting = false;
  boostTimer = 0;
  /** 0 = assis, 1 = en danseuse (visible à l'écran) */
  standing = 0;
  /** vraie fringale : on n'en sort qu'en remontant l'énergie (hystérésis) */
  bonking = false;
  /** dans les bordures : à l'abri (groupe de tête) ou laissé dans le vent */
  abrite = true;
  /**
   * Réserve maximale. Le joueur reste à 100 ; les adversaires peuvent monter
   * au-delà dans les paliers de difficulté élevés, ce qui leur permet de
   * tenir un effort bien plus longtemps avant de devoir se relever.
   */
  energieMax = 100;
  /** ravitaillement embarqué (joueur) */
  bidons = 4;
  gels = 3;
  /**
   * Spécialités actives. Elles ne donnent jamais de vitesse pure : elles
   * réduisent un coût ou allongent une durée, si bien qu'elles ouvrent une
   * option tactique sans déplacer le curseur de difficulté.
   */
  specialites = new Set<string>();
  /** vitesse d'absorption du bidon, doublée par « Estomac solide » */
  private debitBidon = 6;
  /** énergie du bidon en cours d'absorption (se vide dans energy à ~6/s) */
  private drinkPool = 0;
  finished = false;
  finishTime = 0;

  private pos = new THREE.Vector3();
  private tan = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();

  constructor(init: RiderInit) {
    this.id = init.id;
    this.name = init.name;
    this.color = init.color;
    this.stats = init.stats;
    this.isPlayer = init.isPlayer;
    this.visual = init.visual;
    this.lane = init.startLane;
    this.targetLane = init.startLane;
  }

  private statFactor(v: number): number {
    return 0.8 + v / 250; // 0.8 .. 1.18
  }

  updatePhysics(dt: number, track: Track, others: Rider[]): void {
    if (this.finished) {
      /*
       * On ne s'arrête pas sur la ligne. Le coureur roule sur son élan dans le
       * dégagement d'arrivée, ce qui laisse le temps à la célébration de se
       * jouer et donne l'image d'une vraie arrivée plutôt qu'un arrêt net.
       */
      // décélération douce dans le dégagement, sans dépasser sa longueur
      this.speed = Math.max(0, this.speed - 3.2 * dt);
      const limite = track.length + 140;
      this.dist = Math.min(limite, this.dist + this.speed * dt);
      this.standing = 0;
      this.effort = 0.2;
      this.updateVisual(dt, track);
      return;
    }

    const grade = track.gradeAt(this.dist);

    // aspiration : un coureur 2 à 9 unités devant, écart latéral < 1.6
    this.drafting = false;
    for (const o of others) {
      if (o === this || o.finished) continue;
      const gap = o.dist - this.dist;
      if (gap > 2 && gap < 9 && Math.abs(o.lane - this.lane) < 1.6) {
        this.drafting = true;
        break;
      }
    }

    // fringale : déclenchée à 0, on n'en sort qu'au-dessus de 18 % d'énergie.
    // C'est la vraie sanction du coureur qui n'a pas géré son effort.
    const sangFroid = this.specialites.has('sang-froid');
    if (this.energy <= 0) this.bonking = true;
    else if (this.bonking && this.energy > (sangFroid ? 7 : 12)) this.bonking = false;
    const fringale = this.bonking;

    const effort = fringale ? Math.min(this.effort, sangFroid ? 0.46 : 0.34) : this.effort;
    const sprint = this.sprinting && !fringale && this.energy > 3;

    let target = (7.5 + effort * 10.5) * this.statFactor(this.stats.flat);
    if (sprint) target += 6.5 * this.statFactor(this.stats.sprint);
    if (grade > 0) {
      target *= 1 / (1 + grade * 0.13 * (1.15 - this.stats.climb / 300));
    } else if (grade < 0) {
      target *= 1 + Math.min(-grade * 0.035, 0.45);
    }
    // pavés : chaussée irrégulière, tout le monde ralentit et encaisse les secousses
    if (track.isPave(this.dist)) target *= 0.91;
    // bordures : laissé dans le vent, sans abri, on paie plein pot
    if (track.isVent(this.dist) && !this.abrite) target *= 0.87;
    if (this.drafting) target *= 1.05;
    if (fringale) target *= this.specialites.has('sang-froid') ? 0.89 : 0.8;
    if (this.boostTimer > 0) {
      target *= 1.28;
      this.boostTimer -= dt;
    }

    this.speed += (target - this.speed) * Math.min(1, dt * 1.6);

    // énergie
    let drain = 0;
    if (effort > 0.55) drain += (effort - 0.55) * 11;
    if (sprint) drain += 9.5;
    if (grade > 1) drain += grade * 0.34 * effort;
    drain *= 1.12 - this.stats.endurance / 260;
    /*
     * Le vent.
     *
     * Être abrité fait économiser 45 %. Mais jusqu'ici, rouler seul ne coûtait
     * rien de plus que rouler en groupe : il n'y avait qu'un bonus, pas de
     * malus. Un coureur bien noté pouvait donc partir seul et tenir jusqu'au
     * bout sans jamais payer le prix du vent — le peloton ne revenait plus.
     *
     * Une surcharge s'applique désormais à l'effort soutenu sans abri. C'est
     * ce qui rend une échappée coûteuse, et ce qui fait qu'un groupe qui se
     * relaie va plus vite qu'un homme seul.
     */
    if (this.drafting) drain *= 0.55;
    else if (effort > 0.66) {
      // « Rouleur » rend l'échappée tenable en amortissant le prix du vent
      const surcout = (effort - 0.66) * 0.85;
      drain *= 1 + surcout * (this.specialites.has('rouleur') ? 0.66 : 1);
    }

    if (grade > 6 && this.specialites.has('grimpeur-ne')) drain *= 0.75;
    if (grade > 3 && grade <= 6 && this.specialites.has('puncheur')) drain *= 0.78;
    if (sprint && this.specialites.has('finisseur') && this.finalProche) drain *= 0.75;

    let recovery = 0;
    if (effort < 0.5 && !sprint) recovery = 6.4 + (this.drafting ? 2.2 : 0);
    if (fringale) recovery *= 0.7; // la remontée est laborieuse

    // absorption du bidon en cours (hydratation progressive, ~6 pts/s)
    if (this.drinkPool > 0) {
      const sip = Math.min(this.drinkPool, this.debitBidon * dt);
      this.drinkPool -= sip;
      recovery += sip / dt;
    }

    this.energy = THREE.MathUtils.clamp(
      this.energy - drain * dt + recovery * dt,
      0,
      this.energieMax
    );

    // danseuse : sprint, ou gros effort dans une pente sévère
    const wantStanding =
      (sprint ? 1 : 0) ||
      (grade > 4 && effort > 0.78 && this.energy > 5 ? 1 : 0) ||
      (grade > 7 && effort > 0.62 && this.energy > 5 ? 1 : 0);
    this.standing += (wantStanding - this.standing) * Math.min(1, dt * 4.5);

    // latéral
    this.lane += (this.targetLane - this.lane) * Math.min(1, dt * 3);

    this.dist += this.speed * dt;
    this.updateVisual(dt, track);
  }

  /** vrai dans les 400 derniers mètres, pour la spécialité « Finisseur » */
  finalProche = false;
  /** 0 = position de course, 1 = bras levés */
  celebration = 0;

  /** applique les spécialités équipées */
  setSpecialites(liste: string[]): void {
    this.specialites = new Set(liste);
    this.debitBidon = this.specialites.has('estomac') ? 12 : 6;
    if (this.specialites.has('estomac')) this.gels += 1;
  }

  /** boit un bidon du stock : +26 énergie absorbée progressivement */
  drinkBidon(): boolean {
    // le seuil suit la réserve : figé à 99, il empêchait les adversaires des
    // hauts niveaux, dont la réserve dépasse 100, de boire un seul bidon
    if (this.bidons <= 0 || this.energy >= this.energieMax - 2) return false;
    this.bidons -= 1;
    this.drinkPool += 26;
    return true;
  }

  /** avale un gel : +16 énergie immédiate (sucre rapide) */
  eatGel(): boolean {
    if (this.gels <= 0 || this.energy >= this.energieMax - 4) return false;
    this.gels -= 1;
    this.energy = Math.min(this.energieMax, this.energy + 16);
    return true;
  }

  /** passage à la musette : bidons refaits, +1 gel */
  refuel(): void {
    this.bidons = Math.max(this.bidons, 4);
    this.gels = Math.min(4, this.gels + 1);
  }

  private updateVisual(dt: number, track: Track): void {
    /*
     * On ne borne plus la position visuelle à la ligne d'arrivée. Ce plafond
     * datait de l'époque où la route s'y arrêtait : le coureur y restait
     * planté pendant que la caméra, elle, continuait — on le perdait de vue
     * pendant toute la célébration.
     */
    track.pose(this.dist, this.lane, this.pos, this.tan);
    const g = this.visual.group;
    g.position.copy(this.pos);
    this.lookTarget.copy(this.pos).add(this.tan);
    g.lookAt(this.lookTarget);
    this.visual.update(dt, this.speed, this.standing, this.effort, this.celebration);
  }

  get worldPosition(): THREE.Vector3 {
    return this.visual.group.position;
  }
}
