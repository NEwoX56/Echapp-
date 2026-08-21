import type { StageDef } from '../data/types';
import type { RaceHudState } from '../race/Race';
import { profileRadarSvg, TYPE_LABEL, formatTime } from './util';
import { logoTour, ICONES, pastilleMaillot, type GroupeCourse } from './RaceGroups';

export class HUD {
  private root: HTMLElement;
  private els!: {
    energyFill: HTMLElement;
    speed: HTMLElement;
    pos: HTMLElement;
    remaining: HTMLElement;
    grade: HTMLElement;
    profile: HTMLElement;
    draft: HTMLElement;
    boost: HTMLElement;
    bonk: HTMLElement;
    danseuse: HTMLElement;
    bidons: HTMLElement;
    gels: HTMLElement;
    marker: HTMLElement;
    tvGroupes: HTMLElement;
    tvLogo: HTMLElement;
    gaps: HTMLElement;
    radarLegend: HTMLElement;
    radio: HTMLElement;
    radioText: HTMLElement;
    keyBidon: HTMLElement;
    keyGel: HTMLElement;
    effortFill: HTMLElement;
    clock: HTMLElement;
    countdown: HTMLElement;
    finishFlash: HTMLElement;
  };
  private stage!: StageDef;
  private profileTick = 0;
  private tourId = 'cimes';

  /** format des écarts façon retransmission : 2'02" ou 34" */
  private ecart(s: number): string {
    const t = Math.max(0, Math.round(s));
    const m = Math.floor(t / 60);
    const r = t % 60;
    // au-delà de l'heure on passe en h min : « 87'12" » ne se lit pas
    if (m >= 60) return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`;
    return m > 0 ? `${m}'${r.toString().padStart(2, '0')}"` : `${r}"`;
  }

  /** distances à la virgule, comme sur les incrustations télévisées */
  private km(v: number): string {
    return `${v.toFixed(1).replace('.', ',')} km`;
  }

  /**
   * Bandeau des groupes.
   *
   * Réécrit uniquement quand le contenu change réellement. Sans cette
   * signature, on reconstruirait le HTML soixante fois par seconde et le
   * texte scintillerait.
   */
  private majBandeau(groupes: GroupeCourse[]): void {
    if (!this.els?.tvGroupes) return;
    if (this.els.tvLogo.dataset.tour !== this.tourId) {
      this.els.tvLogo.dataset.tour = this.tourId;
      this.els.tvLogo.innerHTML = logoTour(this.tourId);
    }

    const sig = groupes
      .map((g) => `${g.nom}|${g.effectif}|${Math.round(g.retard)}|${g.kmRestants?.toFixed(1) ?? ''}`)
      .join('/');
    if (sig === this.tvSignature) return;
    this.tvSignature = sig;

    this.els.tvGroupes.innerHTML = groupes
      .map((g, i) => {
        if (i === 0) {
          const sommet =
            g.kmSommet !== null
              ? `<div class="tv-ligne tv-sommet">${ICONES.montagne}<span class="tv-val">${this.km(g.kmSommet)}</span></div>`
              : '';
          return `<div class="tv-groupe tv-tete">
              <div class="tv-titre">Tête de la course</div>
              <div class="tv-ligne">
                ${ICONES.drapeau}
                <span class="tv-nb">${g.effectif}</span>
                ${g.avecJaune ? pastilleMaillot('#ffd633') : ''}
                <span class="tv-val">${this.km(g.kmRestants ?? 0)}</span>
              </div>
              ${sommet}
            </div>`;
        }
        return `<div class="tv-groupe ${g.avecJoueur ? 'tv-moi' : ''}">
            <div class="tv-titre">${g.nom}</div>
            <div class="tv-ligne">
              <span class="tv-fleche">${ICONES.ecart}</span>
              <span class="tv-nb">${g.effectif}</span>
              ${g.avecJaune ? pastilleMaillot('#ffd633') : ''}
              <span class="tv-val">${this.ecart(g.retard)}</span>
            </div>
          </div>`;
      })
      .join('');
  }
  /** signature du dernier bandeau rendu, pour ne pas réécrire pour rien */
  private tvSignature = '';
  private padShown: boolean | null = null;

