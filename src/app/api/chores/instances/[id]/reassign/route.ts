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

    const body = await request.json();
    const newAssigneeId = body.new_assignee_id ?? body.assigned_to;

    if (!newAssigneeId) {
      return NextResponse.json({ error: 'Missing new_assignee_id' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const previousAssignee = instance.assignedTo;

    db.update(choreInstances)
      .set({ assignedTo: newAssigneeId })
      .where(eq(choreInstances.id, instanceId))
      .run();

    db.insert(choreEvents)
      .values({
        choreInstanceId: instanceId,
        eventType: 'reassigned',
        actorId: user.id,
        metadata: JSON.stringify({ previous_assignee: previousAssignee, new_assignee: newAssigneeId }),
        createdAt: now,
      })
      .run();

    const updated = db
      .select()
      .from(choreInstances)
      .where(eq(choreInstances.id, instanceId))
      .get();

    eventBus.emit('chore:updated', { instanceId, assigned_to: newAssigneeId });

    return NextResponse.json({
      id: updated!.id,
      chore_id: updated!.choreId,
      family_date: updated!.familyDate,
      assigned_to: updated!.assignedTo,
      status: updated!.status,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
