import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { completeChoreInstance } from '@/lib/chore-engine';
import { recalculateStreak } from '@/lib/streaks';
import { db } from '@/db';
import { chores, choreInstances, streaks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const instanceId = parseInt(id, 10);

    if (isNaN(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
    }

    const result = await completeChoreInstance({
      instanceId,
      completedBy: user.id,
    });

    // Recalculate streak
    const instance = db
      .select()
      .from(choreInstances)
      .where(eq(choreInstances.id, instanceId))
      .get();

    if (instance) {
      const chore = db
        .select()
        .from(chores)
        .where(eq(chores.id, instance.choreId))
        .get();

      if (chore && instance.assignedTo) {
        const existingStreak = db
          .select()
          .from(streaks)
          .where(
            and(
              eq(streaks.userId, instance.assignedTo),
              eq(streaks.choreId, instance.choreId)
            )
          )
          .get();

        const streakResult = await recalculateStreak({
          userId: instance.assignedTo,
          choreId: instance.choreId,
          familyDate: instance.familyDate,
          completedAt: instance.completedAt,
          dueTime: chore.dueTime,
          previousStreak: existingStreak?.currentStreak ?? 0,
          longestStreak: existingStreak?.longestStreak ?? 0,
          lastCompletedDate: existingStreak?.lastCompletedDate ?? null,
        });

        // Upsert streak
        if (existingStreak) {
          db.update(streaks)
            .set({
              currentStreak: streakResult.current_streak,
              longestStreak: streakResult.longest_streak,
              lastCompletedDate: streakResult.last_completed_date,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(streaks.id, existingStreak.id))
            .run();
        } else {
          db.insert(streaks)
            .values({
              userId: instance.assignedTo,
              choreId: instance.choreId,
              currentStreak: streakResult.current_streak,
              longestStreak: streakResult.longest_streak,
              lastCompletedDate: streakResult.last_completed_date,
              updatedAt: new Date().toISOString(),
            })
            .run();
        }

        eventBus.emit('streak:updated', {
          userId: instance.assignedTo,
          choreId: instance.choreId,
          ...streakResult,
        });
      }
    }

    eventBus.emit('chore:updated', {
      instance_id: instanceId,
      status: 'done',
      family_date: instance?.familyDate ?? null,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('not found') ? 404 : 500);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
