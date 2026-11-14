// M6: renewalsToIcs and renewalsFromFindings.
//
// Every expected string below is written by hand from RFC 5545, never copied from the output of the
// code under test:
//   - §3.1  content lines end in CRLF; a line is folded at 75 octets (UTF-8 bytes, the line break not
//           counted) by inserting CRLF and one space; a multi-octet UTF-8 sequence is never split.
//   - §3.3.11 TEXT: `\` `;` `,` and a newline are written `\\` `\;` `\,` `\n`.
//   - §3.3.4  DATE values are YYYYMMDD; §3.3.5 DATE-TIME in UTC is YYYYMMDDTHHMMSSZ.
//   - §3.3.10 a recurrence on a day that does not exist (31 April, 29 February in a common year) is
//           skipped, so month-end days use BYMONTHDAY with BYSETPOS=-1: the last day that exists out of
//           28..N. That is N in a long month and the month's last day in a short one, and February
//           is never skipped.
//   - §3.6.6 a DISPLAY alarm needs DESCRIPTION and TRIGGER.
import { describe, expect, it } from 'vitest';
import type { SubscriptionFinding } from '@lifeguessr/types';
import { subscriptionsExpected } from '@/fixtures/tools';
import { renewalsFromFindings, renewalsToIcs, type RenewalItem } from './ics';

const NOW = new Date('2026-11-14T09:30:05Z'); // DTSTAMP:20261114T093005Z
const CRLF = '\r\n';

const HEADER = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//LifeGuessr//Renewals//EN',
  'CALSCALE:GREGORIAN',
  'X-WR-CALNAME:Subscription renewals',
];
const FOOTER = ['END:VCALENDAR'];

/** Joins lines the way a calendar file is written: CRLF after every line, the last one included. */
const lines = (...all: string[]): string => all.map((l) => l + CRLF).join('');

/** One VEVENT as the code must write it, from hand-written property lines (no folding applied). */
const event = (props: { uid: string; start: string; rrule: string; summary: string; alarm?: string }): string[] => [
  'BEGIN:VEVENT',
  `UID:${props.uid}`,
  'DTSTAMP:20261114T093005Z',
  `DTSTART;VALUE=DATE:${props.start}`,
  `RRULE:${props.rrule}`,
  `SUMMARY:${props.summary}`,
  'TRANSP:TRANSPARENT',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  `DESCRIPTION:${props.summary}`,
  `TRIGGER:${props.alarm ?? '-P1D'}`,
  'END:VALARM',
  'END:VEVENT',
];

const calendar = (...events: string[][]): string => lines(...HEADER, ...events.flat(), ...FOOTER);

const item = (over: Partial<RenewalItem> = {}): RenewalItem => ({
  id: 'spotify-usa-ny', label: 'SPOTIFY USA # NY', amount: 11.99, cadence: 'monthly',
  next: { month: '2026-12', day: 12 }, ...over,
});

const bytes = (s: string): number => new TextEncoder().encode(s).length;

