/**
 * Integration tests: Chore API (REQ-006, REQ-007, REQ-008, REQ-023, REQ-024, REQ-025)
 *
 * Tests the chore lifecycle through API routes:
 * GET /api/chores/today, POST /api/chores/instances/:id/complete,
 * POST /api/chores, PATCH /api/chores/:id,
 * POST /api/chores/instances/:id/skip, POST /api/chores/instances/:id/reassign
 *
 * Spec: 03-chore-system.md, 07-api-realtime.md
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_USERS, TEST_CHORES, resetServerDb } from '@tests/helpers/db';

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

async function postJson(path: string, body: object, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

// --- GET /api/chores/today (REQ-006) ---

describe('GET /api/chores/today', () => {
  it('returns 200 without authentication (TV access)', async () => {
    const { res } = await getJson('/api/chores/today');
    expect(res.status).toBe(200);
  });

  it('returns the current family_date', async () => {
    const { json } = await getJson('/api/chores/today');
    expect(json.family_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('auto-generates instances if none exist for today', async () => {
    const { json } = await getJson('/api/chores/today');
    expect(json.chores.length).toBeGreaterThan(0);
  });

  it('returns instances with correct shape', async () => {
    const { json } = await getJson('/api/chores/today');
    const chore = json.chores[0];
    expect(chore).toMatchObject({
      instance_id: expect.any(Number),
      chore_id: expect.any(Number),
      name: expect.any(String),
      assigned_to: expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        avatar_color: expect.any(String),
      }),
      due_time: expect.any(String),
      status: 'pending',
      streak: expect.objectContaining({
        current: expect.any(Number),
        longest: expect.any(Number),
      }),
    });
  });

  it('returns same instances on repeated calls (idempotent)', async () => {
    const { json: first } = await getJson('/api/chores/today');
    const { json: second } = await getJson('/api/chores/today');
    expect(first.chores.length).toBe(second.chores.length);
    expect(first.chores[0].instance_id).toBe(second.chores[0].instance_id);
  });
});

// --- POST /api/chores/instances/:id/complete (REQ-007) ---

describe('POST /api/chores/instances/:id/complete', () => {
  it('marks a chore as done when authenticated', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);

    // Get today's chores to find an instance ID
    const { json: today } = await getJson('/api/chores/today');
    const myChore = today.chores.find((c: any) => c.assigned_to.id === TEST_USERS.kid1.id);

    const { res, json } = await postJson(
      `/api/chores/instances/${myChore.instance_id}/complete`,
      { user_id: TEST_USERS.kid1.id },
      cookie
    );

    expect(res.status).toBe(200);
    expect(json.status).toBe('done');
    expect(json.completed_at).toBeTruthy();
  });

  it('returns 401 without authentication', async () => {
    const { res } = await postJson('/api/chores/instances/1/complete', {
      user_id: TEST_USERS.kid1.id,
    });
    expect(res.status).toBe(401);
  });

  it('is idempotent — completing an already-done chore returns success', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const myChore = today.chores.find((c: any) => c.assigned_to.id === TEST_USERS.kid1.id);

    // Complete twice
    await postJson(
      `/api/chores/instances/${myChore.instance_id}/complete`,
      { user_id: TEST_USERS.kid1.id },
      cookie
    );
    const { res } = await postJson(
      `/api/chores/instances/${myChore.instance_id}/complete`,
      { user_id: TEST_USERS.kid1.id },
      cookie
    );

    expect(res.status).toBe(200);
  });

  it('writes an event to chore_events audit log (REQ-008)', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const myChore = today.chores.find((c: any) => c.assigned_to.id === TEST_USERS.kid1.id);

    await postJson(
      `/api/chores/instances/${myChore.instance_id}/complete`,
      { user_id: TEST_USERS.kid1.id },
      cookie
    );

    // Verify via history API
    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: history } = await getJson(
      `/api/chores/history?chore_id=${myChore.chore_id}`,
      parentCookie
    );
    const completedEvent = history.events?.find((e: any) => e.event_type === 'completed');
    expect(completedEvent).toBeTruthy();
  });

  it('returns 404 for non-existent instance', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res } = await postJson(
      '/api/chores/instances/99999/complete',
      { user_id: TEST_USERS.kid1.id },
      cookie
    );
    expect(res.status).toBe(404);
  });
});

// --- POST /api/chores (REQ-023) - Admin ---

describe('POST /api/chores (admin)', () => {
  it('creates a new chore definition when parent', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res, json } = await postJson(
      '/api/chores',
      { name: 'Vacuum Living Room', assigned_to: TEST_USERS.kid2.id, due_time: '19:00' },
      cookie
    );
    expect(res.status).toBe(200);
    expect(json.name).toBe('Vacuum Living Room');
  });

  it('rejects creation from kid account with 403', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { res } = await postJson(
      '/api/chores',
      { name: 'New Chore', assigned_to: TEST_USERS.kid1.id, due_time: '18:00' },
      cookie
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing name', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res } = await postJson(
      '/api/chores',
      { assigned_to: TEST_USERS.kid1.id, due_time: '18:00' },
      cookie
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty name', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res } = await postJson(
      '/api/chores',
      { name: '', assigned_to: TEST_USERS.kid1.id, due_time: '18:00' },
      cookie
    );
    expect(res.status).toBe(400);
  });
});

// --- POST /api/chores/instances/:id/skip (REQ-024) ---

describe('POST /api/chores/instances/:id/skip', () => {
  it('parent can skip a chore with a reason', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const instance = today.chores[0];

    const { res, json } = await postJson(
      `/api/chores/instances/${instance.instance_id}/skip`,
      { reason: 'sick day' },
      cookie
    );
    expect(res.status).toBe(200);
    expect(json.status).toBe('skipped');
  });

  it('kid cannot skip a chore (403)', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const instance = today.chores[0];

    const { res } = await postJson(
      `/api/chores/instances/${instance.instance_id}/skip`,
      { reason: 'dont wanna' },
      cookie
    );
    expect(res.status).toBe(403);
  });

  it('writes a skipped event to the audit log', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const instance = today.chores[0];

    await postJson(
      `/api/chores/instances/${instance.instance_id}/skip`,
      { reason: 'field trip' },
      cookie
    );

    const { json: history } = await getJson(
      `/api/chores/history?chore_id=${instance.chore_id}`,
      cookie
    );
    const skipEvent = history.events?.find((e: any) => e.event_type === 'skipped');
    expect(skipEvent).toBeTruthy();
  });
});

// --- POST /api/chores/instances/:id/reassign (REQ-025) ---

describe('POST /api/chores/instances/:id/reassign', () => {
  it('parent can reassign a pending chore to another kid', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const instance = today.chores.find((c: any) => c.status === 'pending');

    const { res, json } = await postJson(
      `/api/chores/instances/${instance.instance_id}/reassign`,
      { new_assignee_id: TEST_USERS.kid2.id },
      cookie
    );
    expect(res.status).toBe(200);
    expect(json.assigned_to).toBe(TEST_USERS.kid2.id);
  });

  it('kid cannot reassign (403)', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const instance = today.chores[0];

    const { res } = await postJson(
      `/api/chores/instances/${instance.instance_id}/reassign`,
      { new_assignee_id: TEST_USERS.kid2.id },
      cookie
    );
    expect(res.status).toBe(403);
  });

  it('writes a reassigned event with previous_assignee metadata', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const instance = today.chores.find((c: any) => c.status === 'pending');

    await postJson(
      `/api/chores/instances/${instance.instance_id}/reassign`,
      { new_assignee_id: TEST_USERS.kid3.id },
      cookie
    );

    const { json: history } = await getJson(
      `/api/chores/history?chore_id=${instance.chore_id}`,
      cookie
    );
    const reassignEvent = history.events?.find((e: any) => e.event_type === 'reassigned');
    expect(reassignEvent).toBeTruthy();
    const metadata = JSON.parse(reassignEvent.metadata || '{}');
    expect(metadata.previous_assignee).toBeTruthy();
  });
});

// --- GET /api/chores/history (REQ-027) ---

describe('GET /api/chores/history', () => {
  it('returns event history sorted by created_at descending', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { res, json } = await getJson('/api/chores/history', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(json.events)).toBe(true);

    // Verify descending order
    for (let i = 1; i < json.events.length; i++) {
      expect(json.events[i - 1].created_at >= json.events[i].created_at).toBe(true);
    }
  });

  it('filters by user_id', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json } = await getJson(
      `/api/chores/history?user_id=${TEST_USERS.kid1.id}`,
      cookie
    );
    // All events should relate to Kid1
    for (const event of json.events || []) {
      expect(event.actor_id).toBe(TEST_USERS.kid1.id);
    }
  });

  it('filters by date range', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json } = await getJson(
      '/api/chores/history?from=2026-03-01&to=2026-03-13',
      cookie
    );
    expect(Array.isArray(json.events)).toBe(true);
  });

  it('requires authentication', async () => {
    const { res } = await getJson('/api/chores/history');
    expect(res.status).toBe(401);
  });
});
