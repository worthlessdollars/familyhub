/**
 * Authentication utilities.
 *
 * PIN-per-person auth with bcrypt. HTTP-only session cookies.
 * Phone sessions expire in 7 days. TV sessions have a 365-day TTL.
 *
 * Spec: 02-auth.md
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!pin) return false;
  return bcrypt.compare(pin, hash);
}

export interface SessionRow {
  id: string;
  user_id: number;
  device_type: string;
  expires_at: string;
}

export async function createSession(
  userId: number,
  deviceType: 'phone' | 'tv'
): Promise<SessionRow> {
  const id = randomUUID();
  const now = new Date();
  const ttlDays = deviceType === 'phone' ? 7 : 365;
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const row = {
    id,
    userId,
    deviceType,
    expiresAt: expiresAt.toISOString(),
  };

  db.insert(sessions).values(row).run();

  return {
    id,
    user_id: userId,
    device_type: deviceType,
    expires_at: expiresAt.toISOString(),
  };
}

export async function validateSession(
  token: string
): Promise<{ user_id: number; role: string } | null> {
  if (!token) return null;

  const now = new Date().toISOString();
  const result = db
    .select({
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .get();

  if (!result) return null;
  if (result.expiresAt < now) {
    // Piggyback cleanup: delete the expired session
    db.delete(sessions).where(eq(sessions.id, token)).run();
    return null;
  }

  return { user_id: result.userId, role: result.role };
}

export async function deleteSession(token: string): Promise<void> {
  db.delete(sessions).where(eq(sessions.id, token)).run();
}

class AuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireAuth(
  request: Request
): Promise<{ id: number; name: string; role: string; avatar_color: string }> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) throw new AuthError(401, 'Unauthorized');

  const session = await validateSession(token);
  if (!session) throw new AuthError(401, 'Unauthorized');

  const row = db
    .select({ id: users.id, name: users.name, role: users.role, avatarColor: users.avatarColor })
    .from(users)
    .where(eq(users.id, session.user_id))
    .get();

  if (!row) throw new AuthError(401, 'Unauthorized');
  return { id: row.id, name: row.name, role: row.role, avatar_color: row.avatarColor };
}

export async function requireParent(
  request: Request
): Promise<{ id: number; name: string; role: string; avatar_color: string }> {
  const user = await requireAuth(request);
  if (user.role !== 'parent') throw new AuthError(403, 'Forbidden');
  return user;
}
