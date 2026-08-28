/**
 * État éphémère côté navigateur : slots de combat et liste du tournoi en
 * cours de constitution. Rien de sensible n'y transite — uniquement des
 * codes-barres, rejoués côté serveur au moment d'enregistrer.
 */

export type Slot = 'a' | 'b';

const SLOT_KEY = (slot: Slot) => `scanfood:combat:${slot}`;
const TOURNAMENT_KEY = 'scanfood:tournament';

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function setSlot(slot: Slot, barcode: string): void {
  session()?.setItem(SLOT_KEY(slot), barcode);
}

export function getSlot(slot: Slot): string | null {
  return session()?.getItem(SLOT_KEY(slot)) ?? null;
}

export function clearSlots(): void {
  const store = session();
  store?.removeItem(SLOT_KEY('a'));
  store?.removeItem(SLOT_KEY('b'));
}

export function getTournament(): string[] {
  const raw = session()?.getItem(TOURNAMENT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function setTournament(barcodes: string[]): void {
  session()?.setItem(TOURNAMENT_KEY, JSON.stringify(barcodes));
}

export function clearTournament(): void {
  session()?.removeItem(TOURNAMENT_KEY);
}
