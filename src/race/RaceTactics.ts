import type { Rider } from './Rider';
import type { Track } from './Track';
import type { StageType, Archetype } from '../data/types';
import { reglage, type ReglageDifficulte } from '../data/difficulty';

/**
 * Tactique collective de la course.
 *
 * Jusqu'ici chaque coureur décidait seul, ce qui donnait un peloton compact du
 * départ à l'arrivée. Or une course se joue à deux niveaux : l'effort de
 * chacun, et une décision collective — qui part devant, et qui accepte de
 * rouler pour les reprendre.
 *
 * Cette classe tient ce second niveau. Elle ne pilote pas les coureurs
 * directement : elle leur transmet une consigne, que chacun interprète selon
 * son tempérament et sa réserve. Un sprinteur épuisé ne roulera pas fort
 * parce qu'on le lui demande.
 *
 * Le principe qui gouverne le peloton n'est pas « rattraper l'échappée » mais
 * « la rattraper au bon moment ». Un peloton qui reprend les fuyards à
 * mi-parcours a mal calculé et se fait reprendre par une contre-attaque ;
 * un peloton qui s'y prend trop tard perd l'étape. Il vise donc un écart
 * décroissant vers un point de jonction, et corrige son allure en continu —
 * comme un thermostat.
 */

export type Phase = 'depart' | 'echappee' | 'chasse' | 'regroupement' | 'final';

export interface OrdreCourse {
  /** effort demandé, ou null si le coureur décide seul */
  effort: number | null;
  /** le coureur fait partie de l'échappée */
  dansEchappee: boolean;
  /** il prend un relais en tête de son groupe */
  relais: boolean;
}

export interface EtatCourse {
  phase: Phase;
  /** identifiants des fuyards encore devant */
  echappee: string[];
  /** écart en secondes de jeu */
  ecart: number;
  /** écart converti à l'échelle d'une vraie course, pour l'affichage */
  ecartAffiche: number;
  /** écart visé à cet instant par le peloton */
  ecartVise: number;
  /** le peloton roule-t-il pour revenir */
  chasse: boolean;
  /** le joueur est-il dans l'échappée */
  joueurDevant: boolean;
}

/** distance au-delà de laquelle on considère un coureur détaché */
const SEUIL_DETACHE = 22;
/** durée de l'attaque initiale, en secondes de jeu */
const DUREE_ATTAQUE = 14;
/** le peloton temporise après l'attaque : il « laisse filer » */
const DUREE_TEMPORISATION = 22;

interface Candidat {
  rider: Rider;
  archetype: Archetype;
  /** envie de partir, 0..1 */
  envie: number;
}

export class RaceTactics {
  private track: Track;
  private type: StageType;
  private riders: Rider[] = [];
  private archetypes = new Map<string, Archetype>();
  /** retard au général, en secondes, par coureur */
  private retardGc = new Map<string, number>();

  private phase: Phase = 'depart';
  private echappee = new Set<string>();
  private candidats: Candidat[] = [];
  private tentativeFaite = false;
  private tempsAttaque: number;
  /** instant où l'échappée s'est formée, en secondes de jeu */
  private instantFormation = -1;
  /**
   * Conversion entre le temps de jeu et le temps d'une vraie course.
   *
   * Une étape dure quatre minutes de jeu pour 170 km affichés. Un écart de
   * trois secondes de jeu correspond donc à environ trois minutes de course
   * réelle. Sans cette conversion, les écarts annoncés seraient absurdes :
   * soit ridicules à l'écran, soit impossibles à créer en jeu.
   */
  private facteurTemps = 1;
  private chasseActive = false;
  private effortPeloton = 0.62;
  private timer = 0;

  /** fraction du parcours où le peloton veut recoller */
  private pointJonction: number;
  /** écart maximal toléré, en secondes */
  private ecartMax: number;

  private etat: EtatCourse = {
    phase: 'depart',
    echappee: [],
    ecart: 0,
    ecartAffiche: 0,
    ecartVise: 0,
    chasse: false,
    joueurDevant: false
  };

  private regl: ReglageDifficulte;

