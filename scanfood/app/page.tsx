import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ScanLine, Swords, Trophy } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { Shell } from '@/components/Shell';
import { Splash } from '@/components/Splash';
import { currentUser } from '@/lib/auth';
import { CURATED } from '@/lib/higgsfield/assets';
import { resolveCurated } from '@/lib/higgsfield/client';
import { listScans } from '@/lib/store';

export const dynamic = 'force-dynamic';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Bonne nuit';
  if (hour < 13) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect('/signin');

  const scans = await listScans(user.id, 5);

  return (
    <Shell>
      <Splash videoUrl={resolveCurated(CURATED.intro)} />

      <header className="pb-10 pt-12">
        <p className="eyebrow">{greeting()}</p>
        <h1 className="mt-3 break-words font-serif text-display font-normal">{user.firstName}</h1>
      </header>

      <Link href="/scanner" className="btn-primary">
        <ScanLine size={17} strokeWidth={1.25} aria-hidden />
        Scanner un produit
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/combat" className="btn-ghost">
          <Swords size={15} strokeWidth={1.25} aria-hidden />
          Combat
        </Link>
        <Link href="/tournament" className="btn-ghost">
          <Trophy size={15} strokeWidth={1.25} aria-hidden />
          Tournoi
        </Link>
      </div>

      <section className="mt-14">
        <div className="flex items-baseline justify-between rule-b pb-4">
          <h2 className="font-serif text-[1.25rem]">Scans récents</h2>
          {scans.length > 0 && (
            <Link href="/history" className="text-[0.8125rem] text-ink-mute transition-colors hover:text-ink">
              Tout voir
            </Link>
          )}
        </div>

        {scans.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              image="frigo"
              title="Rien de scanné pour l’instant"
              body="Prends ton premier produit en photo, ou saisis son code-barres. Le score arrive en deux secondes."
              cta={{ href: '/scanner', label: 'Scanner un produit' }}
            />
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {scans.map((scan) => (
              <li key={scan.id}>
                <ProductCard
                  barcode={scan.barcode}
                  name={scan.product_name}
                  brand={scan.brand}
                  imageUrl={scan.image_url}
                  score={scan.score}
                  meta={relativeDate(scan.created_at)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
