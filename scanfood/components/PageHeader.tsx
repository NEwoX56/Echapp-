import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** En-tête éditorial : surtitre, titre serif aligné à gauche, filet. */
export function PageHeader({
  eyebrow,
  title,
  back,
  action,
}: {
  eyebrow?: string;
  title: string;
  back?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="pt-8">
      {back && (
        <Link
          href={back}
          className="mb-6 inline-flex items-center gap-2 text-[0.8125rem] text-ink-mute transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} strokeWidth={1.25} aria-hidden />
          Retour
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1 className="section-title">{title}</h1>
        </div>
        {action}
      </div>
      <div className="mt-6 rule-b" />
    </header>
  );
}
