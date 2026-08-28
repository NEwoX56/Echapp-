import { NextResponse } from 'next/server';

import { signIn, signOut } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Connexion par e-mail (crée le compte au besoin). */
export async function POST(request: Request) {
  let body: { email?: string; firstName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  }

  const user = await signIn(email, body.firstName);
  return NextResponse.json({ user: { id: user.id, email: user.email, firstName: user.firstName } });
}

/** Déconnexion. */
export async function DELETE() {
  signOut();
  return NextResponse.json({ ok: true });
}
