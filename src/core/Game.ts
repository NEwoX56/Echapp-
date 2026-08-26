import * as THREE from 'three';
import { Career } from '../career/Career';
import { AssetLoader } from './AssetLoader';
import { Input } from './Input';
import { AudioEngine } from '../audio/AudioEngine';
import { MusicDirector } from '../audio/MusicDirector';
import {
  entrerFullscreen,
  basculerFullscreen,
  fullscreenActif,
  fullscreenDisponible,
  surChangementFullscreen
} from './Fullscreen';
import {
  detectCapabilities,
  resolveQuality,
  antialiasSouhaite,
  type Capabilities,
  type QualitySettings
} from './Quality';
import { Race, type OptionsLibre } from '../race/Race';
import { Menu } from '../ui/Menu';
import { GamepadNav } from '../ui/GamepadNav';
import { NameTags } from '../ui/NameTags';
import { BriefingEtape } from '../ui/BriefingEtape';
import { SyncAccount } from './SyncAccount';
import { appliquerForme } from '../data/progression';
import { HUD } from '../ui/HUD';
import { Results } from '../ui/Results';
import { getRoster } from '../data/rosterStore';
import { toast, formatGap } from '../ui/util';
import { PostFX } from './PostFX';
import type { StageDef } from '../data/types';
import { Atelier } from '../ui/Atelier';
import { creations, nouvelId } from '../data/creations';

type GameState = 'menu' | 'briefing' | 'race' | 'results' | 'replay';

export class Game {
  private renderer: THREE.WebGLRenderer;
  readonly input = new Input();
  private assets = new AssetLoader();
  private career = new Career();

  private state: GameState = 'menu';
  private race: Race | null = null;
  /** séance libre de l'onglet Test : aucun résultat n'est appliqué à la carrière */
  private modeLibre = false;
  /** réglages de la séance libre en cours */
  private optionsLibre: OptionsLibre | null = null;
  /** étapes restant à enchaîner dans un tour créé */
  private serieLibre: StageDef[] = [];
  /** des objets ont été posés depuis le dernier enregistrement */
  private atelierModifie = false;
  /** création en cours d'édition : c'est elle que « Enregistrer » met à jour */
  private creationEnCours: StageDef | null = null;
  private atelier!: Atelier;

  private menuEl = document.getElementById('screen-menu')!;
  private hudEl = document.getElementById('screen-hud')!;
  private resultsEl = document.getElementById('screen-results')!;
  private replayEl = document.getElementById('screen-replay')!;
  private briefingEl = document.getElementById('screen-briefing')!;
  private canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  private menu: Menu;
  private hud: HUD;
  private results: Results;

  private lastT = 0;
  readonly audio = new AudioEngine();
  readonly music = new MusicDirector(this.audio);
  navMenu!: GamepadNav;
  private navBriefing!: GamepadNav;
  private nameTags!: NameTags;
  private briefing!: BriefingEtape;
  private stagePrete: StageDef | null = null;
  sync!: SyncAccount;
  private navResultats!: GamepadNav;
  private caps!: Capabilities;
  private quality!: QualitySettings;
  /** compteur d'échecs de rendu consécutifs, pour dégrader automatiquement */
  private renderFails = 0;
  private degraded = false;
  /** bloom + vignette, seulement en qualité élevée (voir Quality.ts) */
  private postfx: PostFX | null = null;

