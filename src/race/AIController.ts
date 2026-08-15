import type { Archetype } from '../data/types';
import type { Rider } from './Rider';
import type { Track } from './Track';
import type { OrdreCourse } from './RaceTactics';
import { reglage, type ReglageDifficulte } from '../data/difficulty';

/**
 * Comportement par archétype :
 * - sprinteur : économe, explose dans le final
 * - grimpeur : attaque dès que ça monte
 * - rouleur : tempo élevé et constant
 * - complet : adaptatif
 * Un léger rubber-banding garde la course disputée sans la truquer.
 */
export type AIRole = 'rival' | 'equipier';

export class AIController {
  private rider: Rider;
  private archetype: Archetype;
  private role: AIRole;
  private aggression: number;
  private decisionTimer = 0;
  private cruise = 0.6;
  /**
   * Seuil auquel le coureur se ravitaille.
   *
   * Les adversaires disposaient des mêmes bidons que le joueur mais ne s'en
   * servaient jamais : celui-ci arrivait au sprint avec plus de cent points
   * d'énergie d'avance, gagnés simplement en buvant. Aucun réglage de
   * difficulté ne pouvait compenser un tel écart de règles.
   *
   * Le seuil suit le palier : aux niveaux bas l'IA s'y prend mal, tard et de
   * façon irrégulière ; aux niveaux élevés elle gère aussi bien qu'un bon
   * joueur.
   */
  private seuilBidon: number;
  private seuilGel: number;

  /** accès au coureur piloté, pour la tactique collective */
  get coureur(): Rider {
    return this.rider;
  }

  private regl: ReglageDifficulte;
  /** le joueur a équipé « Meneur d'hommes » */
  meneur = false;

  constructor(
    rider: Rider,
    archetype: Archetype,
    role: AIRole = 'rival',
    regl: ReglageDifficulte = reglage('normal')
  ) {
    this.rider = rider;
    this.archetype = archetype;
    this.role = role;
    this.regl = regl;
    const finesse = Math.max(0, Math.min(1, (regl.stats - 0.86) / 0.48));
    this.seuilBidon = 34 + finesse * 24 + (Math.random() - 0.5) * 8;
    this.seuilGel = 16 + finesse * 12 + (Math.random() - 0.5) * 6;
    this.aggression = 0.85 + Math.random() * 0.3;
    // un équipier se sacrifie : il roule plus dur mais ne joue pas sa carte
    if (role === 'equipier') this.aggression *= 0.95;
  }