describe('renewalsToIcs: the file', () => {
  it('writes one monthly renewal on the 12th, line by line', () => {
    expect(renewalsToIcs([item()], { now: NOW })).toBe(
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'PRODID:-//LifeGuessr//Renewals//EN\r\n' +
      'CALSCALE:GREGORIAN\r\n' +
      'X-WR-CALNAME:Subscription renewals\r\n' +
      'BEGIN:VEVENT\r\n' +
      'UID:sub-spotify-usa-ny-20261212@lifeguessr\r\n' +
      'DTSTAMP:20261114T093005Z\r\n' +
      'DTSTART;VALUE=DATE:20261212\r\n' +
      'RRULE:FREQ=MONTHLY\r\n' +
      'SUMMARY:Renews: SPOTIFY USA # NY · $11.99\r\n' +
      'TRANSP:TRANSPARENT\r\n' +
      'BEGIN:VALARM\r\n' +
      'ACTION:DISPLAY\r\n' +
      'DESCRIPTION:Renews: SPOTIFY USA # NY · $11.99\r\n' +
      'TRIGGER:-P1D\r\n' +
      'END:VALARM\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n',
    );
  });

  it('a yearly renewal on 9 August repeats yearly and shows cents on a whole-dollar price', () => {
    const text = renewalsToIcs(
      [item({ id: 'amazon-prime-amzn-com-bill-wa', label: 'AMAZON PRIME*[ref] Amzn.com/bill WA', amount: 139,
        cadence: 'yearly', next: { month: '2027-08', day: 9 } })],
      { now: NOW },
    );
    expect(text).toBe(calendar(event({
      uid: 'sub-amazon-prime-amzn-com-bill-wa-20270809@lifeguessr', start: '20270809', rrule: 'FREQ=YEARLY',
      summary: 'Renews: AMAZON PRIME*[ref] Amzn.com/bill WA · $139.00',
    })));
  });

  it('a quarterly renewal repeats every third month', () => {
    const text = renewalsToIcs([item({ id: 'city-gym', label: 'City Gym', amount: 90, cadence: 'quarterly', next: { month: '2026-12', day: 1 } })], { now: NOW });
    expect(text).toBe(calendar(event({
      uid: 'sub-city-gym-20261201@lifeguessr', start: '20261201', rrule: 'FREQ=MONTHLY;INTERVAL=3',
      summary: 'Renews: City Gym · $90.00',
    })));
  });

  it('a yearly renewal dated in a leap year, not on 29 February, is a plain yearly rule', () => {
    const text = renewalsToIcs([item({ id: 'x', label: 'X', amount: 5, cadence: 'yearly', next: { month: '2028-08', day: 9 } })], { now: NOW });
    expect(text).toBe(calendar(event({ uid: 'sub-x-20280809@lifeguessr', start: '20280809', rrule: 'FREQ=YEARLY', summary: 'Renews: X · $5.00' })));
  });

  it('puts every event in the calendar in the order given, and takes the calendar name and the alarm from the options', () => {
    const text = renewalsToIcs(
      [item({ id: 'a', label: 'A', amount: 1, next: { month: '2026-12', day: 3 } }), item({ id: 'b', label: 'B', amount: 2, next: { month: '2026-12', day: 4 } })],
      { now: NOW, calendarName: 'My renewals', alarmDaysBefore: 3 },
    );
    expect(text).toBe(lines(
      ...HEADER.slice(0, 4), 'X-WR-CALNAME:My renewals',
      ...event({ uid: 'sub-a-20261203@lifeguessr', start: '20261203', rrule: 'FREQ=MONTHLY', summary: 'Renews: A · $1.00', alarm: '-P3D' }),
      ...event({ uid: 'sub-b-20261204@lifeguessr', start: '20261204', rrule: 'FREQ=MONTHLY', summary: 'Renews: B · $2.00', alarm: '-P3D' }),
      ...FOOTER,
    ));
  });

  it('an alarm of 0 days fires at the start of the day itself', () => {
    expect(renewalsToIcs([item()], { now: NOW, alarmDaysBefore: 0 })).toContain('\r\nTRIGGER:PT0S\r\n');
  });

  it('zero items is a valid, empty calendar and does not throw', () => {
    expect(renewalsToIcs([], { now: NOW })).toBe(calendar());
  });

  it('refuses a `now` that is not a date and an alarm that is not a whole number of days', () => {
    expect(() => renewalsToIcs([item()], { now: new Date('nope') })).toThrow(RangeError);
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 366]) {
      expect(() => renewalsToIcs([item()], { now: NOW, alarmDaysBefore: bad })).toThrow(RangeError);
    }
    expect(() => renewalsToIcs([item()], { now: NOW, alarmDaysBefore: 365 })).not.toThrow();
  });
});

