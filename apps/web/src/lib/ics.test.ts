import { describe, expect, it } from 'vitest';
import { escapeIcsText, foldIcsLine, monthlyReminderIcs } from './ics';

const base = {
  startMonth: '2026-12',
  now: new Date(Date.UTC(2026, 10, 14, 9, 5, 7)),
  title: 'Monthly check-in',
  description: 'How did the month go? Check your number.',
  url: 'https://example.app/checkin',
};

describe('monthlyReminderIcs', () => {
  it('is one recurring all-day VEVENT on the 1st, CRLF line endings', () => {
    const ics = monthlyReminderIcs(base);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(ics).toContain('\r\nDTSTART;VALUE=DATE:20261201\r\n');
    expect(ics).toContain('\r\nDTEND;VALUE=DATE:20261202\r\n');
    expect(ics).toContain('\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=1\r\n');
    expect(ics).toContain('\r\nDTSTAMP:20261114T090507Z\r\n');
    expect(ics).toContain('\r\nSUMMARY:Monthly check-in\r\n');
    expect(ics).toContain('\r\nURL:https://example.app/checkin\r\n');
    expect(ics.replace(/\r\n /g, '')).toContain('DESCRIPTION:How did the month go? Check your number.\\nhttps://example.app/checkin');
    // No bare LF anywhere.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('is the same file for the same input (pure)', () => {
    expect(monthlyReminderIcs(base)).toBe(monthlyReminderIcs({ ...base }));
  });

  it('rejects a malformed month', () => {
    expect(() => monthlyReminderIcs({ ...base, startMonth: '2026-13' })).toThrow(RangeError);
  });
});

describe('escapeIcsText and foldIcsLine', () => {
  it('escapes the RFC 5545 specials', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds lines over 75 octets and keeps short ones', () => {
    expect(foldIcsLine('short')).toBe('short');
    const long = `DESCRIPTION:${'x'.repeat(200)}`;
    const folded = foldIcsLine(long);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]!.length).toBe(75);
    for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(long);
  });
});
