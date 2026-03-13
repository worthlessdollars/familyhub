/**
 * Unit tests: Family-Date Utility (REQ-003)
 *
 * The family-date boundary is 4:00 AM local time, not midnight.
 * A timestamp before 4:00 AM belongs to the PREVIOUS calendar date.
 * Uses Intl.DateTimeFormat with TZ env var for timezone handling.
 *
 * Spec: 03-chore-system.md, 07-api-realtime.md
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// This import will fail until src/lib/family-date.ts is implemented
import { getFamilyDate } from '@/lib/family-date';

describe('getFamilyDate', () => {
  const originalTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  // --- Happy path ---

  it('returns today\'s date for a mid-day timestamp', () => {
    // March 13, 2026 at 2:00 PM ET
    const now = new Date('2026-03-13T19:00:00Z'); // 2 PM ET (UTC-5)
    expect(getFamilyDate(now)).toBe('2026-03-13');
  });

  it('returns today\'s date at exactly 4:00 AM', () => {
    // March 13, 2026 at 4:00 AM ET = 9:00 AM UTC
    const now = new Date('2026-03-13T09:00:00Z');
    expect(getFamilyDate(now)).toBe('2026-03-13');
  });

  it('returns today\'s date at 11:59 PM', () => {
    // March 13, 2026 at 11:59 PM ET = next day 4:59 AM UTC
    const now = new Date('2026-03-14T04:59:00Z');
    expect(getFamilyDate(now)).toBe('2026-03-13');
  });

  // --- 4 AM boundary (critical edge case) ---

  it('returns PREVIOUS date at 3:59 AM (before boundary)', () => {
    // March 13, 2026 at 3:59 AM EDT (UTC-4) = 7:59 AM UTC
    const now = new Date('2026-03-13T07:59:00Z');
    expect(getFamilyDate(now)).toBe('2026-03-12');
  });

  it('returns PREVIOUS date at 12:01 AM (well before boundary)', () => {
    // March 13, 2026 at 12:01 AM ET = 5:01 AM UTC
    const now = new Date('2026-03-13T05:01:00Z');
    expect(getFamilyDate(now)).toBe('2026-03-12');
  });

  it('returns PREVIOUS date at 3:00 AM (kiosk refresh time)', () => {
    // March 13 at 3:00 AM EDT (UTC-4) = 7:00 AM UTC — kiosk refreshes here but still previous family-date
    const now = new Date('2026-03-13T07:00:00Z');
    expect(getFamilyDate(now)).toBe('2026-03-12');
  });

  // --- DST transitions ---

  it('handles spring-forward DST correctly (March)', () => {
    // In 2026, DST starts March 8 at 2:00 AM ET → clocks jump to 3:00 AM
    // At 3:30 AM EDT on March 8 (DST just started), UTC-4 = 7:30 AM UTC
    const now = new Date('2026-03-08T07:30:00Z'); // 3:30 AM EDT
    expect(getFamilyDate(now)).toBe('2026-03-07');
  });

  it('handles fall-back DST correctly (November)', () => {
    // DST ends November 1, 2026 at 2:00 AM ET → clocks fall back to 1:00 AM
    // 3:30 AM ET on Nov 1 = 8:30 AM UTC (now EST, UTC-5)
    const now = new Date('2026-11-01T08:30:00Z');
    expect(getFamilyDate(now)).toBe('2026-10-31');
  });

  // --- Month/year boundaries ---

  it('handles month boundary (April 1 at 3 AM → March 31)', () => {
    const now = new Date('2026-04-01T07:00:00Z'); // 3 AM ET
    expect(getFamilyDate(now)).toBe('2026-03-31');
  });

  it('handles year boundary (Jan 1 at 3 AM → Dec 31)', () => {
    const now = new Date('2027-01-01T08:00:00Z'); // 3 AM ET
    expect(getFamilyDate(now)).toBe('2026-12-31');
  });

  it('handles leap year (March 1 at 3 AM in 2028 → Feb 29)', () => {
    const now = new Date('2028-03-01T08:00:00Z'); // 3 AM ET
    expect(getFamilyDate(now)).toBe('2028-02-29');
  });

  // --- Defaults ---

  it('uses current time when no argument is provided', () => {
    const result = getFamilyDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a string in YYYY-MM-DD format', () => {
    const result = getFamilyDate(new Date('2026-03-13T15:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // --- Different timezones ---

  it('respects TZ environment variable', () => {
    process.env.TZ = 'America/Los_Angeles';
    // March 13, 2026 at 3:00 AM PDT (UTC-7) = 10:00 AM UTC
    const now = new Date('2026-03-13T10:00:00Z');
    expect(getFamilyDate(now)).toBe('2026-03-12');
  });

  it('works with UTC timezone', () => {
    process.env.TZ = 'UTC';
    // March 13, 2026 at 3:00 AM UTC
    const now = new Date('2026-03-13T03:00:00Z');
    expect(getFamilyDate(now)).toBe('2026-03-12');
  });
});
