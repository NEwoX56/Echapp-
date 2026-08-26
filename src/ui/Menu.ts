import type { StageDef, TourDef, RiderStats } from '../data/types';
import type { Career } from '../career/Career';
import { TOURS } from '../data/tours';
import { getRoster, equipes } from '../data/rosterStore';
import {
  PALETTE,
  SKIN_TONES,
  PATTERNS,
  WHEEL_STYLES,
  HAIR_COLORS,
  BEARD_STYLES,
  SPONSORS,
  AWARDS,
  type ClassementKey,
  type JerseyPattern,
  type WheelStyle,
  type BeardStyle
} from '../data/appearance';
import { profileSvg, TYPE_LABEL, formatTime, formatGap, hexColor, jerseyIconSvg, toast } from './util';
import { PanneauTest } from './PanneauTest';
import type { OptionsLibre } from '../race/Race';
import { logoTour } from './RaceGroups';
import { RiderPreview } from './RiderPreview';
import { RosterEditor } from './RosterEditor';
import { HeroPanel } from './HeroPanel';
import { carteAchatSpecialite } from './BriefingEtape';
import {
  BADGES,
  SPECIALITES,
  COUTS,
  coutEmplacement,
  badge,
  type SpecialiteId
} from '../data/progression';
import type { SyncAccount } from '../core/SyncAccount';
import { basculerFullscreen, fullscreenActif, fullscreenDisponible } from '../core/Fullscreen';
import { qualityLabel } from '../core/Quality';
import { DIFFICULTES } from '../data/difficulty';

type Panel = 'tours' | 'classements' | 'atelier' | 'peloton' | 'test' | 'progression' | 'params';
type AtelierTab = 'coureur' | 'maillot' | 'velo';

export class Menu {
  private root: HTMLElement;
  private career: Career;
  private onPlay: (stage: StageDef) => void;
  private onTest: (stage: StageDef, options: OptionsLibre) => void;
  private onTestSerie: (stages: StageDef[], options: OptionsLibre) => void;
  private panneauTest: PanneauTest;
  private panel: Panel = 'tours';
  private atelierTab: AtelierTab = 'maillot';
  private classementTab: ClassementKey = 'general';
  private preview = new RiderPreview();
  private editeur: RosterEditor;
  private hero = new HeroPanel(document.createElement('div'));
  private heroPret = false;

  /** prévenu quand le joueur change la qualité graphique */
  onQualityChange: (() => void) | null = null;
  /** prévenu quand un réglage sonore change */
  onAudioChange: (() => void) | null = null;
  /** appelé après chaque reconstruction, pour replacer le curseur manette */
  onRendered: (() => void) | null = null;
  /** prévenu quand l'affichage des noms change */
  onNameTagsChange: (() => void) | null = null;
  /** compte de synchronisation, fourni par le jeu */
  sync: SyncAccount | null = null;
  onSyncApplied: (() => void) | null = null;
  private syncDispo: boolean | null = null;
  private syncEtat = '';

  setSyncDisponible(d: boolean): void {
    this.syncDispo = d;
    const el = this.root.querySelector('#sync-dispo');
    if (el) el.textContent = this.texteDispo();
  }

  private texteDispo(): string {
    if (this.syncDispo === null) return 'Vérification…';
    return this.syncDispo
      ? 'Synchronisation disponible sur ce site.'
      : "La synchronisation n'est pas active sur cette adresse. Utilise la sauvegarde par fichier de l'onglet Peloton.";
  }

  constructor(
    root: HTMLElement,
    career: Career,
    onPlay: (stage: StageDef) => void,
    onTest: (stage: StageDef, options: OptionsLibre) => void,
    onTestSerie: (stages: StageDef[], options: OptionsLibre) => void
  ) {
    this.root = root;
    this.career = career;
    this.onPlay = onPlay;
    this.onTest = onTest;
    this.onTestSerie = onTestSerie;
    this.editeur = new RosterEditor(root, () => this.render());
    this.panneauTest = new PanneauTest({
      lancer: (stage, options) => this.onTest(stage, options),
      lancerSerie: (stages, options) => this.onTestSerie(stages, options),
      rafraichir: () => this.render()
    });
  }

  render(): void {
    this.preview.unmount();
    const s = this.career.save;
    const tour = this.career.tourDef;
    const nextStage = tour.stages[s.tour.currentStage];
    const holders = this.career.jerseyHolders();
    const myJerseys = (['general', 'points', 'montagne', 'jeune'] as ClassementKey[]).filter(
      (k) => holders[k] === 'player'
    );

    /*
     * Structure d'ensemble.
     *
     * Navigation verticale à gauche, scène occupant tout le reste : l'image
     * n'est plus une bande latérale mais le fond de l'écran. Les panneaux
     * riches se posent par-dessus dans un voile sombre ; l'accueil, lui, reste
     * dégagé pour laisser voir l'affiche.
     */
    const icones: Record<string, string> = {
      tours: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M8 17h4l4-8"/><path d="M9 9h4l3 8"/><circle cx="16" cy="5.5" r="1.6" fill="currentColor" stroke="none"/></svg>`,
      classements: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V9"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>`,
      atelier: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3.5a5 5 0 0 0-5.6 6.7L3 16.6 6.4 20l6.4-6.4A5 5 0 0 0 19.5 8l-3 3-2.5-2.5 3-3A5 5 0 0 0 15 3.5Z"/></svg>`,
      peloton: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M2.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M15 19c0-2.4 1.6-4 3.5-4S22 16.6 22 19"/></svg>`,
      test: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.4 14h9.2"/></svg>`,
      progression: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5.5-5.5 3.5 3.5L21 6"/><path d="M15 6h6v6"/></svg>`,
      params: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.04A1.7 1.7 0 0 0 21 10.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03Z"/></svg>`
    };

    const entrees: [Panel, string][] = [
      ['tours', 'Courir'],
      ['classements', 'Classements'],
      ['atelier', 'Atelier'],
      ['peloton', 'Peloton'],
      ['test', 'Test'],
      ['progression', 'Progression']
    ];

    this.root.innerHTML = `
      <div class="app-shell">
        <div class="scene" id="hero-panel"></div>
        <div class="scene-voile"></div>

        <button class="reglages-coin ${this.panel === 'params' ? 'active' : ''}"
                data-tab="params" title="Paramètres">${icones.params}</button>

        <div class="colonne-gauche">
          <div class="marque">
            <h1 class="logo-jeu">ÉCHAPPÉE</h1>
            <div class="logo-sous">Le jeu cycliste</div>
          </div>
          <nav class="side-nav">
            ${entrees
              .map(
                ([id, label]) => `
              <button data-tab="${id}" class="${this.panel === id ? 'active' : ''}">
                <span class="sn-icone">${icones[id]}</span>
                <span class="sn-label">${label}</span>
              </button>`
              )
              .join('')}
          </nav>
        </div>

        <header class="barre-joueur">
          <span class="bj-nom">${s.name}</span>
          ${myJerseys.length ? `<span class="bj-maillots">${myJerseys.map((k) => jerseyIconSvg(AWARDS[k].cssColor, k === 'montagne')).join('')}</span>` : ''}
          <span class="bj-sep"></span>
          <span class="bj-niveau">Niv. <b>${s.level}</b></span>
          <span class="bj-points"><i></i>${s.upgradePoints}</span>
        </header>

        <main class="scene-contenu ${this.panel === 'tours' ? 'accueil' : 'dense'}">
          ${this.renderPanel(tour, nextStage)}
        </main>

        <footer class="bottom-bar">
          <span class="bb-touches">
            <span><b>B</b> Retour</span>
            <span><b>A</b> Sélectionner</span>
          </span>
          <span class="bb-points" id="hero-nav"></span>
          <span class="bb-clavier" id="menu-foot">↑↓ allure · ←→ placement · ESPACE sprint · B bidon · G gel · C caméra</span>
          <span class="pad-aide hidden" id="pad-aide"></span>
        </footer>
      </div>
    `;

    this.monterHero();
    this.bindTabs();
    this.bindPanel(nextStage);
    if (this.panel === 'peloton') this.editeur.bind();
    this.refreshInputHints();
    this.refreshMusicState();
    this.fsActif = fullscreenActif();
    this.setFullscreen(this.fsActif);
    if (this.panel === 'atelier') this.mountPreview();
    this.onRendered?.();
  }

