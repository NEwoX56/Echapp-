import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { fetchProduct, searchProducts } from '@/lib/off';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recherche de produits.
 * `?q=` recherche par nom, `?barcode=` recherche par code-barres.
 */
export async function GET(request: Request) {
  if (!(await currentUserId())) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get('barcode')?.trim();

  if (barcode) {
    const product = await fetchProduct(barcode);
    if (!product) {
      return NextResponse.json({ error: 'Produit non trouvé. Vérifie le code-barres.' }, { status: 404 });
    }
    return NextResponse.json({ products: [product] });
  }

  const q = searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ products: [] });

  const products = await searchProducts(q, 8);
  return NextResponse.json({ products });
}
