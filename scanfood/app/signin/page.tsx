import { redirect } from 'next/navigation';

import { currentUser } from '@/lib/auth';
import { editorialUrl } from '@/lib/higgsfield/assets';

import { SignInForm } from './SignInForm';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  if (await currentUser()) redirect('/');

  return (
    <div className="relative isolate min-h-dvh overflow-hidden">
      <img
        src={editorialUrl('ingredients')}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-cream/90" aria-hidden />

      <div className="relative mx-auto flex min-h-dvh max-w-app flex-col justify-between px-gutter py-14 safe-t safe-b">
        <div>
          <p className="eyebrow">ScanFood</p>
          <h1 className="mt-5 font-serif text-display font-normal">
            Scanne.
            <br />
            Compare.
            <br />
            Choisis mieux.
          </h1>
          <p className="mt-6 max-w-[20rem] text-[0.9375rem] leading-relaxed text-ink-soft">
            Le score de santé de chaque produit, ses additifs, ses alternatives — et un duel
            quand tu hésites entre deux rayons.
          </p>
        </div>

        <SignInForm />
      </div>
    </div>
  );
}
