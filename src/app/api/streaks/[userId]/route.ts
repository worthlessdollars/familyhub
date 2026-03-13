import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { streaks, chores } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const uid = parseInt(userId, 10);

    if (isNaN(uid)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const userStreaks = db
      .select({
        id: streaks.id,
        user_id: streaks.userId,
        chore_id: streaks.choreId,
        current_streak: streaks.currentStreak,
        longest_streak: streaks.longestStreak,
        last_completed_date: streaks.lastCompletedDate,
        updated_at: streaks.updatedAt,
        chore_name: chores.name,
      })
      .from(streaks)
      .innerJoin(chores, eq(streaks.choreId, chores.id))
      .where(eq(streaks.userId, uid))
      .all();

    return NextResponse.json({ streaks: userStreaks });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