  constructor(
    track: Track,
    type: StageType,
    retardGc: Map<string, number>,
    regl: ReglageDifficulte = reglage('normal')
  ) {
    this.track = track;
    this.type = type;
    this.retardGc = retardGc;
    this.regl = regl;

    // l'échappée du jour part dans les premiers kilomètres, jamais au même moment
    this.tempsAttaque = 12 + Math.random() * 26;

    /*
     * Point de jonction visé par le peloton.
     *
     * Sur une étape de plaine, les équipes de sprinteurs veulent l'emballage
     * final : elles reprennent tard mais sûrement. En montagne, personne n'a
     * intérêt à rouler pour un sprint qui n'aura pas lieu, et l'échappée va
     * souvent au bout. C'est ce qui rend les étapes différentes les unes des
     * autres au-delà du profil.
     */
    // plus la difficulté est élevée, moins le peloton laisse d'espace
    const tolerance = 1 / Math.max(0.6, regl.chasse);
    // les écarts sont exprimés en secondes de JEU, pas en minutes de course
    switch (type) {
      case 'plaine':
        this.pointJonction = 0.93 + Math.random() * 0.05;
        this.ecartMax = (2.4 + Math.random() * 1.4) * tolerance;
        break;
      case 'vallonnee':
        this.pointJonction = 0.9 + Math.random() * 0.12;
        this.ecartMax = (3 + Math.random() * 2) * tolerance;
        break;
      case 'montagne':
        // au-delà de 1, le peloton renonce : l'échappée peut gagner
        this.pointJonction = 0.94 + Math.random() * 0.22;
        this.ecartMax = (4 + Math.random() * 3) * tolerance;
        break;
      default:
        this.pointJonction = 2; // contre-la-montre : sans objet
        this.ecartMax = 0;
    }
  }

  setField(riders: Rider[], archetypes: Map<string, Archetype>): void {
    this.riders = riders;
    this.archetypes = archetypes;
  }

  /** échelle de conversion vers le temps d'une course réelle */
  setEchelle(displayKm: number, worldLength: number): void {
    const dureeReelle = (displayKm / 40) * 3600; // à 40 km/h de moyenne
    const dureeJeu = worldLength / 12;
    this.facteurTemps = Math.max(1, dureeReelle / Math.max(1, dureeJeu));
  }

  get état(): EtatCourse {
    return this.etat;
  }

  /** vitesse de référence pour convertir les mètres en secondes */
  private vitesseRef(): number {
    let v = 0;
    let n = 0;
    for (const r of this.riders) {
      if (r.finished) continue;
      v += r.speed;
      n += 1;
    }
    return Math.max(6, n ? v / n : 12);
  }

  /**
   * Sélectionne les coureurs qui tentent leur chance.
   *
   * Un coureur part s'il n'a rien à perdre au général et si son profil s'y
   * prête. Un leader du classement ne s'échappe pas au kilomètre 10 : il
   * serait chassé par tout le peloton. C'est exactement pour cela que les
   * équipes laissent filer des coureurs relégués.
   */
  private choisirCandidats(joueur: Rider): void {
    const liste: Candidat[] = [];
    for (const r of this.riders) {
      if (r === joueur || r.finished) continue;
      const a = this.archetypes.get(r.id) ?? 'complet';
      const retard = this.retardGc.get(r.id) ?? 0;

      // envie de base selon le tempérament
      let envie = a === 'rouleur' ? 0.7 : a === 'complet' ? 0.55 : a === 'grimpeur' ? 0.5 : 0.15;
      // plus on est loin au général, plus on est laissé libre de partir
      if (retard > 600) envie += 0.35;
      else if (retard > 240) envie += 0.2;
      else if (retard < 60) envie -= 0.45; // trop dangereux, le peloton ne laissera pas
      // en montagne les grimpeurs sont les plus motivés
      if (this.type === 'montagne' && a === 'grimpeur') envie += 0.25;
      if (this.type === 'plaine' && a === 'sprinteur') envie -= 0.3;
      envie += (Math.random() - 0.5) * 0.3;

      if (envie > 0.45) liste.push({ rider: r, archetype: a, envie });
    }
    liste.sort((x, y) => y.envie - x.envie);
    const taille = 2 + Math.floor(Math.random() * 3);
    this.candidats = liste.slice(0, taille);
  }

