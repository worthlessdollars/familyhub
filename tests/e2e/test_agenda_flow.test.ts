/**
 * E2E tests: Agenda Flow (REQ-016, REQ-017, REQ-022)
 *
 * Tests the full agenda lifecycle:
 * - Create from phone → appears on TV
 * - Edit/delete with permission model
 * - TV display (sorted, dimmed past events)
 *
 * Spec: 06-daily-agenda.md
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

describe('agenda creation flow', () => {
  it('kid creates item → visible on TV → visible in personal view', async () => {
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);

    // Create an item
    const createRes = await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'Piano lesson',
        date: '2026-03-13',
        time: '16:00',
        person_id: TEST_USERS.kid1.id,
        notes: 'Bring music book',
      }),
    });
    expect(createRes.status).toBe(200);
    const created = await createRes.json() as any;

    // Verify on TV (no auth)
    const tvRes = await fetch(`${BASE}/api/agenda?date=2026-03-13`);
    const tvData = await tvRes.json() as any;
    const onTV = tvData.items.find((i: any) => i.title === 'Piano lesson');
    expect(onTV).toBeTruthy();
    expect(onTV.notes).toBe('Bring music book');

    // Verify in personal view (filtered)
    const personalRes = await fetch(
      `${BASE}/api/agenda?date=2026-03-13&user_id=${TEST_USERS.kid1.id}`
    );
    const personalData = await personalRes.json() as any;
    const inPersonal = personalData.items.find((i: any) => i.title === 'Piano lesson');
    expect(inPersonal).toBeTruthy();
  });

  it('family-wide item visible to all users', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'Family dinner',
        date: '2026-03-13',
        time: '18:00',
      }),
    });

    // Check it's visible for Kid2 (filtered view)
    const kid2Res = await fetch(
      `${BASE}/api/agenda?date=2026-03-13&user_id=${TEST_USERS.kid2.id}`
    );
    const kid2Data = await kid2Res.json() as any;
    const familyDinner = kid2Data.items.find((i: any) => i.title === 'Family dinner');
    expect(familyDinner).toBeTruthy();
    expect(familyDinner.person).toBeNull();
  });
});

describe('agenda permission model', () => {
  it('kid creates item, parent edits it — succeeds', async () => {
    const kidCookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const createRes = await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: kidCookie },
      body: JSON.stringify({ title: 'Editable', date: '2026-03-13' }),
    });
    const created = await createRes.json() as any;

    const parentCookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    const editRes = await fetch(`${BASE}/api/agenda/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: parentCookie },
      body: JSON.stringify({ title: 'Parent edited' }),
    });
    expect(editRes.status).toBe(200);
  });

  it('parent creates item, kid cannot edit — 403', async () => {
    const parentCookie = await login(TEST_USERS.parent2.id, TEST_USERS.parent2.pin);
    const createRes = await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: parentCookie },
      body: JSON.stringify({ title: 'Parent only', date: '2026-03-13' }),
    });
    const created = await createRes.json() as any;

    const kidCookie = await login(TEST_USERS.kid2.id, TEST_USERS.kid2.pin);
    const editRes = await fetch(`${BASE}/api/agenda/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: kidCookie },
      body: JSON.stringify({ title: 'Hacked' }),
    });
    expect(editRes.status).toBe(403);
  });

  it('kid1 creates item, kid2 cannot delete — 403', async () => {
    const kid1Cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const createRes = await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: kid1Cookie },
      body: JSON.stringify({ title: 'Kid1 item', date: '2026-03-13' }),
    });
    const created = await createRes.json() as any;

    const kid2Cookie = await login(TEST_USERS.kid2.id, TEST_USERS.kid2.pin);
    const deleteRes = await fetch(`${BASE}/api/agenda/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: kid2Cookie },
    });
    expect(deleteRes.status).toBe(403);
  });
});

describe('agenda display ordering', () => {
  it('all-day items sort before timed items', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    // Create a timed item first, then an all-day item
    await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Afternoon event', date: '2026-03-14', time: '14:00' }),
    });
    await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'All day event', date: '2026-03-14' }),
    });

    const { items } = await (
      await fetch(`${BASE}/api/agenda?date=2026-03-14`)
    ).json() as any;

    // All-day item should come first
    const allDayIndex = items.findIndex((i: any) => i.title === 'All day event');
    const timedIndex = items.findIndex((i: any) => i.title === 'Afternoon event');
    expect(allDayIndex).toBeLessThan(timedIndex);
  });

  it('timed items sorted ascending by time', async () => {
    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);

    await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Late', date: '2026-03-15', time: '20:00' }),
    });
    await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Early', date: '2026-03-15', time: '08:00' }),
    });

    const { items } = await (
      await fetch(`${BASE}/api/agenda?date=2026-03-15`)
    ).json() as any;

    const earlyIndex = items.findIndex((i: any) => i.title === 'Early');
    const lateIndex = items.findIndex((i: any) => i.title === 'Late');
    expect(earlyIndex).toBeLessThan(lateIndex);
  });
});
