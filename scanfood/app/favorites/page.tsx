import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ProductCard } from '@/components/ProductCard';
import { Shell } from '@/components/Shell';
import { currentUser } from '@/lib/auth';
import { listFavorites } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const user = await currentUser();
  if (!user) redirect('/signin');

  const favorites = await listFavorites(user.id);

  return (
    <Shell>
      <PageHeader
        eyebrow={favorites.length > 0 ? `${favorites.length} produit${favorites.length > 1 ? 's' : ''}` : undefined}
        title="Favoris"
        back="/"
      />

      <div className="pt-8">
        {favorites.length === 0 ? (
          <EmptyState
            image="couverts"
            title="Ta liste est encore vide"
            body="Mets de côté les produits que tu reprends chaque semaine. Ils t’attendront ici."
            cta={{ href: '/scanner', label: 'Scanner un produit' }}
          />
        ) : (
          <ul className="space-y-3">
            {favorites.map((favorite) => (
              <li key={favorite.id}>
                <ProductCard
                  barcode={favorite.barcode}
                  name={favorite.product_name}
                  brand={favorite.brand}
                  imageUrl={favorite.image_url}
                  score={favorite.score}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
