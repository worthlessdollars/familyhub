/**
 * DB reset helper - resets the server's database to clean seed state.
 * Truncates data without dropping tables (keeps the server's connection valid).
 * Must run before integration/e2e tests to ensure clean state.
 */
import { describe, it } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

describe('reset server db', () => {
  it('clears data and reseeds', () => {
    const dbPath = 'data/familyhub.db';
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');

    // Clear all data in FK-safe order (foreign_keys OFF to avoid constraint issues)
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

    // Seed users
    const salt = bcrypt.genSaltSync(10);
    const insertUser = sqlite.prepare(
      'INSERT INTO users (name, pin_hash, role, avatar_color) VALUES (?, ?, ?, ?)'
    );
    insertUser.run('Parent1', bcrypt.hashSync('1111', salt), 'parent', '#4A90D9');
    insertUser.run('Parent2', bcrypt.hashSync('2222', salt), 'parent', '#E67E22');
    insertUser.run('Kid1',   bcrypt.hashSync('3333', salt), 'kid',    '#3498DB');
    insertUser.run('Kid2',   bcrypt.hashSync('4444', salt), 'kid',    '#E74C3C');
    insertUser.run('Kid3',   bcrypt.hashSync('5555', salt), 'kid',    '#2ECC71');

    // Seed chores
    const insertChore = sqlite.prepare(
      'INSERT INTO chores (name, assigned_to, due_time, created_by) VALUES (?, ?, ?, ?)'
    );
    insertChore.run('Cat Litter Box', 3, '20:00', 1);
    insertChore.run('Dishes',         4, '21:00', 1);
    insertChore.run('Trash',          5, '20:00', 1);

    sqlite.close();
  });
});
