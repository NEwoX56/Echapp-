import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { rateLimitOk } from '@/lib/higgsfield/cache';
import { generateProductImage } from '@/lib/higgsfield/client';
import { fallbackImageFor } from '@/lib/foodApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Photo éditoriale générée pour un produit sans image OpenFoodFacts. */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const prompt = (searchParams.get('prompt') ?? '').trim().slice(0, 200);
  const category = (searchParams.get('category') ?? '').trim().slice(0, 200);
  if (!prompt) return NextResponse.json({ error: 'Prompt manquant' }, { status: 400 });

  const fallback = fallbackImageFor(prompt, category);

  if (!(await rateLimitOk(userId))) {
    return NextResponse.json({ imageUrl: fallback, limited: true });
  }

  const result = await generateProductImage(`${prompt} ${category}`.trim(), fallback);
  return NextResponse.json(result);
}
