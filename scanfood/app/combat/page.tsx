import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import { Shell } from '@/components/Shell';
import { currentUser } from '@/lib/auth';

import { CombatClient } from './CombatClient';

export const dynamic = 'force-dynamic';

export default async function CombatPage() {
  if (!(await currentUser())) redirect('/signin');

  return (
    <Shell>
      <PageHeader eyebrow="Deux produits, un vainqueur" title="Combat" back="/" />
      <CombatClient />
    </Shell>
  );
}
