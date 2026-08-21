import * as THREE from 'three';
import type {
  StageDef,
  StageResultRow,
  RosterRider,
  RiderStats,
  Difficulty,
  StagePoints
} from '../data/types';
import type { RiderAppearance, ClassementKey } from '../data/appearance';
import { reglage, scaleStats } from '../data/difficulty';
import { AWARDS } from '../data/appearance';
import { KOM_POINTS, SPRINT_POINTS, FINISH_POINTS } from '../data/tours';
import { Track, type VentMarker } from './Track';
import { Rider } from './Rider';
import { AIController } from './AIController';
import { RaceTactics, type EtatCourse } from './RaceTactics';
import { calculerGroupes, type GroupeCourse } from '../ui/RaceGroups';
import { Caravane } from './Caravane';
import type { AssetLoader } from '../core/AssetLoader';
import type { Input } from '../core/Input';
import { PLAYER_ID } from '../career/Career';
import { DirectorRadio, type RadioMessage, type RivalInfo } from './DirectorRadio';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Ambiance } from '../audio/Music';
import type { MusicDirector } from '../audio/MusicDirector';
import { atmosphereDeEtape, brumeFinale } from './Atmosphere';
import { Rain } from './Rain';

export interface RaceHudState {
  energy: number;
  speedKmh: number;
  position: number;
  fieldSize: number;
  remainingKm: number;
  progress: number;
  grade: number;
  drafting: boolean;
  boost: number;
  effort: number;
  clock: number;
  countdown: number;
  finished: boolean;
  bidons: number;
  gels: number;
  standing: boolean;
  /** roue à plat en cours */
  crevaison: boolean;
  /** prochain point chaud : col ou sprint */
  nextMarker: { kind: 'col' | 'sprint' | 'pave' | 'vent'; name: string; inMeters: number } | null;
  gapAhead: number | null;
  gapBehind: number | null;
  /** coureurs à placer sur la mini-carte */
  radar: RadarEntry[];
  radio: RadioMessage | null;
  /** groupes de course, façon retransmission */
  groupes: GroupeCourse[];
  /** la séquence d'arrivée se joue */
  celebration: boolean;
  /** situation de course : échappée, écart, chasse */
  course: {
    phase: string;
    tailleEchappee: number;
    ecart: number;
    joueurDevant: boolean;
    chasse: boolean;
  };
}

interface ReplaySnapshot {
  riderId: string;
  dist: number;
  lane: number;
  speed: number;
  standing: number;
  effort: number;
  celebration: number;
}
interface ReplayFrame {
  /** secondes écoulées depuis le début de l'enregistrement */
  t: number;
  riders: ReplaySnapshot[];
}

export interface RadarEntry {
  id: string;
  name: string;
  color: number;
  /** progression 0..1 sur le parcours */
  progress: number;
  /** écart en secondes (positif = devant le joueur) */
  gapSeconds: number;
  isPlayer: boolean;
  /** menace pour le classement général : 0..1 */
  threat: number;
  /** équipier du joueur */
  teammate: boolean;
  /** membre de l'échappée */
  fuyard: boolean;
}

interface PlayerConfig {
  name: string;
  stats: RiderStats;
  /** spécialités équipées pour cette étape */
  specialites?: string[];
  /** bidons supplémentaires achetés */
  bidonsBonus?: number;
  appearance: RiderAppearance;
  /** maillot distinctif porté au départ de l'étape */
  jersey: ClassementKey | null;
  /** équipe du joueur : ses coureurs le protègent */
  team: string;
  /** maillots portés (pour les conseils) */
  jerseys: ClassementKey[];
}

/** état du général avant l'étape, pour évaluer les menaces */
export interface GcSnapshot {
  /** temps cumulé par coureur ; vide au départ du tour */
  times: Record<string, number>;
  ranks: Record<string, number>;
}



/** applique un maillot distinctif par-dessus une apparence */
export function withJersey(a: RiderAppearance, key: ClassementKey | null): RiderAppearance {
  if (!key) return a;
  const o = AWARDS[key].override;
  return { ...a, ...o };
}

export class Race {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly stage: StageDef;
  readonly track: Track;

  readonly riders: Rider[] = [];
  player!: Rider;
  private ais: AIController[] = [];
  private clock = 0;
  private countdown = 3;
  private done = false;
  private results: StageResultRow[] = [];
  private virtualTimes: StageResultRow[] = [];
  private onEvent: (msg: string) => void;
  private feedZoneDone = false;

  /** angle de caméra pendant la course ; l'arrivée et le décompte gardent leur mise en scène propre */
  private static readonly CAMERA_MODES = ['chase', 'cockpit', 'tv', 'aerial'] as const;
  private cameraModeIndex = 0;
  private get cameraMode(): (typeof Race.CAMERA_MODES)[number] {
    return Race.CAMERA_MODES[this.cameraModeIndex];
  }

  /** points marqués pendant l'étape */
  private pointsMap = new Map<string, StagePoints>();
  private passedSprints = new Set<number>();
  private passedClimbs = new Set<number>();
  /** secteur de vent de côté en cours, si le joueur y est */
  private ventZoneEnCours: VentMarker | null = null;
  /** progression 0..1 à laquelle le joueur crève cette étape (-1 = pas de crevaison) */
  private crevaisonJoueurAt = -1;
  /** progression 0..1 à laquelle chaque adversaire tiré au sort crève */
  private crevaisonBots = new Map<string, number>();

  /* ---- replay de l'arrivée ---- */
  private replayFrames: ReplayFrame[] = [];
  private enregistrementActif = false;
  private replayStart = 0;
  private replayIndex = 0;
  private replayElapsed = 0;
  /** lecture en cours (false une fois la dernière image atteinte : le replay reste figé) */
  replayPlaying = false;
  private audio: AudioEngine;
  private music: MusicDirector;
  private ambiance: Ambiance = 'course';
  private dernierBip = 4;
  private clocheSonnee = false;
  /*
   * Séquence d'arrivée.
   *
   * Le jeu construit une tension pendant plusieurs minutes et la laissait
   * retomber sur un fondu vers un tableau de chiffres. La caméra vient
   * désormais se placer devant le coureur dans le dernier hectomètre, le suit
   * après la ligne, et le vainqueur lève les bras.
   */
  private phaseArrivee: 'course' | 'approche' | 'franchie' = 'course';
  private tempsArrivee = 0;
  private placeArrivee = 0;
  private ralenti = 1;
  private angleFete = 0;

