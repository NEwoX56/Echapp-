import type { Career } from '../career/Career';
import type { MusicLibrary } from '../audio/MusicLibrary';
import { exporter as exporterRoster, importer as importerRoster } from '../data/rosterStore';

/**
 * Compte de synchronisation.
 *
 * Un identifiant et un code personnel suffisent à retrouver ses réglages sur
 * un autre appareil. Il faut être clair sur un point : cela suppose bien un
 * serveur. Deux appareils ne peuvent rien s'échanger sans un point commun.
 * Ce qu'on évite ici, c'est une base de données à administrer et un compte
 * chez un tiers — la fonction `netlify/functions/sync.mts` s'appuie sur le
 * stockage fourni avec l'hébergement.
 *
 * Le contenu envoyé couvre la carrière, le peloton modifié, les préférences
 * et la musique importée.
 *
 * L'envoi est découpé : la partie d'abord, puis chaque morceau séparément.
 * Netlify plafonne une requête à 6 Mo et les morceaux, encodés en base64,
 * s'alourdissent d'un tiers — un envoi monolithique se faisait refuser avec
 * un code 413 dès qu'on dépassait deux ou trois musiques. Découpé, seul un
 * morceau isolé de plus de 3 Mo pose encore problème, et il est alors écarté
 * avec un message qui le nomme plutôt que de faire échouer tout l'envoi.
 */

const AMBIANCES = ['menu', 'course', 'tension', 'finale', 'victoire'] as const;
/** au-delà, le morceau dépasse le plafond de la plateforme une fois encodé */
const LIMITE_PISTE = 3 * 1024 * 1024;

export interface Sauvegarde {
  version: number;
  carriere: unknown;
  roster: unknown;
  /** conservé pour lire les sauvegardes d'avant le découpage */
  musiques: Record<string, { nom: string; type: string; donnees: string }>;
  /** ambiances dont un morceau est stocké séparément */
  pistes?: string[];
  maj?: string;
}

export interface ResultatSync {
  ok: boolean;
  message: string;
  detail?: string;
}

export type Progression = (texte: string) => void;

function base64Depuis(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result);
      res(s.slice(s.indexOf(',') + 1));
    };
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

function blobDepuis(base64: string, type: string): Blob {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type });
}

export class SyncAccount {
  private career: Career;
  private bibliotheque: MusicLibrary;
  private base: string;

  constructor(career: Career, bibliotheque: MusicLibrary, base = '/api/sync') {
    this.career = career;
    this.bibliotheque = bibliotheque;
    this.base = base;
  }

  get identifiant(): string {
    return this.career.save.syncId ?? '';
  }
  get code(): string {
    return this.career.save.syncCode ?? '';
  }

  memoriser(id: string, code: string): void {
    this.career.save.syncId = id.trim().toLowerCase();
    this.career.save.syncCode = code.trim();
    this.career.persist();
  }

  /** partie seule : carrière, peloton et réglages, sans la musique */
  collecter(): Sauvegarde {
    // le code personnel ne part pas dans le corps : il voyage en entête
    const carriere = { ...this.career.save };
    delete (carriere as Record<string, unknown>).syncCode;

    const pistes: string[] = [];
    for (const a of AMBIANCES) if (this.bibliotheque.info(a)) pistes.push(a);

    return {
      version: 1,
      carriere,
      roster: JSON.parse(exporterRoster()),
      musiques: {},
      pistes
    };
  }

  /** envoie l'état courant sous cet identifiant */
  async envoyer(
    id: string,
    code: string,
    inclureMusique = true,
    progres?: Progression
  ): Promise<ResultatSync> {
    const cible = id.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(cible)) {
      return { ok: false, message: 'Identifiant invalide', detail: '3 à 24 caractères : lettres, chiffres, tiret ou souligné' };
    }
    if (code.trim().length < 4) {
      return { ok: false, message: 'Code personnel trop court', detail: '4 caractères minimum' };
    }

    const entetes = { 'content-type': 'application/json', 'x-code': code.trim() };
    const adresse = (p?: string) =>
      `${this.base}?id=${encodeURIComponent(cible)}${p ? `&piste=${p}` : ''}`;