  /** applique les réglages de qualité au renderer */
  private applyQuality(): void {
    const q = this.quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatioMax));
    this.renderer.shadowMap.enabled = q.shadows;
    // les ombres douces coûtent plusieurs échantillons par pixel : on ne les
    // garde qu'en qualité élevée, le filtrage simple suffit ailleurs
    this.renderer.shadowMap.type =
      q.resolutionOmbres >= 1024 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // la carte d'ombres n'a pas besoin d'être recalculée à chaque image
    this.renderer.shadowMap.autoUpdate = q.intervalleOmbre <= 1;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (q.postProcessing && !this.postfx) {
      try {
        this.postfx = new PostFX(this.renderer, window.innerWidth, window.innerHeight);
      } catch {
        this.postfx = null; // composer indisponible sur cette plateforme : rendu direct
      }
    } else if (!q.postProcessing && this.postfx) {
      this.postfx.dispose();
      this.postfx = null;
    }
    this.resize();
  }

  get qualitySettings(): QualitySettings {
    return this.quality;
  }
  get capabilities(): Capabilities {
    return this.caps;
  }

  /** recalcule la qualité après un changement de préférence */
  refreshQuality(): void {
    this.quality = resolveQuality(this.career.save.quality ?? 'auto', this.caps);
    this.degraded = false;
    this.renderFails = 0;
    this.applyQuality();
  }

  constructor() {
    // l'antialiasing se fixe ici et n'est plus modifiable ensuite : on décide
    // donc avant même d'avoir un contexte, à partir de la plateforme
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: antialiasSouhaite(this.career.save.quality ?? 'auto'),
      powerPreference: 'high-performance',
      // le tampon de profondeur suffit en 16 bits pour une scène de cette
      // profondeur, et allège la bande passante mémoire
      stencil: false
    });
    this.caps = detectCapabilities(this.renderer);
    this.quality = resolveQuality(this.career.save.quality ?? 'auto', this.caps);
    this.applyQuality();

    // si le contexte WebGL est perdu (mémoire vidéo saturée sur console ou
    // mobile), on le signale et on rétablit le rendu au lieu de laisser un
    // écran blanc muet
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      toast('Rendu interrompu, récupération en cours…');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.applyQuality();
      toast('Rendu rétabli');
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.navMenu = new GamepadNav(this.menuEl);
    this.navResultats = new GamepadNav(this.resultsEl);
    this.navBriefing = new GamepadNav(this.briefingEl);
    this.sync = new SyncAccount(this.career, this.music.bibliotheque);
    this.briefing = new BriefingEtape(
      this.briefingEl,
      this.career,
      () => this.startRace(this.stagePrete!),
      () => {
        this.setState('menu');
        this.menu.render();
      }
    );
    this.menu = new Menu(
      this.menuEl,
      this.career,
      (stage) => this.ouvrirBriefing(stage),
      (stage, options) => this.startRace(stage, options),
      (stages, options) => this.demarrerSerie(stages, options)
    );
    // après chaque reconstruction du menu, le curseur doit retrouver sa place
    this.menu.onRendered = () => this.navMenu.rafraichir();
    this.menu.onQualityChange = () => this.refreshQuality();
    this.menu.onAudioChange = () => this.refreshAudio();
    this.menu.onNameTagsChange = () => this.refreshNameTags();
    this.menu.sync = this.sync;
    this.menu.onSyncApplied = () => {
      // une restauration change tout : peloton, réglages, musique
      this.refreshQuality();
      this.refreshAudio();
      this.refreshNameTags();
      this.majMusiqueUI();
      this.menu.render();
    };
    void this.sync.disponible().then((d) => this.menu.setSyncDisponible(d));
    this.hud = new HUD(this.hudEl);
    // le conteneur d'étiquettes vit à côté du HUD, pas dedans : le HUD
    // reconstruit son contenu au départ de chaque étape
    this.nameTags = new NameTags(document.getElementById('ui') ?? document.body);
    this.nameTags.setActif(this.career.save.nomsCoureurs !== false);
    this.results = new Results(this.resultsEl);
    // l'atelier vit à côté des écrans : il se superpose à la 3D pendant une
    // séance libre, et n'existe pas du tout le reste du temps
    this.atelier = new Atelier(document.getElementById('ui') ?? document.body);
  }

  /** navigation à la manette dans le menu et l'écran de résultats */
  /** Échap et F fonctionnent partout ; Start sur la manette aussi */
  private handleGlobalKeys(): void {
    if (this.input.toggleFullscreen) {
      void basculerFullscreen();
    }
    // une séance libre se quitte quand on veut : elle n'a rien à conclure
    if (this.modeLibre && this.state === 'race' && this.input.back) {
      this.quitterSeanceLibre();
    }
  }

  private handleMenuPad(dt: number): void {
    if (!this.input.gamepadConnected) return;
    const nav =
      this.state === 'results'
        ? this.navResultats
        : this.state === 'briefing'
          ? this.navBriefing
          : this.navMenu;

    // LB et RB changent d'onglet quel que soit l'endroit où se trouve le curseur
    const shift = this.input.tabShift;
    if (shift !== 0 && this.state === 'menu') {
      const tabs = [...this.menuEl.querySelectorAll<HTMLButtonElement>('[data-tab]')];
      const i = tabs.findIndex((b) => b.classList.contains('active'));
      if (i >= 0 && tabs.length) {
        tabs[(i + shift + tabs.length) % tabs.length].click();
        return;
      }
    }

    // B ramène au premier élément, ou quitte la navigation si on y est déjà
    if (this.input.back) {
      nav.retour();
      return;
    }

    // tant que le curseur n'est pas sorti, A déclenche l'action principale de
    // l'écran : c'est le geste attendu pour lancer une étape ou continuer
    if (!nav.estActif && this.input.confirm) {
      const root =
        this.state === 'results'
          ? this.resultsEl
          : this.state === 'briefing'
            ? this.briefingEl
            : this.menuEl;
      const btn =
        root.querySelector<HTMLButtonElement>('[data-action="continue"]') ??
        root.querySelector<HTMLButtonElement>('[data-action="partir"]') ??
        root.querySelector<HTMLButtonElement>('[data-action="play"]') ??
        root.querySelector<HTMLButtonElement>('[data-action="restart-tour"]');
      if (btn) {
        btn.click();
        return;
      }
    }

    nav.update(this.input, dt);
  }

  async start(): Promise<void> {
    // la détection des musiques du joueur est lancée en parallèle du reste
    await Promise.all([this.assets.preload(), this.music.detecter()]);
    this.majMusiqueUI();
    this.menu.onImportMusique = async (ambiance, fichier) => {
      const res = await this.music.bibliotheque.importer(ambiance, fichier);
      toast(res.message);
      if (res.ok) {
        this.music.rafraichir(ambiance);
        this.majMusiqueUI();
      }
    };
    this.menu.onSupprMusique = async (ambiance) => {
      await this.music.bibliotheque.supprimer(ambiance);
      this.music.rafraichir(ambiance);
      this.majMusiqueUI();
      toast('Morceau retiré');
    };
    surChangementFullscreen((actif) => {
      this.menu.setFullscreen(actif);
      this.resize();
    });
    this.input.onGamepadChange = (connected, name) => {
      toast(connected ? `${name} détectée` : 'Manette déconnectée');
      this.menu.setGamepad(connected, name);
      this.hud.setGamepad(connected);
    };
    // la manette est interrogée dès la construction : si elle était déjà
    // branchée au chargement, l'événement est passé avant que le menu existe
    if (this.input.gamepadConnected) {
      this.menu.setGamepad(true, this.input.gamepadName);
      this.hud.setGamepad(true);
    }
    // hook de debug/test : carrière accessible dès le démarrage
    (window as unknown as Record<string, unknown>).__career = this.career;
    (window as unknown as Record<string, unknown>).__menu = this.menu;
    (window as unknown as Record<string, unknown>).__game = this;
    this.showMenu();
    requestAnimationFrame((t) => this.loop(t));
  }

  private setState(s: GameState): void {
    this.state = s;
    this.menuEl.classList.toggle('hidden', s !== 'menu');
    this.briefingEl.classList.toggle('hidden', s !== 'briefing');
    this.hudEl.classList.toggle('hidden', s !== 'race');
    this.nameTags?.setEnCourse(s === 'race');
    this.resultsEl.classList.toggle('hidden', s !== 'results');
    this.replayEl.classList.toggle('hidden', s !== 'replay');
    this.canvas.classList.toggle('dimmed', s !== 'race' && s !== 'replay');
  }

  private showMenu(): void {
    this.menu.render();
    this.setState('menu');
  }

  /** ouvre l'écran d'avant-course : forme, contrat, spécialités */
  private ouvrirBriefing(stage: StageDef): void {
    this.stagePrete = stage;
    this.setState('briefing');
    this.briefing.afficher(stage);
    this.navBriefing.rafraichir();
  }

  private startRace(stage: StageDef, libre?: OptionsLibre): void {
    this.modeLibre = libre != null;
    this.optionsLibre = libre ?? null;
    this.creationEnCours = stage.creee ? stage : null;
    if (!libre) this.serieLibre = [];
    // Le lancement part d'un clic ou d'un appui : c'est le geste utilisateur
    // exigé par l'API. Passer en plein écran ici rend la manette au jeu sur
    // les navigateurs de console, où l'interface du navigateur intercepte
    // sinon une partie des boutons.
    if (this.career.save.autoFullscreen !== false && !fullscreenActif()) {
      void entrerFullscreen();
    }
    // le navigateur n'autorise le son qu'à partir d'un geste utilisateur :
    // le clic de départ est ce geste
    void this.audio.resume().then((ok) => {
      if (!ok) return;
      this.audio.setVolumes(
        this.career.save.volMaster ?? 0.75,
        this.career.save.volMusique ?? 0.55,
        this.career.save.volEffets ?? 0.8
      );
      this.audio.setCoupe(this.career.save.sonCoupe === true);
      this.music.jouer('course');
    });
    this.disposeRace();
    const s = this.career.save;
    this.race = new Race(
      stage,
      {
        name: s.name,
        // la forme du jour s'applique aux caractéristiques de l'étape
        stats: s.forme ? appliquerForme(s.stats, s.forme) : s.stats,
        specialites: this.career.equipees,
        bidonsBonus: this.career.bidonsBonus,
        appearance: s.appearance,
        jersey: this.career.playerJersey(),
        team: s.team,
        jerseys: this.career.playerJerseys(),
        crevaisonFrequence: s.crevaisonFrequence
      },
      libre?.seul ? [] : getRoster(),
      this.career.jerseyHolders(),
      this.career.gcSnapshot(),
      this.assets,
      this.aspect(),
      s.difficulty,
      this.quality,
      { engine: this.audio, music: this.music },
      (msg: string) => toast(msg),
      libre ?? null
    );
    this.hud.mount(stage, this.career.save.tour.tourId, libre?.sansFatigue === true);
    this.setState('race');
    if (libre) {
      this.atelier.ouvrir(
        this.race,
        {
          rouler: () => this.race?.basculerVolLibre(),
          enregistrer: () => this.enregistrerAtelier(),
          quitter: () => this.quitterSeanceLibre()
        },
        { edition: libre.atelier, titre: stage.name }
      );
      this.atelierModifie = false;
      this.race.onAtelier = () => {
        this.atelierModifie = true;
        this.atelier.rafraichir();
      };
    } else {
      this.atelier.fermer();
    }
    // hook de debug/test (Playwright) : accès à la course en cours
    (window as unknown as Record<string, unknown>).__race = this.race;
    (window as unknown as Record<string, unknown>).__career = this.career;
  }

  /** rafraîchit l'affichage des pistes musicales */
  private majMusiqueUI(): void {
    this.menu.setMusiquesFournies(this.music.ambiancesFournies);
    const infos: Record<string, { nom: string; taille: number } | null> = {};
    for (const a of ['menu', 'course', 'tension', 'finale', 'victoire']) {
      const i = this.music.bibliotheque.info(a);
      infos[a] = i ? { nom: i.nom, taille: i.taille } : null;
    }
    this.menu.setInfosMusique(infos);
  }

  /** active ou non les noms au-dessus des coureurs */
  refreshNameTags(): void {
    this.nameTags.setActif(this.career.save.nomsCoureurs !== false);
  }

  /** applique les réglages audio courants */
  refreshAudio(): void {
    const s = this.career.save;
    this.audio.setVolumes(s.volMaster ?? 0.75, s.volMusique ?? 0.55, s.volEffets ?? 0.8);
    this.audio.setCoupe(s.sonCoupe === true);
  }

  private endRace(): void {
    if (!this.race) return;
    /*
     * Séance libre : on ne passe pas par l'écran de résultats, qui applique
     * les temps, l'expérience, les maillots et le contrat à la carrière. Rien
     * de ce qui se joue ici ne doit y laisser de trace.
     */
    if (this.modeLibre) {
      // tour créé : on enchaîne sur l'étape suivante sans repasser par le menu
      const suivante = this.serieLibre.shift();
      if (suivante && this.optionsLibre) {
        const options = this.optionsLibre;
        toast(`Étape suivante : ${suivante.name}`);
        this.startRace(suivante, options);
        return;
      }
      this.quitterSeanceLibre();
      return;
    }
    const rows = this.race.getResults();
    const points = this.race.getPoints();
    const stage = this.race.stage;
    const gagne = rows.findIndex((r) => r.isPlayer) === 0;
    this.music.jouer(gagne ? 'victoire' : 'menu');
    this.music.setIntensite(gagne ? 0.8 : 0.4);
    this.setState('results');
    const suivi = this.race.suivi;
    this.results.show(
      stage,
      rows,
      points,
      this.career,
      suivi,
      () => {
        this.disposeRace();
        this.music.jouer('menu');
        this.showMenu();
      },
      this.race.hasReplay ? () => this.showReplay() : null
    );
  }

  /** rejoue l'arrivée enregistrée pendant la course, caméra fixe façon ligne d'arrivée */
  private showReplay(): void {
    if (!this.race || !this.race.hasReplay) return;
    const rows = this.race.getResults();
    const gap = rows.length > 1 ? rows[1].time - rows[0].time : Infinity;
    const photoFinish = gap < 0.3;
    this.replayEl.innerHTML = `
      <div class="replay-wrap">
        ${photoFinish ? `<div class="replay-photo">PHOTO FINISH</div>` : ''}
        <div class="replay-info">${rows[0].name} l'emporte${gap < Infinity ? ` · ${formatGap(gap)}` : ''}</div>
        <button class="btn-primary" data-action="replay-retour">Retour aux résultats</button>
      </div>`;
    this.replayEl
      .querySelector<HTMLButtonElement>('[data-action="replay-retour"]')!
      .addEventListener('click', () => this.setState('results'));
    this.race.startReplay();
    this.setState('replay');
  }

  /** retour au menu depuis une séance libre, à l'arrivée ou sur abandon */
  /**
   * Enchaînement d'étapes en séance libre.
   *
   * C'est ce qui donne corps aux tours créés : on lance le premier parcours,
   * et chaque arrivée déclenche le suivant. Rien n'est classé ni enregistré,
   * la carrière n'en sait rien — c'est une visite guidée, pas une épreuve.
   */
  private demarrerSerie(stages: StageDef[], options: OptionsLibre): void {
    if (!stages.length) return;
    this.serieLibre = stages.slice(1);
    this.startRace(stages[0], options);
  }

  /**
   * Enregistre les meubles posés.
   *
   * Meubler une étape officielle n'y touche pas : cela en crée une copie
   * dans les créations du joueur. Les tours du jeu restent ce qu'ils sont,
   * et l'on repart de sa propre version à la séance suivante.
   */
  private enregistrerAtelier(): void {
    if (!this.race) return;
    const base = this.creationEnCours ?? this.race.stage;
    const objets = this.race.objetsPoses();
    const s: StageDef = this.creationEnCours
      ? { ...base, objets }
      : {
          ...base,
          id: nouvelId('etape'),
          name: `${base.name} (atelier)`,
          objets,
          creee: true
        };
    this.creationEnCours = creations.enregistrer(s);
    this.atelierModifie = false;
    this.menu.render();
    toast(
      `${objets.length} objet${objets.length > 1 ? 's' : ''} enregistré${objets.length > 1 ? 's' : ''} — « ${s.name} »`
    );
  }

  private quitterSeanceLibre(): void {
    /*
     * On ne perd pas son travail par mégarde : l'atelier prévient si des
     * objets ont été posés sans être enregistrés. Le reste d'une séance
     * libre, lui, n'a rien à sauver — c'est tout son intérêt.
     */
    if (this.atelierModifie && !confirm('Des objets posés ne sont pas enregistrés. Quitter quand même ?')) {
      return;
    }
    this.atelierModifie = false;
    this.modeLibre = false;
    this.optionsLibre = null;
    this.serieLibre = [];
    this.creationEnCours = null;
    this.atelier.fermer();
    this.disposeRace();
    this.music.jouer('menu');
    this.showMenu();
  }

  private disposeRace(): void {
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
  }

  /**
   * Rendu protégé. Un shader qui ne compile pas ou une carte d'environnement
   * refusée par le pilote produisent un écran blanc sans exception visible ;
   * quand une erreur remonte tout de même, on retire les éléments coûteux
   * plutôt que de laisser le joueur devant une page vide.
   */
  private safeRender(): void {
    if (!this.race) return;
    try {
      if (this.postfx) this.postfx.render(this.race.scene, this.race.camera);
      else this.renderer.render(this.race.scene, this.race.camera);
      this.renderFails = 0;
    } catch (err) {
      this.renderFails += 1;
      if (this.renderFails > 3 && !this.degraded) {
        this.degraded = true;
        console.warn('Rendu dégradé après échecs répétés', err);
        this.race.scene.environment = null;
        this.renderer.shadowMap.enabled = false;
        this.quality = { ...this.quality, environnement: false, shadows: false };
        // le composer de post-traitement est lui-même un point de défaillance
        // possible (cibles de rendu flottantes) : on repasse en rendu direct
        this.postfx?.dispose();
        this.postfx = null;
        toast('Qualité réduite automatiquement pour rétablir l\'affichage');
      }
    }
  }

  /** carte d'ombres actualisée une frame sur n en qualité réduite */
  private frameOmbre = 0;
  private majOmbres(): void {
    const n = this.quality.intervalleOmbre;
    if (n <= 1 || !this.quality.shadows) return;
    this.frameOmbre = (this.frameOmbre + 1) % n;
    this.renderer.shadowMap.needsUpdate = this.frameOmbre === 0;
  }

  /**
   * Surveillance du framerate.
   *
   * Si le jeu reste sous 24 images par seconde pendant plusieurs secondes en
   * qualité automatique, on descend d'un cran plutôt que de laisser le joueur
   * subir. La mesure ignore les premières secondes, le temps que les shaders
   * finissent de se compiler.
   */
  private fpsAccu = 0;
  private fpsFrames = 0;
  private fpsBas = 0;
  private fpsDelai = 3;
  private mesurerFps(dt: number): void {
    if (this.career.save.quality !== 'auto') return;
    if (this.fpsDelai > 0) {
      this.fpsDelai -= dt;
      return;
    }
    this.fpsAccu += dt;
    this.fpsFrames += 1;
    if (this.fpsAccu < 1) return;
    const fps = this.fpsFrames / this.fpsAccu;
    this.fpsAccu = 0;
    this.fpsFrames = 0;

    if (fps < 24) {
      this.fpsBas += 1;
      if (this.fpsBas >= 4) {
        this.fpsBas = 0;
        this.fpsDelai = 6;
        this.descendreQualite();
      }
    } else {
      this.fpsBas = 0;
    }
  }

  private descendreQualite(): void {
    const q = this.quality;
    if (!q.environnement && !q.shadows && q.pixelRatioMax <= 0.9) return; // déjà au plus bas
    if (q.environnement) {
      this.quality = { ...q, environnement: false };
      if (this.race) this.race.scene.environment = null;
      toast('Reflets désactivés pour gagner en fluidité');
    } else if (q.shadows) {
      this.quality = { ...q, shadows: false, densiteFoule: q.densiteFoule * 0.6 };
      toast('Ombres désactivées pour gagner en fluidité');
    } else {
      this.quality = { ...q, pixelRatioMax: 0.85, distanceLod: 12 };
      toast('Résolution réduite pour gagner en fluidité');
    }
    this.applyQuality();
  }

  private loop(t: number): void {
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;

    // l'API Gamepad n'émet pas d'événements : il faut interroger l'état
    this.input.poll();
    // renfort du séquenceur musical : son minuteur peut être déprogrammé
    // quand la machine est chargée, ce qui créerait des trous audibles
    this.music.tick();
    this.handleGlobalKeys();
    if (this.state !== 'race') this.handleMenuPad(dt);

    if (this.state === 'race' && this.race) {
      this.race.handleInput(this.input, dt);
      this.race.update(dt);
      /*
       * Vol libre : le tableau de bord du coureur n'a plus de sens — on ne
       * roule pas — et laisserait ses jauges figées au milieu de l'écran.
       * Il s'efface au profit de l'atelier.
       */
      const vol = this.race.volLibre;
      this.hudEl.classList.toggle('hidden', vol);
      // les étiquettes de nom suivent les coureurs : en vol libre elles
      // flotteraient au-dessus d'un peloton immobile, loin derrière
      this.nameTags.setEnCourse(!vol);
      if (this.optionsLibre) {
        this.atelier.setVisible(vol);
        if (vol) this.atelier.rafraichir();
      }
      this.hud.setGamepad(this.input.gamepadConnected);
      if (!vol) this.hud.update(this.race.hudState());
      this.nameTags.update(this.race.riders, this.race.player, this.race.camera);
      this.majOmbres();
      this.mesurerFps(dt);
      this.safeRender();
      if (this.race.isOver) this.endRace();
    } else if (this.state === 'replay' && this.race) {
      this.race.updateReplay(dt);
      this.safeRender();
    } else if (this.race) {
      // écran résultats : la 3D reste en fond
      this.safeRender();
    }

    requestAnimationFrame((tt) => this.loop(tt));
  }

  private aspect(): number {
    return window.innerWidth / window.innerHeight;
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postfx?.setSize(window.innerWidth, window.innerHeight);
    this.race?.resize(this.aspect());
  }
}