  /** bascule les libellés de touches entre clavier et manette */
  setGamepad(connected: boolean): void {
    if (this.padShown === connected) return;
    // ne mémoriser l'état qu'une fois réellement appliqué : si le HUD n'est pas
    // encore monté, il faut pouvoir réessayer à la frame suivante
    if (!this.els?.keyBidon) return;
    this.padShown = connected;
    this.els.keyBidon.textContent = connected ? 'X' : 'B';
    this.els.keyGel.textContent = connected ? 'Y' : 'G';
    this.els.keyBidon.classList.toggle('pad', connected);
    this.els.keyGel.classList.toggle('pad', connected);
  }

  constructor(root: HTMLElement) {
    this.root = root;
  }

  mount(stage: StageDef, tourId = 'cimes'): void {
    this.stage = stage;
    this.tourId = tourId;
    this.tvSignature = '';
    this.root.innerHTML = `
      <div class="hud">
        <div class="tv-bar" id="tv-bar">
          <div class="tv-logo" id="tv-logo"></div>
          <div class="tv-groupes" id="tv-groupes"></div>
        </div>
        <div class="hud-top">
          <div class="hud-stage">
            <div class="hud-stage-name">${stage.name}</div>
            <div class="hud-stage-type">${TYPE_LABEL[stage.type]} · ${stage.displayKm} km</div>
          </div>
          <div class="hud-clock" id="hud-clock">0'00"</div>
          <div class="hud-pos" id="hud-pos">—</div>
        </div>

        <div class="hud-marker hidden" id="hud-marker"></div>
        <div class="hud-radar">
          <div class="hud-profile" id="hud-profile"></div>
          <div class="radar-legend" id="hud-radar-legend"></div>
        </div>
        <div class="hud-gaps" id="hud-gaps"></div>
        <div class="hud-radio hidden" id="hud-radio">
          <span class="radio-icon">📻</span>
          <span class="radio-text" id="hud-radio-text"></span>
        </div>

        <div class="hud-bottom">
          <div class="hud-left">
            <div class="hud-label">Énergie</div>
            <div class="energy-bar"><div id="hud-energy"></div></div>
            <div class="hud-label">Allure</div>
            <div class="effort-bar"><div id="hud-effort"></div></div>
            <div class="hud-badges">
              <span class="badge badge-draft hidden" id="hud-draft">Aspiration</span>
              <span class="badge badge-boost hidden" id="hud-boost">Boost</span>
              <span class="badge badge-bonk hidden" id="hud-bonk">Fringale</span>
              <span class="badge badge-danseuse hidden" id="hud-danseuse">Danseuse</span>
            </div>
            <div class="hud-supplies">
              <span class="supply"><b id="hud-bidons">4</b> bidon(s) <kbd id="hud-key-bidon">B</kbd></span>
              <span class="supply"><b id="hud-gels">3</b> gel(s) <kbd id="hud-key-gel">G</kbd></span>
            </div>
          </div>
          <div class="hud-right">
            <div class="hud-speed"><span id="hud-speed">0</span><small>km/h</small></div>
            <div class="hud-remaining"><span id="hud-remaining">—</span><small>km restants</small></div>
            <div class="hud-grade" id="hud-grade">0 %</div>
          </div>
        </div>

        <div class="hud-countdown" id="hud-countdown"></div>
        <div class="hud-finish hidden" id="hud-finish">LIGNE FRANCHIE</div>
      </div>
    `;
    const g = (id: string) => document.getElementById(id)!;
    this.els = {
      energyFill: g('hud-energy'),
      speed: g('hud-speed'),
      pos: g('hud-pos'),
      remaining: g('hud-remaining'),
      grade: g('hud-grade'),
      profile: g('hud-profile'),
      draft: g('hud-draft'),
      boost: g('hud-boost'),
      bonk: g('hud-bonk'),
      danseuse: g('hud-danseuse'),
      marker: g('hud-marker'),
      tvGroupes: g('tv-groupes'),
      tvLogo: g('tv-logo'),
      gaps: g('hud-gaps'),
      radarLegend: g('hud-radar-legend'),
      keyBidon: g('hud-key-bidon'),
      keyGel: g('hud-key-gel'),
      radio: g('hud-radio'),
      radioText: g('hud-radio-text'),
      bidons: g('hud-bidons'),
      gels: g('hud-gels'),
      effortFill: g('hud-effort'),
      clock: g('hud-clock'),
      countdown: g('hud-countdown'),
      finishFlash: g('hud-finish')
    };
  }

