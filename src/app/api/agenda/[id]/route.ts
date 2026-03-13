import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { agendaItems, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

function enrichItem(item: any) {
  let person = null;
  if (item.personId !== null) {
    const personRow = db
      .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
      .from(users)
      .where(eq(users.id, item.personId))
      .get();
    if (personRow) {
      person = { id: personRow.id, name: personRow.name, avatar_color: personRow.avatarColor };
    }
  }

  let createdBy = null;
  if (item.createdBy !== null) {
    const creatorRow = db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, item.createdBy))
      .get();
    if (creatorRow) {
      createdBy = { id: creatorRow.id, name: creatorRow.name };
    }
  }

  return {
    id: item.id,
    title: item.title,
    date: item.date,
    time: item.time,
    person,
    notes: item.notes,
    created_by: createdBy,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const existing = db.select().from(agendaItems).where(eq(agendaItems.id, itemId)).get();
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Permission: kids can only edit their own items
    if (user.role === 'kid' && existing.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title;
    if (body.date !== undefined) updates.date = body.date;
    if (body.time !== undefined) updates.time = body.time;
    if (body.person_id !== undefined) updates.personId = body.person_id;
    if (body.notes !== undefined) updates.notes = body.notes;

    db.update(agendaItems).set(updates).where(eq(agendaItems.id, itemId)).run();

    const updated = db.select().from(agendaItems).where(eq(agendaItems.id, itemId)).get();

    eventBus.emit('agenda:updated', { action: 'updated', id: itemId });

    return NextResponse.json(enrichItem(updated));
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const existing = db.select().from(agendaItems).where(eq(agendaItems.id, itemId)).get();
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Permission: kids can only delete their own items
    if (user.role === 'kid' && existing.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    db.delete(agendaItems).where(eq(agendaItems.id, itemId)).run();

    eventBus.emit('agenda:updated', { action: 'deleted', id: itemId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
