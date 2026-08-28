import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import { ScoreSmall } from '@/components/Score';
import { Shell } from '@/components/Shell';
import { VideoThumb } from '@/components/VideoThumb';
import { currentUser } from '@/lib/auth';
import { listBattles, listFavorites, listScans, listTournaments } from '@/lib/store';

import { SignOutButton } from './SignOutButton';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect('/signin');

  const [scans, battles, favorites, tournaments] = await Promise.all([
    listScans(user.id),
    listBattles(user.id),
    listFavorites(user.id),
    listTournaments(user.id),
  ]);

  const averageScore =
    scans.length > 0 ? Math.round(scans.reduce((sum, s) => sum + s.score, 0) / scans.length) : null;

  const champion = scans.reduce<(typeof scans)[number] | null>(
    (best, scan) => (best === null || scan.score > best.score ? scan : best),
    null,
  );

  const victoryVideos = [
    ...battles.filter((b) => b.victory_video_url).map((b) => ({
      id: b.id,
      url: b.victory_video_url!,
      label: b.winner === 'a' ? b.product_a_name : b.product_b_name,
    })),
    ...tournaments.filter((t) => t.coronation_video_url).map((t) => ({
      id: t.id,
      url: t.coronation_video_url!,
      label: t.winner_name,
    })),
  ].slice(0, 6);

  const stats = [
    { label: 'Scans', value: scans.length },
    { label: 'Combats', value: battles.length },
    { label: 'Favoris', value: favorites.length },
    { label: 'Tournois', value: tournaments.length },
  ];

  return (
    <Shell>
      <PageHeader eyebrow="Ton compte" title="Profil" back="/" />

      <section className="flex items-center gap-4 pt-9">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center border border-rule bg-forest-wash font-serif text-[1.375rem] text-forest"
          aria-hidden
        >
          {user.firstName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-serif text-[1.25rem] leading-snug">{user.firstName}</p>
          <p className="truncate text-[0.8125rem] text-ink-mute">{user.email}</p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow rule-b pb-4">En chiffres</h2>
        <dl className="mt-2 grid grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="border-b border-rule py-5">
              <dd className="tnum font-serif text-[2rem] leading-none">{stat.value}</dd>
              <dt className="mt-2 text-[0.75rem] text-ink-mute">{stat.label}</dt>
            </div>
          ))}
          <div className="col-span-2 border-b border-rule py-5">
            <dd className="tnum font-serif text-[2rem] leading-none">{averageScore ?? '—'}</dd>
            <dt className="mt-2 text-[0.75rem] text-ink-mute">Score moyen de tes scans</dt>
          </div>
        </dl>
      </section>

      {champion && (
        <section className="mt-12">
          <h2 className="eyebrow rule-b pb-4">Ton champion</h2>
          <Link href={`/product/${champion.barcode}`} className="mt-5 flex items-start gap-5">
            {champion.image_url && (
              <img src={champion.image_url} alt="" className="h-20 w-20 shrink-0 border border-rule object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[1.25rem] leading-snug">{champion.product_name}</p>
              <p className="mt-1 truncate text-[0.8125rem] text-ink-mute">{champion.brand || '—'}</p>
            </div>
            <ScoreSmall value={champion.score} />
          </Link>
        </section>
      )}

      {victoryVideos.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow rule-b pb-4">Tes moments de victoire</h2>
          <ul className="mt-5 grid grid-cols-3 gap-3">
            {victoryVideos.map((video) => (
              <li key={video.id}>
                <VideoThumb src={video.url} label={video.label} />
                <p className="mt-2 line-clamp-2 text-[0.6875rem] leading-snug text-ink-mute">{video.label}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 grid gap-3">
        <Link href="/history" className="btn-ghost">
          Voir l’historique complet
        </Link>
        <SignOutButton />
      </section>
    </Shell>
  );
}
