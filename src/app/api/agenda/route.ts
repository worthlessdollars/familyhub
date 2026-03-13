import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { agendaItems, users } from '@/db/schema';
import { eq, and, or, isNull, asc, sql } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const userId = url.searchParams.get('user_id');

    if (!date) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    // Alias tables for person and created_by joins
    const personAlias = users;
    const creatorAlias = users;

    let conditions = eq(agendaItems.date, date);

    // Build query with raw SQL for proper joins
    let query;
    if (userId) {
      const uid = parseInt(userId, 10);
      query = db
        .select({
          id: agendaItems.id,
          title: agendaItems.title,
          date: agendaItems.date,
          time: agendaItems.time,
          personId: agendaItems.personId,
          notes: agendaItems.notes,
          createdBy: agendaItems.createdBy,
          createdAt: agendaItems.createdAt,
          updatedAt: agendaItems.updatedAt,
        })
        .from(agendaItems)
        .where(
          and(
            eq(agendaItems.date, date),
            or(
              eq(agendaItems.personId, uid),
              isNull(agendaItems.personId)
            )
          )
        )
        .all();
    } else {
      query = db
        .select({
          id: agendaItems.id,
          title: agendaItems.title,
          date: agendaItems.date,
          time: agendaItems.time,
          personId: agendaItems.personId,
          notes: agendaItems.notes,
          createdBy: agendaItems.createdBy,
          createdAt: agendaItems.createdAt,
          updatedAt: agendaItems.updatedAt,
        })
        .from(agendaItems)
        .where(eq(agendaItems.date, date))
        .all();
    }

    // Sort: null time first, then ascending
    const items = query.sort((a, b) => {
      if (a.time === null && b.time !== null) return -1;
      if (a.time !== null && b.time === null) return 1;
      if (a.time === null && b.time === null) return 0;
      return a.time! < b.time! ? -1 : a.time! > b.time! ? 1 : 0;
    });

    // Enrich with person and created_by info
    const enrichedItems = items.map((item) => {
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
          .where(eq(users.id, item.createdBy!))
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
    });

    return NextResponse.json({ date, items: enrichedItems });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { title, date, time, person_id, notes } = body;

    if (!title) {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: 'Missing required field: date' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const result = db.insert(agendaItems)
      .values({
        title,
        date,
        time: time ?? null,
        personId: person_id ?? null,
        notes: notes ?? null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const insertedId = Number(result.lastInsertRowid);
    const inserted = db.select().from(agendaItems).where(eq(agendaItems.id, insertedId)).get();

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }

    eventBus.emit('agenda:updated', { action: 'created', id: inserted.id });

    return NextResponse.json({
      id: inserted.id,
      title: inserted.title,
      date: inserted.date,
      time: inserted.time,
      person_id: inserted.personId,
      notes: inserted.notes,
      created_by: inserted.createdBy,
      created_at: inserted.createdAt,
      updated_at: inserted.updatedAt,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
  }
}
