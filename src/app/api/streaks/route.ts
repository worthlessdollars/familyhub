import { NextResponse } from 'next/server';
import { db } from '@/db';
import { streaks, users, chores } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const allStreaks = db
      .select({
        id: streaks.id,
        user_id: streaks.userId,
        chore_id: streaks.choreId,
        current_streak: streaks.currentStreak,
        longest_streak: streaks.longestStreak,
        last_completed_date: streaks.lastCompletedDate,
        updated_at: streaks.updatedAt,
        user_name: users.name,
        avatar_color: users.avatarColor,
        chore_name: chores.name,
      })
      .from(streaks)
      .innerJoin(users, eq(streaks.userId, users.id))
      .innerJoin(chores, eq(streaks.choreId, chores.id))
      .all();

    return NextResponse.json({ streaks: allStreaks });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