  private renderPanel(tour: TourDef, nextStage: StageDef | undefined): string {
    switch (this.panel) {
      case 'tours':
        return this.renderTours(tour, nextStage);
      case 'atelier':
        return `<div class="panel-dense">${this.renderAtelier()}</div>`;
      case 'classements':
        return `<div class="panel-dense">${this.renderClassement()}</div>`;
      case 'peloton':
        return `<div class="panel-dense">${this.editeur.render()}</div>`;
      case 'test':
        return `<div class="panel-dense">${this.renderTest()}</div>`;
      case 'progression':
        return `<div class="panel-dense">${this.renderProgression()}</div>`;
      default:
        return `<div class="panel-dense">${this.renderParams()}</div>`;
    }
  }

  /* --------------------------------------------------------- */
  /* onglet Courir                                             */
  /* --------------------------------------------------------- */

  /**
   * Profil d'étape avec repères, façon incrustation télévisée : départ,
   * sommets catégorisés, arrivée. C'est le profil qui rend une étape lisible
   * d'un coup d'œil, bien plus qu'une ligne de texte.
   */
  private profilRepere(stage: StageDef, w = 300, h = 84): string {
    const pts = stage.profile;
    const maxAlt = Math.max(...pts.map((p) => p[1]), 20);
    const padB = 20;
    const x = (t: number) => 6 + t * (w - 12);
    const y = (a: number) => h - padB - (a / maxAlt) * (h - padB - 8);
    const alt = (t: number) => {
      if (t <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) {
        if (t <= pts[i][0]) {
          const [t0, a0] = pts[i - 1];
          const [t1, a1] = pts[i];
          const k = (t - t0) / (t1 - t0);
          return a0 + (a1 - a0) * ((1 - Math.cos(k * Math.PI)) / 2);
        }
      }
      return pts[pts.length - 1][1];
    };

    let d = `M ${x(0)} ${h - padB}`;
    for (let i = 0; i <= 90; i++) d += ` L ${x(i / 90).toFixed(1)} ${y(alt(i / 90)).toFixed(1)}`;
    d += ` L ${x(1)} ${h - padB} Z`;

    const cat = (c: number) => (c === 0 ? 'HC' : String(c));
    const reperes = [
      `<g><line x1="${x(0)}" y1="${y(alt(0)) - 2}" x2="${x(0)}" y2="${h - padB}" stroke="#3fd07a" stroke-width="1.4"/>
         <circle cx="${x(0)}" cy="${y(alt(0)) - 9}" r="7" fill="#3fd07a"/>
         <text class="pr-txt" x="${x(0)}" y="${y(alt(0)) - 6}" text-anchor="middle">S</text></g>`,
      ...(stage.climbs ?? []).map(
        (c) => `<g><line x1="${x(c.at)}" y1="${y(alt(c.at)) - 2}" x2="${x(c.at)}" y2="${h - padB}" stroke="#e0392c" stroke-width="1.4"/>
          <circle cx="${x(c.at)}" cy="${y(alt(c.at)) - 9}" r="7.5" fill="#e0392c"/>
          <text class="pr-txt" x="${x(c.at)}" y="${y(alt(c.at)) - 6}" text-anchor="middle">${cat(c.category)}</text></g>`
      ),
      `<g><line x1="${x(1)}" y1="${y(alt(1)) - 2}" x2="${x(1)}" y2="${h - padB}" stroke="#f4f4f0" stroke-width="1.4"/>
         <rect x="${x(1) - 1}" y="${y(alt(1)) - 18}" width="12" height="9" fill="url(#damier)"/></g>`
    ].join('');

    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" class="profil-repere">
      <defs>
        <linearGradient id="grad-prof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" stop-opacity="0.85"/>
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0.12"/>
        </linearGradient>
        <pattern id="damier" width="6" height="4.5" patternUnits="userSpaceOnUse">
          <rect width="6" height="4.5" fill="#f4f4f0"/>
          <rect width="3" height="2.25" fill="#15161a"/>
          <rect x="3" y="2.25" width="3" height="2.25" fill="#15161a"/>
        </pattern>
      </defs>
      <path d="${d}" fill="url(#grad-prof)" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/>
      ${reperes}
    </svg>`;
  }

  private renderTours(tour: TourDef, nextStage: StageDef | undefined): string {
    const s = this.career.save;
    const gc = this.career.gcTable();
    const holders = this.career.jerseyHolders();
    const numEtape = s.tour.currentStage + 1;

    const lignes = gc.length
      ? gc
          .slice(0, 5)
          .map((r, i) => {
            const maillot = holders.general === r.id ? jerseyIconSvg('#ffd633') : '';
            const equipe =
              r.id === 'player'
                ? s.team
                : getRoster().find((x) => x.id === r.id)?.team ?? '';
            /*
             * Sigle d'équipe sur trois lettres, comme sur les classements
             * officiels. Prendre l'initiale de chaque mot ne suffit pas : une
             * équipe en un seul mot donnerait une lettre unique.
             */
            const mots = equipe.replace(/[^A-Za-zÀ-ÿ0-9 -]/g, '').split(/[ -]+/).filter(Boolean);
            const sigle = (
              mots.length >= 3
                ? mots.map((m) => m[0]).join('')
                : mots.length === 2
                  ? mots[0].slice(0, 2) + mots[1][0]
                  : (mots[0] ?? '').slice(0, 3)
            )
              .slice(0, 3)
              .toUpperCase();
            return `<div class="cls-ligne ${r.isPlayer ? 'moi' : ''} ${i === 0 ? 'tete' : ''}">
                <span class="cl-rang">${i + 1}</span>
                <span class="cl-maillot">${maillot}</span>
                <span class="cl-nom">${r.name}</span>
                <span class="cl-equipe">${sigle}</span>
                <span class="cl-temps">${i === 0 ? formatTime(r.time) : formatGap(r.gap)}</span>
              </div>`;
          })
          .join('')
      : `<div class="cls-vide">Le tour n'a pas encore commencé. Prends le départ de la première étape.</div>`;

    const forme = this.career.forme;
    const boutonPrincipal = s.tour.finished
      ? `<button class="btn-pill" data-action="restart-tour">Recommencer le tour <span class="touche">A</span></button>`
      : `<button class="btn-pill" data-action="play">Voir l'étape <span class="touche">A</span></button>`;

    const pastilles = TOURS.map((t) => {
      const ouvert = this.career.isTourUnlocked(t.id);
      return `<button class="pt-point ${t.id === tour.id ? 'actif' : ''}"
                data-tour="${t.id}" ${ouvert ? '' : 'disabled'} title="${t.name}"></button>`;
    }).join('');

    return `
      <div class="carte-course">
        <div class="cc-sur">Course en cours</div>
        <div class="cc-tete">
          <div>
            <h2 class="cc-titre">${tour.name}</h2>
            <div class="cc-etape">Étape ${numEtape} / ${tour.stages.length}</div>
            ${
              nextStage
                ? `<div class="cc-meta">
                     <span class="cc-ico">${
                       nextStage.type === 'montagne'
                         ? '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 16 8 5l4 6 2-3 4 8Z"/></svg>'
                         : '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 14h16"/><path d="M4 14 8 7l4 4 4-6"/></svg>'
                     }</span>
                     ${nextStage.displayKm} km — ${TYPE_LABEL[nextStage.type]}
                     ${forme ? `<span class="cc-forme" style="color:${forme.couleur}">${forme.libelle}</span>` : ''}
                   </div>`
                : '<div class="cc-meta">Grand tour terminé</div>'
            }
          </div>
          <div class="cc-profil">${nextStage ? this.profilRepere(nextStage) : ''}</div>
        </div>

        <div class="cc-sur cc-sur2">Classement général</div>
        <div class="cls-tableau">${lignes}</div>

        <div class="cc-actions">
          ${boutonPrincipal}
          <button class="btn-outline" data-tab="classements">Classement complet</button>
        </div>
      </div>

      <div class="carte-pastilles">
        <span class="pp-touche">R</span>
        ${pastilles}
      </div>`;
  }

