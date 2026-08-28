import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  BattleRecord,
  FavoriteRecord,
  ScanRecord,
  TournamentRecord,
  UserRecord,
} from './records';

/**
 * Couche de persistance.
 *
 * - `DATABASE_URL` défini → Prisma + Postgres (`prisma/schema.prisma`).
 * - Sinon → magasin JSON local dans `.data/store.json`, pour développer
 *   et démontrer l'application sans base de données.
 *
 * Toutes les lectures sont scopées par `userId` : aucune fonction
 * exportée ne retourne de données sans filtre utilisateur.
 */

export const USES_PRISMA = Boolean(process.env.DATABASE_URL);

/* ------------------------------------------------------------------ */
/* Magasin fichier                                                     */
/* ------------------------------------------------------------------ */

interface FileShape {
  users: UserRecord[];
  scans: ScanRecord[];
  favorites: FavoriteRecord[];
  battles: BattleRecord[];
  tournaments: TournamentRecord[];
}

const DATA_DIR = process.env.SCANFOOD_DATA_DIR || path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const EMPTY: FileShape = { users: [], scans: [], favorites: [], battles: [], tournaments: [] };

let cache: FileShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function readStore(): Promise<FileShape> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    cache = { ...EMPTY, ...(JSON.parse(raw) as Partial<FileShape>) };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

/** Sérialise les écritures pour éviter les pertes en cas d'appels concurrents. */
async function mutate<T>(fn: (store: FileShape) => T | Promise<T>): Promise<T> {
  const run = writeChain.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
    return result;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function newId(): string {
  return randomUUID();
}

function byNewest<T extends { created_at: string }>(a: T, b: T): number {
  return b.created_at.localeCompare(a.created_at);
}

/* ------------------------------------------------------------------ */
/* Prisma (chargé paresseusement)                                      */
/* ------------------------------------------------------------------ */

type PrismaLike = any;
let prismaClient: PrismaLike | null = null;

async function prisma(): Promise<PrismaLike> {
  if (prismaClient) return prismaClient;
  const globalRef = globalThis as unknown as { __scanfoodPrisma?: PrismaLike };
  if (globalRef.__scanfoodPrisma) {
    prismaClient = globalRef.__scanfoodPrisma;
    return prismaClient;
  }
  const { PrismaClient } = await import('@prisma/client');
  prismaClient = new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalRef.__scanfoodPrisma = prismaClient;
  return prismaClient;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value ?? new Date().toISOString());
}

function normalizeDates<T extends { created_at: unknown }>(row: T): T & { created_at: string } {
  return { ...row, created_at: iso(row.created_at) };
}

/* ------------------------------------------------------------------ */
/* Utilisateurs                                                        */
/* ------------------------------------------------------------------ */

