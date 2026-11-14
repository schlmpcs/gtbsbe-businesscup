// A calendar file (RFC 5545) for the monthly check-in reminder: one all-day event on the 1st of every
// month. Pure: the caller passes the start month, the time stamp and the text. No personal data goes
// in (no name, no amounts, no id): only the title, a description and a link to the check-in.

export type MonthlyReminder = {
  /** First month of the reminder, 'YYYY-MM'; the event falls on its 1st. */
  startMonth: string;
  /** When the file was made (DTSTAMP). */
  now: Date;
  title: string;
  description: string;
  /** Link opened from the event (the check-in screen). */
  url: string;
};

const CRLF = '\r\n';

/** Escape a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold a content line at 75 octets (continuation lines start with a space). */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines carry a leading space
    if (size + n > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const pad = (n: number) => String(n).padStart(2, '0');

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** The .ics text: a VCALENDAR with one VEVENT repeating monthly on the 1st, with a reminder that morning. */
export function monthlyReminderIcs(r: MonthlyReminder): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(r.startMonth);
  if (!m) throw new RangeError(`Invalid month: ${r.startMonth} (expected YYYY-MM)`);
  if (Number.isNaN(r.now.getTime())) throw new RangeError('Invalid time stamp');
  const year = Number(m[1]);
  const month = Number(m[2]);
  const start = `${year}${pad(month)}01`;
  const end = `${year}${pad(month)}02`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeGuessr//Monthly check-in//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // The same UID for every download, so importing it twice updates the event instead of doubling it.
    'UID:monthly-checkin@lifeguessr.app',
    `DTSTAMP:${utcStamp(r.now)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=1',
    `SUMMARY:${escapeIcsText(r.title)}`,
    `DESCRIPTION:${escapeIcsText(`${r.description}\n${r.url}`)}`,
    `URL:${r.url}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(r.title)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
