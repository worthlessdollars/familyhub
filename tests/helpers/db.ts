/**
 * Test database helpers.
 *
 * Provides an isolated in-memory SQLite instance for each test suite,
 * with seed data matching the spec (5 users, 3 chores).
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

/** Create all tables in an in-memory SQLite instance using raw SQL (mirrors Drizzle schema). */
export function createTestSchema(sqlite: InstanceType<typeof Database>): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('parent', 'kid')),
      avatar_color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      assigned_to INTEGER REFERENCES users(id),
      due_time TEXT NOT NULL,
      recurrence TEXT NOT NULL DEFAULT 'daily',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chore_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chore_id INTEGER NOT NULL REFERENCES chores(id),
      family_date TEXT NOT NULL,
      assigned_to INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      completed_by INTEGER REFERENCES users(id),
      skipped_by INTEGER REFERENCES users(id),
      skip_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(chore_id, family_date)
    );

    CREATE TABLE IF NOT EXISTS chore_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chore_instance_id INTEGER NOT NULL REFERENCES chore_instances(id),
      event_type TEXT NOT NULL,
      actor_id INTEGER REFERENCES users(id),
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      chore_id INTEGER NOT NULL REFERENCES chores(id),
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_completed_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, chore_id)
    );

    CREATE TABLE IF NOT EXISTS agenda_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      person_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      device_type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chore_instances_date ON chore_instances(family_date);
    CREATE INDEX IF NOT EXISTS idx_chore_instances_assigned ON chore_instances(assigned_to, family_date);
    CREATE INDEX IF NOT EXISTS idx_chore_events_instance ON chore_events(chore_instance_id);
    CREATE INDEX IF NOT EXISTS idx_chore_events_created ON chore_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_agenda_items_date ON agenda_items(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id);
  `);
}

/** Seed the test DB with the standard 5 users and 3 chores. */
export function seedTestData(sqlite: InstanceType<typeof Database>): void {
  // Use low-cost bcrypt rounds (1) for test speed; compare() still works
  const salt = bcrypt.genSaltSync(1);
  const insertUser = sqlite.prepare(`
    INSERT INTO users (name, pin_hash, role, avatar_color) VALUES (?, ?, ?, ?)
  `);
  insertUser.run('Parent1', bcrypt.hashSync('1111', salt), 'parent', '#4A90D9');
  insertUser.run('Parent2', bcrypt.hashSync('2222', salt), 'parent', '#E67E22');
  insertUser.run('Kid1',   bcrypt.hashSync('3333', salt), 'kid',    '#3498DB');
  insertUser.run('Kid2',   bcrypt.hashSync('4444', salt), 'kid',    '#E74C3C');
  insertUser.run('Kid3',   bcrypt.hashSync('5555', salt), 'kid',    '#2ECC71');

  const insertChore = sqlite.prepare(`
    INSERT INTO chores (name, assigned_to, due_time, created_by) VALUES (?, ?, ?, ?)
  `);
  insertChore.run('Cat Litter Box', 3, '20:00', 1);
  insertChore.run('Dishes',         4, '21:00', 1);
  insertChore.run('Trash',          5, '20:00', 1);
}

/** Delete all rows from all tables (in FK-safe order) to reset between tests. */
export function resetTestData(sqlite: InstanceType<typeof Database>): void {
  sqlite.exec(`
    DELETE FROM sessions;
    DELETE FROM chore_events;
    DELETE FROM streaks;
    DELETE FROM chore_instances;
    DELETE FROM agenda_items;
    DELETE FROM chores;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

/**
 * Reset the server's persistent DB to clean seed state.
 * Opens the DB file directly — works even while the server is running (WAL mode).
 */
export function resetServerDb(): void {
  const dbPath = 'data/familyhub.db';
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = OFF');
  sqlite.exec(`
    DELETE FROM sessions;
    DELETE FROM chore_events;
    DELETE FROM streaks;
    DELETE FROM chore_instances;
    DELETE FROM agenda_items;
    DELETE FROM chores;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
  sqlite.pragma('foreign_keys = ON');

  // Use cost 10 (same as server) so bcrypt.compare works
  const salt = bcrypt.genSaltSync(10);
  const insertUser = sqlite.prepare(
    'INSERT INTO users (name, pin_hash, role, avatar_color) VALUES (?, ?, ?, ?)'
  );
  insertUser.run('Parent1', bcrypt.hashSync('1111', salt), 'parent', '#4A90D9');
  insertUser.run('Parent2', bcrypt.hashSync('2222', salt), 'parent', '#E67E22');
  insertUser.run('Kid1',   bcrypt.hashSync('3333', salt), 'kid',    '#3498DB');
  insertUser.run('Kid2',   bcrypt.hashSync('4444', salt), 'kid',    '#E74C3C');
  insertUser.run('Kid3',   bcrypt.hashSync('5555', salt), 'kid',    '#2ECC71');

  const insertChore = sqlite.prepare(
    'INSERT INTO chores (name, assigned_to, due_time, created_by) VALUES (?, ?, ?, ?)'
  );
  insertChore.run('Cat Litter Box', 3, '20:00', 1);
  insertChore.run('Dishes',         4, '21:00', 1);
  insertChore.run('Trash',          5, '20:00', 1);

  sqlite.close();
}

/** Standard test users matching the seed script */
export const TEST_USERS = {
  parent1: { id: 1, name: 'Parent1', role: 'parent' as const, pin: '1111', avatar_color: '#4A90D9' },
  parent2: { id: 2, name: 'Parent2', role: 'parent' as const, pin: '2222', avatar_color: '#E67E22' },
  kid1:   { id: 3, name: 'Kid1',   role: 'kid' as const,    pin: '3333', avatar_color: '#3498DB' },
  kid2:   { id: 4, name: 'Kid2',   role: 'kid' as const,    pin: '4444', avatar_color: '#E74C3C' },
  kid3:   { id: 5, name: 'Kid3',   role: 'kid' as const,    pin: '5555', avatar_color: '#2ECC71' },
} as const;

export const TEST_CHORES = {
  catLitter: { id: 1, name: 'Cat Litter Box', assigned_to: 3, due_time: '20:00' },
  dishes:    { id: 2, name: 'Dishes',         assigned_to: 4, due_time: '21:00' },
  trash:     { id: 3, name: 'Trash',          assigned_to: 5, due_time: '20:00' },
} as const;
