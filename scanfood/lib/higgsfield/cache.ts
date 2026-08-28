import 'server-only';

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DATA_DIR } from '../dataDir';

/**
 * Cache des générations Higgsfield.
 *
 * - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → Redis Upstash.
 * - Sinon → fichier JSON local (`.data/higgsfield-cache.json`).
 *
 * La clé est un hash du prompt + des paramètres, de sorte qu'un même
 * gagnant ne soit jamais régénéré deux fois.
 */

const PREFIX = 'higgsfield:video:';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export function cacheKey(kind: string, prompt: string, params: Record<string, unknown> = {}): string {
  const hash = createHash('sha256')
    .update(JSON.stringify({ kind, prompt, params }))
    .digest('hex')
    .slice(0, 32);
  return `${PREFIX}${kind}:${hash}`;
}

/* ------------------------------- Redis ------------------------------ */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
export const USES_REDIS = Boolean(redisUrl && redisToken);

type RedisLike = { get: (k: string) => Promise<unknown>; set: (k: string, v: string, o?: any) => Promise<unknown>; incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<unknown> };
let redisClient: RedisLike | null = null;

async function redis(): Promise<RedisLike> {
  if (redisClient) return redisClient;
  const { Redis } = await import('@upstash/redis');
  redisClient = new Redis({ url: redisUrl!, token: redisToken! }) as unknown as RedisLike;
  return redisClient;
}

/* ---------------------------- Fichier local ------------------------- */

const CACHE_FILE = path.join(DATA_DIR, 'higgsfield-cache.json');

interface FileCache {
  entries: Record<string, { value: string; expiresAt: number }>;
  counters: Record<string, { count: number; expiresAt: number }>;
}

let fileCache: FileCache | null = null;

async function readFileCache(): Promise<FileCache> {
  if (fileCache) return fileCache;
  try {
    fileCache = JSON.parse(await readFile(CACHE_FILE, 'utf8')) as FileCache;
    fileCache.entries ??= {};
    fileCache.counters ??= {};
  } catch {
    fileCache = { entries: {}, counters: {} };
  }
  return fileCache;
}

async function persistFileCache(): Promise<void> {
  // Le cache est best-effort : un disque en lecture seule ne doit jamais
  // faire échouer une génération, seulement la rendre non mémorisée.
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(fileCache ?? { entries: {}, counters: {} }), 'utf8');
  } catch {
    /* on continue sans cache persistant */
  }
}

/* ------------------------------- API -------------------------------- */

export async function cacheGet(key: string): Promise<string | null> {
  if (USES_REDIS) {
    try {
      const value = await (await redis()).get(key);
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }
  const store = await readFileCache();
  const entry = store.entries[key];
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    delete store.entries[key];
    return null;
  }
  return entry.value;
}

export async function cacheSet(key: string, value: string): Promise<void> {
  if (USES_REDIS) {
    try {
      await (await redis()).set(key, value, { ex: TTL_SECONDS });
    } catch {
      /* le cache est best-effort */
    }
    return;
  }
  const store = await readFileCache();
  store.entries[key] = { value, expiresAt: Date.now() + TTL_SECONDS * 1000 };
  await persistFileCache();
}

/**
 * Limitation de débit : `limit` générations par utilisateur et par fenêtre.
 * Retourne `true` si l'appel est autorisé.
 */
export async function rateLimitOk(userId: string, limit = 10, windowSeconds = 3600): Promise<boolean> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `higgsfield:rate:${userId}:${bucket}`;

  if (USES_REDIS) {
    try {
      const client = await redis();
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, windowSeconds);
      return count <= limit;
    } catch {
      return true;
    }
  }

  const store = await readFileCache();
  const now = Date.now();
  const entry = store.counters[key];
  if (!entry || entry.expiresAt < now) {
    store.counters[key] = { count: 1, expiresAt: now + windowSeconds * 1000 };
    await persistFileCache();
    return true;
  }
  entry.count += 1;
  await persistFileCache();
  return entry.count <= limit;
}