  update(dt: number, track: Track, player: Rider, ordre?: OrdreCourse): void {
    const r = this.rider;
    if (r.finished) return;

    this.decisionTimer -= dt;
    if (this.decisionTimer > 0) return;
    this.decisionTimer = 0.35 + Math.random() * 0.4;

    const remaining = track.length - r.dist;
    const grade = track.gradeAt(r.dist);

    // ravitaillement : mêmes règles que pour le joueur
    if (remaining > 400) {
      if (r.energy < this.seuilBidon) r.drinkBidon();
      else if (r.energy < this.seuilGel) r.eatGel();
    } else if (r.energy < this.seuilGel + 6) {
      // dans le final, le gel prime : son effet est immédiat
      if (!r.eatGel()) r.drinkBidon();
    }
    const gapToPlayer = r.dist - player.dist;

    let effort: number;

    if (remaining < 480) {
      // final
      const sprintPower = r.stats.sprint / 100;
      effort = 0.85 + sprintPower * 0.15;
      r.sprinting = remaining < 320 && r.energy > 8 && (sprintPower > 0.55 || remaining < 140);
    } else if (grade > 2.5) {
      // montée
      const climbPower = r.stats.climb / 100;
      if (this.archetype === 'grimpeur') {
        effort = 0.82 * this.aggression;
        r.sprinting = grade > 5 && r.energy > 45 && Math.random() < 0.25;
      } else {
        effort = 0.45 + climbPower * 0.3;
        r.sprinting = false;
      }
    } else {
      // tempo
      switch (this.archetype) {
        case 'rouleur':
          effort = this.cruise + 0.14;
          break;
        case 'sprinteur':
          effort = this.cruise - 0.08;
          break;
        case 'grimpeur':
          effort = this.cruise - 0.02;
          break;
        default:
          effort = this.cruise + 0.05;
      }
      effort *= this.aggression;
      r.sprinting = false;
    }

    /* --- rôle d'équipier : protéger le leader --- */
    if (this.role === 'equipier') {
      const gap = r.dist - player.dist; // > 0 : je suis devant lui
      if (remaining < 900) {
        // lancement du sprint : on se met devant et on met le feu
        if (gap > -6 && gap < 14) {
          effort = 1;
          r.sprinting = r.energy > 12 && remaining < 600;
          r.targetLane = clampLane(player.lane);
        }
      } else if (!player.finished) {
        // se maintenir 4 à 8 m devant le leader, dans son axe : il prend la roue
        const want = 6;
        if (gap < want - 2.5) effort = Math.min(1, effort + 0.22);
        else if (gap > want + 4) effort = Math.max(0.3, effort - 0.2);
        // se caler sur la trajectoire du leader
        if (Math.abs(gap - want) < 9) r.targetLane = clampLane(player.lane);
      }
      /*
       * L'équipier se sacrifie. « Meneur d'hommes » abaisse encore ce
       * plancher : tes coureurs tiennent devant toi bien plus longtemps.
       */
      const plancherEquipier = this.meneur ? 6 : 12;
      if (r.energy < plancherEquipier && remaining > 500) effort = Math.min(effort, 0.42);
    }

    // gestion d'énergie : un fuyard puise plus bas, il joue sa carte
    // aux paliers élevés, l'IA puise beaucoup plus bas avant de se relever
    const plancher = ordre?.dansEchappee
      ? Math.max(4, this.regl.plancherEnergie - 8)
      : this.regl.plancherEnergie;
    if (this.role === 'rival' && r.energy < plancher && remaining > 500) {
      effort = Math.min(effort, 0.42);
    }

    /*
     * Rubber-banding doux : la course reste un match.
     *
     * Il est désactivé pour les fuyards, sans quoi une échappée serait
     * ramenée artificiellement dès qu'elle prend de l'avance sur le joueur —
     * ce qui viderait la mécanique de son sens.
     */
    const rb = this.regl.rubberBand;
    if (rb > 0 && this.role === 'rival' && remaining > 600 && !ordre?.dansEchappee) {
      if (gapToPlayer > 130) effort *= 1 - 0.1 * rb;
      else if (gapToPlayer < -150) effort *= 1 + 0.1 * rb;
    }

    /*
     * Consigne collective.
     *
     * L'ordre venu de la tactique de course ne remplace pas la décision
     * individuelle : on en fait une moyenne. Un fuyard épuisé ne tiendra pas
     * l'allure demandée, un grimpeur dans un col durcira au-delà. C'est ce
     * mélange qui évite l'impression de coureurs télécommandés.
     */
    if (ordre?.effort !== null && ordre?.effort !== undefined) {
      // en chasse organisée, la consigne prime nettement sur l'humeur du
      // coureur : c'est tout l'intérêt d'une équipe qui roule en tête
      const poids = ordre.dansEchappee ? 0.7 : ordre.relais ? 0.8 : 0.55;
      effort = effort * (1 - poids) + ordre.effort * poids;
      // un fuyard prend des relais : il roule dans le vent, pas à l'abri
      if (ordre.relais && remaining > 600) r.sprinting = false;
    }

    r.effort = Math.min(1, Math.max(0.25, effort));

    // évitement simple : se décale si un coureur est juste devant
    if (this.role === 'equipier' && remaining < 900) return;
    for (const other of trackOthers) {
      if (other === r || other.finished) continue;
      const gap = other.dist - r.dist;
      if (gap > 0.5 && gap < 4 && Math.abs(other.lane - r.lane) < 0.9) {
        r.targetLane = clampLane(r.lane + (r.lane <= other.lane ? -1.4 : 1.4));
        break;
      }
    }
    // sinon, chercher l'aspiration
    if (!r.drafting && Math.random() < 0.35) {
      let best: Rider | null = null;
      for (const other of trackOthers) {
        if (other === r || other.finished) continue;
        const gap = other.dist - r.dist;
        if (gap > 2 && gap < 14) {
          if (!best || other.dist < best.dist) best = other;
        }
      }
      if (best) r.targetLane = clampLane(best.lane);
    }
  }

  static setField(riders: Rider[]): void {
    trackOthers = riders;
  }
}

let trackOthers: Rider[] = [];

function clampLane(v: number): number {
  return Math.max(-3.2, Math.min(3.2, v));
}
