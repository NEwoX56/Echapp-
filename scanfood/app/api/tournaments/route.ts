import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { fetchProduct } from '@/lib/off';
import { addTournament, listTournaments } from '@/lib/store';
import type { TournamentEntry } from '@/lib/records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  return NextResponse.json({ tournaments: await listTournaments(userId) });
}

/** Enregistre un tournoi. Le classement est recalculé côté serveur. */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { barcodes?: string[]; coronationVideoUrl?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const barcodes = Array.from(new Set((body.barcodes ?? []).map(String))).slice(0, 16);
  if (barcodes.length < 2) {
    return NextResponse.json({ error: 'Il faut au moins deux produits.' }, { status: 400 });
  }

  const resolved = (await Promise.all(barcodes.map((code) => fetchProduct(code)))).filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );

  if (resolved.length < 2) {
    return NextResponse.json({ error: 'Produits introuvables.' }, { status: 404 });
  }

  const ranked: TournamentEntry[] = resolved
    .map((p) => ({
      barcode: p.barcode,
      product_name: p.product_name,
      brand: p.brand,
      score: p.score,
      image_url: p.image_url,
    }))
    .sort((x, y) => y.score - x.score);

  const champion = ranked[0];

  const tournament = await addTournament(userId, {
    products: ranked,
    winner_name: champion.product_name,
    winner_score: champion.score,
    winner_image: champion.image_url,
    product_count: ranked.length,
    coronation_video_url: body.coronationVideoUrl ?? null,
  });

  return NextResponse.json({ tournament });
}
