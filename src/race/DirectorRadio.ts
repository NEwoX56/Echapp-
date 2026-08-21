import type { ClassementKey } from '../data/appearance';

export interface RadioContext {
  /** distance restante en mètres */
  remaining: number;
  totalLength: number;
  grade: number;
  energy: number;
  drafting: boolean;
  position: number;
  fieldSize: number;
  /** écart en secondes avec le coureur devant (null si en tête) */
  gapAhead: number | null;
  gapBehind: number | null;
  /** adversaires triés par distance décroissante */
  rivals: RivalInfo[];
  nextClimb: { name: string; inMeters: number; category: number; avgGrade: number } | null;
  nextSprint: { name: string; inMeters: number } | null;
  nextVent: { name: string; inMeters: number } | null;
  /** secteur de vent en cours, si le joueur y est */
  bordures: { abrite: boolean } | null;
  /** maillots portés par le joueur */
  jerseys: ClassementKey[];
  stageType: string;
  /** situation collective : échappée, écart, chasse */
  course: {
    phase: string;
    tailleEchappee: number;
    ecart: number;
    joueurDevant: boolean;
    chasse: boolean;
  };
}

export interface RivalInfo {
  id: string;
  name: string;
  /** écart en secondes : positif = devant le joueur */
  gapSeconds: number;
  /** place au classement général avant l'étape */
  gcRank: number;
  /** retard au général sur le joueur, en secondes (négatif = il est devant) */
  gcGapToPlayer: number;
  /** 0 = inoffensif, 1 = danger direct pour le général */
  threat: number;
}

export interface RadioMessage {
  text: string;
  tone: 'info' | 'alerte' | 'tactique' | 'encouragement';
  /** priorité : le plus haut passe en premier */
  priority: number;
}

/**
 * Le directeur sportif dans l'oreillette.
 *
 * Il ne répète pas, il ne parle pas pour ne rien dire, et il hiérarchise :
 * une menace directe au général passe avant un conseil d'allure.
 */
export class DirectorRadio {
  private lastAt = -999;
  private cooldown = 7;
  private saidOnce = new Set<string>();
  /** dernier instant où l'on a parlé de chaque coureur */
  private rivalSaidAt = new Map<string, number>();
  private clock = 0;
  private current: RadioMessage | null = null;
  private currentUntil = 0;

  /** appelé chaque frame ; retourne le message à afficher (ou null) */
  update(clock: number, ctx: RadioContext): RadioMessage | null {
    this.clock = clock;
    if (this.current && clock < this.currentUntil) return this.current;
    this.current = null;

    if (clock - this.lastAt < this.cooldown) return null;

    const candidates = this.analyse(ctx);
    if (!candidates.length) return null;

    candidates.sort((a, b) => b.priority - a.priority);
    const msg = candidates[0];
    this.lastAt = clock;
    this.current = msg;
    this.currentUntil = clock + 5.5;
    return msg;
  }

  private once(key: string): boolean {
    if (this.saidOnce.has(key)) return false;
    this.saidOnce.add(key);
    return true;
  }

