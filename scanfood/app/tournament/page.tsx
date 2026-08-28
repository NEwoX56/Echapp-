import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import { Shell } from '@/components/Shell';
import { currentUser } from '@/lib/auth';

import { TournamentClient } from './TournamentClient';

export const dynamic = 'force-dynamic';

export default async function TournamentPage() {
  if (!(await currentUser())) redirect('/signin');

  return (
    <Shell>
      <PageHeader eyebrow="Autant de produits que tu veux" title="Tournoi" back="/" />
      <TournamentClient />
    </Shell>
  );
}
