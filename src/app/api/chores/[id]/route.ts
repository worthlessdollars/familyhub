import { NextRequest, NextResponse } from 'next/server';
import { requireParent } from '@/lib/auth';
import { db } from '@/db';
import { chores } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireParent(request);
    const { id } = await params;
    const choreId = parseInt(id, 10);

    if (isNaN(choreId)) {
      return NextResponse.json({ error: 'Invalid chore ID' }, { status: 400 });
    }

    const existing = db.select().from(chores).where(eq(chores.id, choreId)).get();
    if (!existing) {
      return NextResponse.json({ error: 'Chore not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (body.name !== undefined) updates.name = body.name;
    if (body.assigned_to !== undefined) updates.assignedTo = body.assigned_to;
    if (body.due_time !== undefined) updates.dueTime = body.due_time;
    if (body.recurrence !== undefined) updates.recurrence = body.recurrence;
    if (body.is_active !== undefined) updates.isActive = body.is_active ? 1 : 0;

    db.update(chores).set(updates).where(eq(chores.id, choreId)).run();

    const updated = db.select().from(chores).where(eq(chores.id, choreId)).get();

    return NextResponse.json({
      id: updated!.id,
      name: updated!.name,
      assigned_to: updated!.assignedTo,
      due_time: updated!.dueTime,
      recurrence: updated!.recurrence,
      is_active: updated!.isActive,
      created_by: updated!.createdBy,
      created_at: updated!.createdAt,
      updated_at: updated!.updatedAt,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
