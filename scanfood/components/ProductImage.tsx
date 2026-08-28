'use client';

import { useEffect, useState } from 'react';

/**
 * Image produit.
 *
 * Quand OpenFoodFacts ne fournit pas de visuel (`isFallback`), on demande
 * à `/api/higgsfield/product-image` une photo éditoriale générée et mise
 * en cache. Pendant ce temps, l'image de repli par catégorie reste
 * affichée derrière un voile crème — jamais de trou dans la mise en page.
 */
export function ProductImage({
  src,
  isFallback,
  name,
  category,
  className = 'h-32 w-32',
}: {
  src: string;
  isFallback: boolean;
  name: string;
  category: string;
  className?: string;
}) {
  const [url, setUrl] = useState(src);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!isFallback) return;

    let cancelled = false;
    setGenerating(true);

    const params = new URLSearchParams({ prompt: name, category });
    fetch(`/api/higgsfield/product-image?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.imageUrl) setUrl(data.imageUrl);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isFallback, name, category]);

  return (
    <div className={`relative shrink-0 overflow-hidden border border-rule bg-cream-deep ${className}`}>
      <img
        src={url}
        alt={name}
        className={`h-full w-full object-cover transition-opacity duration-700 ease-editorial ${
          generating ? 'opacity-40 blur-[2px]' : 'opacity-100'
        }`}
        loading="lazy"
      />
      {generating && (
        <span className="absolute inset-x-0 bottom-0 bg-cream/85 py-1 text-center text-[0.5625rem] uppercase tracking-[0.16em] text-ink-mute">
          Image en cours
        </span>
      )}
    </div>
  );
}
