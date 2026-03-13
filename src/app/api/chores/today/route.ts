import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, chores, streaks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateDailyInstances } from '@/lib/chore-engine';
import { getFamilyDate } from '@/lib/family-date';

export async function GET() {
  try {
    const familyDate = getFamilyDate();
    const instances = await generateDailyInstances(familyDate);

    // Enrich with user info, chore name/due_time, and streak
    const enriched = instances.map((inst) => {
      const user = inst.assigned_to
        ? db.select({ id: users.id, name: users.name, avatar_color: users.avatarColor })
            .from(users)
            .where(eq(users.id, inst.assigned_to))
            .get()
        : null;

      const chore = db.select().from(chores).where(eq(chores.id, inst.chore_id)).get();

      const streakRow = inst.assigned_to
        ? db.select()
            .from(streaks)
            .where(and(eq(streaks.userId, inst.assigned_to), eq(streaks.choreId, inst.chore_id)))
            .get()
        : null;

      return {
        instance_id: inst.id,
        chore_id: inst.chore_id,
        name: chore?.name ?? '',
        assigned_to: user || null,
        due_time: chore?.dueTime ?? '',
        status: inst.status,
        family_date: inst.family_date,
        completed_at: inst.completed_at,
        completed_by: inst.completed_by,
        streak: {
          current: streakRow?.currentStreak ?? 0,
          longest: streakRow?.longestStreak ?? 0,
        },
      };
    });

    return NextResponse.json({ family_date: familyDate, chores: enriched });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
