import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import { Shell } from '@/components/Shell';
import { currentUser } from '@/lib/auth';

import { ScannerClient } from './ScannerClient';

export const dynamic = 'force-dynamic';

export default async function ScannerPage() {
  if (!(await currentUser())) redirect('/signin');

  return (
    <Shell>
      <PageHeader eyebrow="Trois façons de faire" title="Scanner" back="/" />
      <ScannerClient />
    </Shell>
  );
}
