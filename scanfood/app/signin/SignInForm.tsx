'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Connexion impossible. Réessaie.');
        setPending(false);
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Connexion impossible. Vérifie ta connexion réseau.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-12">
      <label htmlFor="email" className="eyebrow mb-4 block">
        Ton adresse e-mail
      </label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="prenom@exemple.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="field"
      />

      {error && <p className="mt-3 text-[0.8125rem] text-terracotta">{error}</p>}

      <button type="submit" disabled={pending || email.length < 5} className="btn-primary mt-8">
        {pending ? 'Un instant…' : 'Entrer'}
        {!pending && <ArrowRight size={16} strokeWidth={1.25} aria-hidden />}
      </button>

      <p className="mt-5 text-[0.75rem] leading-relaxed text-ink-mute">
        Pas de mot de passe : ton e-mail identifie ton historique, tes favoris et tes combats.
      </p>
    </form>
  );
}