  private caravane!: Caravane;
  private tactics: RaceTactics;
  private groupes: GroupeCourse[] = [];
  private timerGroupes = 0;
  private porteurJaune: string | undefined;
  private radio = new DirectorRadio();
  /** relevés servant aux badges et à l'évaluation du contrat */
  readonly suivi = {
    energieMin: 100,
    colsEnTete: 0,
    colsHcEnTete: 0,
    sprintsTop3: 0,
    aEteDansEchappee: false
  };
  private radioMsg: RadioMessage | null = null;
  private gc: GcSnapshot;
  private playerTeam: string;
  private playerJerseys: ClassementKey[];
  private teamOf = new Map<string, string>();

  private sun: THREE.DirectionalLight;
  private sky: import('./Sky').Sky;
  /** décalage du soleil par rapport au coureur ; varie avec l'heure de l'étape (Atmosphere.ts) */
  private sunOffset = new THREE.Vector3(38, 62, -30);
  private rain: Rain | null = null;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private tan = new THREE.Vector3();

  constructor(
    stage: StageDef,
    playerCfg: PlayerConfig,
    roster: RosterRider[],
    jerseys: Partial<Record<ClassementKey, string>>,
    gc: GcSnapshot,
    assets: AssetLoader,
    aspect: number,
    difficulty: Difficulty,
    quality: import('../core/Quality').QualitySettings,
    audio: { engine: AudioEngine; music: MusicDirector },
    onEvent: (msg: string) => void
  ) {
    this.stage = stage;
    this.onEvent = onEvent;
    this.gc = gc;
    this.audio = audio.engine;
    this.music = audio.music;
    // calculée une fois ici : la météo est parfois tirée au sort (voir
    // atmosphereDeEtape), il faut la même valeur pour le son d'ambiance,
    // la brume et la pluie visuelle plus bas
    const atmo = atmosphereDeEtape(stage);
    this.audio.demarrerAmbiance(atmo.pluie);
    this.playerTeam = playerCfg.team;
    this.playerJerseys = playerCfg.jerseys;
    this.porteurJaune = jerseys.general;
    for (const r of roster) this.teamOf.set(r.id, r.team);
    const regl = reglage(difficulty);
    this.track = new Track(stage, assets.scenery, quality, assets.buildings);

    // retard au général de chaque coureur : sert à savoir qui le peloton
    // laissera partir et qui il chassera
    const retards = new Map<string, number>();
    const meilleur = Math.min(...Object.values(gc.times).filter((t) => t > 0), Infinity);
    for (const [id, t] of Object.entries(gc.times)) {
      if (t > 0 && Number.isFinite(meilleur)) retards.set(id, t - meilleur);
    }
    this.tactics = new RaceTactics(this.track, stage.type, retards, regl);
    this.tactics.setEchelle(stage.displayKm, this.track.length);
    this.scene.add(this.track.group);

    // ambiance : panorama photographique si disponible, dégradé uni sinon
    const mountain = stage.type === 'montagne';
    this.sky = assets.sky;
    this.sunOffset.set(...atmo.soleilPos);
    const fogHex = brumeFinale(this.sky.fogColor(stage.type), atmo);
    const cielOk = quality.cielTexture && this.sky.apply(this.scene, stage.type, quality.environnement);
    if (!cielOk) {
      this.scene.background = new THREE.Color(mountain ? 0x9db8d6 : 0x9fd0f0);
    }
    this.scene.backgroundIntensity = (this.scene.backgroundIntensity || 1) * atmo.fondIntensite;
    if (this.scene.environmentIntensity) this.scene.environmentIntensity *= atmo.fondIntensite;
    // la brume raccorde le relief lointain à la teinte du ciel
    this.scene.fog = new THREE.Fog(fogHex, atmo.pluie ? 90 : 220, atmo.brumeLointain);
    this.scene.add(
      new THREE.HemisphereLight(atmo.hemisphereCiel, atmo.hemisphereSol, atmo.hemisphereIntensite)
    );
    const sun = new THREE.DirectionalLight(atmo.soleilCouleur, atmo.soleilIntensite);
    sun.position.set(...atmo.soleilPos);
    sun.castShadow = quality.shadows;
    // la caméra d'ombre ne couvre qu'une petite zone autour du joueur :
    // elle le suit, ce qui donne des ombres nettes sans coût mémoire
    sun.shadow.mapSize.set(quality.resolutionOmbres, quality.resolutionOmbres);
    const sc = sun.shadow.camera;
    sc.near = 1;
    sc.far = 190;
    sc.left = -26;
    sc.right = 26;
    sc.top = 26;
    sc.bottom = -26;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    if (atmo.pluie) {
      this.rain = new Rain();
      this.scene.add(this.rain.group);
    }

    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 3000);

    // quel coureur porte quel maillot
    const jerseyOf = (id: string): ClassementKey | null => {
      for (const k of ['general', 'points', 'montagne', 'jeune'] as ClassementKey[]) {
        if (jerseys[k] === id) return k;
      }
      return null;
    };

    // joueur
    // dossards : le leader du général porte le 1, les autres suivent
    /*
     * Ombres du peloton.
     *
     * Faire projeter une ombre aux dix-huit coureurs coûte 342 meshes dans la
     * passe d'ombres, pour un gain visuel faible : à l'écran on regarde son
     * propre coureur, et les ombres des autres se confondent avec le peloton.
     * En qualité réduite, seul le joueur en projette une — c'est elle qui
     * ancre le vélo sur la route.
     */
    const ombrePeloton = quality.shadows && quality.distanceOmbre >= 50;
    const optionsVisuel = { distanceLod: quality.distanceLod, ombre: ombrePeloton };
    const playerVisual = assets.createRider(
      withJersey({ ...playerCfg.appearance, dossard: gc.ranks[PLAYER_ID] ?? 11 }, playerCfg.jersey),
      { distanceLod: quality.distanceLod, ombre: quality.shadows }
    );
    this.player = new Rider({
      id: PLAYER_ID,
      name: playerCfg.name,
      color: playerCfg.appearance.jerseyPrimary,
      stats: playerCfg.stats,
      isPlayer: true,
      visual: playerVisual,
      startLane: 0
    });
    this.player.setSpecialites(playerCfg.specialites ?? []);
    this.player.bidons += playerCfg.bidonsBonus ?? 0;
    this.scene.add(playerVisual.group);
    this.riders.push(this.player);
    this.pointsMap.set(PLAYER_ID, { riderId: PLAYER_ID, points: 0, montagne: 0 });