  update(s: RaceHudState): void {
    const e = this.els;
    e.energyFill.style.width = `${s.energy}%`;
    e.energyFill.className = s.energy < 25 ? 'low' : s.energy < 55 ? 'mid' : '';
    e.effortFill.style.width = `${s.effort * 100}%`;
    e.speed.textContent = s.speedKmh.toFixed(0);
    e.pos.textContent = s.fieldSize > 1 ? `P${s.position}/${s.fieldSize}` : 'CLM';
    e.remaining.textContent = s.remainingKm.toFixed(1);
    const gr = s.grade;
    e.grade.textContent = `${gr >= 0 ? '+' : ''}${gr.toFixed(1)} %`;
    e.grade.className = 'hud-grade ' + (gr > 3 ? 'up' : gr < -2 ? 'down' : '');
    e.draft.classList.toggle('hidden', !s.drafting);
    e.boost.classList.toggle('hidden', s.boost <= 0);
    e.bonk.classList.toggle('hidden', s.energy > 0.5);
    e.danseuse.classList.toggle('hidden', !s.standing);

    this.majBandeau(s.groupes);
    // les jauges disparaissent pendant la célébration d'arrivée
    this.root.querySelector('.hud')?.classList.toggle('celebration', !!s.celebration);

    if (s.nextMarker) {
      const m = s.nextMarker;
      const km = (m.inMeters / 1000).toFixed(1);
      e.marker.className = `hud-marker ${m.kind}`;
      const label = m.kind === 'col' ? 'Col' : m.kind === 'sprint' ? 'Sprint' : 'Pavés';
      e.marker.innerHTML = `<b>${label}</b> ${m.name} <span>dans ${km} km</span>`;
    } else {
      e.marker.classList.add('hidden');
    }

    const parts: string[] = [];
    if (s.gapAhead !== null && s.gapAhead < 400) {
      parts.push(`<span class="gap ahead">▲ ${s.gapAhead.toFixed(0)} m</span>`);
    }
    if (s.gapBehind !== null && s.gapBehind < 400) {
      parts.push(`<span class="gap behind">▼ ${s.gapBehind.toFixed(0)} m</span>`);
    }
    e.gaps.innerHTML = parts.join('');
    e.bidons.textContent = String(s.bidons);
    e.gels.textContent = String(s.gels);
    e.clock.textContent = formatTime(s.clock);

    if (s.countdown > 0) {
      e.countdown.textContent = String(Math.ceil(s.countdown));
      e.countdown.classList.remove('hidden');
    } else if (s.countdown > -1) {
      e.countdown.textContent = 'GO';
      setTimeout(() => e.countdown.classList.add('hidden'), 600);
    }

    e.finishFlash.classList.toggle('hidden', !s.finished);

    // le profil SVG n'est régénéré que 5x/s
    this.profileTick -= 1;
    if (this.profileTick <= 0) {
      this.profileTick = 5;
      this.els.profile.innerHTML = profileRadarSvg(
        this.stage,
        300,
        52,
        s.radar.map((r) => ({
          progress: r.progress,
          color: r.color,
          isPlayer: r.isPlayer,
          threat: r.threat,
          teammate: r.teammate,
          fuyard: r.fuyard
        })),
        this.stage.climbs ?? [],
        this.stage.sprints ?? []
      );

      // trois coureurs les plus pertinents autour du joueur
      const me = s.radar.findIndex((r) => r.isPlayer);
      const near = s.radar
        .map((r, i) => ({ r, d: Math.abs(i - me) }))
        .filter((x) => !x.r.isPlayer)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.r)
        .sort((a, b) => b.gapSeconds - a.gapSeconds);

      this.els.radarLegend.innerHTML = near
        .map((r) => {
          const g = r.gapSeconds;
          const sign = g > 0 ? '+' : '';
          const cls = r.teammate ? 'mate' : r.threat > 0.7 ? 'danger' : '';
          const name = r.name.split(' ').pop();
          return `<span class="rl ${cls}">
            <i style="background:${'#' + r.color.toString(16).padStart(6, '0')}"></i>
            ${name} <b>${sign}${g.toFixed(0)}s</b></span>`;
        })
        .join('');
    }

    if (s.radio) {
      this.els.radio.className = `hud-radio ${s.radio.tone}`;
      this.els.radioText.textContent = s.radio.text;
    } else {
      this.els.radio.classList.add('hidden');
    }
  }
}
