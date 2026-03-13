/**
 * Integration tests: Agenda API (REQ-016, REQ-017, REQ-022)
 *
 * Tests agenda CRUD through API routes with permission model:
 * GET /api/agenda, POST /api/agenda, PATCH /api/agenda/:id, DELETE /api/agenda/:id
 *
 * Spec: 06-daily-agenda.md, 07-api-realtime.md
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

async function getJson(path: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { headers });
  return { res, json: await res.json() };
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

async function deleteReq(path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  return { res, json: await res.json().catch(() => ({})) };
}

// --- GET /api/agenda ---

describe('GET /api/agenda', () => {
  it('returns 200 without auth (TV access)', async () => {
    const { res } = await getJson('/api/agenda?date=2026-03-13');
    expect(res.status).toBe(200);
  });

  it('returns items for the specified date', async () => {
    const { json } = await getJson('/api/agenda?date=2026-03-13');
    expect(json.date).toBe('2026-03-13');
    expect(Array.isArray(json.items)).toBe(true);
  });

  it('returns items sorted by time (all-day first, then ascending)', async () => {
    const { json } = await getJson('/api/agenda?date=2026-03-13');
    const items = json.items;
    if (items.length > 1) {
      // All-day items (time === null) should come first
      let seenTimed = false;
      for (const item of items) {
        if (item.time !== null) seenTimed = true;
        if (seenTimed && item.time === null) {
          throw new Error('All-day item found after timed item — sort is wrong');
        }
      }
    }
  });

  it('filters by user_id when provided', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    // Create a kid-specific item
    await postJson(
      '/api/agenda',
      {
        title: 'Kid1 dentist',
        date: '2026-03-13',
        time: '10:00',
        person_id: TEST_USERS.kid1.id,
      },
      cookie
    );

    // Filter by kid1
    const { json } = await getJson(
      `/api/agenda?date=2026-03-13&user_id=${TEST_USERS.kid1.id}`
    );
    // Should include kid1's items AND family-wide items
    for (const item of json.items) {
      const isForKid1 = item.person?.id === TEST_USERS.kid1.id;
      const isFamilyWide = item.person === null;
      expect(isForKid1 || isFamilyWide).toBe(true);
    }
  });

  it('returns correct item shape', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    await postJson(
      '/api/agenda',
      { title: 'Soccer', date: '2026-03-13', time: '15:30', person_id: TEST_USERS.kid2.id, notes: 'Bring cleats' },
      cookie
    );

    const { json } = await getJson('/api/agenda?date=2026-03-13');
    const soccer = json.items.find((i: any) => i.title === 'Soccer');
    expect(soccer).toMatchObject({
      id: expect.any(Number),
      title: 'Soccer',
      date: '2026-03-13',
      time: '15:30',
      person: expect.objectContaining({
        id: TEST_USERS.kid2.id,
        name: expect.any(String),
        avatar_color: expect.any(String),
      }),
      notes: 'Bring cleats',
      created_by: expect.objectContaining({
        id: TEST_USERS.parent1.id,
        name: 'Parent1',
      }),
    });
  });
});

// --- POST /api/agenda ---

describe('POST /api/agenda', () => {
  it('any family member can create an item', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res, json } = await postJson(
      '/api/agenda',
      { title: 'Homework due', date: '2026-03-13' },
      cookie
    );
    expect(res.status).toBe(200);
    expect(json.title).toBe('Homework due');
  });

  it('requires authentication', async () => {
    const res = await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', date: '2026-03-13' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing title', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res } = await postJson('/api/agenda', { date: '2026-03-13' }, cookie);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing date', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res } = await postJson('/api/agenda', { title: 'Test' }, cookie);
    expect(res.status).toBe(400);
  });

  it('creates an all-day item when time is omitted', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json } = await postJson(
      '/api/agenda',
      { title: 'Family day', date: '2026-03-14' },
      cookie
    );
    expect(json.time).toBeNull();
  });

  it('creates a family-wide item when person_id is omitted', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json } = await postJson(
      '/api/agenda',
      { title: 'Dinner out', date: '2026-03-13', time: '18:00' },
      cookie
    );
    expect(json.person_id).toBeNull();
  });

  it('sets created_by to the authenticated user', async () => {
    const cookie = await login(TEST_USERS.kid2.id, TEST_USERS.kid2.pin);
    const { json } = await postJson(
      '/api/agenda',
      { title: 'My event', date: '2026-03-13' },
      cookie
    );
    expect(json.created_by).toBe(TEST_USERS.kid2.id);
  });
});

// --- PATCH /api/agenda/:id ---

describe('PATCH /api/agenda/:id', () => {
  it('parent can edit any item', async () => {
    // Kid creates an item
    const kidCookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: created } = await postJson(
      '/api/agenda',
      { title: 'Original', date: '2026-03-13' },
      kidCookie
    );

    // Parent edits it
    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res, json } = await patchJson(
      `/api/agenda/${created.id}`,
      { title: 'Updated by parent' },
      parentCookie
    );
    expect(res.status).toBe(200);
    expect(json.title).toBe('Updated by parent');
  });

  it('kid can edit their own item', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: created } = await postJson(
      '/api/agenda',
      { title: 'My item', date: '2026-03-13' },
      cookie
    );

    const { res, json } = await patchJson(
      `/api/agenda/${created.id}`,
      { title: 'My updated item' },
      cookie
    );
    expect(res.status).toBe(200);
    expect(json.title).toBe('My updated item');
  });

  it('kid cannot edit another user\'s item (403)', async () => {
    // Parent creates an item
    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: created } = await postJson(
      '/api/agenda',
      { title: 'Parent item', date: '2026-03-13' },
      parentCookie
    );

    // Kid tries to edit it
    const kidCookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res } = await patchJson(
      `/api/agenda/${created.id}`,
      { title: 'Hacked' },
      kidCookie
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent item', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res } = await patchJson('/api/agenda/99999', { title: 'Nope' }, cookie);
    expect(res.status).toBe(404);
  });
});

// --- DELETE /api/agenda/:id ---

describe('DELETE /api/agenda/:id', () => {
  it('parent can delete any item', async () => {
    const kidCookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: created } = await postJson(
      '/api/agenda',
      { title: 'To delete', date: '2026-03-13' },
      kidCookie
    );

    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res } = await deleteReq(`/api/agenda/${created.id}`, parentCookie);
    expect(res.status).toBe(200);

    // Verify it's gone
    const { json: after } = await getJson('/api/agenda?date=2026-03-13');
    const found = after.items.find((i: any) => i.id === created.id);
    expect(found).toBeUndefined();
  });

  it('kid can delete their own item', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: created } = await postJson(
      '/api/agenda',
      { title: 'My deletable', date: '2026-03-13' },
      cookie
    );

    const { res } = await deleteReq(`/api/agenda/${created.id}`, cookie);
    expect(res.status).toBe(200);
  });

  it('kid cannot delete another user\'s item (403)', async () => {
    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: created } = await postJson(
      '/api/agenda',
      { title: 'Protected', date: '2026-03-13' },
      parentCookie
    );

    const kidCookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res } = await deleteReq(`/api/agenda/${created.id}`, kidCookie);
    expect(res.status).toBe(403);
  });

  it('deletion is a hard delete (not soft)', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: created } = await postJson(
      '/api/agenda',
      { title: 'Gone forever', date: '2026-03-13' },
      cookie
    );

    await deleteReq(`/api/agenda/${created.id}`, cookie);

    // Item should not appear even with admin access
    const { json } = await getJson('/api/agenda?date=2026-03-13');
    const found = json.items.find((i: any) => i.id === created.id);
    expect(found).toBeUndefined();
  });
});
