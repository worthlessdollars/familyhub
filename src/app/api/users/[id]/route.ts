import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPin, requireParent } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireParent(request);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as { message?: string }).message ?? 'Auth error';
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    // Check user exists
    const existing = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.avatar_color !== undefined) {
      updates.avatarColor = body.avatar_color;
    }
    if (body.role !== undefined) {
      updates.role = body.role;
    }
    if (body.pin !== undefined) {
      updates.pinHash = await hashPin(body.pin);
    }

    if (Object.keys(updates).length > 0) {
      db.update(users).set(updates).where(eq(users.id, userId)).run();
    }

    const updated = db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        avatar_color: users.avatarColor,
        created_at: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
