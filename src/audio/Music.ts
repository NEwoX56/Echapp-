import type { AudioEngine } from './AudioEngine';

/**
 * Musique générative.
 *
 * Rien n'est enregistré : la musique est composée à la volée à partir d'une
 * grille d'accords et jouée par des voix synthétisées. C'est ce qui permet
 * d'avoir une bande-son originale de quelques kilo-octets, et surtout de la
 * faire réagir à la course — la tension monte dans les cols et dans le
 * dernier kilomètre sans coupure ni raccord audible.
 *
 * Le séquenceur travaille en avance de phase : il programme à l'avance les
 * notes à venir sur l'horloge audio, qui est indépendante du taux de
 * rafraîchissement. Le tempo reste donc juste même quand le rendu tombe à 20
 * images par seconde sur console.
 *
 * La fenêtre d'anticipation est large (0,7 s) et non 0,1 s comme le veut
 * l'usage : sur une machine chargée, `setInterval` est déprogrammé et peut
 * sauter plusieurs centaines de millisecondes. Avec une fenêtre courte, ces
 * décrochages se traduisent par des trous audibles dans la musique. La
 * contrepartie — les variations d'intensité s'appliquent avec un peu de
 * retard — ne s'entend pas.
 *
 * Le séquenceur est en outre appelé depuis la boucle de jeu en plus de son
 * minuteur : si l'un des deux est ralenti, l'autre prend le relais.
 */

export type Ambiance = 'menu' | 'course' | 'tension' | 'finale' | 'victoire' | 'aucune';

/** demi-tons depuis le la 440, par degré de gamme mineure naturelle */
const MINEURE = [0, 2, 3, 5, 7, 8, 10];

interface Grille {
  /** degrés de la fondamentale de chaque mesure */
  accords: number[];
  bpm: number;
  /** transposition en demi-tons */
  tonique: number;
  batterie: boolean;
  arpege: boolean;
  /** densité de la charleston, 0..1 */
  densite: number;
}

const GRILLES: Record<Exclude<Ambiance, 'aucune'>, Grille> = {
  // menu : lent, aéré, sans batterie — on doit pouvoir lire les textes
  menu: { accords: [0, 5, 3, 4], bpm: 76, tonique: -3, batterie: false, arpege: true, densite: 0 },
  // course : moteur régulier, ça avance
  course: { accords: [0, 0, 5, 5, 3, 3, 4, 4], bpm: 132, tonique: 0, batterie: true, arpege: true, densite: 0.55 },
  // tension : montée, adversaire dangereux — accords instables, tempo plus vif
  tension: { accords: [0, 1, 0, 6, 5, 1, 4, 4], bpm: 144, tonique: 0, batterie: true, arpege: true, densite: 0.8 },
  // dernier kilomètre : tout est ouvert, batterie serrée
  finale: { accords: [0, 4, 5, 4, 0, 4, 6, 4], bpm: 156, tonique: 2, batterie: true, arpege: true, densite: 1 },
  // victoire : majeur, lumineux
  victoire: { accords: [0, 4, 5, 3], bpm: 108, tonique: 4, batterie: true, arpege: true, densite: 0.4 }
};

function midiVersHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** note de la gamme mineure ; degre peut dépasser l'octave */
function noteGamme(degre: number, tonique: number, octave: number): number {
  const o = Math.floor(degre / 7);
  const d = ((degre % 7) + 7) % 7;
  return 57 + tonique + MINEURE[d] + (octave + o) * 12;
}

export class Music {
  private engine: AudioEngine;
  private ambiance: Ambiance = 'aucune';
  private cible: Ambiance = 'aucune';

  private timer: number | null = null;
  private prochainTemps = 0;
  private pas = 0;
  private bus: GainNode | null = null;
  private gainAmbiance: GainNode | null = null;

  /** intensité 0..1 : ouvre les voix aiguës et la batterie */
  private intensite = 0.5;

  private readonly AVANCE = 0.7;
  private readonly TICK = 60;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  /** change d'ambiance avec un fondu ; sans effet si déjà en cours */
  jouer(ambiance: Ambiance): void {
    if (this.cible === ambiance) return;
    this.cible = ambiance;
    const ctx = this.engine.context;
    if (!ctx) return;

    if (ambiance === 'aucune') {
      this.fondu(0, 0.6);
      window.setTimeout(() => {
        if (this.cible === 'aucune') this.arreter();
      }, 700);
      return;
    }

    if (this.ambiance === 'aucune') {
      this.demarrer(ambiance);
    } else {
      // changement à chaud : on garde la phase du séquenceur pour que la
      // transition tombe dans le tempo au lieu de repartir de zéro
      this.ambiance = ambiance;
      this.fondu(1, 0.8);
    }
  }

  setIntensite(v: number): void {
    this.intensite = Math.max(0, Math.min(1, v));
  }

  private fondu(valeur: number, duree: number): void {
    const ctx = this.engine.context;
    if (!ctx || !this.gainAmbiance) return;
    this.gainAmbiance.gain.setTargetAtTime(valeur, ctx.currentTime, duree / 3);
  }