  /** écart en secondes entre la tête de l'échappée et la tête du peloton */
  private calculerEcart(joueur: Rider): { ecart: number; teteEchappee: number; tetePeloton: number } {
    const v = this.vitesseRef();
    let teteEchappee = -Infinity;
    let tetePeloton = -Infinity;
    for (const r of this.riders) {
      if (r.finished) continue;
      const devant = this.echappee.has(r.id) || (r === joueur && this.etat.joueurDevant);
      if (devant) teteEchappee = Math.max(teteEchappee, r.dist);
      else tetePeloton = Math.max(tetePeloton, r.dist);
    }
    if (teteEchappee === -Infinity || tetePeloton === -Infinity) {
      return { ecart: 0, teteEchappee, tetePeloton };
    }
    return { ecart: Math.max(0, (teteEchappee - tetePeloton) / v), teteEchappee, tetePeloton };
  }

  /**
   * Écart que le peloton accepte à cet instant.
   *
   * L'écart monte pendant le premier tiers, plafonne, puis redescend jusqu'à
   * zéro au point de jonction. Le peloton ne connaît évidemment pas cette
   * courbe : c'est une façon de représenter la somme des décisions des
   * équipes, qui laissent filer tant que c'est sans danger puis organisent la
   * chasse quand l'arrivée approche.
   */
  private ecartVise(progression: number): number {
    if (this.pointJonction > 1.05) {
      // personne ne roule vraiment : l'écart plafonne et se maintient
      return progression < 0.3 ? this.ecartMax * (progression / 0.3) : this.ecartMax;
    }
    const montee = 0.28;
    if (progression < montee) return this.ecartMax * (progression / montee);
    const t = (progression - montee) / (this.pointJonction - montee);
    if (t >= 1) return 0;
    // décroissance en courbe : lente d'abord, franche à la fin
    return this.ecartMax * (1 - t) * (1 - t * 0.55);
  }

  update(dt: number, clock: number, joueur: Rider): void {
    if (this.type === 'clm') return;
    this.timer -= dt;

    const progression = Math.min(1, joueur.dist / this.track.length);
    const { ecart } = this.calculerEcart(joueur);

    // le joueur est considéré devant s'il est détaché de la tête du peloton
    if (!this.etat.joueurDevant) {
      let tetePeloton = -Infinity;
      for (const r of this.riders) {
        if (r === joueur || r.finished || this.echappee.has(r.id)) continue;
        tetePeloton = Math.max(tetePeloton, r.dist);
      }
      if (tetePeloton > -Infinity && joueur.dist - tetePeloton > SEUIL_DETACHE) {
        this.etat.joueurDevant = true;
      }
    } else {
      // repris : il rentre dans le rang
      let tetePeloton = -Infinity;
      for (const r of this.riders) {
        if (r === joueur || r.finished || this.echappee.has(r.id)) continue;
        tetePeloton = Math.max(tetePeloton, r.dist);
      }
      if (tetePeloton > joueur.dist - 8) this.etat.joueurDevant = false;
    }

    // un fuyard rattrapé n'est plus dans l'échappée. On laisse toutefois le
    // temps à l'attaque de produire son effet : sans ce délai, les fuyards
    // seraient exclus à la frame suivant leur départ, encore au milieu du
    // peloton, et aucune échappée ne se formerait jamais.
    const forme = this.instantFormation >= 0 && clock - this.instantFormation > DUREE_ATTAQUE;
    if (this.echappee.size && forme) {
      let tetePeloton = -Infinity;
      for (const r of this.riders) {
        if (this.echappee.has(r.id) || r.finished || r === joueur) continue;
        tetePeloton = Math.max(tetePeloton, r.dist);
      }
      for (const id of [...this.echappee]) {
        const r = this.riders.find((x) => x.id === id);
        if (!r || r.finished) continue;
        if (r.dist < tetePeloton) this.echappee.delete(id);
      }
    }

    // formation de l'échappée
    if (!this.tentativeFaite && clock > this.tempsAttaque && progression < 0.25) {
      this.tentativeFaite = true;
      this.instantFormation = clock;
      this.choisirCandidats(joueur);
      for (const c of this.candidats) this.echappee.add(c.rider.id);
      this.phase = 'echappee';
    }

    // phase courante
    if (this.echappee.size === 0 && !this.etat.joueurDevant) {
      this.phase = this.tentativeFaite ? 'regroupement' : 'depart';
    } else if (progression > 0.9) {
      this.phase = 'final';
    } else if (this.chasseActive) {
      this.phase = 'chasse';
    } else {
      this.phase = 'echappee';
    }

    const vise = this.ecartVise(progression);

    /*
     * Régulation de l'allure du peloton.
     *
     * Un simple asservissement : si l'écart dépasse la consigne, on durcit ;
     * s'il est en dessous, on lève le pied. Le peloton ne roule pas à fond en
     * permanence, ce qui laisse respirer les fuyards et rend les écarts
     * vivants au lieu de fondre linéairement.
     */
    if (this.timer <= 0) {
      this.timer = 0.6;
      const erreur = ecart - vise;
      // juste après l'attaque, le peloton lève le pied : c'est ce moment de
      // flottement qui permet à l'écart de se creuser
      const temporise =
        this.instantFormation >= 0 && clock - this.instantFormation < DUREE_TEMPORISATION;
      /*
       * Gain volontairement faible. Un régulateur nerveux fait osciller
       * l'écart de plusieurs minutes d'un relevé à l'autre, ce qui ne
       * ressemble à rien : un peloton ne passe pas son temps à accélérer et
       * ralentir. Une correction douce donne une courbe qui respire.
       */
      /*
       * Le plafond monte avec l'écart. Un peloton qui voit filer un homme
       * dangereux ne se contente pas d'un tempo appuyé : il met tout le monde
       * à contribution. Sans ce plafond mobile, un coureur bien noté partait
       * seul et prenait vingt minutes sans que personne ne réagisse.
       */
      /*
       * La vigueur de la chasse suit le palier de difficulté. Aux niveaux
       * élevés le peloton ne laisse plus rien passer : une échappée du joueur
       * doit être méritée et défendue jusqu'au bout.
       */
      const ch = this.regl.chasse;
      const cible = temporise
        ? 0.5
        : 0.62 + Math.max(-0.13, Math.min(0.35 * ch, (erreur / 3.2) * ch));
      this.effortPeloton += (cible - this.effortPeloton) * 0.16;
      this.chasseActive = !temporise && erreur > 0.4 && vise < this.ecartMax * 0.95;
    }

    this.etat.phase = this.phase;
    this.etat.echappee = [...this.echappee];
    /*
     * L'écart affiché est lissé. La valeur brute saute à chaque bosse, parce
     * que la vitesse de référence change avec la pente. Une voiture de course
     * n'annonce pas un écart qui bondit de trente secondes entre deux
     * phrases.
     */
    this.etat.ecart = ecart;
    const brut = ecart * this.facteurTemps;
    this.etat.ecartAffiche += (brut - this.etat.ecartAffiche) * Math.min(1, dt * 0.7);
    this.etat.ecartVise = vise;
    this.etat.chasse = this.chasseActive;
  }

