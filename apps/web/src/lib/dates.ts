// Calendar helpers for the client. The engine never reads the clock; the web app passes dates in.

const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in US Eastern time as 'YYYY-MM-DD': the daily set rolls over at US midnight. */
export function usEasternDate(now: Date = new Date()): string {
  return easternDate.format(now); // en-CA formats as YYYY-MM-DD
}

/** Whole days between 1970-01-01 and a 'YYYY-MM-DD' date (deterministic seed for a daily set). */
export function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/** The local calendar month ('YYYY-MM') and day of month for `now`. */
export function localMonthDay(now: Date = new Date()): { month: string; day: number } {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { month, day: now.getDate() };
}
