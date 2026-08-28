'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';

/** Bascule de favori — persiste côté serveur, état optimiste. */
export function FavoriteButton({ barcode, initial }: { barcode: string; initial: boolean }) {
  const [active, setActive] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const optimistic = !active;
    setActive(optimistic);

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();
      if (res.ok) setActive(Boolean(data.isFavorite));
      else setActive(!optimistic);
    } catch {
      setActive(!optimistic);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className="btn-ghost w-full"
    >
      <Heart
        size={15}
        strokeWidth={1.25}
        className={active ? 'text-terracotta' : 'text-ink-mute'}
        fill={active ? '#C2683B' : 'none'}
        aria-hidden
      />
      {active ? 'Dans tes favoris' : 'Ajouter aux favoris'}
    </button>
  );
}