  /**
   * Consigne pour un coureur donné. Retourne un effort suggéré, que
   * l'AIController pondère ensuite par sa réserve et son tempérament.
   */
  ordre(rider: Rider, progression: number, clock = 0): OrdreCourse {
    if (this.type === 'clm') {
      return { effort: null, dansEchappee: false, relais: false };
    }
    const dedans = this.echappee.has(rider.id);

    if (dedans) {
      // l'attaque : quelques secondes à fond pour créer la cassure
      if (this.instantFormation >= 0 && clock - this.instantFormation < DUREE_ATTAQUE) {
        return { effort: 0.98, dansEchappee: true, relais: true };
      }
      /*
       * Dans l'échappée, on roule fort mais on ne se suicide pas. L'effort
       * baisse quand la réserve fond : c'est ce qui explique qu'une échappée
       * finisse par craquer même quand le peloton ne roule pas plus vite.
       */
      let e = 0.82;
      if (progression > 0.85) e = 0.9;
      if (rider.energy < 35) e -= 0.14;
      if (rider.energy < 18) e -= 0.16;
      return { effort: e, dansEchappee: true, relais: true };
    }

    /*
     * Dans le peloton. Ceux qui roulent devant fournissent l'effort demandé,
     * les suiveurs profitent de l'abri et en font un peu moins. En pleine
     * chasse tout le monde met la main à la pâte.
     */
    const e = this.chasseActive ? this.effortPeloton : this.effortPeloton - 0.05;
    return { effort: e, dansEchappee: false, relais: this.chasseActive };
  }

  /** échelle de conversion vers le temps d'une course réelle */
  get echelleTemps(): number {
    return this.facteurTemps;
  }

  /** nombre de fuyards encore devant, joueur compris */
  get tailleEchappee(): number {
    return this.echappee.size + (this.etat.joueurDevant ? 1 : 0);
  }
}
