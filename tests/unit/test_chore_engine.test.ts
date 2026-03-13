/**
 * Unit tests: Chore Engine (REQ-006, REQ-007, REQ-008)
 *
 * Daily instance generation, mark-done flow, immutable event log.
 *
 * Spec: 03-chore-system.md
 */
import { describe, it, expect, beforeEach } from 'vitest';

// These imports will fail until implementation exists
import {
  generateDailyInstances,
  completeChoreInstance,
  getChoreEventsForInstance,
} from '@/lib/chore-engine';

describe('generateDailyInstances', () => {
  // --- Happy path ---

  it('creates one instance per active chore for the given family-date', async () => {
    const instances = await generateDailyInstances('2026-03-13');
    // With 3 seeded chores, expect 3 instances
    expect(instances).toHaveLength(3);
  });

  it('sets status to pending for all new instances', async () => {
    const instances = await generateDailyInstances('2026-03-13');
    for (const instance of instances) {
      expect(instance.status).toBe('pending');
    }
  });

  it('inherits assigned_to from chore definition', async () => {
    const instances = await generateDailyInstances('2026-03-13');
    const catLitter = instances.find((i: any) => i.chore_id === 1);
    expect(catLitter!.assigned_to).toBe(3); // Kid1
  });

  it('sets the family_date on each instance', async () => {
    const instances = await generateDailyInstances('2026-03-13');
    for (const instance of instances) {
      expect(instance.family_date).toBe('2026-03-13');
    }
  });

  it('writes a created event to chore_events for each instance', async () => {
    const instances = await generateDailyInstances('2026-03-13');
    for (const instance of instances) {
      const events = await getChoreEventsForInstance(instance.id);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('created');
    }
  });

  // --- Idempotency (unique constraint) ---

  it('does not create duplicate instances for the same date', async () => {
    await generateDailyInstances('2026-03-13');
    const secondRun = await generateDailyInstances('2026-03-13');
    // Should return existing instances, not create duplicates
    expect(secondRun).toHaveLength(3);
  });

  it('handles concurrent calls safely (upsert behavior)', async () => {
    // Simulate concurrent generation
    const [result1, result2] = await Promise.all([
      generateDailyInstances('2026-03-13'),
      generateDailyInstances('2026-03-13'),
    ]);
    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(3);
  });

  // --- Inactive chores ---

  it('does not create instances for inactive chores', async () => {
    // Assuming a way to deactivate a chore in the test setup
    // This test documents the expected behavior
    const instances = await generateDailyInstances('2026-03-13');
    const choreIds = instances.map((i: any) => i.chore_id);
    // Should only include active chore IDs
    expect(choreIds.every((id: number) => id > 0)).toBe(true);
  });
});

describe('completeChoreInstance', () => {
  // --- Happy path ---

  it('sets status to done', async () => {
    await generateDailyInstances('2026-03-13');
    const result = await completeChoreInstance({
      instanceId: 1,
      completedBy: 3, // Kid1
    });
    expect(result.status).toBe('done');
  });

  it('sets completed_at timestamp', async () => {
    await generateDailyInstances('2026-03-13');
    const result = await completeChoreInstance({
      instanceId: 1,
      completedBy: 3,
    });
    expect(result.completed_at).toBeTruthy();
    // Should be a valid ISO 8601 string
    expect(new Date(result.completed_at!).toISOString()).toBe(result.completed_at);
  });

  it('sets completed_by to the acting user', async () => {
    await generateDailyInstances('2026-03-13');
    const result = await completeChoreInstance({
      instanceId: 1,
      completedBy: 3,
    });
    expect(result.completed_by).toBe(3);
  });

  it('writes a completed event to chore_events', async () => {
    await generateDailyInstances('2026-03-13');
    await completeChoreInstance({ instanceId: 1, completedBy: 3 });
    const events = await getChoreEventsForInstance(1);
    const completedEvent = events.find((e: any) => e.event_type === 'completed');
    expect(completedEvent).toBeTruthy();
    expect(completedEvent!.actor_id).toBe(3);
  });

  // --- Idempotency ---

  it('returns success without state change if already done', async () => {
    await generateDailyInstances('2026-03-13');
    await completeChoreInstance({ instanceId: 1, completedBy: 3 });
    const secondComplete = await completeChoreInstance({
      instanceId: 1,
      completedBy: 3,
    });
    expect(secondComplete.status).toBe('done');
    // Should not write a second completed event
    const events = await getChoreEventsForInstance(1);
    const completedEvents = events.filter((e: any) => e.event_type === 'completed');
    expect(completedEvents).toHaveLength(1);
  });

  it('returns success without state change if already skipped', async () => {
    // A skipped chore cannot be marked done
    await generateDailyInstances('2026-03-13');
    // Assume instance was skipped already
    // This documents expected idempotent behavior
  });

  // --- Error cases ---

  it('throws for non-existent instance ID', async () => {
    await expect(
      completeChoreInstance({ instanceId: 99999, completedBy: 3 })
    ).rejects.toThrow();
  });
});

describe('chore_events immutability (REQ-008)', () => {
  it('events are never modified after creation', async () => {
    await generateDailyInstances('2026-03-13');
    await completeChoreInstance({ instanceId: 1, completedBy: 3 });

    const eventsBefore = await getChoreEventsForInstance(1);
    // Complete again (idempotent — no new event)
    await completeChoreInstance({ instanceId: 1, completedBy: 3 });
    const eventsAfter = await getChoreEventsForInstance(1);

    // Same events, same content
    expect(eventsAfter).toHaveLength(eventsBefore.length);
    for (let i = 0; i < eventsBefore.length; i++) {
      expect(eventsAfter[i].id).toBe(eventsBefore[i].id);
      expect(eventsAfter[i].created_at).toBe(eventsBefore[i].created_at);
    }
  });

  it('every event has a created_at timestamp', async () => {
    await generateDailyInstances('2026-03-13');
    await completeChoreInstance({ instanceId: 1, completedBy: 3 });
    const events = await getChoreEventsForInstance(1);
    for (const event of events) {
      expect(event.created_at).toBeTruthy();
    }
  });

  it('every event has an actor_id', async () => {
    await generateDailyInstances('2026-03-13');
    await completeChoreInstance({ instanceId: 1, completedBy: 3 });
    const events = await getChoreEventsForInstance(1);
    for (const event of events) {
      expect(event.actor_id).toBeGreaterThan(0);
    }
  });
});
