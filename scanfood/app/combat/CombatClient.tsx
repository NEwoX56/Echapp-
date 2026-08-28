'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, RotateCcw, X } from 'lucide-react';

import { CompareTable } from '@/components/CompareTable';
import { ScoreBig, ScoreSmall } from '@/components/Score';
import { VictoryOverlay } from '@/components/VictoryOverlay';
import { clearSlots, getSlot, setSlot, type Slot } from '@/lib/clientState';
import type { ScoredProduct } from '@/lib/types';

const EASE = [0.22, 1, 0.36, 1] as const;

type Phase = 'setup' | 'vs' | 'video' | 'result';

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

/* ------------------------------------------------------------------ */
/* Emplacement produit                                                 */
/* ------------------------------------------------------------------ */

function SlotCard({
  slot,
  product,
  onClear,
}: {
  slot: Slot;
  product: ScoredProduct | null;
  onClear: () => void;
}) {
  const letter = slot.toUpperCase();

  if (!product) {
    return (
      <Link
        href={`/scanner?returnTo=combat&slot=${slot}`}
        className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 border border-dashed border-rule px-4 py-7 transition-colors hover:border-ink-faint"
      >
        <Plus size={18} strokeWidth={1.25} className="text-ink-faint" aria-hidden />
        <span className="text-[0.8125rem] text-ink-mute">Produit {letter}</span>
      </Link>
    );
  }

  return (
    <div className="relative min-h-[7.5rem] border border-rule bg-white px-4 py-4">
      <button
        type="button"
        onClick={onClear}
        aria-label={`Retirer le produit ${letter}`}
        className="absolute right-2 top-2 p-1.5 text-ink-faint transition-colors hover:text-ink"
      >
        <X size={14} strokeWidth={1.25} aria-hidden />
      </button>

      <span className="eyebrow">{letter}</span>
      {product.image_url && (
        <img src={product.image_url} alt="" className="mt-3 h-16 w-16 border border-rule object-cover" />
      )}
      <p className="mt-3 line-clamp-2 font-serif text-[0.9375rem] leading-snug">{product.product_name}</p>
      <p className="mt-1 truncate text-[0.75rem] text-ink-mute">{product.brand || '—'}</p>
      <div className="mt-3">
        <ScoreSmall value={product.score} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Écran                                                               */
/* ------------------------------------------------------------------ */

function CombatInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [a, setA] = useState<ScoredProduct | null>(null);
  const [b, setB] = useState<ScoredProduct | null>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Reprise des slots : paramètre d'URL (depuis une fiche produit) puis session.
  useEffect(() => {
    const urlBarcode = params.get('barcode');
    const urlSlot = params.get('slot') as Slot | null;
    if (urlBarcode && (urlSlot === 'a' || urlSlot === 'b')) setSlot(urlSlot, urlBarcode);

    const codeA = getSlot('a');
    const codeB = getSlot('b');

    Promise.all([codeA ? loadProduct(codeA) : null, codeB ? loadProduct(codeB) : null])
      .then(([pa, pb]) => {
        setA(pa);
        setB(pb);
      })
      .finally(() => setLoading(false));
  }, [params]);

  const winner: 'a' | 'b' | 'tie' | null =
    a && b ? (a.score > b.score ? 'a' : b.score > a.score ? 'b' : 'tie') : null;

  const champion = winner === 'a' ? a : winner === 'b' ? b : null;

  const start = useCallback(async () => {
    if (!a || !b) return;
    setError(null);
    setPhase('vs');

    const victor = a.score >= b.score ? a : b;

    // La vidéo se génère pendant que l'animation VS se joue.
    const videoPromise = fetch('/api/higgsfield/battle-victory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: victor.product_name, category: victor.categories[0] ?? '' }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (typeof data?.videoUrl === 'string' ? data.videoUrl : null))
      .catch(() => null);

    const [, url] = await Promise.all([
      new Promise((resolve) => setTimeout(resolve, 2300)),
      videoPromise,
    ]);

    setVideoUrl(url);
    setPhase('video');

    // Enregistrement du combat : le gagnant est recalculé côté serveur.
    fetch('/api/battles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcodeA: a.barcode, barcodeB: b.barcode, victoryVideoUrl: url }),
    }).catch(() => setError("Le combat n’a pas pu être enregistré dans ton historique."));
  }, [a, b]);

  function restart() {
    clearSlots();
    setA(null);
    setB(null);
    setVideoUrl(null);
    setPhase('setup');
    router.replace('/combat');
  }

  if (loading) {
    return <p className="pt-10 text-[0.8125rem] text-ink-mute">Chargement…</p>;
  }

  return (
    <div className="pt-9">
      <VictoryOverlay
        open={phase === 'video'}
        videoUrl={videoUrl}
        eyebrow={winner === 'tie' ? 'Match nul' : 'Vainqueur'}
        name={champion?.product_name ?? a?.product_name ?? ''}
        score={champion?.score ?? a?.score ?? 0}
        onDone={() => setPhase('result')}
      />

      {/* ----------------------------- Setup ---------------------------- */}
      {phase === 'setup' && (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <SlotCard slot="a" product={a} onClear={() => { setSlot('a', ''); setA(null); }} />
            <span className="font-serif text-[1.125rem] italic text-ink-faint">vs</span>
            <SlotCard slot="b" product={b} onClear={() => { setSlot('b', ''); setB(null); }} />
          </div>

          <button type="button" onClick={start} disabled={!a || !b} className="btn-primary mt-9">
            Lancer le combat
          </button>

          {!(a && b) && (
            <p className="mt-4 text-center text-[0.8125rem] text-ink-mute">
              Ajoute deux produits pour lancer le duel.
            </p>
          )}
        </>
      )}

      {/* ------------------------- Animation VS ------------------------- */}
      <AnimatePresence>
        {phase === 'vs' && a && b && (
          <motion.div
            className="flex min-h-[24rem] flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {/* Parallaxe : les deux produits glissent l'un vers l'autre. */}
            <motion.div
              className="w-full text-center"
              initial={{ x: -70, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1, ease: EASE }}
            >
              <p className="font-serif text-[1.375rem] leading-snug">{a.product_name}</p>
              <p className="mt-1 text-[0.75rem] text-ink-mute">{a.brand || '—'}</p>
            </motion.div>

            {/* Le « vs » se dessine : trait qui s'étire puis lettres. */}
            <div className="my-10 flex flex-col items-center">
              <motion.span
                className="block h-px bg-rule"
                initial={{ width: 0 }}
                animate={{ width: '7rem' }}
                transition={{ delay: 0.5, duration: 0.9, ease: EASE }}
                aria-hidden
              />
              <motion.span
                className="my-4 font-serif text-[2.5rem] italic leading-none text-forest"
                initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.95, duration: 0.9, ease: EASE }}
              >
                vs
              </motion.span>
              <motion.span
                className="block h-px bg-rule"
                initial={{ width: 0 }}
                animate={{ width: '7rem' }}
                transition={{ delay: 0.5, duration: 0.9, ease: EASE }}
                aria-hidden
              />
            </div>

            <motion.div
              className="w-full text-center"
              initial={{ x: 70, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1, ease: EASE }}
            >
              <p className="font-serif text-[1.375rem] leading-snug">{b.product_name}</p>
              <p className="mt-1 text-[0.75rem] text-ink-mute">{b.brand || '—'}</p>
            </motion.div>

            <motion.p
              className="mt-12 text-eyebrow uppercase tracking-[0.16em] text-ink-mute"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.7 }}
            >
              Dépouillement…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------- Résultat -------------------------- */}
      {phase === 'result' && a && b && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <p className="eyebrow">{winner === 'tie' ? 'Match nul' : 'Vainqueur'}</p>
          <h2 className="mt-3 font-serif text-title">
            {winner === 'tie' ? 'Les deux se valent' : champion?.product_name}
          </h2>

          <div className="mt-9 grid grid-cols-2 gap-4">
            {([a, b] as const).map((product, index) => {
              const side = index === 0 ? 'a' : 'b';
              const won = winner === side;
              return (
                <div
                  key={product.barcode}
                  className={`border px-4 py-5 ${won ? 'border-forest bg-forest-wash' : 'border-rule bg-white'}`}
                >
                  <span className="eyebrow">{side.toUpperCase()}</span>
                  {product.image_url && (
                    <img src={product.image_url} alt="" className="mt-3 h-16 w-16 border border-rule object-cover" />
                  )}
                  <p
                    className={`mt-3 line-clamp-2 font-serif leading-snug ${
                      won ? 'text-[1.0625rem] text-forest' : 'text-[0.9375rem] text-ink'
                    }`}
                  >
                    {product.product_name}
                  </p>
                  <div className="mt-4">
                    <ScoreBig value={product.score} label={false} />
                  </div>
                </div>
              );
            })}
          </div>

          <section className="mt-12">
            <h3 className="eyebrow rule-b pb-4">Face à face</h3>
            <div className="mt-5">
              <CompareTable a={a} b={b} />
            </div>
          </section>

          {error && <p className="mt-6 text-[0.8125rem] text-terracotta">{error}</p>}

          <div className="mt-12 grid gap-3">
            <button type="button" onClick={() => setPhase('video')} className="btn-ghost">
              Revoir la vidéo de victoire
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

export function CombatClient() {
  return (
    <Suspense fallback={<p className="pt-10 text-[0.8125rem] text-ink-mute">Chargement…</p>}>
      <CombatInner />
    </Suspense>
  );
}
