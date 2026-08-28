'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, RotateCcw, X } from 'lucide-react';

import { ScoreSmall } from '@/components/Score';
import { VictoryOverlay } from '@/components/VictoryOverlay';
import { clearTournament, getTournament, setTournament } from '@/lib/clientState';
import { getScoreColorHex } from '@/lib/foodApi';
import type { ScoredProduct } from '@/lib/types';

const EASE = [0.22, 1, 0.36, 1] as const;
const MEDALS = ['Or', 'Argent', 'Bronze'];

type Phase = 'setup' | 'coronation' | 'results';

async function loadProduct(barcode: string): Promise<ScoredProduct | null> {
  try {
    const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.products?.[0] ?? null;
  } catch {
    return null;
  }
}

function TournamentInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [products, setProducts] = useState<ScoredProduct[]>([]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Reprise de la sélection en cours, plus l'éventuel `?add=` du scanner.
  useEffect(() => {
    const stored = getTournament();
    const added = params.get('add');
    const codes = added && !stored.includes(added) ? [...stored, added] : stored;

    if (added) {
      setTournament(codes);
      router.replace('/tournament');
    }

    Promise.all(codes.map(loadProduct))
      .then((list) => setProducts(list.filter((p): p is ScoredProduct => p !== null)))
      .finally(() => setLoading(false));
  }, [params, router]);

  const ranked = [...products].sort((x, y) => y.score - x.score);
  const champion = ranked[0];

  function remove(barcode: string) {
    const next = products.filter((p) => p.barcode !== barcode);
    setProducts(next);
    setTournament(next.map((p) => p.barcode));
  }

  const start = useCallback(async () => {
    if (products.length < 2 || !champion) return;
    setError(null);
    setPhase('coronation');

    const url = await fetch('/api/higgsfield/tournament-coronation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champion: champion.product_name, category: champion.categories[0] ?? '' }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (typeof data?.videoUrl === 'string' ? data.videoUrl : null))
      .catch(() => null);

    setVideoUrl(url);

    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcodes: products.map((p) => p.barcode), coronationVideoUrl: url }),
    }).catch(() => setError("Le tournoi n’a pas pu être enregistré dans ton historique."));
  }, [products, champion]);

  function restart() {
    clearTournament();
    setProducts([]);
    setVideoUrl(null);
    setPhase('setup');
  }

  if (loading) return <p className="pt-10 text-[0.8125rem] text-ink-mute">Chargement…</p>;

  return (
    <div className="pt-9">
      <VictoryOverlay
        open={phase === 'coronation'}
        videoUrl={videoUrl}
        eyebrow="Champion du tournoi"
        name={champion?.product_name ?? ''}
        score={champion?.score ?? 0}
        durationMs={6200}
        onDone={() => setPhase('results')}
      />

      {/* ----------------------------- Setup ---------------------------- */}
      {phase === 'setup' && (
        <>
          {products.length === 0 ? (
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
              Réunis les produits que tu hésites à mettre dans le panier. Le tournoi les classe
              du meilleur au moins bon.
            </p>
          ) : (
            <ul className="space-y-3">
              {products.map((product) => (
                <li key={product.barcode} className="product-card">
                  {product.image_url && <img src={product.image_url} alt="" className="thumb" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[1.0625rem] leading-snug">{product.product_name}</p>
                    <p className="mt-0.5 truncate text-[0.8125rem] text-ink-mute">{product.brand || '—'}</p>
                  </div>
                  <ScoreSmall value={product.score} />
                  <button
                    type="button"
                    onClick={() => remove(product.barcode)}
                    aria-label={`Retirer ${product.product_name}`}
                    className="p-1.5 text-ink-faint transition-colors hover:text-ink"
                  >
                    <X size={15} strokeWidth={1.25} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/scanner?returnTo=tournament"
            className="mt-5 flex items-center justify-center gap-2.5 border border-dashed border-rule px-4 py-5 text-[0.875rem] text-ink-mute transition-colors hover:border-ink-faint hover:text-ink"
          >
            <Plus size={16} strokeWidth={1.25} aria-hidden />
            Ajouter un produit
          </Link>

          <button type="button" onClick={start} disabled={products.length < 2} className="btn-primary mt-9">
            Lancer le tournoi
          </button>

          {products.length < 2 && (
            <p className="mt-4 text-center text-[0.8125rem] text-ink-mute">
              Il faut au moins deux produits.
            </p>
          )}
        </>
      )}

      {/* ---------------------------- Classement ------------------------ */}
      {phase === 'results' && champion && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <p className="eyebrow">Champion</p>
          <h2 className="mt-3 font-serif text-title">{champion.product_name}</h2>

          <ol className="mt-10">
            {ranked.map((product, index) => (
              <motion.li
                key={product.barcode}
                className="border-b border-rule py-5 last:border-b-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.07, duration: 0.6, ease: EASE }}
              >
                <div className="flex items-center gap-4">
                  <span className="tnum w-6 shrink-0 font-serif text-[1.125rem] text-ink-faint">
                    {index + 1}
                  </span>
                  {product.image_url && (
                    <img src={product.image_url} alt="" className="h-12 w-12 shrink-0 border border-rule object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[1rem] leading-snug">{product.product_name}</p>
                    <p className="mt-0.5 truncate text-[0.75rem] text-ink-mute">
                      {[product.brand, MEDALS[index]].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <ScoreSmall value={product.score} />
                </div>

                {/* Barre de progression sobre : un filet, pas un tube coloré. */}
                <div className="mt-3 h-px w-full bg-cream-dim">
                  <motion.div
                    className="h-px"
                    style={{ backgroundColor: getScoreColorHex(product.score) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${product.score}%` }}
                    transition={{ delay: 0.3 + index * 0.07, duration: 0.9, ease: EASE }}
                  />
                </div>
              </motion.li>
            ))}
          </ol>

          {error && <p className="mt-6 text-[0.8125rem] text-terracotta">{error}</p>}

          <div className="mt-12 grid gap-3">
            <button type="button" onClick={() => setPhase('coronation')} className="btn-ghost">
              Revoir le couronnement
            </button>
            <button type="button" onClick={restart} className="btn-primary">
              <RotateCcw size={16} strokeWidth={1.25} aria-hidden />
              Recommencer
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function TournamentClient() {
  return (
    <Suspense fallback={<p className="pt-10 text-[0.8125rem] text-ink-mute">Chargement…</p>}>
      <TournamentInner />
    </Suspense>
  );
}
