/**
 * Unit tests: Streak Calculation Engine (REQ-009, REQ-010)
 *
 * Streak rules:
 * - On-time (before due_time): current_streak += 1, update longest if new max
 * - Late (after due_time, before 4 AM): done but current_streak = 0
 * - Missed (never done before 4 AM): current_streak = 0
 * - Skipped (parent marks): day excluded, streak unchanged
 *
 * Spec: 03-chore-system.md (Streak Rules section)
 */
import { describe, it, expect, beforeEach } from 'vitest';

// This import will fail until src/lib/streaks.ts is implemented
import { recalculateStreak } from '@/lib/streaks';

describe('recalculateStreak', () => {
  // --- On-time completion ---

  it('increments streak by 1 for on-time completion', async () => {
    // User completes chore at 7:30 PM, due_time is 8:00 PM
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-13T19:30:00Z', // 7:30 PM UTC
      dueTime: '20:00', // 8:00 PM
      previousStreak: 5,
      longestStreak: 10,
    });

    expect(result.current_streak).toBe(6);
  });

  it('updates longest_streak when current exceeds it', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-13T19:30:00Z',
      dueTime: '20:00',
      previousStreak: 10,
      longestStreak: 10,
    });

    expect(result.current_streak).toBe(11);
    expect(result.longest_streak).toBe(11);
  });

  it('does not update longest_streak when current is below it', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-13T19:30:00Z',
      dueTime: '20:00',
      previousStreak: 3,
      longestStreak: 12,
    });

    expect(result.current_streak).toBe(4);
    expect(result.longest_streak).toBe(12);
  });

  it('starts streak at 1 from zero', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-13T19:30:00Z',
      dueTime: '20:00',
      previousStreak: 0,
      longestStreak: 5,
    });

    expect(result.current_streak).toBe(1);
  });

  it('considers exactly at due_time as on-time', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-14T01:00:00Z', // 8:00 PM ET = due_time exactly
      dueTime: '20:00',
      previousStreak: 5,
      longestStreak: 5,
    });

    expect(result.current_streak).toBe(6);
  });

  // --- Late completion ---

  it('resets streak to 0 for late completion', async () => {
    // Completed at 9:30 PM, due at 8:00 PM
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-14T02:30:00Z', // 9:30 PM ET
      dueTime: '20:00',
      previousStreak: 7,
      longestStreak: 12,
    });

    expect(result.current_streak).toBe(0);
  });

  it('does not reduce longest_streak on late completion', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-14T02:30:00Z',
      dueTime: '20:00',
      previousStreak: 7,
      longestStreak: 12,
    });

    expect(result.longest_streak).toBe(12);
  });

  it('treats 1 minute after due_time as late', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-14T01:01:00Z', // 8:01 PM ET
      dueTime: '20:00',
      previousStreak: 5,
      longestStreak: 5,
    });

    expect(result.current_streak).toBe(0);
  });

  // --- Missed (day rollover) ---

  it('resets streak to 0 for missed chore during day rollover', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: null, // never completed
      dueTime: '20:00',
      previousStreak: 8,
      longestStreak: 8,
    });

    expect(result.current_streak).toBe(0);
  });

  it('preserves longest_streak when resetting for missed chore', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: null,
      dueTime: '20:00',
      previousStreak: 5,
      longestStreak: 12,
    });

    expect(result.longest_streak).toBe(12);
  });

  // --- Skipped ---

  it('leaves streak unchanged when chore is skipped', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: null,
      dueTime: '20:00',
      previousStreak: 5,
      longestStreak: 10,
      status: 'skipped',
    });

    expect(result.current_streak).toBe(5);
    expect(result.longest_streak).toBe(10);
  });

  it('does not increment streak for skipped day', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: null,
      dueTime: '20:00',
      previousStreak: 5,
      longestStreak: 10,
      status: 'skipped',
    });

    expect(result.current_streak).toBe(5);
    // Not 6 — skipped days don't count
  });

  // --- Edge cases ---

  it('handles streak from 0 longest to first completion', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-13T19:30:00Z',
      dueTime: '20:00',
      previousStreak: 0,
      longestStreak: 0,
    });

    expect(result.current_streak).toBe(1);
    expect(result.longest_streak).toBe(1);
  });

  it('updates last_completed_date on successful on-time completion', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: '2026-03-13T19:30:00Z',
      dueTime: '20:00',
      previousStreak: 0,
      longestStreak: 0,
    });

    expect(result.last_completed_date).toBe('2026-03-13');
  });

  it('does not update last_completed_date on skip', async () => {
    const result = await recalculateStreak({
      userId: 3,
      choreId: 1,
      familyDate: '2026-03-13',
      completedAt: null,
      dueTime: '20:00',
      previousStreak: 5,
      longestStreak: 10,
      status: 'skipped',
      lastCompletedDate: '2026-03-12',
    });

    expect(result.last_completed_date).toBe('2026-03-12');
  });
});
