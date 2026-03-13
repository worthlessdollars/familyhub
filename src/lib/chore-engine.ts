/**
 * Chore engine — daily instance generation, completion, and event logging.
 *
 * Spec: 03-chore-system.md
 */
import { db } from '@/db';
import { chores, choreInstances, choreEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface ChoreInstanceRow {
  id: number;
  chore_id: number;
  family_date: string;
  assigned_to: number;
  status: string;
  completed_at: string | null;
  completed_by: number | null;
  skipped_by: number | null;
  skip_reason: string | null;
  created_at: string;
}

export interface ChoreEventRow {
  id: number;
  chore_instance_id: number;
  event_type: string;
  actor_id: number;
  metadata: string | null;
  created_at: string;
}

/**
 * Generate (or return existing) chore instances for a given family-date.
 * Idempotent: returns existing rows if already generated.
 */
export async function generateDailyInstances(
  familyDate: string
): Promise<ChoreInstanceRow[]> {
  const activeChores = db
    .select()
    .from(chores)
    .where(eq(chores.isActive, 1))
    .all();

  const results: ChoreInstanceRow[] = [];

  for (const chore of activeChores) {
    // Check if instance already exists (unique constraint: chore_id + family_date)
    const existing = db
      .select()
      .from(choreInstances)
      .where(
        and(
          eq(choreInstances.choreId, chore.id),
          eq(choreInstances.familyDate, familyDate)
        )
      )
      .get();

    if (existing) {
      results.push(toInstanceRow(existing));
      continue;
    }

    // Create new instance
    const now = new Date().toISOString();
    db.insert(choreInstances)
      .values({
        choreId: chore.id,
        familyDate,
        assignedTo: chore.assignedTo!,
        status: 'pending',
        createdAt: now,
      })
      .run();

    const inserted = db
      .select()
      .from(choreInstances)
      .where(
        and(
          eq(choreInstances.choreId, chore.id),
          eq(choreInstances.familyDate, familyDate)
        )
      )
      .get();

    if (!inserted) continue;

    // Write 'created' event
    db.insert(choreEvents)
      .values({
        choreInstanceId: inserted.id,
        eventType: 'created',
        actorId: chore.createdBy!,
        createdAt: now,
      })
      .run();

    results.push(toInstanceRow(inserted));
  }

  return results;
}

/**
 * Mark a chore instance as done. Idempotent if already done.
 */
export async function completeChoreInstance(input: {
  instanceId: number;
  completedBy: number;
}): Promise<ChoreInstanceRow> {
  const { instanceId, completedBy } = input;

  const instance = db
    .select()
    .from(choreInstances)
    .where(eq(choreInstances.id, instanceId))
    .get();

  if (!instance) throw new Error(`Chore instance ${instanceId} not found`);

  // Idempotent — already done
  if (instance.status === 'done') {
    return toInstanceRow(instance);
  }

  const now = new Date().toISOString();

  db.update(choreInstances)
    .set({
      status: 'done',
      completedAt: now,
      completedBy,
    })
    .where(eq(choreInstances.id, instanceId))
    .run();

  // Append completed event
  db.insert(choreEvents)
    .values({
      choreInstanceId: instanceId,
      eventType: 'completed',
      actorId: completedBy,
      createdAt: now,
    })
    .run();

  const updated = db
    .select()
    .from(choreInstances)
    .where(eq(choreInstances.id, instanceId))
    .get();

  return toInstanceRow(updated!);
}

/**
 * Get all events for a chore instance.
 */
export async function getChoreEventsForInstance(
  instanceId: number
): Promise<ChoreEventRow[]> {
  const rows = db
    .select()
    .from(choreEvents)
    .where(eq(choreEvents.choreInstanceId, instanceId))
    .all();

  return rows.map((r) => ({
    id: r.id,
    chore_instance_id: r.choreInstanceId,
    event_type: r.eventType,
    actor_id: r.actorId!,
    metadata: r.metadata ?? null,
    created_at: r.createdAt,
  }));
}

function toInstanceRow(r: typeof choreInstances.$inferSelect): ChoreInstanceRow {
  return {
    id: r.id,
    chore_id: r.choreId,
    family_date: r.familyDate,
    assigned_to: r.assignedTo!,
    status: r.status,
    completed_at: r.completedAt ?? null,
    completed_by: r.completedBy ?? null,
    skipped_by: r.skippedBy ?? null,
    skip_reason: r.skipReason ?? null,
    created_at: r.createdAt,
  };
}
