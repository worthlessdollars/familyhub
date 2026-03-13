/**
 * Family-date utility.
 *
 * The "family date" boundary is 4:00 AM local time, not midnight.
 * Timestamps before 4:00 AM belong to the PREVIOUS calendar date.
 * Uses Intl.DateTimeFormat with the TZ env var for timezone handling.
 */

const BOUNDARY_HOUR = 4;

export function getFamilyDate(now?: Date): string {
  const date = now ?? new Date();
  const tz = process.env.TZ || 'America/New_York';

  // Get the local date/time parts in the configured timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;

  for (const part of parts) {
    switch (part.type) {
      case 'year':
        year = parseInt(part.value, 10);
        break;
      case 'month':
        month = parseInt(part.value, 10);
        break;
      case 'day':
        day = parseInt(part.value, 10);
        break;
      case 'hour':
        // Intl hour12:false returns 24 for midnight in some locales
        hour = parseInt(part.value, 10);
        if (hour === 24) hour = 0;
        break;
    }
  }

  // If before the boundary hour, subtract one day
  if (hour < BOUNDARY_HOUR) {
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() - 1);
    return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  return formatDate(year, month, day);
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
