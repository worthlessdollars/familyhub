/**
 * Streak calculation engine (pure function — no DB access).
 *
 * Rules (from spec 03-chore-system.md):
 * - On-time (completed at or before due_time): current_streak += 1
 * - Late (completed after due_time but before 4 AM boundary): current_streak = 0
 * - Missed (completedAt === null): current_streak = 0
 * - Skipped (status === 'skipped'): streak unchanged, last_completed_date unchanged
 */

export interface RecalculateStreakInput {
  userId: number;
  choreId: number;
  familyDate: string; // YYYY-MM-DD
  completedAt: string | null; // ISO 8601 UTC or null
  dueTime: string; // HH:MM 24h local time
  previousStreak: number;
  longestStreak: number;
  status?: string;
  lastCompletedDate?: string | null;
}

export interface StreakResult {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
}

export async function recalculateStreak(
  input: RecalculateStreakInput
): Promise<StreakResult> {
  const {
    familyDate,
    completedAt,
    dueTime,
    previousStreak,
    longestStreak,
    status,
    lastCompletedDate = null,
  } = input;

  // Skipped: streak unchanged
  if (status === 'skipped') {
    return {
      current_streak: previousStreak,
      longest_streak: longestStreak,
      last_completed_date: lastCompletedDate ?? null,
    };
  }

  // Missed: never completed
  if (!completedAt) {
    return {
      current_streak: 0,
      longest_streak: longestStreak,
      last_completed_date: lastCompletedDate ?? null,
    };
  }

  const onTime = isCompletionOnTime(completedAt, familyDate, dueTime);

  if (onTime) {
    const newStreak = previousStreak + 1;
    return {
      current_streak: newStreak,
      longest_streak: Math.max(longestStreak, newStreak),
      last_completed_date: familyDate,
    };
  } else {
    // Late completion: done but streak resets
    return {
      current_streak: 0,
      longest_streak: longestStreak,
      last_completed_date: lastCompletedDate ?? null,
    };
  }
}

/**
 * Determine if a completion was on-time.
 *
 * Constructs the deadline (familyDate + dueTime in the configured timezone's
 * standard offset) as a UTC timestamp, then checks if completedAt <= deadline.
 *
 * Uses the timezone's standard (non-DST) offset so that due times remain
 * consistent year-round — families set chores by wall-clock habit, not UTC.
 */
function isCompletionOnTime(
  completedAt: string,
  familyDate: string,
  dueTime: string
): boolean {
  const tz = process.env.TZ || 'America/New_York';
  const [dueHour, dueMinute] = dueTime.split(':').map(Number);

  // Get the standard (non-DST) UTC offset for the timezone.
  // We probe a date known to be in standard time (January 1) to find it.
  const standardOffsetMinutes = getStandardOffsetMinutes(tz);

  // Build the deadline: familyDate at dueTime local, converted to UTC
  // using the standard offset. Offset is negative for west-of-UTC zones.
  const deadlineLocalMs = Date.UTC(
    parseInt(familyDate.substring(0, 4)),
    parseInt(familyDate.substring(5, 7)) - 1,
    parseInt(familyDate.substring(8, 10)),
    dueHour,
    dueMinute,
    0
  );
  // standardOffsetMinutes is negative for America/New_York (-300 = -5h).
  // Local = UTC + offset, so UTC = Local - offset.
  const deadlineUtcMs = deadlineLocalMs - standardOffsetMinutes * 60 * 1000;

  const completedUtcMs = new Date(completedAt).getTime();
  return completedUtcMs <= deadlineUtcMs;
}

/**
 * Get the standard (non-DST) UTC offset for a timezone in minutes.
 * For America/New_York this returns -300 (i.e., UTC-5 = EST).
 */
function getStandardOffsetMinutes(tz: string): number {
  // Use January 1 (always standard time in the Northern Hemisphere)
  const jan1 = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(jan1);
  let localHour = 0, localMinute = 0, localDay = 0;
  for (const p of parts) {
    switch (p.type) {
      case 'day': localDay = parseInt(p.value); break;
      case 'hour':
        localHour = parseInt(p.value);
        if (localHour === 24) localHour = 0;
        break;
      case 'minute': localMinute = parseInt(p.value); break;
    }
  }

  // jan1 is 12:00 UTC on Jan 1. If local is 7:00 on Jan 1, offset is -300 min.
  const utcMinutes = 12 * 60;
  let localMinutes = localHour * 60 + localMinute;
  // If the local day is different from UTC day 1, adjust
  if (localDay === 2) localMinutes += 24 * 60;
  if (localDay === 31) localMinutes -= 24 * 60; // crossed back to Dec 31

  return localMinutes - utcMinutes;
}
