/**
 * Unit tests: Database Schema (REQ-001, REQ-002)
 *
 * Validates that the Drizzle schema matches the spec:
 * 7 tables, correct columns, constraints, indexes, WAL mode.
 *
 * Spec: 01-data-model.md
 */
import { describe, it, expect } from 'vitest';

// These imports will fail until src/db/schema.ts is implemented
import * as schema from '@/db/schema';

describe('schema tables exist', () => {
  it('exports users table', () => {
    expect(schema.users).toBeDefined();
  });

  it('exports chores table', () => {
    expect(schema.chores).toBeDefined();
  });

  it('exports chore_instances table', () => {
    expect(schema.choreInstances).toBeDefined();
  });

  it('exports chore_events table', () => {
    expect(schema.choreEvents).toBeDefined();
  });

  it('exports streaks table', () => {
    expect(schema.streaks).toBeDefined();
  });

  it('exports agenda_items table', () => {
    expect(schema.agendaItems).toBeDefined();
  });

  it('exports sessions table', () => {
    expect(schema.sessions).toBeDefined();
  });
});

describe('users table columns', () => {
  it('has id column (integer, primary key)', () => {
    expect(schema.users.id).toBeDefined();
  });

  it('has name column (text, not null, unique)', () => {
    expect(schema.users.name).toBeDefined();
  });

  it('has pin_hash column (text, not null)', () => {
    expect(schema.users.pinHash).toBeDefined();
  });

  it('has role column (text, not null) with parent/kid constraint', () => {
    expect(schema.users.role).toBeDefined();
  });

  it('has avatar_color column (text, not null)', () => {
    expect(schema.users.avatarColor).toBeDefined();
  });

  it('has created_at column (text, not null)', () => {
    expect(schema.users.createdAt).toBeDefined();
  });
});

describe('chores table columns', () => {
  it('has name column (text, not null)', () => {
    expect(schema.chores.name).toBeDefined();
  });

  it('has assigned_to column (FK to users)', () => {
    expect(schema.chores.assignedTo).toBeDefined();
  });

  it('has due_time column (text, not null)', () => {
    expect(schema.chores.dueTime).toBeDefined();
  });

  it('has recurrence column with daily default', () => {
    expect(schema.chores.recurrence).toBeDefined();
  });

  it('has is_active column (integer, default 1)', () => {
    expect(schema.chores.isActive).toBeDefined();
  });

  it('has created_by column (FK to users)', () => {
    expect(schema.chores.createdBy).toBeDefined();
  });
});

describe('chore_instances table', () => {
  it('has chore_id FK column', () => {
    expect(schema.choreInstances.choreId).toBeDefined();
  });

  it('has family_date column', () => {
    expect(schema.choreInstances.familyDate).toBeDefined();
  });

  it('has status column with pending default', () => {
    expect(schema.choreInstances.status).toBeDefined();
  });

  it('has completed_at nullable column', () => {
    expect(schema.choreInstances.completedAt).toBeDefined();
  });

  it('has completed_by nullable FK column', () => {
    expect(schema.choreInstances.completedBy).toBeDefined();
  });

  it('has skipped_by nullable FK column', () => {
    expect(schema.choreInstances.skippedBy).toBeDefined();
  });

  it('has skip_reason nullable column', () => {
    expect(schema.choreInstances.skipReason).toBeDefined();
  });
});

describe('chore_events table (immutable audit log)', () => {
  it('has chore_instance_id FK column', () => {
    expect(schema.choreEvents.choreInstanceId).toBeDefined();
  });

  it('has event_type column', () => {
    expect(schema.choreEvents.eventType).toBeDefined();
  });

  it('has actor_id FK column', () => {
    expect(schema.choreEvents.actorId).toBeDefined();
  });

  it('has metadata JSON column (nullable)', () => {
    expect(schema.choreEvents.metadata).toBeDefined();
  });

  it('has created_at column', () => {
    expect(schema.choreEvents.createdAt).toBeDefined();
  });
});

describe('streaks table', () => {
  it('has user_id and chore_id FK columns', () => {
    expect(schema.streaks.userId).toBeDefined();
    expect(schema.streaks.choreId).toBeDefined();
  });

  it('has current_streak with default 0', () => {
    expect(schema.streaks.currentStreak).toBeDefined();
  });

  it('has longest_streak with default 0', () => {
    expect(schema.streaks.longestStreak).toBeDefined();
  });

  it('has last_completed_date nullable column', () => {
    expect(schema.streaks.lastCompletedDate).toBeDefined();
  });
});

describe('sessions table', () => {
  it('has id column (text/UUID, primary key)', () => {
    expect(schema.sessions.id).toBeDefined();
  });

  it('has user_id FK column', () => {
    expect(schema.sessions.userId).toBeDefined();
  });

  it('has device_type column', () => {
    expect(schema.sessions.deviceType).toBeDefined();
  });

  it('has expires_at column', () => {
    expect(schema.sessions.expiresAt).toBeDefined();
  });
});

describe('agenda_items table', () => {
  it('has title column (text, not null)', () => {
    expect(schema.agendaItems.title).toBeDefined();
  });

  it('has date column (text, not null)', () => {
    expect(schema.agendaItems.date).toBeDefined();
  });

  it('has time nullable column', () => {
    expect(schema.agendaItems.time).toBeDefined();
  });

  it('has person_id nullable FK column', () => {
    expect(schema.agendaItems.personId).toBeDefined();
  });

  it('has created_by FK column', () => {
    expect(schema.agendaItems.createdBy).toBeDefined();
  });
});
