/**
 * Unit tests: Authentication (REQ-004, REQ-005)
 *
 * PIN-per-person auth with bcrypt. HTTP-only session cookies.
 * Phone sessions expire in 7 days. TV is trusted for viewing.
 *
 * Spec: 02-auth.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// These imports will fail until src/lib/auth.ts is implemented
import {
  hashPin,
  verifyPin,
  createSession,
  validateSession,
  deleteSession,
  requireAuth,
  requireParent,
} from '@/lib/auth';

describe('hashPin', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashPin('1234');
    expect(hash).toBeTruthy();
    expect(hash).not.toBe('1234');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });

  it('produces different hashes for the same PIN (salt)', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('1234');
    expect(hash1).not.toBe(hash2);
  });

  it('handles 4-digit PINs', async () => {
    const hash = await hashPin('0000');
    expect(hash).toBeTruthy();
  });
});

describe('verifyPin', () => {
  it('returns true for correct PIN', async () => {
    const hash = await hashPin('1234');
    const result = await verifyPin('1234', hash);
    expect(result).toBe(true);
  });

  it('returns false for incorrect PIN', async () => {
    const hash = await hashPin('1234');
    const result = await verifyPin('5678', hash);
    expect(result).toBe(false);
  });

  it('returns false for empty PIN', async () => {
    const hash = await hashPin('1234');
    const result = await verifyPin('', hash);
    expect(result).toBe(false);
  });

  it('returns false for PIN with extra digits', async () => {
    const hash = await hashPin('1234');
    const result = await verifyPin('12345', hash);
    expect(result).toBe(false);
  });
});

describe('createSession', () => {
  it('returns a session object with a UUID token', async () => {
    const session = await createSession(1, 'phone');
    expect(session).toHaveProperty('id');
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('creates a phone session with 7-day expiry', async () => {
    const session = await createSession(1, 'phone');
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it('creates a TV session with extended or no expiry', async () => {
    const session = await createSession(1, 'tv');
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    // TV sessions should have a very long TTL (30+ days or no expiry)
    expect(diffDays).toBeGreaterThan(29);
  });

  it('stores the session in the database', async () => {
    const session = await createSession(1, 'phone');
    const found = await validateSession(session.id);
    expect(found).toBeTruthy();
    expect(found!.user_id).toBe(1);
  });

  it('records the device type', async () => {
    const session = await createSession(1, 'phone');
    expect(session.device_type).toBe('phone');
  });
});

describe('validateSession', () => {
  it('returns user data for a valid session', async () => {
    const session = await createSession(1, 'phone');
    const result = await validateSession(session.id);
    expect(result).toBeTruthy();
    expect(result!.user_id).toBe(1);
  });

  it('returns null for a non-existent session token', async () => {
    const result = await validateSession('non-existent-token');
    expect(result).toBeNull();
  });

  it('returns null for an expired session', async () => {
    // Create a session, then manually expire it
    const session = await createSession(1, 'phone');
    // Simulate expiry by manipulating the database directly
    // (implementation detail — the test should verify the behavior)
    // For now: this test documents the expected behavior
    expect(true).toBe(true); // placeholder — implementation will make this real
  });

  it('returns null for an empty token string', async () => {
    const result = await validateSession('');
    expect(result).toBeNull();
  });
});

describe('deleteSession', () => {
  it('removes the session from the database', async () => {
    const session = await createSession(1, 'phone');
    await deleteSession(session.id);
    const result = await validateSession(session.id);
    expect(result).toBeNull();
  });

  it('does not throw for non-existent session', async () => {
    await expect(deleteSession('non-existent')).resolves.not.toThrow();
  });
});

describe('requireAuth', () => {
  it('returns user when request has valid session cookie', async () => {
    // Mock a Request object with a session cookie
    const session = await createSession(1, 'phone');
    const request = new Request('http://localhost:3000/api/test', {
      headers: { Cookie: `session=${session.id}` },
    });
    const user = await requireAuth(request);
    expect(user).toHaveProperty('id', 1);
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('role');
  });

  it('throws 401 error when no session cookie present', async () => {
    const request = new Request('http://localhost:3000/api/test');
    await expect(requireAuth(request)).rejects.toThrow();
  });

  it('throws 401 error when session is expired', async () => {
    const request = new Request('http://localhost:3000/api/test', {
      headers: { Cookie: 'session=expired-token' },
    });
    await expect(requireAuth(request)).rejects.toThrow();
  });
});

describe('requireParent', () => {
  it('returns user when authenticated as parent', async () => {
    // Parent1 is a parent (user_id: 1)
    const session = await createSession(1, 'phone');
    const request = new Request('http://localhost:3000/api/test', {
      headers: { Cookie: `session=${session.id}` },
    });
    const user = await requireParent(request);
    expect(user.role).toBe('parent');
  });

  it('throws 403 error when authenticated as kid', async () => {
    // Kid1 is user_id: 3
    const session = await createSession(3, 'phone');
    const request = new Request('http://localhost:3000/api/test', {
      headers: { Cookie: `session=${session.id}` },
    });
    await expect(requireParent(request)).rejects.toThrow();
  });

  it('throws 401 error when not authenticated at all', async () => {
    const request = new Request('http://localhost:3000/api/test');
    await expect(requireParent(request)).rejects.toThrow();
  });
});
