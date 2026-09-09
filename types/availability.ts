export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Monday first, matching the Postgres enum's own declaration order. */
export const DAYS_OF_WEEK: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/**
 * The hours a detailer works on one day, as they set them in the detailer
 * portal. Read-only here: the dashboard displays this schedule and never edits
 * it, and nothing reads it to filter or warn in the Assign Detailer dropdown.
 *
 * A day the detailer does not work has no row at all.
 */
export interface Availability {
  id: string;
  detailer_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
}

/** "14:30:00" -> "2:30 PM", matching how booking times already render. */
export function formatScheduleTime(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;

  const hours = parseInt(parts[0], 10);
  if (Number.isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${parts[1]} ${ampm}`;
}