  private analyse(c: RadioContext): RadioMessage[] {
    const out: RadioMessage[] = [];
    const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

    /* --- l'échappée : c'est la trame de l'étape --- */
    const cc = c.course;
    if (cc) {
      const min = (s: number) => {
        const m = Math.floor(s / 60);
        const r = Math.round(s % 60);
        return m > 0 ? `${m} min ${r.toString().padStart(2, '0')}` : `${r} s`;
      };

      if (cc.tailleEchappee > 0 && !cc.joueurDevant && this.once('echappee-partie')) {
        out.push({
          text: `${cc.tailleEchappee} coureurs sont partis devant. Le peloton les laisse filer pour l'instant.`,
          tone: 'info',
          priority: 80
        });
      }
      if (cc.joueurDevant && this.once('joueur-devant')) {
        out.push({
          text: "Tu es dans l'échappée. Prends tes relais, mais garde de quoi finir.",
          tone: 'encouragement',
          priority: 86
        });
      }
      // écart annoncé par paliers, comme à la radio d'une vraie course
      const paliers = [30, 60, 120, 180, 240];
      for (const p of paliers) {
        if (cc.ecart >= p && cc.ecart < p + 25 && this.once(`ecart-${p}`)) {
          out.push({
            text: cc.joueurDevant
              ? `Vous avez ${min(cc.ecart)} d'avance sur le peloton. Ça tient.`
              : `L'échappée compte ${min(cc.ecart)} d'avance.`,
            tone: 'info',
            priority: 72
          });
        }
      }
      if (cc.chasse && this.once('chasse-lancee')) {
        out.push({
          text: cc.joueurDevant
            ? 'Le peloton a lancé la chasse derrière vous. Ça va se jouer maintenant.'
            : 'Les équipes se sont mises à rouler, on revient sur les échappés.',
          tone: 'tactique',
          priority: 82
        });
      }
      if (cc.phase === 'regroupement' && this.once('regroupement')) {
        out.push({
          text: "L'échappée est reprise, tout le monde est ensemble.",
          tone: 'info',
          priority: 74
        });
      }
      if (
        cc.joueurDevant &&
        cc.ecart < 15 &&
        cc.ecart > 0 &&
        c.remaining > 400 &&
        this.once('bientot-repris')
      ) {
        out.push({
          text: 'Ils sont à moins de quinze secondes. Soit tu relances, soit tu te relèves.',
          tone: 'alerte',
          priority: 90
        });
      }
    }

    /* --- menace au classement général --- */
    const dangerous = c.rivals
      .filter((r) => r.threat > 0.5 && r.gapSeconds > 3 && r.gapSeconds < 90)
      // on ne reparle pas du même coureur avant 30 s : le directeur n'est pas un perroquet
      .filter((r) => this.clock - (this.rivalSaidAt.get(r.id) ?? -999) > 30)
      .sort((a, b) => b.threat - a.threat);
    if (dangerous.length) {
      const r = dangerous[0];
      this.rivalSaidAt.set(r.id, this.clock);
      const behindMe = r.gcGapToPlayer > 0;
      out.push({
        text: behindMe
          ? `${r.name} est parti devant, ${Math.round(r.gapSeconds)} s. Il est à ${Math.round(r.gcGapToPlayer)} s de toi au général — ne le laisse pas filer.`
          : `${r.name} attaque, ${Math.round(r.gapSeconds)} s d'avance. Il te devance déjà de ${Math.round(-r.gcGapToPlayer)} s au général. Réagis.`,
        tone: 'alerte',
        priority: 95
      });
    }

    /* --- coureur devant mais sans danger : on le laisse partir --- */
    const harmless = c.rivals.filter(
      (r) => r.gapSeconds > 20 && r.threat < 0.2 && r.gcRank > 8
    );
    if (harmless.length && this.once('laisser-filer')) {
      const r = harmless[0];
      out.push({
        text: `${r.name} est devant mais il est ${r.gcRank}e à ${Math.round(Math.abs(r.gcGapToPlayer) / 60)} min au général. Laisse filer, il ne menace rien.`,
        tone: 'tactique',
        priority: 60
      });
    }

    /* --- col à venir --- */
    if (c.nextClimb && c.nextClimb.inMeters < 1600 && c.nextClimb.inMeters > 250) {
      const key = `col-${c.nextClimb.name}`;
      if (this.once(key)) {
        const cat =
          c.nextClimb.category === 0
            ? 'hors catégorie'
            : `${c.nextClimb.category}re catégorie`.replace('1re', '1re').replace(/^([234])re/, '$1e');
        out.push({
          text: `${c.nextClimb.name}, ${cat}, dans ${km(c.nextClimb.inMeters)}. ${
            c.energy < 55
              ? 'Tu es juste en énergie, monte à ton rythme.'
              : 'Tu as de la réserve, tu peux durcir dans la bosse.'
          }`,
          tone: 'info',
          priority: 78
        });
      }
    }

    /* --- sprint intermédiaire --- */
    if (c.nextSprint && c.nextSprint.inMeters < 1100 && c.nextSprint.inMeters > 150) {
      if (this.once(`sprint-${c.nextSprint.name}`)) {
        out.push({
          text: c.jerseys.includes('points')
            ? `Sprint dans ${km(c.nextSprint.inMeters)}. Tu as le maillot vert à défendre, place-toi.`
            : `Sprint dans ${km(c.nextSprint.inMeters)}. Des points à prendre si tu te places bien.`,
          tone: 'tactique',
          priority: 74
        });
      }
    }

    /* --- vent de côté à venir : le peloton risque de se scinder --- */
    if (c.nextVent && c.nextVent.inMeters < 1400 && c.nextVent.inMeters > 250) {
      if (this.once(`vent-${c.nextVent.name}`)) {
        out.push({
          text: `Vent de côté dans ${km(c.nextVent.inMeters)}. Ça va se scinder en bordures, mets-toi devant avant que ça casse.`,
          tone: 'alerte',
          priority: 84
        });
      }
    }
    if (c.bordures && !c.bordures.abrite && this.once('bordures-dehors')) {
      out.push({
        text: "Tu es resté dans le vent, sans personne pour t'abriter. Il va falloir revenir dans le groupe de tête.",
        tone: 'alerte',
        priority: 91
      });
    }

    /* --- énergie --- */
    if (c.energy < 12 && c.remaining > 600) {
      out.push({
        text: c.drafting
          ? 'Tu es à sec. Reste dans la roue et ne prends aucun relais.'
          : 'Tu es à sec et exposé au vent. Cale-toi derrière quelqu\'un, vite.',
        tone: 'alerte',
        priority: 88
      });
    } else if (c.energy < 32 && c.remaining > 1200 && this.once('energie-basse')) {
      out.push({
        text: 'Attention à la réserve. Bois un bidon et lève le pied un moment.',
        tone: 'info',
        priority: 62
      });
    }

    /* --- aspiration non exploitée --- */
    if (!c.drafting && c.gapAhead !== null && c.gapAhead < 25 && c.position > 1 && c.remaining > 900) {
      if (this.once('aspiration')) {
        out.push({
          text: 'Tu roules dans le vent pour rien. Remonte dans la roue devant toi.',
          tone: 'tactique',
          priority: 66
        });
      }
    }

    /* --- final --- */
    if (c.remaining < 1000 && c.remaining > 700 && this.once('flamme')) {
      out.push({
        text: `Dernier kilomètre. Tu es ${c.position}${c.position === 1 ? 'er' : 'e'}${
          c.energy > 40 ? ', tu as de quoi lancer le sprint.' : ', gère ce qu\'il te reste.'
        }`,
        tone: 'info',
        priority: 85
      });
    }
    if (c.remaining < 320 && this.once('sprint-final')) {
      out.push({
        text:
          c.position === 1
            ? 'Tu es en tête, ne te retourne pas. Vas-y !'
            : `${c.position - 1} coureur${c.position > 2 ? 's' : ''} devant toi. C'est maintenant ou jamais.`,
        tone: 'encouragement',
        priority: 99
      });
    }

    /* --- en tête, écart sur le suivant --- */
    if (c.position === 1 && c.gapBehind !== null && c.remaining > 800) {
      const secs = c.gapBehind;
      if (secs > 12 && this.once('echappee-solide')) {
        out.push({
          text: `Tu as ${Math.round(secs)} s d'avance sur le peloton. Garde ce rythme, ne surdose pas.`,
          tone: 'encouragement',
          priority: 70
        });
      } else if (secs < 4 && this.once('echappee-menacee')) {
        out.push({
          text: 'Ils te reviennent dessus. Soit tu relances, soit tu te relèves et tu attends.',
          tone: 'alerte',
          priority: 76
        });
      }
    }

    /* --- pente en cours --- */
    if (c.grade > 8 && this.once('pente-raide')) {
      out.push({
        text: `${c.grade.toFixed(0)} % de pente. Passe en danseuse si tu veux relancer, mais ça coûte cher.`,
        tone: 'info',
        priority: 64
      });
    }

    return out;
  }

  reset(): void {
    this.rivalSaidAt.clear();
    this.saidOnce.clear();
    this.lastAt = -999;
    this.current = null;
  }
}
