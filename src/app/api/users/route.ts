import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPin, requireParent } from '@/lib/auth';

export async function GET() {
  try {
    const allUsers = db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        avatar_color: users.avatarColor,
      })
      .from(users)
      .all();

    return NextResponse.json({ users: allUsers });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireParent(request);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as { message?: string }).message ?? 'Auth error';
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const body = await request.json();
    const { name, role, avatar_color, pin } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }

    const pinHash = pin ? await hashPin(pin) : await hashPin('0000');

    db.insert(users)
      .values({
        name,
        pinHash,
        role: role || 'kid',
        avatarColor: avatar_color || '#888888',
      })
      .run();

    const inserted = db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        avatar_color: users.avatarColor,
        created_at: users.createdAt,
      })
      .from(users)
      .where(eq(users.name, name))
      .get();

    return NextResponse.json(inserted);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
