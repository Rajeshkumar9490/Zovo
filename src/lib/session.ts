import type { User } from '../types.js';
import { ApiError } from './api.js';

export const SESSION_CACHE_KEY = 'zovo_session_preview';
export const SESSION_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const SESSION_CHECK_TIMEOUT_MS = 8000;

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): SessionStorage | null {
  try { return localStorage; } catch { return null; }
}

function tokenPreview(token: string): { id: string; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.id === 'string' && typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? { id: payload.id, exp: payload.exp } : null;
  } catch { return null; }
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<User>;
  return typeof user.id === 'string' && typeof user.email === 'string' && typeof user.name === 'string'
    && typeof user.createdAt === 'number' && Number.isFinite(user.createdAt)
    && (user.avatar === undefined || typeof user.avatar === 'string');
}

// This cache only restores presentation while the server revalidates the existing token.
// It is never read by API requests or accepted as proof of authentication.
export function readCachedSession(token: string | null, storage: SessionStorage | null = browserStorage(), now = Date.now()): User | null {
  if (!token || !storage) return null;
  try {
    const cached = JSON.parse(storage.getItem(SESSION_CACHE_KEY) || 'null');
    const preview = tokenPreview(token);
    if (!cached || cached.token !== token || !preview || preview.exp * 1000 <= now
      || typeof cached.validatedAt !== 'number' || !Number.isFinite(cached.validatedAt)
      || cached.validatedAt > now || now - cached.validatedAt > SESSION_CACHE_MAX_AGE_MS
      || !isUser(cached.user) || cached.user.id !== preview.id) return null;
    return cached.user;
  } catch { return null; }
}

export function cacheSession(token: string, user: User, storage: SessionStorage | null = browserStorage(), now = Date.now()): void {
  // /auth/me and older profile responses contain only display fields, without createdAt.
  const previewUser = { ...user, createdAt: Number.isFinite(user.createdAt) ? user.createdAt : now };
  try { storage?.setItem(SESSION_CACHE_KEY, JSON.stringify({ token, user: previewUser, validatedAt: now })); } catch {}
}

export function clearCachedSession(storage: SessionStorage | null = browserStorage()): void {
  try { storage?.removeItem(SESSION_CACHE_KEY); } catch {}
}

export type SessionValidation =
  | { status: 'valid'; user: User }
  | { status: 'invalid' | 'unavailable' | 'cancelled' };

export async function revalidateSession(loadUser: () => Promise<User>, cancellation: AbortSignal): Promise<SessionValidation> {
  try {
    const user = await loadUser();
    return cancellation.aborted ? { status: 'cancelled' } : { status: 'valid', user };
  } catch (error) {
    if (cancellation.aborted) return { status: 'cancelled' };
    return error instanceof ApiError && (error.status === 401 || error.status === 403)
      ? { status: 'invalid' } : { status: 'unavailable' };
  }
}
