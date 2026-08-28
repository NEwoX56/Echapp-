import type { EcoscoreGrade, NutriscoreGrade } from '@/lib/types';

function Badge({ label, value, tone }: { label: string; value: string; tone: 'good' | 'mid' | 'bad' }) {
  const color = tone === 'good' ? '#1F3D2B' : tone === 'bad' ? '#C2683B' : '#4A4A46';
  return (
    <div className="flex flex-col items-start">
      <span className="text-eyebrow uppercase tracking-[0.16em] text-ink-mute">{label}</span>
      <span className="mt-1.5 font-serif text-[1.375rem] leading-none" style={{ color }}>
        {value}
      </span>
      <span className="mt-1.5 block h-px w-4" style={{ backgroundColor: color }} aria-hidden />
    </div>
  );
}

function gradeTone(grade: string | null): 'good' | 'mid' | 'bad' {
  if (!grade) return 'mid';
  if (['a', 'b'].includes(grade)) return 'good';
  if (grade === 'c') return 'mid';
  return 'bad';
}

/** Nutri-Score, NOVA et Eco-Score, intégrés discrètement en ligne. */
export function Badges({
  nutriscore,
  nova,
  ecoscore,
}: {
  nutriscore: NutriscoreGrade;
  nova: 1 | 2 | 3 | 4 | null;
  ecoscore: EcoscoreGrade;
}) {
  return (
    <div className="flex gap-10 rule-t rule-b py-5">
      <Badge label="Nutri-Score" value={nutriscore ? nutriscore.toUpperCase() : '—'} tone={gradeTone(nutriscore)} />
      <Badge
        label="NOVA"
        value={nova ? String(nova) : '—'}
        tone={nova === null ? 'mid' : nova <= 2 ? 'good' : nova === 3 ? 'mid' : 'bad'}
      />
      <Badge label="Eco-Score" value={ecoscore ? ecoscore.toUpperCase() : '—'} tone={gradeTone(ecoscore)} />
    </div>
  );
}
