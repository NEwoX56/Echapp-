/**
 * Moteur audio.
 *
 * Tout est synthétisé à l'exécution : aucun fichier son n'est téléchargé, ce
 * qui garde le jeu léger sur une connexion de console et évite toute question
 * de licence. Les sons sont construits à partir d'oscillateurs et de bruit
 * filtré, comme sur un synthétiseur analogique.
 *
 * Le contexte audio ne peut démarrer que sur un geste de l'utilisateur : les
 * navigateurs bloquent tout son avant un clic ou un appui. `resume()` est donc
 * appelé au premier départ d'étape.
 */

export type Bus = 'musique' | 'effets';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private busMusique: GainNode | null = null;
  private busEffets: GainNode | null = null;

  /** bruit blanc réutilisé par tous les effets : générer 2 s suffit */
  private bruit: AudioBuffer | null = null;

  private volMaster = 0.75;
  private volMusique = 0.55;
  private volEffets = 0.8;
  private coupe = false;

  /* --- boucles continues --- */
  private vent: { src: AudioBufferSourceNode; filtre: BiquadFilterNode; gain: GainNode } | null =
    null;
  private foule: { src: AudioBufferSourceNode; filtre: BiquadFilterNode; gain: GainNode } | null =
    null;
  private roulement: { osc: OscillatorNode; gain: GainNode } | null = null;

  get context(): AudioContext | null {
    return this.ctx;
  }
  get pret(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }
  get musiqueBus(): GainNode | null {
    return this.busMusique;
  }
  /** exposé pour les tests automatisés */
  get effetsBus(): GainNode | null {
    return this.busEffets;
  }

  /** à appeler depuis un geste utilisateur */
  async resume(): Promise<boolean> {
    try {
      if (!this.ctx) this.init();
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  private init(): void {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.coupe ? 0 : this.volMaster;
      // limiteur doux : évite la saturation quand plusieurs sons se cumulent
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      this.master.connect(comp);
      comp.connect(ctx.destination);

      this.busMusique = ctx.createGain();
      this.busMusique.gain.value = this.volMusique;
      this.busMusique.connect(this.master);

      this.busEffets = ctx.createGain();
      this.busEffets.gain.value = this.volEffets;
      this.busEffets.connect(this.master);

      this.bruit = this.creerBruit(ctx);
    } catch {
      this.ctx = null;
    }
  }

  private creerBruit(ctx: AudioContext): AudioBuffer {
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // bruit rose approché : plus naturel que le bruit blanc pour le vent
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57555 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    return buf;
  }

  private sortie(bus: Bus): GainNode | null {
    return bus === 'musique' ? this.busMusique : this.busEffets;
  }

  /* ---------------- réglages ---------------- */

  setVolumes(master: number, musique: number, effets: number): void {
    this.volMaster = master;
    this.volMusique = musique;
    this.volEffets = effets;
    if (this.master) this.master.gain.value = this.coupe ? 0 : master;
    if (this.busMusique) this.busMusique.gain.value = musique;
    if (this.busEffets) this.busEffets.gain.value = effets;
  }

  setCoupe(coupe: boolean): void {
    this.coupe = coupe;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(coupe ? 0 : this.volMaster, this.ctx.currentTime, 0.05);
    }
  }

  get estCoupe(): boolean {
    return this.coupe;
  }

  /* ---------------- effets ponctuels ---------------- */

  /** bip du décompte ; aigu au dernier pour marquer le départ */
  bip(aigu = false): void {
    const ctx = this.ctx;
    const out = this.sortie('effets');
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = aigu ? 880 : 440;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + (aigu ? 0.5 : 0.16));
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + (aigu ? 0.55 : 0.2));
  }

  /** cloche du dernier kilomètre */
  cloche(): void {
    const ctx = this.ctx;
    const out = this.sortie('effets');
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    // trois partiels inharmoniques : c'est ce qui donne le timbre métallique
    for (const [ratio, niveau, duree] of [
      [1, 0.3, 1.8],
      [2.76, 0.16, 1.2],
      [5.4, 0.09, 0.7]
    ] as [number, number, number][]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660 * ratio;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(niveau, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0008, t + duree);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + duree + 0.05);
    }
  }

  /** gorgée de bidon : bruit filtré descendant */
  gorgee(): void {
    const ctx = this.ctx;
    const out = this.sortie('effets');
    if (!ctx || !out || !this.bruit) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bruit;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(280, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + 0.45);
  }

  /** emballage sec : sachet de gel */
  sachet(): void {
    const ctx = this.ctx;
    const out = this.sortie('effets');
    if (!ctx || !out || !this.bruit) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bruit;
    src.playbackRate.value = 1.8;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + 0.25);
  }

  /** changement de vitesse : claquement de dérailleur */
  derailleur(): void {
    const ctx = this.ctx;
    const out = this.sortie('effets');
    if (!ctx || !out || !this.bruit) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.bruit;
      src.playbackRate.value = 2.4;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 3200 + i * 900;
      f.Q.value = 9;
      const g = ctx.createGain();
      const t0 = t + i * 0.045;
      g.gain.setValueAtTime(0.18, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t0);
      src.stop(t0 + 0.08);
    }
  }

  /** acclamation ponctuelle quand on passe une ligne */
  acclamation(force = 1): void {
    const ctx = this.ctx;
    const out = this.sortie('effets');
    if (!ctx || !out || !this.bruit) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bruit;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3 * force, t + 0.25);
    g.gain.setValueAtTime(0.3 * force, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + 2.7);
  }

  /* ---------------- boucles continues ---------------- */

  /** démarre vent, foule et roulement ; sans effet si déjà lancés */
  demarrerAmbiance(): void {
    const ctx = this.ctx;
    const out = this.sortie('effets');
    if (!ctx || !out || !this.bruit || this.vent) return;

    // vent : bruit rose passe-bas, la fréquence monte avec la vitesse
    {
      const src = ctx.createBufferSource();
      src.buffer = this.bruit;
      src.loop = true;
      const filtre = ctx.createBiquadFilter();
      filtre.type = 'lowpass';
      filtre.frequency.value = 500;
      filtre.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filtre);
      filtre.connect(gain);
      gain.connect(out);
      src.start();
      this.vent = { src, filtre, gain };
    }

    // foule : bruit à bande étroite, module par la proximité des barrières
    {
      const src = ctx.createBufferSource();
      src.buffer = this.bruit;
      src.loop = true;
      src.playbackRate.value = 0.85;
      const filtre = ctx.createBiquadFilter();
      filtre.type = 'bandpass';
      filtre.frequency.value = 1000;
      filtre.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filtre);
      filtre.connect(gain);
      gain.connect(out);
      src.start();
      this.foule = { src, filtre, gain };
    }

    // roulement des pneus : sinus grave dont la hauteur suit la vitesse
    {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 180;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(f);
      f.connect(gain);
      gain.connect(out);
      osc.start();
      this.roulement = { osc, gain };
    }
  }

  /**
   * Met à jour l'ambiance selon l'état de course.
   * vitesse en m/s, foule 0..1, effort 0..1
   */
  majAmbiance(vitesse: number, foule: number, effort: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = Math.max(0, Math.min(1, vitesse / 22));

    if (this.vent) {
      this.vent.gain.gain.setTargetAtTime(0.05 + v * 0.3, t, 0.25);
      this.vent.filtre.frequency.setTargetAtTime(320 + v * 1500, t, 0.3);
    }
    if (this.foule) {
      this.foule.gain.gain.setTargetAtTime(foule * 0.34, t, 0.4);
      this.foule.filtre.frequency.setTargetAtTime(850 + foule * 700, t, 0.5);
    }
    if (this.roulement) {
      this.roulement.gain.gain.setTargetAtTime(v * 0.075 * (0.6 + effort * 0.5), t, 0.3);
      this.roulement.osc.frequency.setTargetAtTime(38 + v * 46, t, 0.25);
    }
  }

  arreterAmbiance(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const n of [this.vent, this.foule]) {
      if (n) {
        n.gain.gain.setTargetAtTime(0, t, 0.2);
        n.src.stop(t + 1.2);
      }
    }
    if (this.roulement) {
      this.roulement.gain.gain.setTargetAtTime(0, t, 0.2);
      this.roulement.osc.stop(t + 1.2);
    }
    this.vent = null;
    this.foule = null;
    this.roulement = null;
  }
}
