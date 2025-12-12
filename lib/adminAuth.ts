import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || '';
const ADMIN_TOKEN_COOKIE = 'admin_session';

export interface AdminTokenPayload {
  id: string;
  username: string;
  is_super_admin: boolean;
}

export function requireAdminSecret() {
  if (!ADMIN_JWT_SECRET) {
    throw new Error('ADMIN_JWT_SECRET is not configured');
  }
}

export function signAdminToken(payload: AdminTokenPayload) {
  requireAdminSecret();
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '12h' });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    requireAdminSecret();
    return jwt.verify(token, ADMIN_JWT_SECRET) as AdminTokenPayload;
  } catch (err) {
    console.warn('[adminAuth] Invalid token', err);
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookiesList = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookiesList) {
    if (c.startsWith(`${ADMIN_TOKEN_COOKIE}=`)) {
      return decodeURIComponent(c.split('=')[1]);
    }
  }
  return null;
}

export async function setAdminCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  });
}

export function setAdminCookieInResponse(response: Response, token: string) {
  response.headers.set(
    'Set-Cookie',
    `${ADMIN_TOKEN_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function clearAdminCookieInResponse(response: Response) {
  response.headers.set(
    'Set-Cookie',
    `${ADMIN_TOKEN_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}


