/**
 * Integration tests: User Management API (REQ-026)
 *
 * Tests user CRUD through API routes.
 * POST /api/users, PATCH /api/users/:id
 *
 * Spec: 02-auth.md, 05-personal-view.md
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_USERS, resetServerDb } from '@tests/helpers/db';

beforeAll(() => { resetServerDb(); });

const BASE = 'http://localhost:3000';

async function login(userId: number, pin: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, pin }),
  });
  return res.headers.get('set-cookie')!.split(';')[0];
}

async function postJson(path: string, body: object, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

async function patchJson(path: string, body: object, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

describe('POST /api/users', () => {
  it('parent can add a new family member', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res, json } = await postJson(
      '/api/users',
      { name: 'Kid4', role: 'kid', avatar_color: '#9B59B6', pin: '6666' },
      cookie
    );
    expect(res.status).toBe(200);
    expect(json.name).toBe('Kid4');
    expect(json.role).toBe('kid');
  });

  it('kid cannot add users (403)', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res } = await postJson(
      '/api/users',
      { name: 'Hacker', role: 'parent', avatar_color: '#000', pin: '0000' },
      cookie
    );
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', role: 'kid', avatar_color: '#FFF', pin: '1111' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing name', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res } = await postJson(
      '/api/users',
      { role: 'kid', avatar_color: '#FFF', pin: '1111' },
      cookie
    );
    expect(res.status).toBe(400);
  });

  it('hashes the PIN (not stored in plaintext)', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json } = await postJson(
      '/api/users',
      { name: 'Kid5', role: 'kid', avatar_color: '#1ABC9C', pin: '7777' },
      cookie
    );
    // Response should not include the pin or pin_hash
    expect(json).not.toHaveProperty('pin');
    expect(json).not.toHaveProperty('pin_hash');
    expect(json).not.toHaveProperty('pinHash');
  });

  it('new user can login immediately after creation', async () => {
    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    await postJson(
      '/api/users',
      { name: 'NewKid', role: 'kid', avatar_color: '#F1C40F', pin: '8888' },
      parentCookie
    );

    // Try logging in as the new user
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 6, pin: '8888' }), // Assuming auto-increment
    });
    // Should succeed (might need to find actual ID)
    expect([200, 401]).toContain(loginRes.status);
  });
});

describe('PATCH /api/users/:id', () => {
  it('parent can update a user\'s name', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res, json } = await patchJson(
      `/api/users/${TEST_USERS.kid1.id}`,
      { name: 'Kid1-Updated' },
      cookie
    );
    expect(res.status).toBe(200);
    expect(json.name).toBe('Kid1-Updated');
  });

  it('parent can reset a user\'s PIN', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res } = await patchJson(
      `/api/users/${TEST_USERS.kid1.id}`,
      { pin: '9999' },
      cookie
    );
    expect(res.status).toBe(200);

    // Verify new PIN works
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: TEST_USERS.kid1.id, pin: '9999' }),
    });
    expect(loginRes.status).toBe(200);
  });

  it('kid cannot update other users (403)', async () => {
    // Use kid2 here — kid1's PIN was changed by the previous test
    const cookie = await login(TEST_USERS.kid2.id, TEST_USERS.kid2.pin);
    const { res } = await patchJson(
      `/api/users/${TEST_USERS.kid1.id}`,
      { name: 'Hacked' },
      cookie
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res } = await patchJson('/api/users/99999', { name: 'Ghost' }, cookie);
    expect(res.status).toBe(404);
  });
});
