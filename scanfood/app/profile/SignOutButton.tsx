'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      router.replace('/signin');
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={signOut} disabled={pending} className="btn-ghost">
      <LogOut size={15} strokeWidth={1.25} aria-hidden />
      {pending ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  );
}
