import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ─── Users ──────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  pinHash: text('pin_hash').notNull(),
  role: text('role', { enum: ['parent', 'kid'] }).notNull(),
  avatarColor: text('avatar_color').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── Chores ─────────────────────────────────────────────────────────────────
export const chores = sqliteTable('chores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  assignedTo: integer('assigned_to').references(() => users.id),
  dueTime: text('due_time').notNull(),
  recurrence: text('recurrence').notNull().default('daily'),
  isActive: integer('is_active').notNull().default(1),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── Chore Instances ────────────────────────────────────────────────────────
export const choreInstances = sqliteTable('chore_instances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  choreId: integer('chore_id').notNull().references(() => chores.id),
  familyDate: text('family_date').notNull(),
  assignedTo: integer('assigned_to').references(() => users.id),
  status: text('status').notNull().default('pending'),
  completedAt: text('completed_at'),
  completedBy: integer('completed_by').references(() => users.id),
  skippedBy: integer('skipped_by').references(() => users.id),
  skipReason: text('skip_reason'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ([
  uniqueIndex('chore_instance_unique').on(table.choreId, table.familyDate),
]));

// ─── Chore Events (immutable audit log) ─────────────────────────────────────
export const choreEvents = sqliteTable('chore_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  choreInstanceId: integer('chore_instance_id').notNull().references(() => choreInstances.id),
  eventType: text('event_type').notNull(),
  actorId: integer('actor_id').references(() => users.id),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── Streaks ────────────────────────────────────────────────────────────────
export const streaks = sqliteTable('streaks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  choreId: integer('chore_id').notNull().references(() => chores.id),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastCompletedDate: text('last_completed_date'),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ([
  uniqueIndex('streak_user_chore_unique').on(table.userId, table.choreId),
]));

// ─── Agenda Items ───────────────────────────────────────────────────────────
export const agendaItems = sqliteTable('agenda_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  date: text('date').notNull(),
  time: text('time'),
  personId: integer('person_id').references(() => users.id),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── Sessions ───────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  deviceType: text('device_type').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
