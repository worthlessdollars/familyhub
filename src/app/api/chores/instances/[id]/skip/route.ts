import { NextRequest, NextResponse } from 'next/server';
import { requireParent } from '@/lib/auth';
import { db } from '@/db';
import { choreInstances, choreEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireParent(request);
    const { id } = await params;
    const instanceId = parseInt(id, 10);

    if (isNaN(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
    }

    const instance = db
      .select()
      .from(choreInstances)
      .where(eq(choreInstances.id, instanceId))
      .get();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Idempotent: if already skipped, return current state
    if (instance.status === 'skipped') {
      return NextResponse.json({
        id: instance.id,
        chore_id: instance.choreId,
        family_date: instance.familyDate,
        assigned_to: instance.assignedTo,
        status: instance.status,
        skipped_by: instance.skippedBy,
        skip_reason: instance.skipReason,
      });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();

    db.update(choreInstances)
      .set({
        status: 'skipped',
        skippedBy: user.id,
        skipReason: body.reason || null,
      })
      .where(eq(choreInstances.id, instanceId))
      .run();

    db.insert(choreEvents)
      .values({
        choreInstanceId: instanceId,
        eventType: 'skipped',
        actorId: user.id,
        metadata: body.reason ? JSON.stringify({ reason: body.reason }) : null,
        createdAt: now,
      })
      .run();

    const updated = db
      .select()
      .from(choreInstances)
      .where(eq(choreInstances.id, instanceId))
      .get();

    eventBus.emit('chore:updated', { instanceId, status: 'skipped' });

    return NextResponse.json({
      id: updated!.id,
      chore_id: updated!.choreId,
      family_date: updated!.familyDate,
      assigned_to: updated!.assignedTo,
      status: updated!.status,
      skipped_by: updated!.skippedBy,
      skip_reason: updated!.skipReason,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
