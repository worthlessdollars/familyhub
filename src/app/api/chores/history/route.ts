import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { choreEvents, choreInstances, chores, users } from '@/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const choreId = url.searchParams.get('chore_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const conditions = [];

    if (userId) {
      conditions.push(eq(choreEvents.actorId, parseInt(userId, 10)));
    }
    if (choreId) {
      conditions.push(eq(choreInstances.choreId, parseInt(choreId, 10)));
    }
    if (from) {
      conditions.push(gte(choreEvents.createdAt, from));
    }
    if (to) {
      // Include the entire "to" day
      conditions.push(lte(choreEvents.createdAt, to + 'T23:59:59.999Z'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const events = db
      .select({
        id: choreEvents.id,
        chore_instance_id: choreEvents.choreInstanceId,
        event_type: choreEvents.eventType,
        actor_id: choreEvents.actorId,
        metadata: choreEvents.metadata,
        created_at: choreEvents.createdAt,
        family_date: choreInstances.familyDate,
        chore_id: choreInstances.choreId,
        chore_name: chores.name,
        actor_name: users.name,
      })
      .from(choreEvents)
      .innerJoin(choreInstances, eq(choreEvents.choreInstanceId, choreInstances.id))
      .innerJoin(chores, eq(choreInstances.choreId, chores.id))
      .leftJoin(users, eq(choreEvents.actorId, users.id))
      .where(whereClause)
      .orderBy(desc(choreEvents.createdAt))
      .all();

    return NextResponse.json({ events });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