  private renderClassement(): string {
    const s = this.career.save;
    if (s.tour.currentStage === 0) {
      return `<div class="cls-block"><h3>Classements</h3><p class="hint">Le tour n'a pas encore commencé.</p></div>`;
    }
    const tabs = (
      [
        ['general', 'Général'],
        ['points', 'Points'],
        ['montagne', 'Montagne'],
        ['jeune', 'Jeune']
      ] as [ClassementKey, string][]
    )
      .map(
        ([k, label]) =>
          `<button class="cls-tab ${this.classementTab === k ? 'active' : ''}" data-cls="${k}">${label}</button>`
      )
      .join('');

    let rows = '';
    if (this.classementTab === 'general' || this.classementTab === 'jeune') {
      let table = this.career.gcTable();
      if (this.classementTab === 'jeune') {
        const holders = this.career.jerseyHolders();
        const youngLeader = holders.jeune;
        table = table.filter((r) => r.isPlayer || r.id === youngLeader || true);
        // ne conserver que les jeunes
        const youngIds = new Set(
          this.career
            .gcTable()
            .map((r) => r.id)
            .filter((id) => this.isYoungId(id))
        );
        table = table.filter((r) => youngIds.has(r.id));
        if (table.length) {
          const lead = table[0].time;
          table = table.map((r) => ({ ...r, gap: r.time - lead }));
        }
      }
      rows = table
        .slice(0, 10)
        .map(
          (r, i) => `
        <li class="${r.isPlayer ? 'me' : ''}">
          <span class="res-pos">${i + 1}</span>
          <span class="res-name">${r.name}</span>
          <span class="res-time">${i === 0 ? formatTime(r.time) : formatGap(r.gap)}</span>
        </li>`
        )
        .join('');
    } else {
      rows = this.career
        .pointsTable(this.classementTab === 'points' ? 'points' : 'montagne')
        .slice(0, 10)
        .map(
          (r, i) => `
        <li class="${r.isPlayer ? 'me' : ''}">
          <span class="res-pos">${i + 1}</span>
          <span class="res-name">${r.name}</span>
          <span class="res-time">${r.value} pts</span>
        </li>`
        )
        .join('');
    }

    const award = AWARDS[this.classementTab];
    return `
      <div class="cls-block">
        <div class="cls-head">
          ${jerseyIconSvg(award.cssColor, this.classementTab === 'montagne')}
          <div>
            <h3>${award.label.split('—')[0].trim()}</h3>
            <p class="hint">${award.label.split('—')[1]?.trim() ?? ''}</p>
          </div>
        </div>
        <div class="cls-tabs">${tabs}</div>
        <ol class="res-list">${rows || '<li class="hint">Aucun point marqué</li>'}</ol>
      </div>`;
  }

  private isYoungId(id: string): boolean {
    if (id === 'player') return this.career.save.age <= 25;
    const r = getRoster().find((x) => x.id === id);
    return !!r && r.age <= 25;
  }

  /* --------------------------------------------------------- */
  /* onglet Atelier                                            */
  /* --------------------------------------------------------- */

  private swatches(field: string, current: number): string {
    return PALETTE.map(
      (c) => `
      <button class="sw ${c.value === current ? 'active' : ''}"
              style="background:${hexColor(c.value)}"
              title="${c.label}" data-color-field="${field}" data-color="${c.value}"></button>`
    ).join('');
  }

