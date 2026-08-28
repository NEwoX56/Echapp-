import { Check } from 'lucide-react';

import type { ScoredProduct } from '@/lib/types';

interface Metric {
  label: string;
  unit: string;
  /** `up` : plus c'est haut, mieux c'est. */
  direction: 'up' | 'down';
  value: (p: ScoredProduct) => number | null;
}

const METRICS: Metric[] = [
  { label: 'Calories', unit: 'kcal', direction: 'down', value: (p) => p.nutriments.calories },
  { label: 'Sucres', unit: 'g', direction: 'down', value: (p) => p.nutriments.sugars },
  { label: 'Sel', unit: 'g', direction: 'down', value: (p) => p.nutriments.salt },
  { label: 'Graisses saturées', unit: 'g', direction: 'down', value: (p) => p.nutriments.saturated_fat },
  { label: 'Protéines', unit: 'g', direction: 'up', value: (p) => p.nutriments.proteins },
  { label: 'Fibres', unit: 'g', direction: 'up', value: (p) => p.nutriments.fiber },
  { label: 'Additifs', unit: '', direction: 'down', value: (p) => p.additives_n },
];

function fmt(value: number | null, unit: string): string {
  if (value === null) return '—';
  const rounded = unit === 'kcal' || unit === '' ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit ? ` ${unit}` : ''}`;
}

/** Décide qui gagne la ligne. `null` si égalité ou donnée manquante. */
function lineWinner(metric: Metric, a: number | null, b: number | null): 'a' | 'b' | null {
  if (a === null || b === null || a === b) return null;
  const aWins = metric.direction === 'up' ? a > b : a < b;
  return aWins ? 'a' : 'b';
}

/** Tableau comparatif ligne à ligne — le gagnant de chaque métrique est marqué. */
export function CompareTable({ a, b }: { a: ScoredProduct; b: ScoredProduct }) {
  return (
    <table className="w-full">
      <caption className="sr-only">Comparaison nutritionnelle pour 100 g</caption>
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className="w-2/5 py-3 text-left text-eyebrow uppercase tracking-[0.16em] text-ink-mute">
            Pour 100 g
          </th>
          <th scope="col" className="py-3 text-right text-eyebrow uppercase tracking-[0.16em] text-ink-mute">
            A
          </th>
          <th scope="col" className="py-3 text-right text-eyebrow uppercase tracking-[0.16em] text-ink-mute">
            B
          </th>
        </tr>
      </thead>
      <tbody>
        {METRICS.map((metric) => {
          const va = metric.value(a);
          const vb = metric.value(b);
          const winner = lineWinner(metric, va, vb);

          return (
            <tr key={metric.label} className="border-b border-rule last:border-b-0">
              <th scope="row" className="py-3 text-left text-[0.875rem] font-normal text-ink-soft">
                {metric.label}
              </th>
              {(['a', 'b'] as const).map((side) => {
                const value = side === 'a' ? va : vb;
                const won = winner === side;
                return (
                  <td key={side} className="py-3 text-right">
                    <span
                      className={`tnum text-[0.9375rem] ${won ? 'font-semibold text-forest' : 'text-ink-soft'}`}
                    >
                      {fmt(value, metric.unit)}
                    </span>
                    {won && (
                      <Check
                        size={13}
                        strokeWidth={1.5}
                        className="ml-1.5 inline-block align-[-1px] text-forest"
                        aria-label="Meilleure valeur"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