    if (stage.type !== 'clm') {
      roster.forEach((r, i) => {
        const visual = assets.createRider(
          withJersey({ ...r.appearance, dossard: gc.ranks[r.id] ?? 20 + i }, jerseyOf(r.id)),
          optionsVisuel
        );
        const rider = new Rider({
          id: r.id,
          name: r.name,
          color: r.color,
          stats: scaleStats(r.stats, regl),
          isPlayer: false,
          visual,
          startLane: ((i % 5) - 2) * 1.4
        });
        rider.dist = -(2 + Math.floor(i / 5) * 3);
        // réserve élargie aux paliers élevés : l'IA tient l'effort plus longtemps
        rider.energieMax = regl.energie;
        rider.energy = regl.energie;
        this.scene.add(visual.group);
        this.riders.push(rider);
        this.ais.push(
          new AIController(
            rider,
            r.archetype,
            r.team === this.playerTeam ? 'equipier' : 'rival',
            regl
          )
        );
        this.pointsMap.set(r.id, { riderId: r.id, points: 0, montagne: 0 });
      });
      const meneur = (playerCfg.specialites ?? []).includes('meneur');
      for (const ai of this.ais) ai.meneur = meneur;
      AIController.setField(this.riders);
      // véhicules de course : présents dès que le peloton existe
      this.caravane = new Caravane(this.track, playerCfg.appearance.jerseyPrimary);
      this.scene.add(this.caravane.group);
      const archetypes = new Map<string, import('../data/types').Archetype>();
      for (const r of roster) archetypes.set(r.id, r.archetype);
      this.tactics.setField(this.riders, archetypes);

      /*
       * Crevaisons : au plus une pour le joueur, tirée au sort une fois pour
       * toutes au départ. Une ou deux dans le peloton, pour que la radio ait
       * de quoi parler et que le classement ne soit jamais figé.
       */
      if (Math.random() < 0.14) {
        this.crevaisonJoueurAt = 0.12 + Math.random() * 0.68;
      }
      const candidats = this.riders.filter((r) => r !== this.player);
      const nbBots = Math.random() < 0.45 ? 1 : Math.random() < 0.8 ? 2 : 0;
      for (let i = 0; i < nbBots && candidats.length; i++) {
        const idx = Math.floor(Math.random() * candidats.length);
        const r = candidats.splice(idx, 1)[0];
        this.crevaisonBots.set(r.id, 0.1 + Math.random() * 0.75);
      }
    } else {
      // contre-la-montre : adversaires en temps virtuels
      this.virtualTimes = roster.map((r) => {
        const climbFactor = this.avgGrade() > 1.5 ? r.stats.climb : r.stats.flat;
        const v =
          (11.2 +
            r.stats.flat * 0.028 +
            climbFactor * 0.018 +
            r.stats.endurance * 0.012 +
            (Math.random() - 0.5) * 0.9) *
          (0.965 + (regl.stats - 1) * 0.6 + 0.035);
        return {
          riderId: r.id,
          name: r.name,
          color: r.color,
          time: this.track.length / v,
          isPlayer: false
        };
      });
    }

