import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { api, ApiError } from '../src/lib/api.js';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { cacheSession, clearCachedSession, readCachedSession, revalidateSession, SESSION_CACHE_KEY, SESSION_CACHE_MAX_AGE_MS } from '../src/lib/session.js';
import type { User } from '../src/types.js';

const now = 1_800_000_000_000;
const user: User = { id: 'synthetic-user', email: 'synthetic@example.com', name: 'Synthetic', createdAt: now - 1000 };
const token = (id = user.id, exp = now / 1000 + 3600, signature = 'synthetic-signature') =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ id, exp })).toString('base64url')}.${signature}`;
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
}

test('session preview is tied to the exact current token and user identity', () => {
  const storage = memoryStorage();
  const currentToken = token();
  cacheSession(currentToken, user, storage, now);
  assert.deepEqual(readCachedSession(currentToken, storage, now), user);
  assert.equal(readCachedSession(token(user.id, now / 1000 + 3600, 'different-signature'), storage, now), null);
  assert.equal(readCachedSession(null, storage, now), null);
  cacheSession(token('another-user'), user, storage, now);
  assert.equal(readCachedSession(token('another-user'), storage, now), null);
});

test('expired, stale, future-dated, and malformed session previews are ignored', () => {
  const storage = memoryStorage();
  const longToken = token(user.id, now / 1000 + 7 * 86400);
  cacheSession(longToken, user, storage, now - SESSION_CACHE_MAX_AGE_MS - 1);
  assert.equal(readCachedSession(longToken, storage, now), null);
  cacheSession(token(user.id, now / 1000), user, storage, now);
  assert.equal(readCachedSession(token(user.id, now / 1000), storage, now), null);
  cacheSession(longToken, user, storage, now + 1);
  assert.equal(readCachedSession(longToken, storage, now), null);
  cacheSession('not-a-token', user, storage, now);
  assert.equal(readCachedSession('not-a-token', storage, now), null);
  storage.setItem(SESSION_CACHE_KEY, '{broken');
  assert.equal(readCachedSession(longToken, storage, now), null);
});

test('session caching is optional when browser storage is unavailable', () => {
  const denied = {
    getItem() { throw new Error('Storage unavailable'); },
    setItem() { throw new Error('Storage unavailable'); },
    removeItem() { throw new Error('Storage unavailable'); },
  };
  assert.equal(readCachedSession(token(), denied, now), null);
  assert.doesNotThrow(() => cacheSession(token(), user, denied, now));
  assert.doesNotThrow(() => clearCachedSession(denied));
  const storage = memoryStorage();
  cacheSession(token(), user, storage, now);
  clearCachedSession(storage);
  assert.equal(readCachedSession(token(), storage, now), null);
});

test('actual auth/me display payload without createdAt remains usable on the next reload', () => {
  const storage = memoryStorage();
  const meUser = { id: user.id, email: user.email, name: user.name, avatar: '' };
  cacheSession(token(), meUser as User, storage, now);
  assert.deepEqual(readCachedSession(token(), storage, now), { ...meUser, createdAt: now });
});

test('a cached session renders on the first AuthProvider pass while a mismatched token waits for validation', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = memoryStorage();
  const currentToken = token(user.id, Date.now() / 1000 + 3600);
  storage.setItem('zovo_auth_token', currentToken);
  cacheSession(currentToken, user, storage);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  function Probe() {
    const auth = useAuth();
    return createElement('span', null, `${auth.user?.id || 'none'}:${auth.isLoading}`);
  }
  try {
    assert.equal(renderToStaticMarkup(createElement(AuthProvider, { children: createElement(Probe) })), '<span>synthetic-user:false</span>');
    storage.setItem('zovo_auth_token', token('other-user', Date.now() / 1000 + 3600));
    assert.equal(renderToStaticMarkup(createElement(AuthProvider, { children: createElement(Probe) })), '<span>none:true</span>');
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete (globalThis as any).localStorage;
  }
});

test('only verified HTTP authentication rejection invalidates a session', async () => {
  const controller = new AbortController();
  for (const status of [401, 403]) {
    assert.deepEqual(await revalidateSession(async () => { throw new ApiError('Rejected', status); }, controller.signal), { status: 'invalid' });
  }
  for (const error of [new ApiError('Unavailable', 503), new ApiError('Internal error', 500), new TypeError('Network failed'), new DOMException('Timed out', 'TimeoutError')]) {
    assert.deepEqual(await revalidateSession(async () => { throw error; }, controller.signal), { status: 'unavailable' });
  }
  assert.deepEqual(await revalidateSession(async () => user, controller.signal), { status: 'valid', user });
});

test('cancelled validation cannot restore or invalidate a newer session', async () => {
  const controller = new AbortController();
  let complete: (value: User) => void;
  const pending = revalidateSession(() => new Promise(resolve => { complete = resolve; }), controller.signal);
  controller.abort();
  complete!(user);
  assert.deepEqual(await pending, { status: 'cancelled' });
  assert.deepEqual(await revalidateSession(async () => { throw new ApiError('Rejected', 401); }, controller.signal), { status: 'cancelled' });
});

test('session requests use the stored token rather than preview data and preserve HTTP status', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = memoryStorage();
  storage.setItem('zovo_auth_token', 'existing-server-credential');
  cacheSession(token(), user, storage, now);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const controller = new AbortController();
  globalThis.fetch = (async (url, init) => {
    assert.equal(url, '/api/auth/me');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer existing-server-credential');
    assert.equal(init?.signal, controller.signal);
    return Response.json({ error: 'Temporarily unavailable' }, { status: 503 });
  }) as typeof fetch;
  try {
    await assert.rejects(api.getMe(controller.signal), error => error instanceof ApiError && error.status === 503);
    assert.equal(storage.getItem('zovo_auth_token'), 'existing-server-credential');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete (globalThis as any).localStorage;
  }
});
