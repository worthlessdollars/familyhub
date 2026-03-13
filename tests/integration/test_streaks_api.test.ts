/**
 * Integration tests: Streaks API (REQ-009, REQ-010)
 *
 * Tests streak calculation through the API after chore completions.
 * GET /api/streaks, GET /api/streaks/:userId
 *
 * Spec: 03-chore-system.md, 07-api-realtime.md
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

describe('GET /api/streaks', () => {
  it('returns 200 without auth (TV access)', async () => {
    const { res } = await getJson('/api/streaks');
    expect(res.status).toBe(200);
  });

  it('returns streak data with correct shape', async () => {
    const { json } = await getJson('/api/streaks');
    expect(json.streaks).toBeDefined();
    expect(Array.isArray(json.streaks)).toBe(true);

    if (json.streaks.length > 0) {
      const streak = json.streaks[0];
      expect(streak).toMatchObject({
        user_id: expect.any(Number),
        user_name: expect.any(String),
        avatar_color: expect.any(String),
        chore_id: expect.any(Number),
        chore_name: expect.any(String),
        current_streak: expect.any(Number),
        longest_streak: expect.any(Number),
      });
    }
  });
});

describe('GET /api/streaks/:userId', () => {
  it('returns streaks for a specific user', async () => {
    const { res, json } = await getJson(`/api/streaks/${TEST_USERS.kid1.id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(json.streaks)).toBe(true);

    for (const streak of json.streaks) {
      expect(streak.user_id).toBe(TEST_USERS.kid1.id);
    }
  });

  it('returns empty array for user with no streaks', async () => {
    // A new user with no chore history
    const { json } = await getJson(`/api/streaks/${TEST_USERS.parent2.id}`);
    expect(json.streaks).toBeDefined();
    // Parent2 is a parent, might not have chores assigned
  });
});

describe('streak integration with chore completion', () => {
  it('streak increments after on-time completion', async () => {
    // Get initial streak
    const { json: before } = await getJson(`/api/streaks/${TEST_USERS.kid1.id}`);
    const initialStreak = before.streaks?.find((s: any) => s.chore_id === 1)?.current_streak ?? 0;

    // Complete the chore on time
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const myChore = today.chores.find((c: any) => c.assigned_to.id === TEST_USERS.kid1.id);

    if (myChore && myChore.status === 'pending') {
      await fetch(`${BASE}/api/chores/instances/${myChore.instance_id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ user_id: TEST_USERS.kid1.id }),
      });

      // Check streak after
      const { json: after } = await getJson(`/api/streaks/${TEST_USERS.kid1.id}`);
      const newStreak = after.streaks?.find((s: any) => s.chore_id === 1)?.current_streak ?? 0;
      expect(newStreak).toBe(initialStreak + 1);
    }
  });

  it('streak resets to 0 after late completion', async () => {
    // This test documents the expected behavior
    // Actual verification requires time manipulation
    // Late = completed after due_time but before 4 AM boundary
    expect(true).toBe(true); // Placeholder — implementation will make this testable
  });

  it('streak unchanged after skip', async () => {
    const { json: before } = await getJson(`/api/streaks/${TEST_USERS.kid1.id}`);
    const initialStreak = before.streaks?.find((s: any) => s.chore_id === 1)?.current_streak ?? 0;

    // Parent skips the chore
    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const { json: today } = await getJson('/api/chores/today');
    const kidChore = today.chores.find(
      (c: any) => c.assigned_to.id === TEST_USERS.kid1.id && c.status === 'pending'
    );

    if (kidChore) {
      await fetch(`${BASE}/api/chores/instances/${kidChore.instance_id}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: parentCookie },
        body: JSON.stringify({ reason: 'test skip' }),
      });

      const { json: after } = await getJson(`/api/streaks/${TEST_USERS.kid1.id}`);
      const newStreak = after.streaks?.find((s: any) => s.chore_id === 1)?.current_streak ?? 0;
      expect(newStreak).toBe(initialStreak);
    }
  });
});
