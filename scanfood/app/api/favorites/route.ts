import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { fetchProduct } from '@/lib/off';
import { listFavorites, toggleFavorite } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  return NextResponse.json({ favorites: await listFavorites(userId) });
}

/** Bascule un favori. Retourne l'état après bascule. */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { barcode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const product = await fetchProduct(String(body.barcode ?? ''));
  if (!product) {
    return NextResponse.json({ error: 'Produit non trouvé. Vérifie le code-barres.' }, { status: 404 });
  }

  const isFavorite = await toggleFavorite(userId, {
    barcode: product.barcode,
    product_name: product.product_name,
    brand: product.brand,
    score: product.score,
    image_url: product.image_url,
    product_data: product,
  });

  return NextResponse.json({ isFavorite });
}
