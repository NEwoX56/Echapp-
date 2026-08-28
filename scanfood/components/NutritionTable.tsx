import type { Nutriments } from '@/lib/types';

/**
 * Seuils pour 100 g. `low`/`high` bornent la zone « correcte » ;
 * `direction` dit si beaucoup est bon (`up`) ou mauvais (`down`).
 */
interface Row {
  key: keyof Nutriments;
  label: string;
  unit: string;
  direction: 'up' | 'down' | 'none';
  warn?: number;
  bad?: number;
  good?: number;
}

const ROWS: Row[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', direction: 'down', warn: 250, bad: 400 },
  { key: 'energy_kj', label: 'Énergie', unit: 'kJ', direction: 'none' },
  { key: 'carbohydrates', label: 'Glucides', unit: 'g', direction: 'down', warn: 30, bad: 55 },
  { key: 'sugars', label: 'dont sucres', unit: 'g', direction: 'down', warn: 10, bad: 20, good: 3 },
  { key: 'fat', label: 'Matières grasses', unit: 'g', direction: 'down', warn: 17, bad: 30 },
  { key: 'saturated_fat', label: 'dont saturées', unit: 'g', direction: 'down', warn: 5, bad: 10, good: 1.5 },
  { key: 'monounsaturated_fat', label: 'dont mono-insaturées', unit: 'g', direction: 'none' },
  { key: 'polyunsaturated_fat', label: 'dont poly-insaturées', unit: 'g', direction: 'none' },
  { key: 'trans_fat', label: 'dont trans', unit: 'g', direction: 'down', warn: 0.5, bad: 1, good: 0 },
  { key: 'proteins', label: 'Protéines', unit: 'g', direction: 'up', good: 8 },
  { key: 'fiber', label: 'Fibres', unit: 'g', direction: 'up', good: 3 },
  { key: 'salt', label: 'Sel', unit: 'g', direction: 'down', warn: 1, bad: 2, good: 0.3 },
  { key: 'sodium', label: 'Sodium', unit: 'g', direction: 'down', warn: 0.4, bad: 0.8 },
  { key: 'cholesterol', label: 'Cholestérol', unit: 'g', direction: 'down', warn: 0.05, bad: 0.1 },
  { key: 'calcium', label: 'Calcium', unit: 'g', direction: 'up', good: 0.12 },
  { key: 'iron', label: 'Fer', unit: 'g', direction: 'up', good: 0.0021 },
  { key: 'vitamin_c', label: 'Vitamine C', unit: 'g', direction: 'up', good: 0.012 },
  { key: 'potassium', label: 'Potassium', unit: 'g', direction: 'up', good: 0.3 },
  { key: 'magnesium', label: 'Magnésium', unit: 'g', direction: 'up', good: 0.056 },
];

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

function toneFor(row: Row, value: number): Tone {
  if (row.direction === 'none') return 'neutral';
  if (row.direction === 'up') return row.good !== undefined && value >= row.good ? 'good' : 'neutral';
  if (row.bad !== undefined && value >= row.bad) return 'bad';
  if (row.warn !== undefined && value >= row.warn) return 'warn';
  if (row.good !== undefined && value <= row.good) return 'good';
  return 'neutral';
}

const TONE_COLOR: Record<Tone, string> = {
  good: '#1F3D2B',
  warn: '#C2683B',
  bad: '#A34E27',
  neutral: '#D5CFC2',
};

function format(value: number, unit: string): string {
  if (unit === 'kcal' || unit === 'kJ') return String(Math.round(value));
  if (value === 0) return '0';
  if (value < 0.01) return value.toFixed(4).replace(/0+$/, '');
  if (value < 1) return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return value.toFixed(1).replace(/\.0$/, '');
}

/**
 * Tableau nutritionnel pour 100 g. Chaque ligne porte un point de couleur
 * discret plutôt qu'un fond teinté.
 */
export function NutritionTable({ nutriments }: { nutriments: Nutriments }) {
  const rows = ROWS.filter((row) => nutriments[row.key] !== null);

  if (rows.length === 0) {
    return (
      <p className="mt-5 text-[0.875rem] text-ink-mute">
        Aucune valeur nutritionnelle renseignée pour ce produit.
      </p>
    );
  }

  return (
    <table className="mt-5 w-full">
      <caption className="sr-only">Valeurs nutritionnelles pour 100 grammes</caption>
      <tbody>
        {rows.map((row) => {
          const value = nutriments[row.key] as number;
          const tone = toneFor(row, value);
          const indented = row.label.startsWith('dont');

          return (
            <tr key={row.key} className="border-b border-rule last:border-b-0">
              <th
                scope="row"
                className={`py-3 text-left text-[0.875rem] font-normal ${
                  indented ? 'pl-4 text-ink-mute' : 'text-ink-soft'
                }`}
              >
                {row.label}
              </th>
              <td className="py-3 text-right">
                <span className="tnum text-[0.9375rem] text-ink">{format(value, row.unit)}</span>
                <span className="ml-1 text-[0.75rem] text-ink-mute">{row.unit}</span>
                <span
                  className="ml-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ backgroundColor: TONE_COLOR[tone] }}
                  aria-hidden
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
