import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import { Shell } from '@/components/Shell';
import { currentUser } from '@/lib/auth';
import { listBattles, listScans, listTournaments } from '@/lib/store';

import { HistoryTabs } from './HistoryTabs';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const user = await currentUser();
  if (!user) redirect('/signin');

  const [scans, battles, tournaments] = await Promise.all([
    listScans(user.id),
    listBattles(user.id),
    listTournaments(user.id),
  ]);

  return (
    <Shell>
      <PageHeader eyebrow="Tout ce que tu as passé au crible" title="Historique" back="/" />
      <HistoryTabs scans={scans} battles={battles} tournaments={tournaments} />
    </Shell>
  );
}
