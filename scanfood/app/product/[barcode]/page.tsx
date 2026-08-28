import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Badges } from '@/components/Badges';
import { FavoriteButton } from '@/components/FavoriteButton';
import { NutritionTable } from '@/components/NutritionTable';
import { PageHeader } from '@/components/PageHeader';
import { ProductCard } from '@/components/ProductCard';
import { ScoreBig } from '@/components/Score';
import { Shell } from '@/components/Shell';
import { ProductImage } from '@/components/ProductImage';
import { currentUser } from '@/lib/auth';
import { formatAdditives, getScoreReasons } from '@/lib/foodApi';
import { fetchProduct, findHealthierAlternatives } from '@/lib/off';
import { addScan, isFavorite } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: { barcode: string } }) {
  const user = await currentUser();
  if (!user) redirect('/signin');

  const product = await fetchProduct(params.barcode);
  if (!product) notFound();

  // La visite de la fiche vaut scan : on l'enregistre dans l'historique.
  await addScan(user.id, {
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

  const [favorite, alternatives] = await Promise.all([
    isFavorite(user.id, product.barcode),
    findHealthierAlternatives(product),
  ]);

  const reasons = getScoreReasons(product);
  const additives = formatAdditives(product.additives_tags);

  return (
    <Shell>
      <PageHeader eyebrow={product.brand || 'Sans marque'} title={product.product_name} back="/" />

      <section className="flex items-start gap-6 pt-9">
        <ProductImage
          src={product.image_url}
          isFallback={product.image_is_fallback}
          name={product.product_name}
          category={product.categories.join(', ')}
        />
        <div className="flex-1 pt-1">
          <ScoreBig value={product.score} />
        </div>
      </section>

      {product.quantity && (
        <p className="mt-6 text-[0.8125rem] text-ink-mute">{product.quantity}</p>
      )}

      <div className="mt-9">
        <Badges nutriscore={product.nutriscore} nova={product.nova_group} ecoscore={product.ecoscore} />
      </div>

      {reasons.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow rule-b pb-4">Ce qui pèse dans le score</h2>
          <ul className="mt-5 space-y-3">
            {reasons.map((reason) => (
              <li key={reason.label} className="flex items-start gap-3">
                <span
                  className="mt-[0.4rem] block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      reason.tone === 'good' ? '#1F3D2B' : reason.tone === 'bad' ? '#C2683B' : '#D5CFC2',
                  }}
                  aria-hidden
                />
                <span className="text-[0.9375rem] leading-snug text-ink-soft">{reason.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="eyebrow rule-b pb-4">Pour 100 g</h2>
        <NutritionTable nutriments={product.nutriments} />
      </section>

      {additives.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow rule-b pb-4">
            {additives.length} additif{additives.length > 1 ? 's' : ''}
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {additives.map((code) => (
              <li
                key={code}
                className="border border-rule px-2.5 py-1 font-mono text-[0.75rem] tracking-[0.06em] text-ink-soft"
              >
                {code}
              </li>
            ))}
          </ul>
        </section>
      )}

      {product.ingredients_text && (
        <section className="mt-12">
          <h2 className="eyebrow rule-b pb-4">Ingrédients</h2>
          <p className="mt-5 text-[0.875rem] leading-relaxed text-ink-soft">{product.ingredients_text}</p>
        </section>
      )}

      <div className="mt-12 grid gap-3">
        <FavoriteButton barcode={product.barcode} initial={favorite} />
        <Link href={`/combat?slot=a&barcode=${encodeURIComponent(product.barcode)}`} className="btn-ghost">
          Mettre en combat
        </Link>
      </div>

      {alternatives.length > 0 && (
        <section className="mt-14">
          <h2 className="eyebrow rule-b pb-4">Mieux noté dans le même rayon</h2>
          <ul className="mt-5 space-y-3">
            {alternatives.map((alt) => (
              <li key={alt.barcode}>
                <ProductCard
                  barcode={alt.barcode}
                  name={alt.product_name}
                  brand={alt.brand}
                  imageUrl={alt.image_url}
                  score={alt.score}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
