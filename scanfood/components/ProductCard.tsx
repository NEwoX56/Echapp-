import Link from 'next/link';

import { ScoreSmall } from './Score';

interface Props {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  score: number;
  href?: string;
  onSelect?: () => void;
  /** Ligne d'information secondaire (date, catégorie…). */
  meta?: string;
}

function Inner({ name, brand, imageUrl, score, meta }: Omit<Props, 'barcode' | 'href' | 'onSelect'>) {
  return (
    <>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="thumb" loading="lazy" />
      ) : (
        <div className="thumb" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[1.0625rem] leading-snug text-ink">{name}</p>
        <p className="mt-0.5 truncate text-[0.8125rem] text-ink-mute">
          {[brand, meta].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <ScoreSmall value={score} />
    </>
  );
}

/** Fiche produit éditoriale : contour fin, image cadrée, score à droite. */
export function ProductCard(props: Props) {
  const { href, onSelect, barcode } = props;

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className="product-card w-full text-left">
        <Inner {...props} />
      </button>
    );
  }

  return (
    <Link href={href ?? `/product/${barcode}`} className="product-card">
      <Inner {...props} />
    </Link>
  );
}
