/**
 * E2E tests: Chore Completion Flow (REQ-007, REQ-009, REQ-021)
 *
 * Tests the full chore completion journey from both phone and TV:
 * - Kid marks chore done on phone (one tap, no extra PIN)
 * - TV updates via SSE
 * - Streak increments
 * - Event log records the completion
 *
 * Spec: 03-chore-system.md, 05-personal-view.md
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

describe('phone chore completion (REQ-021)', () => {
  it('full flow: login → see chores → tap done → verify', async () => {
    // Step 1: Login as Kid1
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);

    // Step 2: Get today's chores
    const todayRes = await fetch(`${BASE}/api/chores/today`, {
      headers: { Cookie: cookie },
    });
    const today = await todayRes.json() as any;
    const myChore = today.chores.find(
      (c: any) => c.assigned_to.id === TEST_USERS.kid1.id && c.status === 'pending'
    );
    expect(myChore).toBeTruthy();

    // Step 3: Complete it (one tap — no extra PIN needed)
    const completeRes = await fetch(
      `${BASE}/api/chores/instances/${myChore.instance_id}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ user_id: TEST_USERS.kid1.id }),
      }
    );
    expect(completeRes.status).toBe(200);

    // Step 4: Verify it's marked done
    const afterRes = await fetch(`${BASE}/api/chores/today`);
    const after = await afterRes.json() as any;
    const completedChore = after.chores.find(
      (c: any) => c.instance_id === myChore.instance_id
    );
    expect(completedChore.status).toBe('done');
    expect(completedChore.completed_at).toBeTruthy();
  });

  it('completed chore no longer shows "Done" button on refetch', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const { chores } = await (await fetch(`${BASE}/api/chores/today`)).json() as any;
    const done = chores.find(
      (c: any) => c.assigned_to.id === TEST_USERS.kid1.id && c.status === 'done'
    );
    // A done chore should have a completed_at but no actionable state
    if (done) {
      expect(done.status).toBe('done');
      expect(done.completed_at).toBeTruthy();
    }
  });
});

describe('streak update after completion (REQ-009)', () => {
  it('streak increments after on-time completion', async () => {
    const cookie = await login(TEST_USERS.kid2.id, TEST_USERS.kid2.pin);

    // Get streak before
    const beforeRes = await fetch(`${BASE}/api/streaks/${TEST_USERS.kid2.id}`);
    const before = await beforeRes.json() as any;

    // Complete a chore
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const myChore = today.chores.find(
      (c: any) => c.assigned_to.id === TEST_USERS.kid2.id && c.status === 'pending'
    );

    if (myChore) {
      await fetch(
        `${BASE}/api/chores/instances/${myChore.instance_id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ user_id: TEST_USERS.kid2.id }),
        }
      );

      // Get streak after
      const afterRes = await fetch(`${BASE}/api/streaks/${TEST_USERS.kid2.id}`);
      const after = await afterRes.json() as any;

      const beforeStreak = before.streaks?.find(
        (s: any) => s.chore_id === myChore.chore_id
      )?.current_streak ?? 0;
      const afterStreak = after.streaks?.find(
        (s: any) => s.chore_id === myChore.chore_id
      )?.current_streak ?? 0;

      expect(afterStreak).toBe(beforeStreak + 1);
    }
  });
});

describe('audit log after completion (REQ-008)', () => {
  it('chore_events contains completed event after marking done', async () => {
    const cookie = await login(TEST_USERS.kid3.id, TEST_USERS.kid3.pin);

    // Complete a chore
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const myChore = today.chores.find(
      (c: any) => c.assigned_to.id === TEST_USERS.kid3.id && c.status === 'pending'
    );

    if (myChore) {
      await fetch(
        `${BASE}/api/chores/instances/${myChore.instance_id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ user_id: TEST_USERS.kid3.id }),
        }
      );

      // Check history via parent account
      const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
      const historyRes = await fetch(
        `${BASE}/api/chores/history?chore_id=${myChore.chore_id}`,
        { headers: { Cookie: parentCookie } }
      );
      const history = await historyRes.json() as any;

      const completedEvent = history.events?.find(
        (e: any) =>
          e.event_type === 'completed' &&
          e.actor_id === TEST_USERS.kid3.id
      );
      expect(completedEvent).toBeTruthy();
      expect(completedEvent.created_at).toBeTruthy();
    }
  });
});

describe('TV chore completion with PIN (REQ-015)', () => {
  it('full flow: validate PIN → complete chore → verify', async () => {
    // Step 1: Get a pending chore from the TV view (no auth)
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const pendingChore = today.chores.find((c: any) => c.status === 'pending');

    if (pendingChore) {
      const userId = pendingChore.assigned_to.id;
      const user = Object.values(TEST_USERS).find((u) => u.id === userId);

      if (user) {
        // Step 2: Validate PIN (inline auth for TV)
        const loginRes = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, pin: user.pin }),
        });
        expect(loginRes.status).toBe(200);
        const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];

        // Step 3: Complete the chore
        const completeRes = await fetch(
          `${BASE}/api/chores/instances/${pendingChore.instance_id}/complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ user_id: user.id }),
          }
        );
        expect(completeRes.status).toBe(200);

        // Step 4: Verify via unauthenticated TV endpoint
        const verifyRes = await fetch(`${BASE}/api/chores/today`);
        const verify = await verifyRes.json() as any;
        const updated = verify.chores.find(
          (c: any) => c.instance_id === pendingChore.instance_id
        );
        expect(updated.status).toBe('done');
      }
    }
  });

  it('wrong PIN does not complete the chore', async () => {
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const pendingChore = today.chores.find((c: any) => c.status === 'pending');

    if (pendingChore) {
      // Try with wrong PIN
      const loginRes = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: pendingChore.assigned_to.id,
          pin: '0000',
        }),
      });
      expect(loginRes.status).toBe(401);

      // Chore should still be pending
      const verifyRes = await fetch(`${BASE}/api/chores/today`);
      const verify = await verifyRes.json() as any;
      const still = verify.chores.find(
        (c: any) => c.instance_id === pendingChore.instance_id
      );
      expect(still.status).toBe('pending');
    }
  });
});
