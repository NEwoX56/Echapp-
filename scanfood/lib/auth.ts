import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { getUser, upsertUser } from './store';
import type { UserRecord } from './records';

/**
 * Session par cookie signé (HMAC-SHA256), sans mot de passe : l'utilisateur
 * saisit son e-mail, on crée/retrouve son compte et on pose le cookie.
 *
 * Pour brancher Supabase Auth ou Clerk, il suffit de remplacer
 * `currentUser()` par le helper du fournisseur : tout le reste de
 * l'application ne connaît que `UserRecord.id`.
 */

const COOKIE_NAME = 'scanfood_session';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 jours

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET manquant : définis une valeur d’au moins 16 caractères.');
  }
  return 'scanfood-dev-secret-non-securise';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function seal(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function unseal(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string };
    return typeof data.userId === 'string' ? data.userId : null;
  } catch {
    return null;
  }
}

/** Utilisateur connecté, ou `null`. */
export async function currentUser(): Promise<UserRecord | null> {
  const userId = unseal(cookies().get(COOKIE_NAME)?.value);
  if (!userId) return null;
  return getUser(userId);
}

/** Identifiant de l'utilisateur connecté, ou `null`. */
export async function currentUserId(): Promise<string | null> {
  const user = await currentUser();
  return user?.id ?? null;
}

/** Connecte (ou inscrit) un utilisateur et pose le cookie de session. */
export async function signIn(email: string, firstName?: string): Promise<UserRecord> {
  const user = await upsertUser(email, firstName);
  cookies().set(COOKIE_NAME, seal(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
  return user;
}

export function signOut(): void {
  cookies().set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export const SESSION_COOKIE = COOKIE_NAME;
