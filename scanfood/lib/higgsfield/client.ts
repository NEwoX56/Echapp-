import 'server-only';

import { existsSync } from 'node:fs';
import path from 'node:path';

import { cacheGet, cacheKey, cacheSet } from './cache';
import { CURATED, type CuratedAsset } from './assets';

/**
 * Client Higgsfield — strictement côté serveur.
 *
 * La clé `HIGGSFIELD_API_KEY` n'est jamais exposée au client : toutes les
 * générations passent par les routes `/api/higgsfield/*`.
 *
 * Chaîne de résolution d'un média :
 *   1. cache (Redis Upstash ou fichier) ;
 *   2. génération live si `HIGGSFIELD_API_KEY` est définie ;
 *   3. asset pré-généré livré avec l'application (toujours disponible).
 *
 * Le point 3 garantit qu'aucun écran ne casse sans clé API.
 */

const API_BASE = process.env.HIGGSFIELD_API_BASE ?? 'https://platform.higgsfield.ai';
const API_KEY = process.env.HIGGSFIELD_API_KEY;
const API_SECRET = process.env.HIGGSFIELD_API_SECRET;
const VIDEO_MODEL = process.env.HIGGSFIELD_VIDEO_MODEL ?? 'seedance_2_5';
const IMAGE_MODEL = process.env.HIGGSFIELD_IMAGE_MODEL ?? 'soul_2';
const POLL_TIMEOUT_MS = Number(process.env.HIGGSFIELD_TIMEOUT_MS ?? 90_000);
const POLL_INTERVAL_MS = 3000;

export const LIVE_GENERATION_ENABLED = Boolean(API_KEY);

/** Résout un asset pré-généré : copie locale si présente, sinon CDN. */
export function resolveCurated(asset: CuratedAsset): string {
  const local = path.join(process.cwd(), 'public', 'higgsfield', asset.file);
  return existsSync(local) ? `/higgsfield/${asset.file}` : asset.remote;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    'hf-api-key': API_KEY ?? '',
  };
  if (API_SECRET) headers['hf-secret'] = API_SECRET;
  return headers;
}

interface JobResult {
  status?: string;
  results?: Array<{ url?: string; raw?: { url?: string }; min?: { url?: string } }>;
  result_url?: string;
  url?: string;
}

function extractUrl(payload: JobResult | null): string | null {
  if (!payload) return null;
  if (typeof payload.result_url === 'string') return payload.result_url;
  if (typeof payload.url === 'string') return payload.url;
  const first = payload.results?.[0];
  return first?.url ?? first?.raw?.url ?? first?.min?.url ?? null;
}

async function pollJob(jobId: string): Promise<string | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${API_BASE}/v1/jobs/${jobId}`, { headers: authHeaders(), cache: 'no-store' });
    if (!res.ok) continue;
    const payload = (await res.json()) as JobResult;
    const status = String(payload.status ?? '').toLowerCase();
    if (['completed', 'succeeded', 'success'].includes(status)) return extractUrl(payload);
    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) return null;
  }
  return null;
}

async function generate(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as JobResult & { id?: string; job_id?: string };
    const direct = extractUrl(payload);
    if (direct) return direct;

    const jobId = payload.id ?? payload.job_id;
    return jobId ? pollJob(String(jobId)) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Vidéos                                                              */
/* ------------------------------------------------------------------ */

interface VideoOptions {
  kind: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio?: string;
  fallback: CuratedAsset;
}

/**
 * Génère (ou récupère en cache) une vidéo verticale.
 * Retourne toujours une URL exploitable grâce à l'asset de repli.
 */
export async function generateVideo(options: VideoOptions): Promise<{ videoUrl: string; cached: boolean; generated: boolean }> {
  const { kind, prompt, durationSeconds, aspectRatio = '9:16', fallback } = options;
  const key = cacheKey(kind, prompt, { durationSeconds, aspectRatio, model: VIDEO_MODEL });

  const cachedUrl = await cacheGet(key);
  if (cachedUrl) return { videoUrl: cachedUrl, cached: true, generated: false };

  const url = await generate('/v1/text2video', {
    model: VIDEO_MODEL,
    params: { prompt, duration: durationSeconds, aspect_ratio: aspectRatio },
  });

  if (url) {
    await cacheSet(key, url);
    return { videoUrl: url, cached: false, generated: true };
  }

  return { videoUrl: resolveCurated(fallback), cached: false, generated: false };
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/**
 * Génère (ou récupère en cache) une photo éditoriale de produit,
 * utilisée quand OpenFoodFacts ne fournit aucune image.
 */
export async function generateProductImage(
  description: string,
  fallbackUrl: string,
): Promise<{ imageUrl: string; cached: boolean; generated: boolean }> {
  const prompt =
    `${description}, premium editorial food photography, dark moody background, ` +
    `dramatic side lighting, minimalist composition, shallow depth of field, no text, no packaging labels`;
  const key = cacheKey('product-image', prompt, { model: IMAGE_MODEL, aspectRatio: '1:1' });

  const cachedUrl = await cacheGet(key);
  if (cachedUrl) return { imageUrl: cachedUrl, cached: true, generated: false };

  const url = await generate('/v1/text2image', {
    model: IMAGE_MODEL,
    params: { prompt, aspect_ratio: '1:1' },
  });

  if (url) {
    await cacheSet(key, url);
    return { imageUrl: url, cached: false, generated: true };
  }

  return { imageUrl: fallbackUrl, cached: false, generated: false };
}

/* ------------------------------------------------------------------ */
/* Prompts métier                                                      */
/* ------------------------------------------------------------------ */

export function battleVictoryPrompt(productName: string, category: string): string {
  const subject = category || productName;
  return (
    `Cinematic slow-motion macro shot of fresh ${subject} with dramatic side lighting, ` +
    `subtle floating particles, dark moody background, premium editorial food photography, ` +
    `slow push-in, muted palette, no text, no people`
  );
}

export function coronationPrompt(championName: string, category: string): string {
  const subject = category || championName;
  return (
    `Cinematic throne-like reveal of ${subject} on a slowly rotating dark stone pedestal, ` +
    `dramatic spot light from above, premium dark editorial still-life, subtle gold accents, ` +
    `fine drifting dust, slow majestic camera rise, no text, no people`
  );
}

export const INTRO_PROMPT =
  'Abstract macro of fresh ingredients falling in slow motion, dark forest green background, ' +
  'cinematic side lighting, fine particles, premium editorial, no text, no people';

export { CURATED };
