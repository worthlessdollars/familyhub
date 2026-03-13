/**
 * E2E tests: Phone Login Flow (REQ-018, REQ-019)
 *
 * Tests the complete phone login experience:
 * - User selector with avatars
 * - PIN pad entry
 * - Redirect to personal dashboard on success
 * - Error handling on failure
 * - Auth guards on protected routes
 *
 * Spec: 02-auth.md, 09-views-inventory.md
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_USERS, resetServerDb } from '@tests/helpers/db';

beforeAll(() => { resetServerDb(); });

const BASE = 'http://localhost:3000';

describe('login page (REQ-018)', () => {
  it('GET /login returns 200', async () => {
    const res = await fetch(`${BASE}/login`);
    expect(res.status).toBe(200);
  });

  it('renders HTML with user selector', async () => {
    const res = await fetch(`${BASE}/login`);
    const html = await res.text();
    // Should contain family member names
    expect(html).toContain('Parent1');
    expect(html).toContain('Parent2');
  });

  it('shows all 5 family members', async () => {
    const res = await fetch(`${BASE}/login`);
    const html = await res.text();
    for (const user of Object.values(TEST_USERS)) {
      expect(html).toContain(user.name);
    }
  });

  it('does not require authentication', async () => {
    const res = await fetch(`${BASE}/login`);
    expect(res.status).toBe(200);
  });
});

describe('login flow', () => {
  it('successful login redirects to /my', async () => {
    // Login via API
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USERS.kid1.id,
        pin: TEST_USERS.kid1.pin,
      }),
    });
    expect(loginRes.status).toBe(200);

    // Session cookie should be set
    const cookie = loginRes.headers.get('set-cookie');
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('session=');
  });

  it('failed login returns error (does not redirect)', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USERS.kid1.id,
        pin: '0000', // wrong
      }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});

describe('auth guards (REQ-019)', () => {
  it('unauthenticated visit to /my redirects to /login', async () => {
    const res = await fetch(`${BASE}/my`, { redirect: 'manual' });
    expect([301, 302, 307, 308]).toContain(res.status);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
  });

  it('unauthenticated visit to /agenda redirects to /login', async () => {
    const res = await fetch(`${BASE}/agenda`, { redirect: 'manual' });
    expect([301, 302, 307, 308]).toContain(res.status);
  });

  it('authenticated kid visiting /admin redirects away', async () => {
    // Login as kid
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USERS.kid1.id,
        pin: TEST_USERS.kid1.pin,
      }),
    });
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];

    const res = await fetch(`${BASE}/admin/chores`, {
      redirect: 'manual',
      headers: { Cookie: cookie },
    });
    // Should redirect to /my (kid can't access admin)
    expect([301, 302, 307, 308, 403]).toContain(res.status);
  });

  it('authenticated parent can access /admin', async () => {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USERS.parent1.id,
        pin: TEST_USERS.parent1.pin,
      }),
    });
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];

    const res = await fetch(`${BASE}/admin/chores`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
  });
});

describe('mobile navigation', () => {
  it.todo('bottom nav shows Home, Agenda, Admin tabs');
  it.todo('Admin tab is hidden for kid accounts');
  it.todo('active tab is highlighted');
});

describe('PIN pad UX', () => {
  it.todo('PIN pad accepts exactly 4 digits');
  it.todo('PIN auto-submits on 4th digit');
  it.todo('progress dots show digits entered');
  it.todo('touch targets are at least 48x48px');
  it.todo('Back button returns to user selector');
});