    this.updateCamera(0, true);
  }

  private avgGrade(): number {
    const p = this.stage.profile;
    return ((p[p.length - 1][1] - p[0][1]) / this.track.length) * 100;
  }

  private static readonly CAMERA_LABELS: Record<(typeof Race.CAMERA_MODES)[number], string> = {
    chase: 'Caméra : poursuite',
    cockpit: 'Caméra : cintre',
    tv: 'Caméra : moto TV',
    aerial: 'Caméra : drone'
  };

  handleInput(input: Input, dt: number): void {
    if (input.changeCamera) {
      this.cameraModeIndex = (this.cameraModeIndex + 1) % Race.CAMERA_MODES.length;
      this.onEvent(Race.CAMERA_LABELS[this.cameraMode]);
    }
    const p = this.player;
    if (p.finished) return;
    if (input.accelerate) p.effort = Math.min(1, p.effort + dt * 0.9);
    if (input.brake) p.effort = Math.max(0.15, p.effort - dt * 1.2);
    p.sprinting = input.sprint && p.energy > 2;
    if (input.left) p.targetLane = Math.max(-3.2, p.targetLane - dt * 6);
    if (input.right) p.targetLane = Math.min(3.2, p.targetLane + dt * 6);

    if (input.drinkBidon) {
      if (p.drinkBidon()) {
        this.onEvent(`Bidon bu — reste ${p.bidons}`);
        this.audio.gorgee();
      } else this.onEvent(p.bidons <= 0 ? 'Plus de bidons !' : 'Énergie déjà pleine');
    }
    if (input.eatGel) {
      if (p.eatGel()) {
        this.onEvent(`Gel avalé — reste ${p.gels}`);
        this.audio.sachet();
      } else this.onEvent(p.gels <= 0 ? 'Plus de gels !' : 'Énergie déjà pleine');
    }
  }

  /** vrai tant que la séquence d'arrivée se joue */
  get enCelebration(): boolean {
    return this.phaseArrivee === 'franchie' && this.tempsArrivee < 5.2;
  }

  update(dtBrut: number): void {
    /*
     * Ralenti au photo-finish. Quand la ligne se joue à moins d'une
     * demi-seconde, le temps s'étire : c'est le moment que l'on veut voir.
     */
    const dt = this.phaseArrivee === 'course' ? dtBrut : dtBrut * this.ralenti;
    // le ciel dérive aussi pendant le décompte
    this.sky.update(dt);
    this.track.animer(dt);
    if (this.countdown > 0) {
      const avant = Math.ceil(this.countdown);
      this.countdown -= dt;
      const apres = Math.ceil(this.countdown);
      if (apres !== avant && apres < this.dernierBip) {
        this.dernierBip = apres;
        this.audio.bip(apres <= 0);
      }
      this.updateCamera(dt, false);
      this.rain?.update(dt, this.tmp);
      return;
    }
    this.clock += dt;

    this.tactics.update(dt, this.clock, this.player);
    this.suivi.energieMin = Math.min(this.suivi.energieMin, this.player.energy);
    if (this.tactics.état.joueurDevant) this.suivi.aEteDansEchappee = true;
    this.player.finalProche = this.track.length - this.player.dist < 400;
    const progression = Math.min(1, this.player.dist / this.track.length);
    for (const ai of this.ais) {
      ai.update(dt, this.track, this.player, this.tactics.ordre(ai.coureur, progression, this.clock));
    }
    for (const r of this.riders) r.updatePhysics(dt, this.track, this.riders);

    this.checkMarkers();
    this.majBordures();
    this.majIncidents();
    this.majEnregistrementArrivee();

    // ravitaillement
    if (
      !this.feedZoneDone &&
      this.track.feedZoneDist > 0 &&
      this.player.dist >= this.track.feedZoneDist
    ) {
      this.feedZoneDone = true;
      // la zone de ravitaillement profite à tout le monde, pas au seul joueur
      for (const r of this.riders) r.refuel();
      this.onEvent('Ravitaillement : bidons refaits, +1 gel');
    }

    for (const r of this.riders) {
      if (!r.finished && r.dist >= this.track.length) {
        r.finished = true;
        r.finishTime = this.clock;
      }
    }

    if (this.player.finished && !this.done && !this.enCelebration) {
      const allDone = this.riders.every((r) => r.finished);
      if (allDone || this.clock - this.player.finishTime > 2.2) {
        this.finalize();
      }
    }

    /*
     * Les groupes ne sont recalculés que trois fois par seconde. Le tri de
     * tout le peloton à chaque image serait du gaspillage, et un bandeau qui
     * se réorganise soixante fois par seconde clignoterait.
     */
    this.timerGroupes -= dt;
    if (this.timerGroupes <= 0) {
      this.timerGroupes = 0.33;
      this.groupes = calculerGroupes(
        this.riders,
        this.track,
        this.stage,
        this.player,
        this.porteurJaune,
        this.tactics.echelleTemps
      );
    }

    this.radioMsg = this.radio.update(this.clock, this.buildRadioContext());
    this.majAudio(dt);
    this.majArrivee(dtBrut);
    this.caravane?.update(dt, this.riders, this.player);

    this.updateCamera(dt, false);
    this.rain?.update(dt, this.tmp);
  }

  /**
   * Ambiance sonore et musique adaptative.
   *
   * La musique change d'ambiance selon la situation : suspense dans les cols
   * et quand un rival dangereux attaque, thème de finale dans le dernier
   * kilomètre. L'intensité, elle, varie en continu avec l'effort et la
   * proximité des adversaires, ce qui fait respirer le morceau sans coupure.
   */
  private majAudio(dt: number): void {
    void dt;
    const p = this.player;
    const restant = this.track.length - p.dist;

    // proximité de la foule : barrières à l'arrivée, aux cols et aux sprints
    let foule = 0;
    if (restant < 420) foule = 1 - restant / 420;
    for (const c of this.track.climbs) {
      const d = Math.abs(c.dist - p.dist);
      if (d < 260) foule = Math.max(foule, (1 - d / 260) * 0.85);
    }
    for (const sp of this.track.sprints) {
      const d = Math.abs(sp.dist - p.dist);
      if (d < 180) foule = Math.max(foule, (1 - d / 180) * 0.7);
    }
    this.audio.majAmbiance(p.speed, foule, p.effort);

    // cloche du dernier kilomètre
    if (!this.clocheSonnee && restant < 900) {
      this.clocheSonnee = true;
      this.audio.cloche();
    }

    // choix de l'ambiance musicale
    const pente = this.track.gradeAt(p.dist);
    const menace = this.riders.some((r) => {
      if (r.isPlayer) return false;
      const ecart = Math.abs(r.dist - p.dist);
      return ecart < 60 && this.threatOf(r.id).threat > 0.7;
    });
    let voulue: Ambiance = 'course';
    if (restant < 1000) voulue = 'finale';
    else if (pente > 5 || menace) voulue = 'tension';
    if (voulue !== this.ambiance) {
      this.ambiance = voulue;
      this.music.jouer(voulue);
    }

    // intensité continue : effort, énergie basse, adversaires proches
    const proches = this.riders.filter(
      (r) => !r.isPlayer && Math.abs(r.dist - p.dist) < 25
    ).length;
    const intensite =
      0.25 +
      p.effort * 0.4 +
      Math.min(0.2, proches * 0.05) +
      (p.energy < 25 ? 0.15 : 0) +
      (restant < 400 ? 0.2 : 0);
    this.music.setIntensite(Math.min(1, intensite));
  }

  private majArrivee(dt: number): void {
    const p = this.player;
    const restant = this.track.length - p.dist;

    if (this.phaseArrivee === 'course' && restant < 110) {
      this.phaseArrivee = 'approche';
      // écart avec le coureur le plus proche : décide du ralenti
      let plusProche = Infinity;
      for (const r of this.riders) {
        if (r === p || r.finished) continue;
        plusProche = Math.min(plusProche, Math.abs(r.dist - p.dist));
      }
      this.ralenti = plusProche < 9 ? 0.42 : 1;
    }

    if (this.phaseArrivee !== 'franchie' && p.finished) {
      this.phaseArrivee = 'franchie';
      this.tempsArrivee = 0;
      this.ralenti = 1;
      this.placeArrivee = this.riders.filter((r) => r.finished && r.finishTime < p.finishTime).length + 1;
      this.audio.acclamation(this.placeArrivee === 1 ? 1 : 0.55);
      this.music.jouer(this.placeArrivee === 1 ? 'victoire' : 'menu');
      this.onEvent(
        this.placeArrivee === 1
          ? "Victoire d'étape !"
          : `${this.placeArrivee}${this.placeArrivee === 2 ? 'e' : 'e'} sur la ligne`
      );
    }

    if (this.phaseArrivee === 'franchie') {
      this.tempsArrivee += dt;
      // le vainqueur lève les bras, les autres se relèvent simplement
      const cible = this.placeArrivee === 1 ? 1 : this.placeArrivee <= 3 ? 0.35 : 0;
      p.celebration += (cible - p.celebration) * Math.min(1, dt * 2.6);
      p.sprinting = false;
      p.effort = Math.max(0.2, p.effort - dt * 0.5);
      this.angleFete += dt * 0.55;
      if (this.tempsArrivee > 1.1 && this.tempsArrivee - dt <= 1.1 && this.placeArrivee === 1) {
        this.audio.acclamation(0.85);
      }
    }
  }

  /** vitesse moyenne approchée, pour convertir les distances en secondes */
  private refSpeed(): number {
    return Math.max(6, this.player.speed);
  }

  /** menace d'un rival pour le classement général du joueur */
  private threatOf(id: string): { threat: number; gcGap: number; rank: number } {
    const mine = this.gc.times[PLAYER_ID];
    const his = this.gc.times[id];
    const rank = this.gc.ranks[id] ?? 99;
    if (mine === undefined || his === undefined || mine === 0 || his === 0) {
      // début de tour : la menace se juge sur la place dans l'étape
      return { threat: 0.5, gcGap: 0, rank };
    }
    const gcGap = his - mine; // > 0 : il est derrière moi au général
    const absGap = Math.abs(gcGap);
    // menace forte si l'écart au général est faible (il peut me passer)
    let threat = absGap < 30 ? 1 : absGap < 90 ? 0.8 : absGap < 180 ? 0.5 : absGap < 420 ? 0.2 : 0.05;
    if (rank <= 5) threat = Math.min(1, threat + 0.15);
    return { threat, gcGap, rank };
  }

  private buildRadioContext() {
    const p = this.player;
    const v = this.refSpeed();
    const rivals: RivalInfo[] = this.riders
      .filter((r) => !r.isPlayer)
      .map((r) => {
        const t = this.threatOf(r.id);
        return {
          id: r.id,
          name: r.name,
          gapSeconds: (r.dist - p.dist) / v,
          gcRank: t.rank,
          gcGapToPlayer: t.gcGap,
          threat: t.threat
        };
      })
      .sort((a, b) => b.gapSeconds - a.gapSeconds);

    const h = this.hudBase();
    let nextClimb = null as { name: string; inMeters: number; category: number; avgGrade: number } | null;
    let best = Infinity;
    for (const c of this.track.climbs) {
      const d = c.dist - p.dist;
      if (d > 0 && d < best) {
        best = d;
        nextClimb = {
          name: c.name,
          inMeters: d,
          category: c.category,
          avgGrade: this.track.gradeAt(c.dist - 150)
        };
      }
    }
    let nextSprint = null as { name: string; inMeters: number } | null;
    let bs = Infinity;
    for (const sp of this.track.sprints) {
      const d = sp.dist - p.dist;
      if (d > 0 && d < bs) {
        bs = d;
        nextSprint = { name: sp.name, inMeters: d };
      }
    }
    let nextVent = null as { name: string; inMeters: number } | null;
    let bv = Infinity;
    for (const z of this.track.ventZones) {
      const d = z.from - p.dist;
      if (d > 0 && d < bv) {
        bv = d;
        nextVent = { name: z.name, inMeters: d };
      }
    }

    return {
      remaining: Math.max(0, this.track.length - p.dist),
      totalLength: this.track.length,
      grade: this.track.gradeAt(p.dist),
      energy: p.energy,
      drafting: p.drafting,
      position: h.position,
      fieldSize: this.riders.length,
      gapAhead: h.gapAheadMeters,
      gapBehind: h.gapBehindMeters === null ? null : h.gapBehindMeters / v,
      rivals,
      nextClimb,
      nextSprint,
      nextVent,
      bordures: this.ventZoneEnCours ? { abrite: p.abrite } : null,
      crevaison: p.crevaisonTimer > 0 ? { relance: false } : p.relanceTimer > 0 ? { relance: true } : null,
      jerseys: this.playerJerseys,
      stageType: this.stage.type,
      course: {
        phase: this.tactics.état.phase,
        tailleEchappee: this.tactics.tailleEchappee,
        ecart: this.tactics.état.ecartAffiche,
        joueurDevant: this.tactics.état.joueurDevant,
        chasse: this.tactics.état.chasse
      }
    };
  }

  private hudBase(): {
    position: number;
    gapAheadMeters: number | null;
    gapBehindMeters: number | null;
  } {
    const p = this.player;
    const ahead = this.riders.filter((r) => r !== p && r.dist > p.dist);
    const behind = this.riders.filter((r) => r !== p && r.dist < p.dist);
    return {
      position: ahead.length + 1,
      gapAheadMeters: ahead.length ? Math.min(...ahead.map((r) => r.dist)) - p.dist : null,
      gapBehindMeters: behind.length ? p.dist - Math.max(...behind.map((r) => r.dist)) : null
    };
  }

  /** attribution des points aux sprints intermédiaires et sommets de cols */
  private checkMarkers(): void {
    const order = [...this.riders].sort((a, b) => b.dist - a.dist);

    this.track.sprints.forEach((s, i) => {
      if (this.passedSprints.has(i)) return;
      if (order[0].dist < s.dist) return;
      this.passedSprints.add(i);
      order.slice(0, SPRINT_POINTS.length).forEach((r, k) => {
        const e = this.pointsMap.get(r.id);
        if (e) e.points += SPRINT_POINTS[k];
        if (r.isPlayer) {
          this.onEvent(`Sprint ${s.name} : ${k + 1}e, +${SPRINT_POINTS[k]} pts`);
          this.audio.acclamation(k === 0 ? 1 : 0.6);
          if (k < 3) this.suivi.sprintsTop3 += 1;
        }
      });
    });

    this.track.climbs.forEach((c, i) => {
      if (this.passedClimbs.has(i)) return;
      if (order[0].dist < c.dist) return;
      this.passedClimbs.add(i);
      const table = KOM_POINTS[c.category];
      order.slice(0, table.length).forEach((r, k) => {
        const e = this.pointsMap.get(r.id);
        if (e) e.montagne += table[k];
        if (r.isPlayer) {
          this.onEvent(`${c.name} : ${k + 1}e au sommet, +${table[k]} pts montagne`);
          this.audio.acclamation(k === 0 ? 1 : 0.6);
          if (k === 0) {
            this.suivi.colsEnTete += 1;
            if (c.category === 0) this.suivi.colsHcEnTete += 1;
          }
        }
      });
    });
  }

  /**
   * Bordures : à l'entrée d'un secteur exposé au vent de côté, le peloton se
   * scinde d'un coup. Chacun est réparti dans un groupe selon son profil
   * (les rouleurs se placent mieux) — sauf le joueur, dont la place dépend de
   * sa réaction au moment précis où ça casse : s'il pousse déjà fort, il
   * suit le groupe de tête ; sinon il reste dans le vent, sans personne pour
   * l'abriter, et le paie jusqu'à la fin du secteur.
   */
  private majBordures(): void {
    const p = this.player;
    const zone = this.track.ventZones.find((z) => p.dist >= z.from && p.dist <= z.to) ?? null;
    if (zone && zone !== this.ventZoneEnCours) {
      this.ventZoneEnCours = zone;
      for (const r of this.riders) {
        if (r === p || r.finished || this.tactics.état.echappee.includes(r.id)) continue;
        const facteur = (r.stats.flat - 55) / 220;
        const chance = Math.min(0.78, Math.max(0.22, 0.5 + facteur));
        r.abrite = Math.random() < chance;
      }
      p.abrite = p.effort > 0.72 || p.boostTimer > 0 || p.standing > 0.5;
      this.onEvent(
        p.abrite ? 'Bordures ! Tu es bien placé, devant.' : 'Bordures ! Tu restes dans le vent.'
      );
    } else if (!zone && this.ventZoneEnCours) {
      this.ventZoneEnCours = null;
      for (const r of this.riders) r.abrite = true;
    }
  }

  /**
   * Incidents mécaniques : crevaisons tirées au sort au départ, déclenchées
   * quand le coureur concerné atteint la progression fixée. Roue à plat,
   * plus d'abri, puis une fenêtre de relance une fois la roue changée.
   */
  private majIncidents(): void {
    if (this.stage.type === 'clm') return;
    const p = this.player;
    const progression = Math.min(1, p.dist / this.track.length);
    if (this.crevaisonJoueurAt > 0 && !p.crevaisonSubie && progression >= this.crevaisonJoueurAt) {
      p.crevaisonSubie = true;
      p.crevaisonTimer = 5 + Math.random() * 2.5;
      this.audio.derailleur();
      this.onEvent('Crevaison ! Roue à changer.');
    }
    for (const [id, at] of this.crevaisonBots) {
      const r = this.riders.find((x) => x.id === id);
      if (!r || r.finished || r.crevaisonSubie) continue;
      const rp = Math.min(1, r.dist / this.track.length);
      if (rp >= at) {
        r.crevaisonSubie = true;
        r.crevaisonTimer = 5 + Math.random() * 2.5;
        // annoncé seulement si le rival crève sous les yeux du joueur
        if (Math.abs(r.dist - p.dist) < 40) this.onEvent(`${r.name} a crevé !`);
      }
    }
  }

  /**
   * Enregistrement de l'arrivée : dès que la tête de course entre dans les
   * derniers 220 mètres, chaque image est capturée (position, allure,
   * danseuse, célébration de chaque coureur) pour permettre de la rejouer
   * ensuite. Pas de contre-la-montre : les coureurs n'y sont jamais groupés.
   */
  private majEnregistrementArrivee(): void {
    if (this.stage.type === 'clm') return;
    if (this.replayFrames.length > 900) return; // filet de sécurité (~15 s à 60 im/s)
    let lead = -Infinity;
    for (const r of this.riders) lead = Math.max(lead, r.dist);
    if (!this.enregistrementActif) {
      if (this.track.length - lead > 220) return;
      this.enregistrementActif = true;
      this.replayStart = this.clock;
    }
    this.replayFrames.push({
      t: this.clock - this.replayStart,
      riders: this.riders.map((r) => ({
        riderId: r.id,
        dist: r.dist,
        lane: r.lane,
        speed: r.speed,
        standing: r.standing,
        effort: r.effort,
        celebration: r.celebration
      }))
    });
  }

  /** assez d'images enregistrées pour proposer de revoir l'arrivée */
  get hasReplay(): boolean {
    return this.replayFrames.length > 5;
  }

  /** relance la lecture depuis le début de l'enregistrement */
  startReplay(): void {
    this.replayElapsed = 0;
    this.replayIndex = 0;
    this.replayPlaying = true;
  }

  /** avance la lecture du replay : repositionne chaque coureur sans repasser par la physique */
  updateReplay(dtBrut: number): void {
    if (!this.replayFrames.length) return;
    const VITESSE = 0.42; // ralenti cinématique
    const dt = dtBrut * VITESSE;
    if (this.replayPlaying) {
      this.replayElapsed += dt;
      const dernier = this.replayFrames[this.replayFrames.length - 1].t;
      if (this.replayElapsed >= dernier) {
        this.replayElapsed = dernier;
        this.replayPlaying = false;
      }
      while (
        this.replayIndex < this.replayFrames.length - 1 &&
        this.replayFrames[this.replayIndex + 1].t <= this.replayElapsed
      ) {
        this.replayIndex++;
      }
    }
    const frame = this.replayFrames[this.replayIndex];
    for (const snap of frame.riders) {
      const r = this.riders.find((x) => x.id === snap.riderId);
      if (!r) continue;
      r.dist = snap.dist;
      r.lane = snap.lane;
      r.speed = snap.speed;
      r.standing = snap.standing;
      r.effort = snap.effort;
      r.celebration = snap.celebration;
      r.updateVisual(dt, this.track);
    }
    this.track.animer(dt);
    this.updateReplayCamera(frame);
  }

  /** caméra façon moto de retransmission : suit la tête de course jusqu'à la ligne et au-delà */
  private updateReplayCamera(frame: ReplayFrame): void {
    let lead = -Infinity;
    for (const s of frame.riders) lead = Math.max(lead, s.dist);
    this.track.pose(lead, 0, this.tmp, this.tan);
    const perp = new THREE.Vector3(-this.tan.z, 0, this.tan.x).normalize();
    const cible = this.tmp
      .clone()
      .add(perp.multiplyScalar(7.5))
      .add(this.tan.clone().multiplyScalar(-1.5))
      .add(new THREE.Vector3(0, 2.1, 0));
    const regard = this.tmp.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.camPos.lerp(cible, 0.18);
    this.camLook.lerp(regard, 0.18);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.track.updateDistant(this.tmp, this.tan);
    this.sun.target.position.copy(this.tmp);
    this.sun.target.updateMatrixWorld();
    this.sun.position.set(this.tmp.x + this.sunOffset.x, this.tmp.y + this.sunOffset.y, this.tmp.z + this.sunOffset.z);
  }

  private finalize(): void {
    this.done = true;
    const rows: StageResultRow[] = this.riders.map((r) => ({
      riderId: r.id,
      name: r.name,
      color: r.color,
      time: r.finished
        ? r.finishTime
        : this.clock + (this.track.length - r.dist) / Math.max(4, r.speed),
      isPlayer: r.isPlayer
    }));
    rows.push(...this.virtualTimes);
    rows.sort((a, b) => a.time - b.time);
    this.results = rows;

    // points de l'arrivée
    const table = FINISH_POINTS[this.stage.type] ?? FINISH_POINTS.plaine;
    rows.slice(0, table.length).forEach((r, i) => {
      const e = this.pointsMap.get(r.riderId);
      if (e) e.points += table[i];
      else this.pointsMap.set(r.riderId, { riderId: r.riderId, points: table[i], montagne: 0 });
    });
  }

  get isOver(): boolean {
    return this.done;
  }

  getResults(): StageResultRow[] {
    return this.results;
  }

  getPoints(): StagePoints[] {
    return [...this.pointsMap.values()];
  }

  /** état tactique : échappée, écart, chasse */
  get etatCourse(): EtatCourse {
    return this.tactics.état;
  }

  hudState(): RaceHudState {
    const p = this.player;
    const ahead = this.riders.filter((r) => r !== p && r.dist > p.dist);
    const behind = this.riders.filter((r) => r !== p && r.dist < p.dist);
    const remaining = Math.max(0, this.track.length - p.dist);

    let nextMarker: RaceHudState['nextMarker'] = null;
    let best = Infinity;
    for (const c of this.track.climbs) {
      const d = c.dist - p.dist;
      if (d > 0 && d < best) {
        best = d;
        nextMarker = { kind: 'col', name: c.name, inMeters: d };
      }
    }
    for (const s of this.track.sprints) {
      const d = s.dist - p.dist;
      if (d > 0 && d < best) {
        best = d;
        nextMarker = { kind: 'sprint', name: s.name, inMeters: d };
      }
    }
    for (const z of this.track.paveZones) {
      const d = z.from - p.dist;
      if (d > 0 && d < best) {
        best = d;
        nextMarker = { kind: 'pave', name: z.name, inMeters: d };
      }
    }
    for (const z of this.track.ventZones) {
      const d = z.from - p.dist;
      if (d > 0 && d < best) {
        best = d;
        nextMarker = { kind: 'vent', name: z.name, inMeters: d };
      }
    }

    const nearestAhead = ahead.length
      ? Math.min(...ahead.map((r) => r.dist)) - p.dist
      : null;
    const nearestBehind = behind.length
      ? p.dist - Math.max(...behind.map((r) => r.dist))
      : null;

    return {
      energy: p.energy,
      speedKmh: p.speed * 3.6,
      position: ahead.length + 1,
      fieldSize: this.stage.type === 'clm' ? 1 : this.riders.length,
      remainingKm: (remaining / this.track.length) * this.stage.displayKm,
      progress: Math.min(1, p.dist / this.track.length),
      grade: this.track.gradeAt(p.dist),
      drafting: p.drafting,
      boost: p.boostTimer,
      effort: p.effort,
      clock: this.clock,
      countdown: this.countdown,
      finished: p.finished,
      bidons: p.bidons,
      gels: p.gels,
      standing: p.standing > 0.5,
      crevaison: p.crevaisonTimer > 0,
      nextMarker,
      gapAhead: nearestAhead,
      gapBehind: nearestBehind,
      radar: this.buildRadar(),
      radio: this.radioMsg,
      groupes: this.groupes,
      celebration: this.phaseArrivee === 'franchie',
      course: {
        phase: this.tactics.état.phase,
        tailleEchappee: this.tactics.tailleEchappee,
        ecart: this.tactics.état.ecartAffiche,
        joueurDevant: this.tactics.état.joueurDevant,
        chasse: this.tactics.état.chasse
      }
    };
  }

  /** coureurs à afficher sur la mini-carte, les plus pertinents d'abord */
  private buildRadar(): RadarEntry[] {
    const p = this.player;
    const v = this.refSpeed();
    const list: RadarEntry[] = this.riders.map((r) => {
      const t = r.isPlayer ? { threat: 0, gcGap: 0, rank: 0 } : this.threatOf(r.id);
      return {
        id: r.id,
        name: r.name,
        color: r.color,
        progress: Math.min(1, r.dist / this.track.length),
        gapSeconds: (r.dist - p.dist) / v,
        isPlayer: r.isPlayer,
        threat: t.threat,
        teammate: !r.isPlayer && this.teamOf.get(r.id) === this.playerTeam,
        fuyard: r.isPlayer
          ? this.tactics.état.joueurDevant
          : this.tactics.état.echappee.includes(r.id)
      };
    });
    return list.sort((a, b) => b.progress - a.progress);
  }

  private updateCamera(dt: number, snap: boolean): void {
    const p = this.player;

    /*
     * Caméra de départ. Le peloton est immobile et bunché sur la grille,
     * certains coureurs à peine plus loin que les 7 unités où se placerait
     * la caméra de course habituelle : à l'arrêt, elle se retrouvait au
     * milieu d'un maillot au lieu de rouler dessus. Le décompte affiche donc
     * un plan d'ensemble surélevé et reculé, qui dégage tout le monde, avant
     * de glisser vers la caméra de course au top départ.
     */
    if (this.countdown > 0) {
      this.track.pose(p.dist, p.lane, this.tmp, this.tan);
      const arriere = this.tan.clone().multiplyScalar(-16);
      const cible = this.tmp.clone().add(arriere).add(new THREE.Vector3(0, 7.5, 0));
      const regard = this.tmp.clone().add(new THREE.Vector3(0, 1.2, 0));
      if (snap) {
        this.camPos.copy(cible);
        this.camLook.copy(regard);
      } else {
        const k = Math.min(1, dt * 2.2);
        this.camPos.lerp(cible, k);
        this.camLook.lerp(regard, k);
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.track.updateDistant(this.tmp, this.tan);
      this.sun.target.position.copy(this.tmp);
      this.sun.target.updateMatrixWorld();
      this.sun.position.set(this.tmp.x + this.sunOffset.x, this.tmp.y + this.sunOffset.y, this.tmp.z + this.sunOffset.z);
      return;
    }

    /*
     * Caméra d'arrivée. Dans le dernier hectomètre elle glisse en avant du
     * coureur, de trois quarts face ; après la ligne elle tourne lentement
     * autour de lui. Le reste du temps, la vue de course habituelle.
     */
    if (this.phaseArrivee !== 'course') {
      /*
       * La caméra se place en avant du coureur et le regarde revenir vers
       * elle. Elle suit sa position réelle : la borner à la ligne d'arrivée
       * la laissait sur place pendant que le coureur poursuivait dans le
       * dégagement, et on finissait par le perdre de vue.
       */
      this.track.pose(p.dist, p.lane, this.tmp, this.tan);
      const avance = this.phaseArrivee === 'franchie' ? 11 : 14;
      const lateral = this.tan.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      const tourne = this.phaseArrivee === 'franchie' ? Math.sin(this.angleFete) * 3.2 : 2.6;
      const cible = this.tmp
        .clone()
        .add(this.tan.clone().multiplyScalar(avance))
        .add(lateral.multiplyScalar(tourne))
        .add(new THREE.Vector3(0, this.phaseArrivee === 'franchie' ? 2.4 : 2.6, 0));
      const regard = this.tmp.clone().add(new THREE.Vector3(0, 1.3, 0));
      const k = Math.min(1, dt * (this.phaseArrivee === 'franchie' ? 1.8 : 2.6));
      this.camPos.lerp(cible, k);
      // le point visé rattrape plus vite que la caméra : sinon, pendant que
      // celle-ci glisse sur le côté, le regard traîne et le coureur se
      // retrouve poussé au bord de l'image
      this.camLook.lerp(regard, Math.min(1, dt * 5));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.track.updateDistant(this.tmp, this.tan);
      this.sun.target.position.copy(this.tmp);
      this.sun.target.updateMatrixWorld();
      this.sun.position.set(this.tmp.x + this.sunOffset.x, this.tmp.y + this.sunOffset.y, this.tmp.z + this.sunOffset.z);
      return;
    }

    const d = Math.max(0, Math.min(p.dist, this.track.length));
    this.track.pose(d, p.lane, this.tmp, this.tan);
    const perp = new THREE.Vector3(-this.tan.z, 0, this.tan.x).normalize();

    /*
     * Quatre angles, cyclés à la touche C. L'arrivée et le décompte gardent
     * leur propre mise en scène (branches précédentes) : ceci ne s'applique
     * qu'au roulage normal.
     */
    let target: THREE.Vector3;
    let look: THREE.Vector3;
    let vitesseSuivi: number;
    switch (this.cameraMode) {
      case 'cockpit':
        // depuis le cintre : bas, collé au coureur, regard loin devant
        target = this.tmp
          .clone()
          .add(this.tan.clone().multiplyScalar(1.15))
          .add(new THREE.Vector3(0, 1.42 - p.standing * 0.1, 0));
        look = this.tmp
          .clone()
          .add(this.tan.clone().multiplyScalar(40))
          .add(new THREE.Vector3(0, 1.2, 0));
        vitesseSuivi = 9;
        break;
      case 'tv':
        // moto de retransmission calée sur le flanc, comme à la télévision
        target = this.tmp
          .clone()
          .add(perp.clone().multiplyScalar(7.5))
          .add(this.tan.clone().multiplyScalar(-1.5))
          .add(new THREE.Vector3(0, 2.1, 0));
        look = this.tmp.clone().add(new THREE.Vector3(0, 1.2, 0));
        vitesseSuivi = 3;
        break;
      case 'aerial':
        // drone : haut et reculé, pour juger le peloton et le tracé
        target = this.tmp
          .clone()
          .add(this.tan.clone().multiplyScalar(-(22 + p.speed * 0.12)))
          .add(new THREE.Vector3(0, 16, 0));
        look = this.tmp
          .clone()
          .add(this.tan.clone().multiplyScalar(14))
          .add(new THREE.Vector3(0, 1, 0));
        vitesseSuivi = 2.2;
        break;
      default:
        // poursuite : la caméra recule et s'abaisse légèrement avec la vitesse
        target = this.tmp
          .clone()
          .add(this.tan.clone().multiplyScalar(-(7.0 + p.speed * 0.11)))
          .add(new THREE.Vector3(0, 2.9 + p.standing * 0.18, 0));
        look = this.tmp
          .clone()
          .add(this.tan.clone().multiplyScalar(10))
          .add(new THREE.Vector3(0, 1.15, 0));
        vitesseSuivi = 3.5;
    }
    if (snap) {
      this.camPos.copy(target);
      this.camLook.copy(look);
    } else {
      const k = Math.min(1, dt * vitesseSuivi);
      this.camPos.lerp(target, k);
      this.camLook.lerp(look, k);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // secousses de caméra sur les pavés : petites vibrations haute fréquence
    if (this.track.isPave(d)) {
      const t = this.clock * 42;
      const amp = Math.min(0.05, 0.014 + p.speed * 0.0011);
      this.camera.position.x += Math.sin(t) * amp;
      this.camera.position.y += Math.sin(t * 1.7 + 1.3) * amp * 0.6;
    }

    // les sommets lointains suivent le coureur : sans cela il les traverserait
    this.track.updateDistant(this.tmp, this.tan);

    // recentrer la zone d'ombre sur le coureur
    this.sun.target.position.copy(this.tmp);
    this.sun.target.updateMatrixWorld();
    this.sun.position.set(this.tmp.x + this.sunOffset.x, this.tmp.y + this.sunOffset.y, this.tmp.z + this.sunOffset.z);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.caravane?.dispose();
    this.audio.arreterAmbiance();
    this.sky.detach();
    this.radio.reset();
    this.track.dispose();
    this.rain?.dispose();
    for (const r of this.riders) r.visual.dispose();
  }
}