  private renderAtelier(): string {
    const a = this.career.save.appearance;
    const s = this.career.save;

    const tabs = (
      [
        ['coureur', 'Coureur'],
        ['maillot', 'Maillot'],
        ['velo', 'Vélo']
      ] as [AtelierTab, string][]
    )
      .map(
        ([k, l]) =>
          `<button class="at-tab ${this.atelierTab === k ? 'active' : ''}" data-atelier="${k}">${l}</button>`
      )
      .join('');

    let body = '';
    if (this.atelierTab === 'coureur') {
      body = `
        <label class="field">
          <span>Nom du coureur</span>
          <input type="text" id="rider-name" maxlength="22" value="${s.name.replace(/"/g, '&quot;')}">
        </label>
        <label class="field">
          <span>Âge <small>(≤ 25 ans : éligible au maillot blanc)</small></span>
          <input type="number" id="rider-age" min="18" max="42" value="${s.age}">
        </label>
        <label class="field">
          <span>Mon équipe <small>(ses coureurs deviennent tes équipiers)</small></span>
          <input type="text" id="rider-team" list="liste-equipes" maxlength="26"
                 value="${s.team.replace(/"/g, '&quot;')}">
          <datalist id="liste-equipes">
            ${equipes().map((e) => `<option value="${e.replace(/"/g, '&quot;')}"></option>`).join('')}
          </datalist>
        </label>
        <div class="field">
          <span>Couleur de peau</span>
          <div class="sw-row">
            ${SKIN_TONES.map(
              (t) => `<button class="sw ${t.value === a.skin ? 'active' : ''}"
                        style="background:${hexColor(t.value)}" title="${t.label}"
                        data-color-field="skin" data-color="${t.value}"></button>`
            ).join('')}
          </div>
        </div>
        <div class="field">
          <span>Casque</span>
          <div class="sw-row">${this.swatches('helmet', a.helmet)}</div>
        </div>
        <div class="field">
          <span>Cuissard</span>
          <div class="sw-row">${this.swatches('shorts', a.shorts)}</div>
        </div>
        <div class="field">
          <span>Couleur des cheveux</span>
          <div class="sw-row">
            ${HAIR_COLORS.map(
              (t) => `<button class="sw ${t.value === (a.hairColor ?? HAIR_COLORS[1].value) ? 'active' : ''}"
                        style="background:${hexColor(t.value)}" title="${t.label}"
                        data-color-field="hairColor" data-color="${t.value}"></button>`
            ).join('')}
          </div>
        </div>
        <div class="field">
          <span>Barbe</span>
          <div class="chip-row">
            ${BEARD_STYLES.map(
              (b) =>
                `<button class="chip ${(a.beard ?? 'aucune') === b.id ? 'active' : ''}" data-beard="${b.id}">${b.label}</button>`
            ).join('')}
          </div>
        </div>
        <label class="check">
          <input type="checkbox" id="rider-tattoo" ${a.tattoo ? 'checked' : ''}>
          Brassard tatoué
        </label>
        <div class="field ${a.tattoo ? '' : 'hidden'}" id="tattoo-color-field">
          <span>Couleur du brassard</span>
          <div class="sw-row">${this.swatches('tattooColor', a.tattooColor ?? PALETTE[6].value)}</div>
        </div>`;
    } else if (this.atelierTab === 'maillot') {
      body = `
        <div class="field">
          <span>Couleur principale</span>
          <div class="sw-row">${this.swatches('jerseyPrimary', a.jerseyPrimary)}</div>
        </div>
        <div class="field">
          <span>Couleur secondaire</span>
          <div class="sw-row">${this.swatches('jerseySecondary', a.jerseySecondary)}</div>
        </div>
        <div class="field">
          <span>Motif</span>
          <div class="chip-row">
            ${PATTERNS.map(
              (p) =>
                `<button class="chip ${p.id === a.pattern ? 'active' : ''}" data-pattern="${p.id}">${p.label}</button>`
            ).join('')}
          </div>
        </div>
        <label class="field">
          <span>Sponsor <small>(imprimé sur la poitrine et le dos)</small></span>
          <input type="text" id="sponsor" maxlength="12" value="${a.sponsor.replace(/"/g, '&quot;')}">
        </label>
        <div class="field">
          <span>Suggestions</span>
          <div class="chip-row">
            ${SPONSORS.map((n) => `<button class="chip small" data-sponsor="${n}">${n}</button>`).join('')}
          </div>
        </div>`;
    } else {
      body = `
        <div class="field">
          <span>Cadre</span>
          <div class="sw-row">${this.swatches('bikeFrame', a.bikeFrame)}</div>
        </div>
        <div class="field">
          <span>Décoration du cadre</span>
          <div class="sw-row">${this.swatches('bikeAccent', a.bikeAccent)}</div>
        </div>
        <div class="field">
          <span>Roues</span>
          <div class="chip-row">
            ${WHEEL_STYLES.map(
              (w) =>
                `<button class="chip ${w.id === a.wheels ? 'active' : ''}" data-wheels="${w.id}">${w.label}</button>`
            ).join('')}
          </div>
        </div>
        <p class="hint">La roue lenticulaire est plus rapide visuellement sur le plat, les rayons classiques évoquent la montagne. Effet purement esthétique pour l'instant.</p>`;
    }

    return `
      <div class="panel-atelier">
        <div class="atelier-preview">
          <canvas id="preview-canvas"></canvas>
          <p class="hint">Fais glisser pour tourner autour du coureur.</p>
        </div>
        <div class="atelier-controls">
          <div class="at-tabs">${tabs}</div>
          ${body}
        </div>
      </div>`;
  }

  /** manette branchée ou non : les libellés changent */
  private padConnected = false;
  private padLabel = 'Manette';

  private fsActif = false;

  setFullscreen(actif: boolean): void {
    this.fsActif = actif;
    const b = this.root.querySelector('[data-action="fullscreen"]');
    if (b) b.textContent = actif ? 'Quitter le plein écran' : 'Passer en plein écran';
  }

  setGamepad(connected: boolean, name: string): void {
    this.padConnected = connected;
    if (name) this.padLabel = name;
    this.refreshInputHints();
    this.refreshMusicState();
    this.fsActif = fullscreenActif();
    this.setFullscreen(this.fsActif);
  }

  /** ambiances couvertes par un fichier du joueur */
  private musiquesFournies: string[] = [];

  setMusiquesFournies(liste: string[]): void {
    this.musiquesFournies = liste;
    this.refreshMusicState();
  }

  /** informations sur les morceaux importés, fournies par le jeu */
  private infosMusique: Record<string, { nom: string; taille: number } | null> = {};

  setInfosMusique(infos: Record<string, { nom: string; taille: number } | null>): void {
    this.infosMusique = infos;
    this.refreshMusicState();
  }

  private refreshMusicState(): void {
    const el = this.root.querySelector('#musique-etat');
    if (!el) return;
    const libelles: Record<string, string> = {
      menu: 'Menu',
      course: 'Course',
      tension: 'Tension',
      finale: 'Dernier km',
      victoire: 'Victoire'
    };
    el.innerHTML = `<div class="piste-row">${Object.keys(libelles)
      .map((a) => {
        const fourni = this.musiquesFournies.includes(a);
        const info = this.infosMusique[a];
        const detail = info
          ? `${info.nom.length > 22 ? info.nom.slice(0, 20) + '…' : info.nom} · ${Math.round(info.taille / 1024)} Ko`
          : fourni
            ? 'fichier du dossier'
            : 'musique générée';
        return `<div class="piste ${fourni ? 'fournie' : ''}">
                  <b>${libelles[a]}</b>
                  <small>${detail}</small>
                  <span class="piste-btns">
                    <button data-import="${a}">${fourni ? 'Changer' : 'Importer'}</button>
                    ${info ? `<button data-suppr="${a}" class="rouge">Retirer</button>` : ''}
                  </span>
                </div>`;
      })
      .join('')}</div>`;
    this.bindMusicButtons();
  }

  /** demandé au jeu : importer un fichier pour une ambiance */
  onImportMusique: ((ambiance: string, fichier: File) => Promise<void>) | null = null;
  onSupprMusique: ((ambiance: string) => Promise<void>) | null = null;

  private bindMusicButtons(): void {
    const champ = this.root.querySelector<HTMLInputElement>('#import-musique');
    this.root.querySelectorAll<HTMLButtonElement>('[data-import]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!champ) return;
        champ.dataset.ambiance = b.dataset.import!;
        champ.click();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-suppr]').forEach((b) => {
      b.addEventListener('click', async () => {
        await this.onSupprMusique?.(b.dataset.suppr!);
      });
    });
    if (champ && !champ.dataset.lie) {
      champ.dataset.lie = '1';
      champ.addEventListener('change', async () => {
        const f = champ.files?.[0];
        const amb = champ.dataset.ambiance;
        if (f && amb) await this.onImportMusique?.(amb, f);
        champ.value = '';
      });
    }
  }

  private refreshInputHints(): void {
    const foot = this.root.querySelector('#menu-foot');
    if (foot) {
      foot.textContent = this.padConnected
        ? 'RT allure · LT ralentir · stick placement · A sprint · X bidon · Y gel · Select caméra · LB/RB onglets'
        : '↑↓ allure · ←→ placement · ESPACE sprint/danseuse · B bidon · G gel · C caméra';
    }
    const aide = this.root.querySelector('#pad-aide');
    if (aide) aide.classList.toggle('hidden', !this.padConnected);
    const status = this.root.querySelector('#pad-status');
    if (status) {
      status.textContent = this.padConnected
        ? `${this.padLabel} détectée et prête. Les manettes Xbox et PlayStation utilisent la même disposition, rien à configurer.`
        : 'Aucune manette détectée. Branche une manette Xbox ou PlayStation, puis appuie sur un bouton : elle est reconnue automatiquement.';
      status.classList.toggle('ok', this.padConnected);
    }
  }

  /**
   * Le panneau visuel n'est construit qu'une fois : il vit en dehors du cycle
   * de rendu du menu, sinon le fondu repartirait de zéro à chaque clic
   * d'onglet et la couleur d'accent clignoterait.
   */
  private monterHero(): void {
    const cible = this.root.querySelector('#hero-panel');
    if (!cible) return;
    const el = this.hero.element;
    if (el.parentElement !== cible) cible.appendChild(el);
    if (this.heroPret) return;
    this.heroPret = true;
    this.hero.onTeinte = (c) => {
      document.documentElement.style.setProperty('--accent', c);
    };
    // une seule image de fond : celle fournie par le joueur
    void this.hero.charger([{ src: 'menu/col-montagne.jpg' }]);
  }

  private mountPreview(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>('#preview-canvas');
    if (canvas) this.preview.mount(canvas, this.career.save.appearance);
  }

  /* --------------------------------------------------------- */
  /* onglet Progression                                        */
  /* --------------------------------------------------------- */

  private renderProgression(): string {
    const s = this.career.save;
    const labels: Record<keyof RiderStats, string> = {
      flat: 'Plat',
      climb: 'Montagne',
      sprint: 'Sprint',
      endurance: 'Endurance'
    };
    const statsHtml = (Object.keys(labels) as (keyof RiderStats)[])
      .map((k) => {
        const v = s.stats[k];
        const max = v >= 99;
        return `
        <div class="stat-row">
          <span class="stat-label">${labels[k]}</span>
          <div class="stat-bar"><div style="width:${v}%"></div></div>
          <span class="stat-val">${Math.round(v)}</span>
          <button class="stat-plus" data-upgrade="${k}" ${
            this.career.points > 0 && !max ? '' : 'disabled'
          }>${max ? 'max' : '+2'}</button>
        </div>`;
      })
      .join('');

    const xpNeeded = s.level * 120;
    const palm = Object.entries(s.palmares);
    const auMax = this.career.toutAuMaximum;

    /* --- badges --- */
    const badgesHtml = BADGES.map((b) => {
      const acquis = this.career.aBadge(b.id);
      return `<div class="badge-tuile ${b.rang} ${acquis ? 'acquis' : 'verrouille'}">
          <div class="bt-nom">${b.nom}</div>
          <div class="bt-desc">${b.description}</div>
          <div class="bt-pts">${acquis ? 'obtenu' : `+${b.points} pts`}</div>
        </div>`;
    }).join('');

    /* --- spécialités --- */
    const specHtml = SPECIALITES.map((sp) =>
      carteAchatSpecialite(sp.id, this.career.aSpecialite(sp.id), this.career.points)
    ).join('');
    const coutEmp = coutEmplacement(this.career.emplacements);

    /* --- achats divers --- */
    const nBidon = this.career.bidonsBonus;
    const coutBidon = nBidon < COUTS.bidonSupplementaire.length ? COUTS.bidonSupplementaire[nBidon] : null;

    return `
      <div class="panel-progression">
        <div class="perso-block bloc-points">
          <div class="pts-grand">${this.career.points}</div>
          <div>
            <div class="pts-titre">points de carrière</div>
            <div class="pts-sous">Niveau ${s.level} · ${s.xp} / ${xpNeeded} XP · ${
              s.pointsGagnes ?? 0
            } gagnés depuis le début</div>
          </div>
          <div class="xp-bar large"><div style="width:${Math.min(100, (s.xp / xpNeeded) * 100)}%"></div></div>
        </div>

        <div class="perso-block">
          <h3>Caractéristiques ${auMax ? '<small>toutes au maximum</small>' : ''}</h3>
          ${statsHtml}
          <p class="hint">${
            auMax
              ? 'Tes caractéristiques sont au plafond : tes points servent désormais aux spécialités, aux emplacements et à ton équipe.'
              : 'Une caractéristique coûte 1 point pour 2 points de progression, jusqu\'à 99.'
          }</p>
        </div>

        <div class="perso-block">
          <h3>Spécialités <small>${this.career.equipees.length} / ${this.career.emplacements} équipées</small></h3>
          <p class="hint">
            Elles ne rendent pas plus rapide : elles réduisent un coût ou ouvrent
            une option. Tu choisis lesquelles équiper avant chaque étape.
          </p>
          <div class="achat-grille">${specHtml}</div>
          <div class="emplacement-achat">
            ${
              coutEmp !== null
                ? `<button class="btn-secondary" data-acheter-emplacement
                     ${this.career.points < coutEmp ? 'disabled' : ''}>
                     Acheter un ${this.career.emplacements + 1}e emplacement · ${coutEmp} pts
                   </button>`
                : '<span class="hint">Nombre maximal d\'emplacements atteint.</span>'
            }
          </div>
        </div>

        <div class="perso-block">
          <h3>Équipement et équipe</h3>
          <div class="achat-grille">
            <div class="achat-carte">
              <div class="ac-tete">
                <span class="ac-nom">Bidon supplémentaire</span>
                ${coutBidon !== null ? `<span class="ac-cout">${coutBidon} pts</span>` : '<span class="ac-ok">au maximum</span>'}
              </div>
              <div class="ac-desc">Tu pars avec un bidon de plus à chaque étape. Actuellement : +${nBidon}.</div>
              ${
                coutBidon !== null
                  ? `<button class="btn-secondary petit" data-acheter-bidon ${
                      this.career.points < coutBidon ? 'disabled' : ''
                    }>Acheter</button>`
                  : ''
              }
            </div>
          </div>
        </div>

        <div class="perso-block">
          <h3>Badges <small>${this.career.progressionBadges}</small></h3>
          <div class="badge-grille">${badgesHtml}</div>
        </div>

        <div class="perso-block">
          <h3>Palmarès</h3>
          ${
            palm.length
              ? `<ul class="palm-list">${palm
                  .map(([id, rank]) => {
                    const t = TOURS.find((x) => x.id === id);
                    return `<li><b>${t?.name ?? id}</b> — ${rank}${rank === 1 ? 'er' : 'e'} au général</li>`;
                  })
                  .join('')}</ul>`
              : '<p class="hint">Aucun grand tour terminé pour le moment.</p>'
          }
          <p class="hint">Victoires d\'étape sur le tour en cours : ${s.tour.stageWins}</p>
        </div>
      </div>`;
  }

  /* --------------------------------------------------------- */
  /* onglet Paramètres                                         */
  /* --------------------------------------------------------- */

  /* --------------------------------------------------------- */
  /* onglet Test : rouler n'importe où, sans conséquence         */
  /* --------------------------------------------------------- */

  /**
   * Séance libre, atelier et créations.
   *
   * L'onglet a grandi au point de mériter son propre fichier : il tient
   * désormais quatre ateliers, dont un éditeur de parcours et un générateur.
   * Le menu se contente de lui passer la main.
   */
  private renderTest(): string {
    return this.panneauTest.render();
  }

  private renderParams(): string {
    const d = this.career.save.difficulty;
    const btn = (val: string, label: string, desc: string) => `
      <button class="diff-btn ${d === val ? 'active' : ''}" data-difficulty="${val}">
        <span>${label}</span><small>${desc}</small>
      </button>`;
    const moyenne = Math.round(
      (this.career.save.stats.flat +
        this.career.save.stats.climb +
        this.career.save.stats.sprint +
        this.career.save.stats.endurance) /
        4
    );
    return `
      <div class="panel-params">
        <div class="perso-block">
          <h3>Difficulté des adversaires</h3>
          <div class="diff-row">
            ${DIFFICULTES.map((x) => btn(x.id, x.label, x.description)).join('')}
          </div>
          <p class="hint">
            S'applique dès la prochaine étape. Ta moyenne actuelle est de
            <b>${moyenne}</b> ${
              moyenne >= 90
                ? '— au-delà de 90, passe à Expert ou plus, sinon les adversaires butent sur le plafond humain et la course devient facile.'
                : moyenne >= 75
                  ? '— Difficile devrait encore te résister.'
                  : '— reste sur Normal le temps de progresser.'
            }
          </p>
          <p class="hint">
            À partir d'<b>Expert</b>, les adversaires dépassent 100 en
            caractéristiques, disposent d'une réserve d'énergie plus grande, ne
            sont plus freinés quand ils te distancent, et le peloton chasse
            beaucoup plus dur.
          </p>
        </div>
        <div class="perso-block">
          <h3>Mon compte <small>retrouver sa partie sur un autre appareil</small></h3>
          <p class="hint" id="sync-dispo">${this.texteDispo()}</p>
          <div class="cd-grille">
            <label class="field">
              <span>Identifiant</span>
              <input type="text" id="sync-id" maxlength="24" placeholder="pogacar2000"
                     value="${(this.career.save.syncId ?? '').replace(/"/g, '&quot;')}">
            </label>
            <label class="field">
              <span>Code personnel <small>(à retenir)</small></span>
              <input type="text" id="sync-code" maxlength="24" placeholder="4 caractères minimum"
                     value="${(this.career.save.syncCode ?? '').replace(/"/g, '&quot;')}">
            </label>
          </div>
          <label class="check">
            <input type="checkbox" id="sync-musique" checked>
            Inclure la musique importée (envoi plus long, 3 Mo par morceau maximum)
          </label>
          <div class="peloton-actions">
            <button class="btn-secondary" data-sync="envoyer">Envoyer ma partie</button>
            <button class="btn-secondary" data-sync="recuperer">Récupérer ma partie</button>
          </div>
          <p class="hint" id="sync-etat">${this.syncEtat}</p>
          <p class="hint">
            Choisis un identifiant et un code, puis <b>Envoyer</b>. Sur l'autre
            appareil, saisis les deux mêmes et fais <b>Récupérer</b> : coureurs,
            équipes, réglages, carrière et musique reviennent à l'identique.
            Récupérer remplace la partie en cours sur cet appareil.
          </p>
        </div>
        <div class="perso-block">
          <h3>Son</h3>
          <label class="check">
            <input type="checkbox" id="son-coupe" ${this.career.save.sonCoupe ? 'checked' : ''}>
            Couper tout le son
          </label>
          <div class="vol-row">
            <label class="vol"><span>Général</span>
              <input type="range" id="vol-master" min="0" max="100"
                     value="${Math.round((this.career.save.volMaster ?? 0.75) * 100)}">
            </label>
            <label class="vol"><span>Musique</span>
              <input type="range" id="vol-musique" min="0" max="100"
                     value="${Math.round((this.career.save.volMusique ?? 0.55) * 100)}">
            </label>
            <label class="vol"><span>Effets</span>
              <input type="range" id="vol-effets" min="0" max="100"
                     value="${Math.round((this.career.save.volEffets ?? 0.8) * 100)}">
            </label>
          </div>
          <div id="musique-etat"></div>
          <input type="file" id="import-musique" accept="audio/*,.mp3,.ogg,.m4a,.wav" hidden>
          <p class="hint">
            Importe tes propres morceaux : clique sur une ambiance ci-dessus et
            choisis un fichier. Ils restent sur cet appareil, rien n'est envoyé
            en ligne. Chaque ambiance sans morceau garde la musique générée
            par le jeu.
          </p>
        </div>
        <div class="perso-block">
          <h3>En course</h3>
          <label class="check">
            <input type="checkbox" id="noms-coureurs" ${this.career.save.nomsCoureurs !== false ? 'checked' : ''}>
            Afficher le nom des coureurs au-dessus de leur tête
          </label>
          <p class="hint">
            Seuls les neuf coureurs les plus proches sont nommés, et le nom
            s'efface avec la distance : de quoi reconnaître qui est autour de
            toi sans encombrer la route.
          </p>
          <h3>Crevaisons</h3>
          <div class="diff-row">
            ${(
              [
                ['aucune', 'Aucune', 'jamais de crevaison'],
                ['normale', 'Normale', 'comme aujourd\'hui'],
                ['frequente', 'Fréquente', 'plus de casse mécanique']
              ] as const
            )
              .map(
                ([v, l, desc]) =>
                  `<button class="diff-btn ${(this.career.save.crevaisonFrequence ?? 'normale') === v ? 'active' : ''}"
                     data-crevaison="${v}">
                     <span>${l}</span><small>${desc}</small>
                   </button>`
              )
              .join('')}
          </div>
        </div>
        <div class="perso-block">
          <h3>Affichage</h3>
          <div class="diff-row">
            ${(['auto', 'elevee', 'moyenne', 'basse'] as const)
              .map(
                (q) => `<button class="diff-btn ${this.career.save.quality === q ? 'active' : ''}"
                          data-quality="${q}">
                          <span>${qualityLabel(q)}</span>
                          <small>${
                            q === 'auto'
                              ? 'détecte la machine'
                              : q === 'elevee'
                                ? 'ombres, reflets, foule dense'
                                : q === 'moyenne'
                                  ? 'sans reflets, foule réduite'
                                  : 'sans ombres, le plus fluide'
                          }</small>
                        </button>`
              )
              .join('')}
          </div>
          <p class="hint">
            Si l'écran devient blanc ou saccadé pendant la course, passe en
            <b>Moyenne</b> ou <b>Basse</b>. Le navigateur des consoles et les
            machines anciennes ne supportent pas toujours les reflets d'environnement.
          </p>
          ${
            fullscreenDisponible()
              ? `<div class="fs-row">
                   <button class="btn-secondary" data-action="fullscreen">${
                     this.fsActif ? 'Quitter le plein écran' : 'Passer en plein écran'
                   }</button>
                   <label class="check">
                     <input type="checkbox" id="auto-fs" ${this.career.save.autoFullscreen !== false ? 'checked' : ''}>
                     Plein écran automatique au départ d'une étape
                   </label>
                 </div>
                 <p class="hint">
                   Recommandé sur console : le navigateur intercepte sinon certains
                   boutons de la manette (Y notamment) pour sa propre interface.
                   Touche <b>F</b> ou bouton <b>Start</b> pour basculer à tout moment.
                 </p>`
              : ''
          }
        </div>
        <div class="perso-block">
          <h3>Manette</h3>
          <p class="hint" id="pad-status">Aucune manette détectée. Branche une manette Xbox ou PlayStation, puis appuie sur un bouton : elle est reconnue automatiquement.</p>
          <table class="pad-table">
            <tr><td>Gâchette droite <b>RT / R2</b></td><td>accélérer</td></tr>
            <tr><td>Gâchette gauche <b>LT / L2</b></td><td>ralentir, récupérer</td></tr>
            <tr><td>Stick gauche ou croix</td><td>placement sur la route</td></tr>
            <tr><td><b>A</b> / <b>Croix</b></td><td>sprint, danseuse — et valider dans les menus</td></tr>
            <tr><td><b>X</b> / <b>Carré</b> ou <b>LB</b> / <b>L1</b></td><td>boire un bidon</td></tr>
            <tr><td><b>Y</b> / <b>Triangle</b> ou <b>RB</b> / <b>R1</b></td><td>avaler un gel</td></tr>
            <tr><td><b>Start</b> / <b>Options</b></td><td>plein écran</td></tr>
            <tr><td><b>LB / RB</b>, <b>L1 / R1</b></td><td>changer d'onglet dans le menu</td></tr>
          </table>
        </div>
        <div class="perso-block">
          <h3>Course</h3>
          <p class="hint">
            Tu pars avec 4 bidons et 3 gels : B pour boire (+26 énergie progressive),
            G pour un gel (+16 immédiat). La zone de ravitaillement à mi-étape refait le plein.
            ESPACE lance le sprint : le coureur se met en danseuse, plus rapide mais très coûteux.
          </p>
        </div>
        <div class="perso-block">
          <h3>Données</h3>
          <button class="btn-danger" data-action="reset">Réinitialiser la carrière</button>
        </div>
      </div>`;
  }

  /* --------------------------------------------------------- */

  private bindTabs(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        this.panel = b.dataset.tab as Panel;
        this.render();
      });
    });
  }

  private bindPanel(nextStage: StageDef | undefined): void {
    const q = <T extends Element>(sel: string) => this.root.querySelector<T>(sel);
    const save = this.career.save;

    q<HTMLButtonElement>('[data-action="play"]')?.addEventListener('click', () => {
      if (nextStage) this.onPlay(nextStage);
    });

    q<HTMLButtonElement>('[data-action="restart-tour"]')?.addEventListener('click', () => {
      this.career.restartTour();
      this.render();
    });

    q<HTMLButtonElement>('[data-action="reset"]')?.addEventListener('click', () => {
      if (confirm('Effacer toute la carrière ?')) {
        this.career.reset();
        this.render();
      }
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-tour]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.tour!;
        if (id === this.career.save.tour.tourId) return;
        if (
          this.career.save.tour.currentStage > 0 &&
          !this.career.save.tour.finished &&
          !confirm('Changer de grand tour va effacer la progression du tour en cours. Continuer ?')
        ) {
          return;
        }
        this.career.selectTour(id);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-cls]').forEach((b) => {
      b.addEventListener('click', () => {
        this.classementTab = b.dataset.cls as ClassementKey;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-atelier]').forEach((b) => {
      b.addEventListener('click', () => {
        this.atelierTab = b.dataset.atelier as AtelierTab;
        this.render();
      });
    });

    const majAudio = () => {
      this.career.persist();
      this.onAudioChange?.();
    };
    const majEtat = (txt: string, classe = '') => {
      this.syncEtat = txt;
      const el = this.root.querySelector('#sync-etat');
      if (el) {
        el.textContent = txt;
        el.className = `hint ${classe}`;
      }
    };
    const champsSync = () => ({
      id: q<HTMLInputElement>('#sync-id')?.value ?? '',
      code: q<HTMLInputElement>('#sync-code')?.value ?? '',
      musique: q<HTMLInputElement>('#sync-musique')?.checked ?? true
    });

    q<HTMLButtonElement>('[data-sync="envoyer"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const { id, code, musique } = champsSync();
      btn.disabled = true;
      majEtat('Envoi en cours…');
      const r = await this.sync?.envoyer(id, code, musique, (t) => majEtat(t));
      btn.disabled = false;
      majEtat(r ? `${r.message}${r.detail ? ' — ' + r.detail : ''}` : 'Indisponible', r?.ok ? 'ok' : 'lost');
    });

    q<HTMLButtonElement>('[data-sync="recuperer"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const { id, code } = champsSync();
      if (!confirm('Récupérer remplacera la partie en cours sur cet appareil. Continuer ?')) return;
      btn.disabled = true;
      majEtat('Récupération en cours…');
      const r = await this.sync?.recuperer(id, code, (t) => majEtat(t));
      btn.disabled = false;
      if (r?.ok) {
        majEtat(`${r.message} — ${r.detail ?? ''}`, 'ok');
        this.onSyncApplied?.();
      } else {
        majEtat(r ? `${r.message}${r.detail ? ' — ' + r.detail : ''}` : 'Indisponible', 'lost');
      }
    });

    q<HTMLInputElement>('#noms-coureurs')?.addEventListener('change', (e) => {
      save.nomsCoureurs = (e.target as HTMLInputElement).checked;
      this.career.persist();
      this.onNameTagsChange?.();
    });

    q<HTMLInputElement>('#son-coupe')?.addEventListener('change', (e) => {
      save.sonCoupe = (e.target as HTMLInputElement).checked;
      majAudio();
    });
    for (const [id, champ] of [
      ['#vol-master', 'volMaster'],
      ['#vol-musique', 'volMusique'],
      ['#vol-effets', 'volEffets']
    ] as [string, 'volMaster' | 'volMusique' | 'volEffets'][]) {
      q<HTMLInputElement>(id)?.addEventListener('input', (e) => {
        save[champ] = Number((e.target as HTMLInputElement).value) / 100;
        majAudio();
      });
    }

    q<HTMLButtonElement>('[data-action="fullscreen"]')?.addEventListener('click', () => {
      void basculerFullscreen().then((a) => this.setFullscreen(a));
    });

    q<HTMLInputElement>('#auto-fs')?.addEventListener('change', (e) => {
      save.autoFullscreen = (e.target as HTMLInputElement).checked;
      this.career.persist();
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((b) => {
      b.addEventListener('click', () => {
        save.quality = b.dataset.quality as 'auto' | 'elevee' | 'moyenne' | 'basse';
        this.career.persist();
        this.onQualityChange?.();
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((b) => {
      b.addEventListener('click', () => {
        save.difficulty = b.dataset.difficulty as (typeof DIFFICULTES)[number]['id'];
        this.career.persist();
        this.render();
      });
    });

    /* ---- onglet Test : tout est géré par son propre panneau ---- */
    if (this.panel === 'test') this.panneauTest.bind(this.root);

    this.root.querySelectorAll<HTMLButtonElement>('[data-crevaison]').forEach((b) => {
      b.addEventListener('click', () => {
        save.crevaisonFrequence = b.dataset.crevaison as 'aucune' | 'normale' | 'frequente';
        this.career.persist();
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-acheter-spec]').forEach((b) => {
      b.addEventListener('click', () => {
        if (this.career.debloquerSpecialite(b.dataset.acheterSpec as SpecialiteId)) {
          toast('Spécialité débloquée');
          this.render();
        }
      });
    });
    q<HTMLButtonElement>('[data-acheter-emplacement]')?.addEventListener('click', () => {
      if (this.career.acheterEmplacement()) {
        toast('Nouvel emplacement de spécialité');
        this.render();
      }
    });
    q<HTMLButtonElement>('[data-acheter-bidon]')?.addEventListener('click', () => {
      if (this.career.acheterBidon()) {
        toast('Bidon supplémentaire acquis');
        this.render();
      }
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((b) => {
      b.addEventListener('click', () => {
        this.career.upgrade(b.dataset.upgrade as keyof RiderStats);
        this.render();
      });
    });

    /* ---- atelier : mise à jour sans re-render complet ---- */
    const refresh = () => {
      this.career.persist();
      this.preview.setAppearance(save.appearance);
    };

    this.root.querySelectorAll<HTMLButtonElement>('[data-color-field]').forEach((b) => {
      b.addEventListener('click', () => {
        const field = b.dataset.colorField as keyof typeof save.appearance;
        const value = Number(b.dataset.color);
        (save.appearance[field] as unknown as number) = value;
        this.root
          .querySelectorAll(`[data-color-field="${field}"]`)
          .forEach((o) => o.classList.remove('active'));
        b.classList.add('active');
        refresh();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach((b) => {
      b.addEventListener('click', () => {
        save.appearance.pattern = b.dataset.pattern as JerseyPattern;
        this.root.querySelectorAll('[data-pattern]').forEach((o) => o.classList.remove('active'));
        b.classList.add('active');
        refresh();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-wheels]').forEach((b) => {
      b.addEventListener('click', () => {
        save.appearance.wheels = b.dataset.wheels as WheelStyle;
        this.root.querySelectorAll('[data-wheels]').forEach((o) => o.classList.remove('active'));
        b.classList.add('active');
        refresh();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-beard]').forEach((b) => {
      b.addEventListener('click', () => {
        save.appearance.beard = b.dataset.beard as BeardStyle;
        this.root.querySelectorAll('[data-beard]').forEach((o) => o.classList.remove('active'));
        b.classList.add('active');
        refresh();
      });
    });

    q<HTMLInputElement>('#rider-tattoo')?.addEventListener('change', (e) => {
      save.appearance.tattoo = (e.target as HTMLInputElement).checked;
      this.root.querySelector('#tattoo-color-field')?.classList.toggle('hidden', !save.appearance.tattoo);
      refresh();
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-sponsor]').forEach((b) => {
      b.addEventListener('click', () => {
        save.appearance.sponsor = b.dataset.sponsor!;
        const input = q<HTMLInputElement>('#sponsor');
        if (input) input.value = save.appearance.sponsor;
        refresh();
      });
    });

    q<HTMLInputElement>('#sponsor')?.addEventListener('input', (e) => {
      save.appearance.sponsor = (e.target as HTMLInputElement).value.toUpperCase();
      refresh();
    });

    q<HTMLInputElement>('#rider-name')?.addEventListener('input', (e) => {
      save.name = (e.target as HTMLInputElement).value || 'Coureur';
      this.career.persist();
    });

    q<HTMLInputElement>('#rider-team')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      save.team = v || 'Sans équipe';
      this.career.persist();
      toast(`Équipe : ${save.team}`);
    });

    q<HTMLInputElement>('#rider-age')?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (v >= 18 && v <= 42) {
        save.age = v;
        this.career.persist();
      }
    });
  }
}
