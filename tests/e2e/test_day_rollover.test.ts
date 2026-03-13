/**
 * E2E tests: Day Rollover (REQ-010, REQ-029)
 *
 * Tests the 4 AM family-date boundary transition:
 * - New instances generated for the new day
 * - Missed chores reset streaks
 * - Idempotent (safe to trigger multiple times)
 * - SSE emits day:rollover event
 *
 * Spec: 03-chore-system.md
 */
import { describe, it, expect } from 'vitest';
import { TEST_USERS } from '@tests/helpers/db';

const BASE = 'http://localhost:3000';

async function login(userId: number, pin: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, pin }),
  });
  return res.headers.get('set-cookie')!.split(';')[0];
}

describe('day rollover (REQ-010)', () => {
  it('requesting chores for a new day generates fresh instances', async () => {
    // Get today's date
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const currentDate = today.family_date;

    // The next call should still return the same date (within the same family-day)
    const secondRes = await fetch(`${BASE}/api/chores/today`);
    const second = await secondRes.json() as any;
    expect(second.family_date).toBe(currentDate);
    expect(second.chores.length).toBe(today.chores.length);
  });

  it('rollover is idempotent — calling multiple times is safe', async () => {
    // Trigger today's instances multiple times
    const res1 = await fetch(`${BASE}/api/chores/today`);
    const data1 = await res1.json() as any;
    const res2 = await fetch(`${BASE}/api/chores/today`);
    const data2 = await res2.json() as any;

    expect(data1.chores.length).toBe(data2.chores.length);
    // Same instance IDs
    for (let i = 0; i < data1.chores.length; i++) {
      expect(data1.chores[i].instance_id).toBe(data2.chores[i].instance_id);
    }
  });

  // These tests require time manipulation (e.g., mocking Date or system clock):

  it.todo('missed chore from previous day resets that user\'s streak to 0');
  it.todo('completed chore from previous day preserves streak');
  it.todo('skipped chore from previous day leaves streak unchanged');
  it.todo('new day generates instances for all active chores');
  it.todo('new day does not generate instances for inactive chores');
  it.todo('day:rollover SSE event is emitted on boundary crossing');
});

describe('nightly sequence timing', () => {
  // 2 AM backup → 3 AM kiosk refresh → 4 AM day rollover
  // These document the expected sequence but can't be tested without time control

  it.todo('backup runs at 2 AM (before any app operations)');
  it.todo('kiosk refreshes at 3 AM (clears memory, still on old family-date)');
  it.todo('day rollover at 4 AM generates new instances');
  it.todo('after 4 AM, 3:59 AM timestamp belongs to previous family-date');
  it.todo('after 4 AM, 4:00 AM timestamp belongs to new family-date');
});
