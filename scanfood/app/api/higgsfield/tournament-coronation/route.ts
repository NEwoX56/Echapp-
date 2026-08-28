import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { rateLimitOk } from '@/lib/higgsfield/cache';
import { CURATED, coronationPrompt, generateVideo, resolveCurated } from '@/lib/higgsfield/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vidéo de couronnement du champion d'un tournoi — 6 s, 9:16. */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { champion?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const champion = String(body.champion ?? '').trim().slice(0, 120);
  const category = String(body.category ?? '').trim().slice(0, 120);
  if (!champion) return NextResponse.json({ error: 'Champion manquant' }, { status: 400 });

  if (!(await rateLimitOk(userId))) {
    return NextResponse.json(
      { videoUrl: resolveCurated(CURATED.coronation), limited: true },
      { status: 200 },
    );
  }

  const result = await generateVideo({
    kind: 'tournament-coronation',
    prompt: coronationPrompt(champion, category),
    durationSeconds: 6,
    fallback: CURATED.coronation,
  });

  return NextResponse.json(result);
}
