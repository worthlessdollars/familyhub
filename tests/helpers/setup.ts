/**
 * Global test setup.
 *
 * Sets DATABASE_URL to :memory: BEFORE any test modules load the db singleton.
 * Creates schema and seeds with baseline data before all tests.
 * Resets (truncate + re-seed) after each test for isolation.
 */

// This MUST be set before @/db is imported by any test or lib module.
process.env.DATABASE_URL = ':memory:';

import { beforeAll, afterAll, afterEach } from 'vitest';
import { createTestSchema, seedTestData, resetTestData } from './db';

beforeAll(async () => {
  const { sqlite } = await import('@/db');
  createTestSchema(sqlite);
  seedTestData(sqlite);
});

afterEach(async () => {
  const { sqlite } = await import('@/db');
  resetTestData(sqlite);
  seedTestData(sqlite);
});

afterAll(async () => {
  // In-memory DB is cleaned up automatically when the process exits.
});
