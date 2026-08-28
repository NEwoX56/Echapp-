import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { addScan, listScans } from '@/lib/store';
import { fetchProduct } from '@/lib/off';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const limit = Number(new URL(request.url).searchParams.get('limit')) || undefined;
  return NextResponse.json({ scans: await listScans(userId, limit) });
}

/** Enregistre un scan à partir d'un code-barres. */
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

  const scan = await addScan(userId, {
    barcode: product.barcode,
    product_name: product.product_name,
    brand: product.brand,
    score: product.score,
    image_url: product.image_url,
    nutriscore: product.nutriscore,
    nova_group: product.nova_group,
    ecoscore: product.ecoscore,
    product_data: product,
  });

  return NextResponse.json({ scan, product });
}