describe('renewalsToIcs: month-end days', () => {
  // The last of the days 28..N that exist in the month: N in a long month, the last day in a short one.
  const rule = (cadence: RenewalItem['cadence'], next: RenewalItem['next'], billingDay?: number) =>
    renewalsToIcs([item({ id: 'm', label: 'M', amount: 1, cadence, next, ...(billingDay === undefined ? {} : { billingDay }) })], { now: NOW })
      .split(CRLF).find((l) => l.startsWith('RRULE:'));

  it('day 31 repeats on the last day of every month, so February and 30-day months are not skipped', () => {
    expect(rule('monthly', { month: '2026-12', day: 31 })).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
  });

  it('day 30 stays on the 30th and falls back to the last day of February', () => {
    expect(rule('monthly', { month: '2026-11', day: 30 })).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1');
  });

  it('day 29 stays on the 29th and falls back to the 28th in a common-year February', () => {
    expect(rule('monthly', { month: '2026-12', day: 29 })).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1');
  });

  it('day 28 and below need no special rule', () => {
    expect(rule('monthly', { month: '2026-12', day: 28 })).toBe('RRULE:FREQ=MONTHLY');
    expect(rule('monthly', { month: '2026-12', day: 1 })).toBe('RRULE:FREQ=MONTHLY');
  });

  it('a quarterly renewal on the 31st keeps the interval and the month-end rule', () => {
    expect(rule('quarterly', { month: '2026-12', day: 31 })).toBe('RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
  });

  it('a yearly renewal on 29 February falls back to 28 February in a common year, in a leap year it is the 29th', () => {
    const text = renewalsToIcs([item({ id: 'leap', label: 'Leap', amount: 20, cadence: 'yearly', next: { month: '2028-02', day: 29 } })], { now: NOW });
    expect(text).toBe(calendar(event({
      uid: 'sub-leap-20280229@lifeguessr', start: '20280229', rrule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1',
      summary: 'Renews: Leap · $20.00',
    })));
  });

  it('a monthly renewal on 29 February (a leap year) is a day-29 rule', () => {
    expect(rule('monthly', { month: '2028-02', day: 29 })).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1');
  });

  it('a billing day that was shortened to fit a short month still repeats on the real billing day', () => {
    // Billed on the 31st; the next one falls in February, so `next` is the 28th.
    expect(rule('monthly', { month: '2027-02', day: 28 }, 31)).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    expect(rule('quarterly', { month: '2027-02', day: 28 }, 30)).toBe('RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=28,29,30;BYSETPOS=-1');
    expect(rule('yearly', { month: '2029-02', day: 28 }, 29)).toBe('RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1');
  });

  it('ignores a billing day that cannot be real: below the date, past the 31st or not a whole number', () => {
    expect(rule('monthly', { month: '2026-12', day: 12 }, 5)).toBe('RRULE:FREQ=MONTHLY');
    expect(rule('monthly', { month: '2026-12', day: 12 }, 32)).toBe('RRULE:FREQ=MONTHLY');
    expect(rule('monthly', { month: '2026-12', day: 12 }, 30.5)).toBe('RRULE:FREQ=MONTHLY');
  });

  it('leaves out an item whose date does not exist, instead of writing a file a calendar would reject', () => {
    const bad: RenewalItem['next'][] = [
      { month: '2027-02', day: 29 }, { month: '2026-04', day: 31 }, { month: '2026-13', day: 1 },
      { month: '2026-12', day: 0 }, { month: '2026-12', day: 1.5 }, { month: '2026-1', day: 1 }, { month: 'soon', day: 1 },
    ];
    for (const next of bad) {
      expect(renewalsToIcs([item({ next })], { now: NOW }), JSON.stringify(next)).toBe(calendar());
    }
  });
});

describe('renewalsToIcs: text', () => {
  const summaryOf = (over: Partial<RenewalItem>, opts: { calendarName?: string } = {}) =>
    renewalsToIcs([item(over)], { now: NOW, ...opts }).split(CRLF).find((l) => l.startsWith('SUMMARY:'));

  it('escapes backslash, semicolon, comma and newline in the label, the amount and the id', () => {
    expect(summaryOf({ label: 'A, B; C\\D\nE' })).toBe('SUMMARY:Renews: A\\, B\\; C\\\\D\\nE · $11.99');
    expect(summaryOf({ amount: 1234.5 })).toBe('SUMMARY:Renews: SPOTIFY USA # NY · $1\\,234.50');
    expect(renewalsToIcs([item({ id: 'a,b;c' })], { now: NOW })).toContain('\r\nUID:sub-a\\,b\\;c-20261212@lifeguessr\r\n');
  });

  it('writes any line break in a label as the two characters \\n, and other control characters as a space', () => {
    expect(summaryOf({ label: 'A\r\nB\rC\nD' })).toBe('SUMMARY:Renews: A\\nB\\nC\\nD · $11.99');
    expect(summaryOf({ label: 'A\u0000B\u0007C\tD' })).toBe('SUMMARY:Renews: A B C D · $11.99'); // a tab is a control character too: TEXT allows it, but a space reads the same
  });

  it('escapes the calendar name', () => {
    const text = renewalsToIcs([], { now: NOW, calendarName: 'Home, work; 2026' });
    expect(text).toContain('\r\nX-WR-CALNAME:Home\\, work\\; 2026\r\n');
  });

  it('keeps non-ASCII text and emoji as they are (UTF-8, no escaping)', () => {
    expect(summaryOf({ label: 'Café 🎬' })).toBe('SUMMARY:Renews: Café 🎬 · $11.99');
  });

  it('replaces a lone surrogate, which has no UTF-8 form, with U+FFFD', () => {
    expect(summaryOf({ label: 'A\ud83cB' })).toBe('SUMMARY:Renews: A�B · $11.99');
  });
});

describe('renewalsToIcs: folding at 75 octets', () => {
  const physical = (text: string): string[] => text.split(CRLF).slice(0, -1);
  const eventLines = (text: string, name: string): string[] => {
    const all = physical(text);
    const start = all.findIndex((l) => l.startsWith(name));
    let end = start + 1;
    while (all[end]?.startsWith(' ')) end++;
    return all.slice(start, end);
  };

  it('folds a 90-character label with CRLF and one space, in SUMMARY and in the alarm DESCRIPTION', () => {
    const label = '0123456789'.repeat(9);
    const text = renewalsToIcs([item({ label })], { now: NOW });
    // "SUMMARY:Renews: " is 16 octets; 59 digits fill the first line to 75. The 31 digits left (the
    // 60th digit onward is 9, 0123456789 x3) and " · $11.99" (10 octets) follow after one space.
    expect(eventLines(text, 'SUMMARY:')).toEqual([
      'SUMMARY:Renews: ' + '0123456789'.repeat(5) + '012345678',
      ' ' + '9' + '0123456789'.repeat(3) + ' · $11.99',
    ]);
    // "DESCRIPTION:Renews: " is 20 octets; 55 digits fill the first line, 35 digits and the price follow.
    expect(eventLines(text, 'DESCRIPTION:')).toEqual([
      'DESCRIPTION:Renews: ' + '0123456789'.repeat(5) + '01234',
      ' ' + '56789' + '0123456789'.repeat(3) + ' · $11.99',
    ]);
  });

  it('keeps folding as long as the line is long: 75 octets, then 74 after each space', () => {
    const text = renewalsToIcs([item({ label: 'x'.repeat(200) })], { now: NOW });
    // 16 + 200 + 10 = 226 octets: 75, then 74 + 74 + 3 after the leading spaces.
    expect(eventLines(text, 'SUMMARY:')).toEqual([
      'SUMMARY:Renews: ' + 'x'.repeat(59),
      ' ' + 'x'.repeat(74),
      ' ' + 'x'.repeat(67) + ' · $11',
      ' .99',
    ]);
  });

  it('never splits a four-octet emoji: it moves whole to the next line', () => {
    // 16 + 58 = 74 octets; the emoji (4) would make 78.
    expect(eventLines(renewalsToIcs([item({ label: 'a'.repeat(58) + '🎬' + 'bbb' })], { now: NOW }), 'SUMMARY:')).toEqual([
      'SUMMARY:Renews: ' + 'a'.repeat(58),
      ' 🎬bbb · $11.99',
    ]);
  });

  it('counts octets, not characters: a label of 40 two-octet letters folds although it is under 75 characters', () => {
    // 16 + 29 x 2 = 74; a 30th would make 76. 11 letters (22) + 10 octets of price + the space = 33.
    expect(eventLines(renewalsToIcs([item({ label: 'é'.repeat(40) })], { now: NOW }), 'SUMMARY:')).toEqual([
      'SUMMARY:Renews: ' + 'é'.repeat(29),
      ' ' + 'é'.repeat(11) + ' · $11.99',
    ]);
  });

  it('fills a line to exactly 75 octets when the next character fits exactly', () => {
    // 16 + 57 = 73, plus a two-octet letter = 75: it stays on the first line, the next character moves down.
    expect(eventLines(renewalsToIcs([item({ label: 'a'.repeat(57) + 'é' + 'z' })], { now: NOW }), 'SUMMARY:')).toEqual([
      'SUMMARY:Renews: ' + 'a'.repeat(57) + 'é',
      ' z · $11.99',
    ]);
  });

  it('keeps an escape sequence together: a comma at the end of the line moves down with its backslash', () => {
    // 16 + 58 = 74 octets; `\,` is two, which would make 76.
    expect(eventLines(renewalsToIcs([item({ label: 'a'.repeat(58) + ',z' })], { now: NOW }), 'SUMMARY:')).toEqual([
      'SUMMARY:Renews: ' + 'a'.repeat(58),
      ' \\,z · $11.99',
    ]);
  });

  it('no physical line is longer than 75 octets, whatever the label, and unfolding gives back the logical lines', () => {
    const labels = ['x'.repeat(500), 'é, 🎬; '.repeat(40), 'a\\'.repeat(100), '中文'.repeat(60)];
    for (const label of labels) {
      const text = renewalsToIcs([item({ label })], { now: NOW });
      for (const l of physical(text)) expect(bytes(l)).toBeLessThanOrEqual(75);
      const unfolded = text.replaceAll('\r\n ', '');
      expect(unfolded).toContain('\r\nSUMMARY:Renews: ');
      expect(unfolded).not.toMatch(/�/);
    }
  });
});

describe('renewalsToIcs: duplicates, determinism, line endings', () => {
  it('the later of two items with the same id wins, in the place of the first', () => {
    const text = renewalsToIcs(
      [
        item({ id: 'a', label: 'A first', amount: 1, next: { month: '2026-12', day: 3 } }),
        item({ id: 'b', label: 'B', amount: 2, next: { month: '2026-12', day: 4 } }),
        item({ id: 'a', label: 'A second', amount: 3, next: { month: '2026-12', day: 5 } }),
      ],
      { now: NOW },
    );
    expect(text).toBe(calendar(
      event({ uid: 'sub-a-20261205@lifeguessr', start: '20261205', rrule: 'FREQ=MONTHLY', summary: 'Renews: A second · $3.00' }),
      event({ uid: 'sub-b-20261204@lifeguessr', start: '20261204', rrule: 'FREQ=MONTHLY', summary: 'Renews: B · $2.00' }),
    ));
  });

  it('is identical for identical input and `now`, ends with END:VCALENDAR and CRLF, and has no bare LF', () => {
    const items = [item(), item({ id: 'b', label: 'B, C', next: { month: '2026-12', day: 31 } })];
    const a = renewalsToIcs(items, { now: NOW });
    const b = renewalsToIcs(structuredClone(items), { now: new Date(NOW.getTime()) });
    expect(a).toBe(b);
    expect(a.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(a).not.toMatch(/(?<!\r)\n/);
    expect(a).not.toMatch(/\r(?!\n)/);
  });

  it('only DTSTAMP changes with `now`', () => {
    const later = renewalsToIcs([item()], { now: new Date('2027-01-02T03:04:05Z') });
    expect(later).toBe(renewalsToIcs([item()], { now: NOW }).replace('DTSTAMP:20261114T093005Z', 'DTSTAMP:20270102T030405Z'));
  });

  it('does not depend on the time zone of the machine: 23:59:59 UTC is still the 14th everywhere', () => {
    const before = process.env.TZ;
    const outputs: string[] = [];
    try {
      for (const tz of ['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
        process.env.TZ = tz;
        outputs.push(renewalsToIcs([item()], { now: new Date('2026-11-14T23:59:59Z') }));
      }
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
    for (const o of outputs) expect(o).toContain('\r\nDTSTAMP:20261114T235959Z\r\n');
    expect(new Set(outputs).size).toBe(1);
  });

  it('does not change the items it is given', () => {
    const items = [item(), item({ id: 'b' })];
    const copy = structuredClone(items);
    renewalsToIcs(items, { now: NOW });
    expect(items).toEqual(copy);
  });
});

describe('renewalsFromFindings', () => {
  const [prime, netflix] = [
    subscriptionsExpected.findings.find((f) => f.id === 'amazon-prime-amzn-com-bill-wa')!,
    subscriptionsExpected.findings.find((f) => f.id === 'netflix-com-ca')!,
  ];
  const finding = (over: Partial<SubscriptionFinding>): SubscriptionFinding => ({ ...netflix, ...over });

  it('turns the sample audit into its five renewals, in the audit order, from the fixture values', () => {
    // Hand-read from packages/data/fixtures/subscriptions.expected.json.
    expect(renewalsFromFindings(subscriptionsExpected.findings)).toEqual([
      { id: 'planet-fitness-club-fees', label: 'PLANET FITNESS CLUB FEES', amount: 24.99, cadence: 'monthly', next: { month: '2026-12', day: 1 } },
      { id: 'netflix-com-ca', label: 'NETFLIX.COM # CA', amount: 17.99, cadence: 'monthly', next: { month: '2026-12', day: 7 } },
      { id: 'spotify-usa-ny', label: 'SPOTIFY USA # NY', amount: 11.99, cadence: 'monthly', next: { month: '2026-12', day: 12 } },
      { id: 'amazon-prime-amzn-com-bill-wa', label: 'AMAZON PRIME*[ref] Amzn.com/bill WA', amount: 139, cadence: 'yearly', next: { month: '2027-08', day: 9 } },
      { id: 'apple-com-bill-ca', label: 'APPLE.COM/BILL # CA', amount: 2.99, cadence: 'monthly', next: { month: '2026-12', day: 3 } },
    ]);
  });

  it('keeps the yearly Prime charge: medium confidence, seen once, next expected on 9 August 2027', () => {
    expect(prime.confidence).toBe('medium');
    expect(renewalsFromFindings([prime])).toHaveLength(1);
  });

  it('skips stopped findings', () => {
    expect(renewalsFromFindings([finding({ status: 'stopped', nextExpected: null })])).toEqual([]);
    expect(renewalsFromFindings([finding({ status: 'stopped' })])).toEqual([]); // even if a date is still set
  });

  it('skips a finding with no next date: an active one without a date, and a service that was only ticked', () => {
    expect(renewalsFromFindings([finding({ nextExpected: null })])).toEqual([]);
    expect(renewalsFromFindings([finding({ origin: 'tickList', chargesSeen: 0, lastCharge: null, nextExpected: null, isEstimate: true })])).toEqual([]);
  });

  it('skips a low-confidence finding until the user confirms it, then keeps it', () => {
    const low = finding({ id: 'maybe', confidence: 'low' });
    expect(renewalsFromFindings([low])).toEqual([]);
    expect(renewalsFromFindings([low], { confirmed: new Set<string>() })).toEqual([]);
    expect(renewalsFromFindings([low], { confirmed: new Set(['someone-else']) })).toEqual([]);
    expect(renewalsFromFindings([low], { confirmed: new Set(['maybe']) }).map((r) => r.id)).toEqual(['maybe']);
  });

  it('keeps a medium- or high-confidence finding whether or not it is in the confirmed set', () => {
    expect(renewalsFromFindings([finding({ confidence: 'medium' }), finding({ id: 'b', confidence: 'high' })], { confirmed: new Set() }).map((r) => r.id)).toEqual(['netflix-com-ca', 'b']);
  });

  it('carries the real billing day when the next date was shortened to fit February', () => {
    const jan31 = finding({ cadence: 'monthly', lastCharge: { month: '2027-01', day: 31 }, nextExpected: { month: '2027-02', day: 28 } });
    expect(renewalsFromFindings([jan31])[0]).toEqual({
      id: 'netflix-com-ca', label: 'NETFLIX.COM # CA', amount: 17.99, cadence: 'monthly', next: { month: '2027-02', day: 28 }, billingDay: 31,
    });
    const leapDay = finding({ cadence: 'yearly', lastCharge: { month: '2028-02', day: 29 }, nextExpected: { month: '2029-02', day: 28 } });
    expect(renewalsFromFindings([leapDay])[0]!.billingDay).toBe(29);
  });

  it('adds no billing day when the next date is the date it was billed on, or when it merely drifted', () => {
    // Billed on the 30th in November, due on the 31st in December: not shortened.
    expect(renewalsFromFindings([finding({ lastCharge: { month: '2026-11', day: 30 }, nextExpected: { month: '2026-12', day: 31 } })])[0]).not.toHaveProperty('billingDay');
    // Same day.
    expect(renewalsFromFindings([finding({ lastCharge: { month: '2026-11', day: 7 }, nextExpected: { month: '2026-12', day: 7 } })])[0]).not.toHaveProperty('billingDay');
    // Charged on the 15th, due on the 12th: earlier, but not the last day of the month, so not a clamp.
    expect(renewalsFromFindings([finding({ lastCharge: { month: '2026-11', day: 15 }, nextExpected: { month: '2026-12', day: 12 } })])[0]).not.toHaveProperty('billingDay');
  });

  it('feeds renewalsToIcs: the Feb-28 renewal of a 31st biller repeats on the last day of every month', () => {
    const jan31 = finding({ lastCharge: { month: '2027-01', day: 31 }, nextExpected: { month: '2027-02', day: 28 } });
    const text = renewalsToIcs(renewalsFromFindings([jan31]), { now: NOW });
    expect(text).toContain('\r\nDTSTART;VALUE=DATE:20270228\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1\r\n');
  });

  it('returns an empty list for an empty audit', () => {
    expect(renewalsFromFindings([])).toEqual([]);
  });
});
