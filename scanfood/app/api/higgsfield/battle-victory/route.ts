import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { rateLimitOk } from '@/lib/higgsfield/cache';
import { CURATED, battleVictoryPrompt, generateVideo, resolveCurated } from '@/lib/higgsfield/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vidéo de victoire du gagnant d'un combat — 4 s, 9:16. */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { product?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const product = String(body.product ?? '').trim().slice(0, 120);
  const category = String(body.category ?? '').trim().slice(0, 120);
  if (!product) return NextResponse.json({ error: 'Produit manquant' }, { status: 400 });

  if (!(await rateLimitOk(userId))) {
    return NextResponse.json(
      { videoUrl: resolveCurated(CURATED.victory), limited: true },
      { status: 200 },
    );
  }

  const result = await generateVideo({
    kind: 'battle-victory',
    prompt: battleVictoryPrompt(product, category),
    durationSeconds: 4,
    fallback: CURATED.victory,
  });

  return NextResponse.json(result);
}
