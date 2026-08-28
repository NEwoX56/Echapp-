import { NextResponse } from 'next/server';

import { cacheGet, cacheKey } from '@/lib/higgsfield/cache';
import { CURATED, INTRO_PROMPT, resolveCurated } from '@/lib/higgsfield/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Générique d'intro (3 s, 9:16).
 *
 * Cette route ne génère jamais à la demande — le splash doit s'afficher
 * instantanément. Elle sert la version en cache si `npm run
 * higgsfield:prefetch` en a produit une, sinon l'asset livré avec
 * l'application.
 */
export async function GET() {
  const key = cacheKey('intro', INTRO_PROMPT, {
    durationSeconds: 3,
    aspectRatio: '9:16',
    model: process.env.HIGGSFIELD_VIDEO_MODEL ?? 'seedance_2_5',
  });

  const cached = await cacheGet(key);
  return NextResponse.json({
    videoUrl: cached ?? resolveCurated(CURATED.intro),
    cached: Boolean(cached),
    generated: false,
  });
}
