/**
 * Seed script — populates the database with initial data.
 *
 * 5 users (2 parents, 3 kids) with bcrypt-hashed PINs.
 * 3 chores assigned to kids.
 */
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import * as schema from '../src/db/schema';

const DB_PATH = process.env.DATABASE_URL || 'data/familyhub.db';

async function seed() {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  console.log('Seeding database...');

  // Hash PINs
  const salt = bcrypt.genSaltSync(10);
  const pins = {
    parent1: bcrypt.hashSync('1111', salt),
    parent2: bcrypt.hashSync('2222', salt),
    kid1: bcrypt.hashSync('3333', salt),
    kid2: bcrypt.hashSync('4444', salt),
    kid3: bcrypt.hashSync('5555', salt),
  };

  // Insert users
  const users = [
    { name: 'Parent1', pinHash: pins.parent1, role: 'parent' as const, avatarColor: '#4A90D9' },
    { name: 'Parent2', pinHash: pins.parent2, role: 'parent' as const, avatarColor: '#E67E22' },
    { name: 'Kid1', pinHash: pins.kid1, role: 'kid' as const, avatarColor: '#3498DB' },
    { name: 'Kid2', pinHash: pins.kid2, role: 'kid' as const, avatarColor: '#E74C3C' },
    { name: 'Kid3', pinHash: pins.kid3, role: 'kid' as const, avatarColor: '#2ECC71' },
  ];

  for (const user of users) {
    db.insert(schema.users).values(user).run();
  }
  console.log('  Inserted 5 users');

  // Insert chores
  const chores = [
    { name: 'Cat Litter Box', assignedTo: 3, dueTime: '20:00', createdBy: 1 },
    { name: 'Dishes', assignedTo: 4, dueTime: '21:00', createdBy: 1 },
    { name: 'Trash', assignedTo: 5, dueTime: '20:00', createdBy: 1 },
  ];

  for (const chore of chores) {
    db.insert(schema.chores).values(chore).run();
  }
  console.log('  Inserted 3 chores');

  sqlite.close();
  console.log('Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