  private demarrer(ambiance: Ambiance): void {
    const ctx = this.engine.context;
    const bus = this.engine.musiqueBus;
    if (!ctx || !bus) return;
    this.ambiance = ambiance;
    this.bus = bus;

    this.gainAmbiance = ctx.createGain();
    this.gainAmbiance.gain.value = 0;
    this.gainAmbiance.connect(bus);
    this.fondu(1, 1.2);

    this.pas = 0;
    this.prochainTemps = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.sequenceur(), this.TICK);
  }

  private arreter(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.gainAmbiance?.disconnect();
    this.gainAmbiance = null;
    this.ambiance = 'aucune';
  }

  private grille(): Grille {
    return GRILLES[(this.ambiance === 'aucune' ? 'menu' : this.ambiance) as Exclude<Ambiance, 'aucune'>];
  }

  /** à appeler depuis la boucle de jeu, en renfort du minuteur interne */
  tick(): void {
    this.sequenceur();
  }

  /** programme à l'avance les pas qui tombent dans la fenêtre à venir */
  private sequenceur(): void {
    const ctx = this.engine.context;
    if (!ctx || this.ambiance === 'aucune') return;
    const g = this.grille();
    const dureeCroche = 30 / g.bpm; // une croche

    let garde = 0;
    while (this.prochainTemps < ctx.currentTime + this.AVANCE && garde++ < 128) {
      this.jouerPas(this.pas, this.prochainTemps, g);
      this.prochainTemps += dureeCroche;
      this.pas += 1;
    }
    // si l'onglet a été mis en arrière-plan, l'horloge a pris de l'avance :
    // on se recale au lieu de rattraper des centaines de pas
    if (this.prochainTemps < ctx.currentTime - 0.3) {
      this.prochainTemps = ctx.currentTime + 0.05;
    }
  }

  private jouerPas(pas: number, t: number, g: Grille): void {
    const parMesure = 8; // croches par mesure
    const mesure = Math.floor(pas / parMesure) % g.accords.length;
    const dansMesure = pas % parMesure;
    const degre = g.accords[mesure];
    const intens = this.intensite;

    // basse : fondamentale sur les temps forts
    if (dansMesure === 0 || dansMesure === 4 || (dansMesure === 6 && intens > 0.6)) {
      this.basse(midiVersHz(noteGamme(degre, g.tonique, 1)), t, dansMesure === 0 ? 0.42 : 0.3);
    }

    // nappe : une fois par mesure, tenue
    if (dansMesure === 0) {
      const tenue = (parMesure * 30) / g.bpm;
      for (const d of [0, 2, 4]) {
        this.nappe(midiVersHz(noteGamme(degre + d, g.tonique, 3)), t, tenue * 1.05);
      }
    }

    // arpège : monte dans l'accord, se densifie avec l'intensité
    if (g.arpege) {
      const motif = [0, 2, 4, 2, 4, 6, 4, 2];
      const jouer = intens > 0.35 || dansMesure % 2 === 0;
      if (jouer) {
        const oct = intens > 0.7 ? 5 : 4;
        this.pincee(midiVersHz(noteGamme(degre + motif[dansMesure], g.tonique, oct)), t, 0.16 + intens * 0.1);
      }
    }

    // batterie
    if (g.batterie) {
      if (dansMesure === 0 || dansMesure === 4) this.grosseCaisse(t);
      if (dansMesure === 2 || dansMesure === 6) this.caisseClaire(t, 0.16 + intens * 0.1);
      const densite = g.densite * (0.5 + intens * 0.5);
      if (dansMesure % 2 === 1 ? densite > 0.6 : densite > 0.2) {
        this.charleston(t, 0.05 + densite * 0.05);
      }
    }
  }

  /* ---------------- voix ---------------- */

  private sortie(): AudioNode | null {
    return this.gainAmbiance;
  }

  private basse(hz: number, t: number, niveau: number): void {
    const ctx = this.engine.context;
    const out = this.sortie();
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = hz;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(340, t);
    f.frequency.exponentialRampToValueAtTime(150, t + 0.28);
    f.Q.value = 5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(niveau, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(f);
    f.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.34);
  }

  private nappe(hz: number, t: number, duree: number): void {
    const ctx = this.engine.context;
    const out = this.sortie();
    if (!ctx || !out) return;
    // deux oscillateurs légèrement désaccordés : c'est ce qui épaissit le son
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = hz;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + duree * 0.3);
      gain.gain.linearRampToValueAtTime(0.035, t + duree * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duree);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + duree + 0.05);
    }
  }

  private pincee(hz: number, t: number, niveau: number): void {
    const ctx = this.engine.context;
    const out = this.sortie();
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(hz * 5, t);
    f.frequency.exponentialRampToValueAtTime(hz * 1.6, t + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(niveau, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(f);
    f.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  private grosseCaisse(t: number): void {
    const ctx = this.engine.context;
    const out = this.sortie();
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  private caisseClaire(t: number, niveau: number): void {
    const ctx = this.engine.context;
    const out = this.sortie();
    if (!ctx || !out) return;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(niveau, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f);
    f.connect(gain);
    gain.connect(out);
    n.start(t);
    n.stop(t + 0.2);
  }

  private charleston(t: number, niveau: number): void {
    const ctx = this.engine.context;
    const out = this.sortie();
    if (!ctx || !out) return;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(niveau, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(f);
    f.connect(gain);
    gain.connect(out);
    n.start(t);
    n.stop(t + 0.07);
  }

  dispose(): void {
    this.arreter();
    this.cible = 'aucune';
  }
}
