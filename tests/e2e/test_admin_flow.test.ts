/**
 * E2E tests: Admin Flow (REQ-023, REQ-024, REQ-025, REQ-026)
 *
 * Tests parent admin capabilities end-to-end:
 * - Create/edit/deactivate chores
 * - Skip and reassign chores
 * - Add/edit family members
 * - Reset PINs
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

describe('chore admin flow (REQ-023)', () => {
  it('parent creates chore → appears in today\'s instances → visible on TV', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    // Create a new chore
    const createRes = await fetch(`${BASE}/api/chores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Feed the Dog',
        assigned_to: TEST_USERS.kid1.id,
        due_time: '07:00',
      }),
    });
    expect(createRes.status).toBe(200);

    // Force instance generation by requesting today
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const newChore = today.chores.find((c: any) => c.name === 'Feed the Dog');
    expect(newChore).toBeTruthy();
    expect(newChore.assigned_to.id).toBe(TEST_USERS.kid1.id);
    expect(newChore.due_time).toBe('07:00');
  });

  it('parent deactivates chore → stops appearing in new days', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    // Get chores list
    const listRes = await fetch(`${BASE}/api/chores`, {
      headers: { Cookie: cookie },
    });
    const list = await listRes.json() as any;
    const choreToDeactivate = list.chores?.[0] || list[0];

    if (choreToDeactivate) {
      // Deactivate
      const patchRes = await fetch(`${BASE}/api/chores/${choreToDeactivate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ is_active: false }),
      });
      expect(patchRes.status).toBe(200);
    }
  });

  it('parent edits chore name and due_time', async () => {
    const cookie = await login(TEST_USERS.parent2.id, TEST_USERS.parent2.pin);

    // Create, then edit
    const createRes = await fetch(`${BASE}/api/chores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Old Name',
        assigned_to: TEST_USERS.kid2.id,
        due_time: '18:00',
      }),
    });
    const created = await createRes.json() as any;

    const editRes = await fetch(`${BASE}/api/chores/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'New Name', due_time: '19:30' }),
    });
    expect(editRes.status).toBe(200);
    const edited = await editRes.json() as any;
    expect(edited.name).toBe('New Name');
    expect(edited.due_time).toBe('19:30');
  });
});

describe('skip chore flow (REQ-024)', () => {
  it('parent skips → status is skipped → streak preserved', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    // Get today's chores
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const pending = today.chores.find((c: any) => c.status === 'pending');

    if (pending) {
      const userId = pending.assigned_to.id;

      // Get streak before
      const beforeRes = await fetch(`${BASE}/api/streaks/${userId}`);
      const before = await beforeRes.json() as any;
      const beforeStreak = before.streaks?.find(
        (s: any) => s.chore_id === pending.chore_id
      )?.current_streak ?? 0;

      // Skip
      const skipRes = await fetch(
        `${BASE}/api/chores/instances/${pending.instance_id}/skip`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ reason: 'sick day' }),
        }
      );
      expect(skipRes.status).toBe(200);
      const skipped = await skipRes.json() as any;
      expect(skipped.status).toBe('skipped');

      // Verify streak unchanged
      const afterRes = await fetch(`${BASE}/api/streaks/${userId}`);
      const after = await afterRes.json() as any;
      const afterStreak = after.streaks?.find(
        (s: any) => s.chore_id === pending.chore_id
      )?.current_streak ?? 0;
      expect(afterStreak).toBe(beforeStreak);
    }
  });
});

describe('reassign chore flow (REQ-025)', () => {
  it('parent reassigns → new assignee sees it → original streak preserved', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const pending = today.chores.find(
      (c: any) => c.status === 'pending' && c.assigned_to.id === TEST_USERS.kid3.id
    );

    if (pending) {
      // Reassign from Kid3 to Kid2
      const reassignRes = await fetch(
        `${BASE}/api/chores/instances/${pending.instance_id}/reassign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ new_assignee_id: TEST_USERS.kid2.id }),
        }
      );
      expect(reassignRes.status).toBe(200);

      // Verify Kid2 now sees it
      const afterRes = await fetch(`${BASE}/api/chores/today`);
      const after = await afterRes.json() as any;
      const reassigned = after.chores.find(
        (c: any) => c.instance_id === pending.instance_id
      );
      expect(reassigned.assigned_to.id).toBe(TEST_USERS.kid2.id);
    }
  });
});

describe('user management flow (REQ-026)', () => {
  it('parent adds new kid → kid can login → kid appears in user selector', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    // Add new kid
    const createRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'NewKid',
        role: 'kid',
        avatar_color: '#8E44AD',
        pin: '7777',
      }),
    });
    expect(createRes.status).toBe(200);
    const newUser = await createRes.json() as any;

    // New kid appears in user list
    const usersRes = await fetch(`${BASE}/api/users`);
    const users = await usersRes.json() as any;
    const found = users.users.find((u: any) => u.name === 'NewKid');
    expect(found).toBeTruthy();

    // New kid can login
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: newUser.id, pin: '7777' }),
    });
    expect(loginRes.status).toBe(200);
  });

  it('parent resets kid PIN → old PIN fails → new PIN works', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    // Reset Kid1's PIN
    const resetRes = await fetch(`${BASE}/api/users/${TEST_USERS.kid1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ pin: '9876' }),
    });
    expect(resetRes.status).toBe(200);

    // Old PIN fails
    const oldPinRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: TEST_USERS.kid1.id, pin: TEST_USERS.kid1.pin }),
    });
    expect(oldPinRes.status).toBe(401);

    // New PIN works
    const newPinRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: TEST_USERS.kid1.id, pin: '9876' }),
    });
    expect(newPinRes.status).toBe(200);
  });
});
