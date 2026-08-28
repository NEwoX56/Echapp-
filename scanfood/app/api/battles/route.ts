import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { fetchProduct } from '@/lib/off';
import { addBattle, listBattles } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  return NextResponse.json({ battles: await listBattles(userId) });
}

/** Enregistre l'issue d'un combat. Le gagnant est recalculé côté serveur. */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { barcodeA?: string; barcodeB?: string; victoryVideoUrl?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const [a, b] = await Promise.all([
    fetchProduct(String(body.barcodeA ?? '')),
    fetchProduct(String(body.barcodeB ?? '')),
  ]);

  if (!a || !b) {
    return NextResponse.json({ error: 'Produit non trouvé. Vérifie le code-barres.' }, { status: 404 });
  }

  const winner: 'a' | 'b' | 'tie' = a.score > b.score ? 'a' : b.score > a.score ? 'b' : 'tie';

  const battle = await addBattle(userId, {
    product_a_barcode: a.barcode,
    product_a_name: a.product_name,
    product_a_score: a.score,
    product_a_image: a.image_url,
    product_a_brand: a.brand,
    product_a_data: a,
    product_b_barcode: b.barcode,
    product_b_name: b.product_name,
    product_b_score: b.score,
    product_b_image: b.image_url,
    product_b_brand: b.brand,
    product_b_data: b,
    winner,
    victory_video_url: body.victoryVideoUrl ?? null,
  });

  return NextResponse.json({ battle });
}
