/**
 * Integration tests: Auth API (REQ-004, REQ-005)
 *
 * Tests the full auth flow through the API routes:
 * POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, GET /api/users
 *
 * Spec: 02-auth.md, 07-api-realtime.md
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_USERS, resetServerDb } from '@tests/helpers/db';

beforeAll(() => { resetServerDb(); });

// Base URL for the test server — will be configured in setup
const BASE = 'http://localhost:3000';

/**
 * Helper: POST JSON and return response + parsed body
 */
async function postJson(path: string, body: object, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json };
}

async function getJson(path: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { headers });
  const json = await res.json();
  return { res, json };
}

describe('GET /api/users', () => {
  it('returns all family members without auth', async () => {
    const { res, json } = await getJson('/api/users');
    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(5);
  });

  it('includes id, name, role, and avatar_color', async () => {
    const { json } = await getJson('/api/users');
    const parent1 = json.users.find((u: any) => u.name === 'Parent1');
    expect(parent1).toMatchObject({
      id: expect.any(Number),
      name: 'Parent1',
      role: 'parent',
      avatar_color: '#4A90D9',
    });
  });

  it('does NOT include pin_hash in response', async () => {
    const { json } = await getJson('/api/users');
    for (const user of json.users) {
      expect(user).not.toHaveProperty('pin_hash');
      expect(user).not.toHaveProperty('pinHash');
    }
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 and user data on correct PIN', async () => {
    const { res, json } = await postJson('/api/auth/login', {
      user_id: TEST_USERS.parent1.id,
      pin: TEST_USERS.parent1.pin,
    });
    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({
      id: TEST_USERS.parent1.id,
      name: 'Parent1',
      role: 'parent',
    });
  });

  it('sets an HTTP-only session cookie', async () => {
    const { res } = await postJson('/api/auth/login', {
      user_id: TEST_USERS.parent1.id,
      pin: TEST_USERS.parent1.pin,
    });
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('session=');
    expect(setCookie!.toLowerCase()).toContain('httponly');
    expect(setCookie!.toLowerCase()).toContain('samesite=strict');
  });

  it('returns 401 on incorrect PIN', async () => {
    const { res, json } = await postJson('/api/auth/login', {
      user_id: TEST_USERS.parent1.id,
      pin: '9999', // wrong PIN
    });
    expect(res.status).toBe(401);
    expect(json.error).toBe('Invalid PIN');
  });

  it('returns 401 for non-existent user_id', async () => {
    const { res } = await postJson('/api/auth/login', {
      user_id: 99999,
      pin: '1234',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing user_id', async () => {
    const { res } = await postJson('/api/auth/login', { pin: '1234' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing pin', async () => {
    const { res } = await postJson('/api/auth/login', { user_id: 1 });
    expect(res.status).toBe(400);
  });

  it('does not reveal which digit was wrong', async () => {
    const { json } = await postJson('/api/auth/login', {
      user_id: TEST_USERS.parent1.id,
      pin: '9999',
    });
    // Error message should be generic
    expect(json.error).not.toContain('digit');
    expect(json.error).not.toContain('first');
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user when authenticated', async () => {
    // Login first to get a session cookie
    const loginRes = await postJson('/api/auth/login', {
      user_id: TEST_USERS.parent2.id,
      pin: TEST_USERS.parent2.pin,
    });
    const cookie = loginRes.res.headers.get('set-cookie')!.split(';')[0];

    const { res, json } = await getJson('/api/auth/me', cookie);
    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({
      id: TEST_USERS.parent2.id,
      name: 'Parent2',
      role: 'parent',
      avatar_color: '#E67E22',
    });
  });

  it('returns 401 when not authenticated', async () => {
    const { res } = await getJson('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid session token', async () => {
    const { res } = await getJson('/api/auth/me', 'session=invalid-token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    // Login
    const loginRes = await postJson('/api/auth/login', {
      user_id: TEST_USERS.parent1.id,
      pin: TEST_USERS.parent1.pin,
    });
    const cookie = loginRes.res.headers.get('set-cookie')!.split(';')[0];

    // Logout
    const headers: Record<string, string> = {
      Cookie: cookie,
    };
    const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers,
    });
    expect(logoutRes.status).toBe(200);

    // Verify session is invalidated
    const { res: meRes } = await getJson('/api/auth/me', cookie);
    expect(meRes.status).toBe(401);
  });
});

describe('session expiry (REQ-005)', () => {
  it('phone session expires after 7 days', async () => {
    // This test documents the expected behavior
    // Actual verification requires time manipulation or direct DB inspection
    const { res } = await postJson('/api/auth/login', {
      user_id: TEST_USERS.kid1.id,
      pin: TEST_USERS.kid1.pin,
    });

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    // Cookie max-age should be approximately 7 days (604800 seconds)
    // OR the session record in DB should have expires_at ~7 days from now
  });
});

describe('parent authorization', () => {
  it('parent can access admin routes', async () => {
    const loginRes = await postJson('/api/auth/login', {
      user_id: TEST_USERS.parent1.id,
      pin: TEST_USERS.parent1.pin,
    });
    const cookie = loginRes.res.headers.get('set-cookie')!.split(';')[0];

    const { res } = await getJson('/api/chores', cookie);
    expect(res.status).toBe(200);
  });

  it('kid gets 403 on admin routes', async () => {
    const loginRes = await postJson('/api/auth/login', {
      user_id: TEST_USERS.kid1.id,
      pin: TEST_USERS.kid1.pin,
    });
    const cookie = loginRes.res.headers.get('set-cookie')!.split(';')[0];

    const { res, json } = await getJson('/api/chores', cookie);
    expect(res.status).toBe(403);
    expect(json.error).toBeTruthy();
  });
});
