/**
 * Bibliothèque musicale du joueur.
 *
 * Les morceaux importés depuis le jeu sont conservés dans IndexedDB. Ce choix
 * n'est pas anodin : localStorage plafonne à environ 5 Mo et ne stocke que du
 * texte, ce qui obligerait à encoder l'audio en base64 — un tiers de poids en
 * plus pour un seul morceau qui saturerait déjà le quota. IndexedDB accepte
 * les données binaires et se compte en centaines de mégaoctets.
 *
 * Conséquence pratique : le joueur importe sa musique depuis l'écran des
 * paramètres, sans rien installer et sans recompiler le jeu. Les morceaux
 * restent sur sa machine, ils ne sont pas envoyés sur le serveur.
 */

const BASE = 'echappee-musique';
const STORE = 'pistes';
const VERSION = 1;

export interface PisteInfo {
  ambiance: string;
  nom: string;
  taille: number;
  type: string;
}

interface Enregistrement extends PisteInfo {
  blob: Blob;
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(BASE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'ambiance' });
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export class MusicLibrary {
  private db: IDBDatabase | null = null;
  private urls = new Map<string, string>();
  private infos = new Map<string, PisteInfo>();
  private dispo = false;

  get disponible(): boolean {
    return this.dispo;
  }

  async init(): Promise<void> {
    try {
      if (!('indexedDB' in window)) return;
      this.db = await ouvrir();
      this.dispo = true;
      await this.chargerTout();
    } catch {
      this.dispo = false;
    }
  }

  private tx(mode: IDBTransactionMode): IDBObjectStore | null {
    if (!this.db) return null;
    try {
      return this.db.transaction(STORE, mode).objectStore(STORE);
    } catch {
      return null;
    }
  }

  /** recrée les URL de lecture pour tous les morceaux enregistrés */
  private chargerTout(): Promise<void> {
    return new Promise((res) => {
      const st = this.tx('readonly');
      if (!st) return res();
      const req = st.getAll();
      req.onsuccess = () => {
        for (const e of (req.result ?? []) as Enregistrement[]) {
          this.enregistrerUrl(e);
        }
        res();
      };
      req.onerror = () => res();
    });
  }

  private enregistrerUrl(e: Enregistrement): void {
    const ancienne = this.urls.get(e.ambiance);
    if (ancienne) URL.revokeObjectURL(ancienne);
    this.urls.set(e.ambiance, URL.createObjectURL(e.blob));
    this.infos.set(e.ambiance, {
      ambiance: e.ambiance,
      nom: e.nom,
      taille: e.taille,
      type: e.type
    });
  }

  /** URL locale du morceau, ou null */
  url(ambiance: string): string | null {
    return this.urls.get(ambiance) ?? null;
  }

  info(ambiance: string): PisteInfo | null {
    return this.infos.get(ambiance) ?? null;
  }

  ambiances(): string[] {
    return [...this.urls.keys()];
  }

  /** importe un fichier choisi par le joueur */
  async importer(ambiance: string, fichier: File): Promise<{ ok: boolean; message: string }> {
    if (!this.dispo) {
      return { ok: false, message: "Ce navigateur n'autorise pas le stockage local" };
    }
    if (!fichier.type.startsWith('audio/') && !/\.(mp3|ogg|m4a|wav|aac|flac)$/i.test(fichier.name)) {
      return { ok: false, message: 'Ce fichier ne semble pas être de l\'audio' };
    }
    // 40 Mo par piste : au-delà, le chargement devient pénible sur console
    if (fichier.size > 40 * 1024 * 1024) {
      return { ok: false, message: 'Fichier trop lourd (40 Mo maximum)' };
    }
    const e: Enregistrement = {
      ambiance,
      nom: fichier.name,
      taille: fichier.size,
      type: fichier.type || 'audio/mpeg',
      blob: fichier
    };
    const ok = await new Promise<boolean>((res) => {
      const st = this.tx('readwrite');
      if (!st) return res(false);
      const req = st.put(e);
      req.onsuccess = () => res(true);
      req.onerror = () => res(false);
    });
    if (!ok) return { ok: false, message: 'Enregistrement impossible (espace insuffisant ?)' };
    this.enregistrerUrl(e);
    return { ok: true, message: `${fichier.name} importé` };
  }

  async supprimer(ambiance: string): Promise<void> {
    const url = this.urls.get(ambiance);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(ambiance);
    this.infos.delete(ambiance);
    await new Promise<void>((res) => {
      const st = this.tx('readwrite');
      if (!st) return res();
      const req = st.delete(ambiance);
      req.onsuccess = () => res();
      req.onerror = () => res();
    });
  }

  /** place occupée par la bibliothèque, en octets */
  tailleTotale(): number {
    let t = 0;
    for (const i of this.infos.values()) t += i.taille;
    return t;
  }
}
