import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPin, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, pin } = body;

    if (!user_id || !pin) {
      return NextResponse.json({ error: 'Missing user_id or pin' }, { status: 400 });
    }

    const user = db
      .select()
      .from(users)
      .where(eq(users.id, user_id))
      .get();

    if (!user) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const valid = await verifyPin(pin, user.pinHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const session = await createSession(user_id, 'phone');

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar_color: user.avatarColor,
      },
    });

    response.cookies.set('session', session.id, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set('role', user.role, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