    // 1. la partie : petite, et c'est elle qui fixe le code du compte
    progres?.('Envoi de la partie…');
    try {
      const r = await fetch(adresse(), {
        method: 'POST',
        headers: entetes,
        body: JSON.stringify(this.collecter())
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; erreur?: string } | null;
      if (!r.ok || !j?.ok) {
        return {
          ok: false,
          message: j?.erreur ?? `Envoi refusé (${r.status})`,
          detail: r.status === 404 ? "La synchronisation n'est pas active sur ce site" : undefined
        };
      }
    } catch {
      return { ok: false, message: 'Serveur injoignable', detail: 'Vérifie ta connexion' };
    }

    // 2. chaque morceau séparément, pour rester sous le plafond par requête
    let envoyes = 0;
    const ecartes: string[] = [];
    if (inclureMusique) {
      for (const a of AMBIANCES) {
        const info = this.bibliotheque.info(a);
        const url = this.bibliotheque.url(a);
        if (!info || !url) continue;
        if (info.taille > LIMITE_PISTE) {
          ecartes.push(`${a} (${(info.taille / 1048576).toFixed(1)} Mo)`);
          continue;
        }
        progres?.(`Envoi de la musique « ${a} »…`);
        try {
          const blob = await (await fetch(url)).blob();
          const r = await fetch(adresse(a), {
            method: 'POST',
            headers: entetes,
            body: JSON.stringify({
              nom: info.nom,
              type: info.type,
              donnees: await base64Depuis(blob)
            })
          });
          if (r.ok) envoyes += 1;
          else ecartes.push(a);
        } catch {
          ecartes.push(a);
        }
      }
    }

    this.memoriser(cible, code);
    const morceaux = envoyes ? `, ${envoyes} morceau${envoyes > 1 ? 'x' : ''}` : '';
    return {
      ok: true,
      message: `Partie envoyée${morceaux}`,
      detail: ecartes.length
        ? `Non envoyé : ${ecartes.join(', ')} — fichier trop lourd, garde moins de 3 Mo par morceau`
        : undefined
    };
  }

  /** récupère et applique la sauvegarde d'un identifiant */
  async recuperer(id: string, code: string, progres?: Progression): Promise<ResultatSync> {
    const cible = id.trim().toLowerCase();
    try {
      const r = await fetch(`${this.base}?id=${encodeURIComponent(cible)}`, {
        headers: { 'cache-control': 'no-cache' }
      });
      if (r.status === 404) {
        return { ok: false, message: 'Aucune sauvegarde sous cet identifiant' };
      }
      const j = (await r.json().catch(() => null)) as
        | { ok?: boolean; erreur?: string; donnees?: Sauvegarde }
        | null;
      if (!r.ok || !j?.ok || !j.donnees) {
        return { ok: false, message: j?.erreur ?? `Lecture refusée (${r.status})` };
      }
      return await this.appliquer(j.donnees, cible, code, progres);
    } catch {
      return { ok: false, message: 'Serveur injoignable', detail: 'Vérifie ta connexion' };
    }
  }

  /** écrit la sauvegarde reçue par-dessus l'état local */
  async appliquer(
    s: Sauvegarde,
    id: string,
    code: string,
    progres?: Progression
  ): Promise<ResultatSync> {
    if (!s || s.version !== 1) return { ok: false, message: 'Sauvegarde d\'une autre version' };

    if (s.roster) importerRoster(JSON.stringify(s.roster));

    if (s.carriere && typeof s.carriere === 'object') {
      const c = s.carriere as Record<string, unknown>;
      // l'identifiant local est conservé : c'est celui qu'on vient d'utiliser
      Object.assign(this.career.save, c);
      this.career.save.syncId = id;
      this.career.save.syncCode = code.trim();
      this.career.persist();
    }

    let musiques = 0;
    const poser = async (amb: string, m: { nom: string; type: string; donnees: string }) => {
      try {
        const blob = blobDepuis(m.donnees, m.type || 'audio/mpeg');
        const fichier = new File([blob], m.nom || `${amb}.mp3`, { type: m.type || 'audio/mpeg' });
        const res = await this.bibliotheque.importer(amb, fichier);
        if (res.ok) musiques += 1;
      } catch {
        /* morceau corrompu : on continue */
      }
    };

    // sauvegardes d'avant le découpage : la musique était dans le corps
    for (const [amb, m] of Object.entries(s.musiques ?? {})) await poser(amb, m);

    for (const amb of s.pistes ?? []) {
      progres?.(`Récupération de la musique « ${amb} »…`);
      try {
        const r = await fetch(`${this.base}?id=${encodeURIComponent(id)}&piste=${amb}`);
        if (!r.ok) continue;
        const j = (await r.json()) as { ok?: boolean; donnees?: { nom: string; type: string; donnees: string } };
        if (j?.ok && j.donnees?.donnees) await poser(amb, j.donnees);
      } catch {
        /* morceau injoignable : on continue */
      }
    }

    return {
      ok: true,
      message: 'Partie restaurée',
      detail: `Peloton, réglages et carrière${musiques ? `, ${musiques} morceau(x)` : ''}`
    };
  }

  /**
   * Vérifie que la fonction de synchronisation est bien publiée.
   *
   * Le code de statut ne suffit pas : un hébergement statique répond aussi
   * 404 quand la fonction est absente. On s'assure donc que la réponse est
   * du JSON portant le champ `ok`, signature de notre fonction.
   */
  async disponible(): Promise<boolean> {
    try {
      const r = await fetch(`${this.base}?id=verification`, {
        method: 'GET',
        headers: { 'cache-control': 'no-cache' }
      });
      if (r.status >= 500) return false;
      const type = r.headers.get('content-type') ?? '';
      if (!type.includes('json')) return false;
      const j = (await r.json().catch(() => null)) as { ok?: unknown } | null;
      return !!j && typeof j.ok === 'boolean';
    } catch {
      return false;
    }
  }
}
