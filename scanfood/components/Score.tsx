import { getScoreColorHex, getScoreLabel } from '@/lib/foodApi';

/**
 * Score typographié. Pas d'anneau, pas de badge : un chiffre en grand
 * format, souligné d'un trait de couleur discret.
 */
export function ScoreBig({ value, label = true }: { value: number; label?: boolean }) {
  const color = getScoreColorHex(value);
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-start leading-none">
        <span className="tnum font-serif text-score font-normal" style={{ color }}>
          {value}
        </span>
        <span className="mt-2 ml-1 font-sans text-[0.8125rem] text-ink-mute">/100</span>
      </div>
      <span className="mt-2 block h-px w-10" style={{ backgroundColor: color }} aria-hidden />
      {label && (
        <span className="mt-2 text-eyebrow uppercase tracking-[0.16em] text-ink-mute">
          {getScoreLabel(value)}
        </span>
      )}
    </div>
  );
}

/** Variante compacte pour les listes et fiches produit. */
export function ScoreSmall({ value }: { value: number }) {
  const color = getScoreColorHex(value);
  return (
    <div className="flex shrink-0 flex-col items-end">
      <span className="tnum font-serif text-score-sm" style={{ color }}>
        {value}
      </span>
      <span className="mt-1 block h-px w-5" style={{ backgroundColor: color }} aria-hidden />
    </div>
  );
}
