import { NextRequest, NextResponse } from 'next/server';
import { requireParent } from '@/lib/auth';
import { db } from '@/db';
import { chores } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    await requireParent(request);

    const allChores = db.select().from(chores).where(eq(chores.isActive, 1)).all();

    return NextResponse.json({
      chores: allChores.map((c) => ({
        id: c.id,
        name: c.name,
        assigned_to: c.assignedTo,
        due_time: c.dueTime,
        recurrence: c.recurrence,
        is_active: c.isActive,
        created_by: c.createdBy,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      })),
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireParent(request);
    const body = await request.json();

    const { name, assigned_to, due_time, recurrence } = body;

    if (!name || !assigned_to || !due_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date().toISOString();

    db.insert(chores)
      .values({
        name,
        assignedTo: assigned_to,
        dueTime: due_time,
        recurrence: recurrence || 'daily',
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Get the inserted chore
    const inserted = db
      .select()
      .from(chores)
      .where(eq(chores.name, name))
      .all()
      .pop();

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create chore' }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: inserted.id,
        name: inserted.name,
        assigned_to: inserted.assignedTo,
        due_time: inserted.dueTime,
        recurrence: inserted.recurrence,
        is_active: inserted.isActive,
        created_by: inserted.createdBy,
        created_at: inserted.createdAt,
        updated_at: inserted.updatedAt,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
