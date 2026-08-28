'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Hash, Search } from 'lucide-react';

import { ProductCard } from '@/components/ProductCard';
import { setSlot, type Slot } from '@/lib/clientState';
import type { ScoredProduct } from '@/lib/types';

type Mode = 'search' | 'camera' | 'manual';

const MODES: Array<{ id: Mode; label: string; Icon: typeof Search }> = [
  { id: 'search', label: 'Recherche', Icon: Search },
  { id: 'camera', label: 'Photo', Icon: Camera },
  { id: 'manual', label: 'Code', Icon: Hash },
];

function ScannerInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const slot = params.get('slot') as Slot | null;

  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [results, setResults] = useState<ScoredProduct[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Route commune : un produit choisi ou décodé est traité comme une saisie. */
  const accept = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      setStatus('Récupération du produit…');

      try {
        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode: code }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'Produit non trouvé. Vérifie le code-barres.');
          setStatus(null);
          setBusy(false);
          return;
        }

        if (returnTo === 'combat' && (slot === 'a' || slot === 'b')) {
          setSlot(slot, code);
          router.push('/combat');
          return;
        }

        if (returnTo === 'tournament') {
          router.push(`/tournament?add=${encodeURIComponent(code)}`);
          return;
        }

        router.push(`/product/${encodeURIComponent(code)}`);
      } catch {
        setError('Connexion impossible. Vérifie ta connexion réseau.');
        setStatus(null);
        setBusy(false);
      }
    },
    [returnTo, router, slot],
  );

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;

    setBusy(true);
    setError(null);
    setStatus('Recherche…');

    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      const products: ScoredProduct[] = data.products ?? [];
      setResults(products);
      setStatus(products.length === 0 ? 'Aucun produit ne correspond à cette recherche.' : null);
    } catch {
      setError('Connexion impossible. Vérifie ta connexion réseau.');
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Décodage depuis la photo prise par l'appareil natif.
   * `@zxing/browser` est importé dynamiquement : il ne pèse sur le bundle
   * que lorsque l'utilisateur choisit réellement le mode photo.
   */
  async function decodePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setStatus('Lecture du code-barres…');

    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      const code = result.getText().replace(/\D/g, '');

      if (!code) {
        setError('Code-barres non détecté. Reprends la photo de plus près.');
        setStatus(null);
        setBusy(false);
        return;
      }

      await accept(code);
    } catch {
      setError('Code-barres non détecté. Reprends la photo de plus près.');
      setStatus(null);
      setBusy(false);
    } finally {
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function submitManual(event: React.FormEvent) {
    event.preventDefault();
    const code = barcode.replace(/\D/g, '');
    if (code.length < 6) {
      setError('Un code-barres compte au moins 6 chiffres.');
      return;
    }
    void accept(code);
  }

  const destination =
    returnTo === 'combat' ? `Produit ${slot === 'b' ? 'B' : 'A'} du combat` : returnTo === 'tournament' ? 'Ajout au tournoi' : null;

  return (
    <div className="pt-8">
      {destination && (
        <p className="mb-7 border border-forest/25 bg-forest-wash px-4 py-3 text-[0.8125rem] text-forest">
          {destination}
        </p>
      )}

      {/* Sélecteur de mode — onglets soulignés, pas de pilules. */}
      <div className="flex gap-7 rule-b pb-3">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setError(null);
              setStatus(null);
            }}
            className="relative flex items-center gap-2 pb-2 transition-colors"
          >
            <Icon
              size={15}
              strokeWidth={1.25}
              className={mode === id ? 'text-forest' : 'text-ink-faint'}
              aria-hidden
            />
            <span className={`text-[0.875rem] ${mode === id ? 'text-ink' : 'text-ink-mute'}`}>{label}</span>
            {mode === id && (
              <motion.span
                layoutId="scanner-tab"
                className="absolute -bottom-[13px] left-0 right-0 h-px bg-forest"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="pt-8"
        >
          {mode === 'search' && (
            <form onSubmit={runSearch}>
              <label htmlFor="q" className="eyebrow mb-4 block">
                Nom du produit
              </label>
              <input
                id="q"
                type="search"
                enterKeyHint="search"
                placeholder="Yaourt nature, pain complet…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="field"
              />
              <button type="submit" disabled={busy || query.trim().length < 2} className="btn-primary mt-7">
                Rechercher
              </button>
            </form>
          )}

          {mode === 'camera' && (
            <div>
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                Prends le code-barres en photo, bien à plat et bien éclairé. La lecture se fait
                sur ton téléphone, l’image n’est jamais envoyée.
              </p>
              <input
                ref={fileRef}
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={decodePhoto}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="btn-primary mt-8"
              >
                <Camera size={17} strokeWidth={1.25} aria-hidden />
                Prendre une photo
              </button>
            </div>
          )}

          {mode === 'manual' && (
            <form onSubmit={submitManual}>
              <label htmlFor="barcode" className="eyebrow mb-4 block">
                Code-barres
              </label>
              <input
                id="barcode"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="3017620422003"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="field font-mono tracking-[0.14em]"
              />
              <button type="submit" disabled={busy || barcode.replace(/\D/g, '').length < 6} className="btn-primary mt-7">
                Saisir le code-barres
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>

      {status && <p className="mt-6 text-[0.8125rem] text-ink-mute">{status}</p>}
      {error && <p className="mt-6 text-[0.8125rem] text-terracotta">{error}</p>}

      {results.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow rule-b pb-4">{results.length} résultats</h2>
          <ul className="mt-5 space-y-3">
            {results.map((product) => (
              <li key={product.barcode}>
                <ProductCard
                  barcode={product.barcode}
                  name={product.product_name}
                  brand={product.brand}
                  imageUrl={product.image_url}
                  score={product.score}
                  onSelect={() => accept(product.barcode)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ScannerClient() {
  return (
    <Suspense fallback={<div className="pt-10 text-[0.8125rem] text-ink-mute">Chargement…</div>}>
      <ScannerInner />
    </Suspense>
  );
}