function firstNameFromEmail(email: string): string {
  // On retire le tag « +quelque-chose » avant de découper : sans quoi
  // camille+courses@… donnerait « Camille+courses ».
  const local = (email.split('@')[0] ?? 'gourmet').split('+')[0];
  const cleaned = local.split(/[._-]/)[0] || local;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/** Trouve ou crée l'utilisateur correspondant à un e-mail. */
export async function upsertUser(email: string, firstName?: string): Promise<UserRecord> {
  const normalized = email.trim().toLowerCase();
  const name = (firstName?.trim() || firstNameFromEmail(normalized)).slice(0, 40);

  if (USES_PRISMA) {
    const db = await prisma();
    const row = await db.user.upsert({
      where: { email: normalized },
      update: firstName ? { firstName: name } : {},
      create: { email: normalized, firstName: name },
    });
    return { id: row.id, email: row.email, firstName: row.firstName, createdAt: iso(row.createdAt) };
  }

  return mutate((store) => {
    let user = store.users.find((u) => u.email === normalized);
    if (!user) {
      user = { id: newId(), email: normalized, firstName: name, createdAt: new Date().toISOString() };
      store.users.push(user);
    } else if (firstName) {
      user.firstName = name;
    }
    return user;
  });
}

export async function getUser(userId: string): Promise<UserRecord | null> {
  if (USES_PRISMA) {
    const db = await prisma();
    const row = await db.user.findUnique({ where: { id: userId } });
    return row ? { id: row.id, email: row.email, firstName: row.firstName, createdAt: iso(row.createdAt) } : null;
  }
  const store = await readStore();
  return store.users.find((u) => u.id === userId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Historique de scans                                                 */
/* ------------------------------------------------------------------ */

export async function addScan(
  userId: string,
  data: Omit<ScanRecord, 'id' | 'userId' | 'created_at'>,
): Promise<ScanRecord> {
  if (USES_PRISMA) {
    const db = await prisma();
    const row = await db.scanHistory.create({ data: { ...data, userId } });
    return normalizeDates(row) as ScanRecord;
  }
  return mutate((store) => {
    const record: ScanRecord = { ...data, id: newId(), userId, created_at: new Date().toISOString() };
    store.scans.unshift(record);
    return record;
  });
}

export async function listScans(userId: string, limit?: number): Promise<ScanRecord[]> {
  if (USES_PRISMA) {
    const db = await prisma();
    const rows = await db.scanHistory.findMany({
      where: { userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return rows.map(normalizeDates) as ScanRecord[];
  }
  const store = await readStore();
  const rows = store.scans.filter((s) => s.userId === userId).sort(byNewest);
  return limit ? rows.slice(0, limit) : rows;
}

/* ------------------------------------------------------------------ */
/* Favoris                                                             */
/* ------------------------------------------------------------------ */

export async function listFavorites(userId: string): Promise<FavoriteRecord[]> {
  if (USES_PRISMA) {
    const db = await prisma();
    const rows = await db.favorite.findMany({ where: { userId }, orderBy: { created_at: 'desc' } });
    return rows.map(normalizeDates) as FavoriteRecord[];
  }
  const store = await readStore();
  return store.favorites.filter((f) => f.userId === userId).sort(byNewest);
}

export async function isFavorite(userId: string, barcode: string): Promise<boolean> {
  if (USES_PRISMA) {
    const db = await prisma();
    const row = await db.favorite.findUnique({ where: { userId_barcode: { userId, barcode } } });
    return Boolean(row);
  }
  const store = await readStore();
  return store.favorites.some((f) => f.userId === userId && f.barcode === barcode);
}

/** Bascule le favori. Retourne l'état après bascule. */
export async function toggleFavorite(
  userId: string,
  data: Omit<FavoriteRecord, 'id' | 'userId' | 'created_at'>,
): Promise<boolean> {
  if (USES_PRISMA) {
    const db = await prisma();
    const existing = await db.favorite.findUnique({
      where: { userId_barcode: { userId, barcode: data.barcode } },
    });
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return false;
    }
    await db.favorite.create({ data: { ...data, userId } });
    return true;
  }
  return mutate((store) => {
    const index = store.favorites.findIndex((f) => f.userId === userId && f.barcode === data.barcode);
    if (index >= 0) {
      store.favorites.splice(index, 1);
      return false;
    }
    store.favorites.unshift({ ...data, id: newId(), userId, created_at: new Date().toISOString() });
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Combats                                                             */
/* ------------------------------------------------------------------ */

export async function addBattle(
  userId: string,
  data: Omit<BattleRecord, 'id' | 'userId' | 'created_at'>,
): Promise<BattleRecord> {
  if (USES_PRISMA) {
    const db = await prisma();
    const row = await db.battle.create({ data: { ...data, userId } });
    return normalizeDates(row) as BattleRecord;
  }
  return mutate((store) => {
    const record: BattleRecord = { ...data, id: newId(), userId, created_at: new Date().toISOString() };
    store.battles.unshift(record);
    return record;
  });
}

export async function listBattles(userId: string): Promise<BattleRecord[]> {
  if (USES_PRISMA) {
    const db = await prisma();
    const rows = await db.battle.findMany({ where: { userId }, orderBy: { created_at: 'desc' } });
    return rows.map(normalizeDates) as BattleRecord[];
  }
  const store = await readStore();
  return store.battles.filter((b) => b.userId === userId).sort(byNewest);
}

/* ------------------------------------------------------------------ */
/* Tournois                                                            */
/* ------------------------------------------------------------------ */

export async function addTournament(
  userId: string,
  data: Omit<TournamentRecord, 'id' | 'userId' | 'created_at'>,
): Promise<TournamentRecord> {
  if (USES_PRISMA) {
    const db = await prisma();
    const row = await db.tournament.create({ data: { ...data, userId } });
    return normalizeDates(row) as TournamentRecord;
  }
  return mutate((store) => {
    const record: TournamentRecord = { ...data, id: newId(), userId, created_at: new Date().toISOString() };
    store.tournaments.unshift(record);
    return record;
  });
}

export async function listTournaments(userId: string): Promise<TournamentRecord[]> {
  if (USES_PRISMA) {
    const db = await prisma();
    const rows = await db.tournament.findMany({ where: { userId }, orderBy: { created_at: 'desc' } });
    return rows.map(normalizeDates) as TournamentRecord[];
  }
  const store = await readStore();
  return store.tournaments.filter((t) => t.userId === userId).sort(byNewest);
}
