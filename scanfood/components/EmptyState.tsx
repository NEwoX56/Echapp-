import Link from 'next/link';

import { editorialUrl, type EditorialKey } from '@/lib/higgsfield/assets';

/**
 * État vide éditorial : photo Higgsfield en arrière-plan, voilée d'un
 * calque crème, texte serif court par-dessus.
 */
export function EmptyState({
  image,
  title,
  body,
  cta,
}: {
  image: EditorialKey;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <section className="relative isolate overflow-hidden border border-rule">
      <img
        src={editorialUrl(image)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-cream/78" aria-hidden />
      <div className="relative px-6 py-14 text-center">
        <h2 className="font-serif text-[1.375rem] leading-snug text-ink">{title}</h2>
        <p className="mx-auto mt-3 max-w-[22rem] text-[0.875rem] leading-relaxed text-ink-soft">{body}</p>
        {cta && (
          <Link href={cta.href} className="btn-ghost mt-7 bg-cream">
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}
