// The renewals calendar (M6): subscription findings → an iCalendar file (RFC 5545) that a phone or a
// desktop calendar imports, so "remind me before it renews" needs no account, no e-mail and no server.
//
// Pure and client-only. Nothing here reads the clock, the locale or the time zone: `now` is a
// parameter and the output is the same string for the same input anywhere. Merchant labels stay in
// the browser: this module builds text, and lib/download.ts hands it to the browser as a file.
//
// Nothing is gated here. Because the file is built in the browser, any Pro lock on the export button
// is a lock on the UI only, not a server gate (decision D2, free or Pro, is open).
//
// Written by hand, no dependency. The parts of RFC 5545 it relies on:
//   - §3.1 lines end in CRLF and are folded at 75 octets (UTF-8 bytes) with CRLF + one space;
//   - §3.3.11 TEXT escapes `\`, `;`, `,` and newlines;
//   - §3.3.10 a recurrence that falls on a day that does not exist (31 April, 29 February in a common
//     year) is skipped. That is why month-end days get a BYSETPOS rule, see `recurrenceRule`.
import type { Cadence, ChargeDate, Money, SubscriptionFinding } from '@lifeguessr/types';
import { renewals as wording } from '@/copy/renewals';
import { formatMoney } from './format';

/** One renewal to put in the calendar. */
export type RenewalItem = {
  /** Becomes part of the event's UID, so the same item on the same date imports as the same event. */
  id: string;
  /** What the person sees after "Renews:": the finding's label. */
  label: string;
  /** The charge per `cadence`, in dollars. */
  amount: Money;
  cadence: Cadence;
  /** The next expected renewal: `month` is 'YYYY-MM'. */
  next: ChargeDate;
  /**
   * The day of the month the service really bills on, when `next.day` was shortened to fit a short
   * month (billed on the 31st, next due 28 February: `next.day` 28, `billingDay` 31). Defaults to
   * `next.day`. Ignored unless it is a whole number from `next.day` to 31.
   */
  billingDay?: number;
};

export type IcsOptions = {
  /** Goes into DTSTAMP, in UTC. The only clock the file has. */
  now: Date;
  /** The calendar's name in the calendar app. */
  calendarName?: string;
  /** How many days before the renewal the reminder fires (0 = on the day). Default 1. */
  alarmDaysBefore?: number;
  /** Start of every event title, in place of "Renews: " (e.g. "Due: " for the bills calendar). */
  summaryPrefix?: string;
};

export const PRODID = '-//LifeGuessr//Renewals//EN';
/** After the "@" of every UID: no host name, so nothing identifies a server or a person. */
export const UID_DOMAIN = 'lifeguessr';
export const DEFAULT_ALARM_DAYS_BEFORE = 1;
/** A reminder further ahead than a year is a mistake, not a setting. */
export const MAX_ALARM_DAYS_BEFORE = 365;
/** RFC 5545 §3.1: content lines SHOULD NOT be longer than 75 octets, the line break not counted. */
export const FOLD_AT_OCTETS = 75;

const CRLF = '\r\n';

// ----- dates ------------------------------------------------------------------------------------

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

type CalendarDate = { year: number; month: number; day: number };

/** The date of a `ChargeDate`, or null when it is not a real calendar day (29 February in a common year). */
function toCalendarDate(date: ChargeDate): CalendarDate | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(date.month);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(date.day) || date.day < 1 || date.day > daysInMonth(year, month)) return null;
  return { year, month, day: date.day };
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** 'YYYYMMDD' (VALUE=DATE). */
const dateValue = (d: CalendarDate): string => `${pad(d.year, 4)}${pad(d.month, 2)}${pad(d.day, 2)}`;

/** 'YYYYMMDDTHHMMSSZ': the UTC date and time, so the machine's time zone never shows. */
const utcStamp = (d: Date): string =>
  `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`
  + `T${pad(d.getUTCHours(), 2)}${pad(d.getUTCMinutes(), 2)}${pad(d.getUTCSeconds(), 2)}Z`;

// ----- recurrence -------------------------------------------------------------------------------

/** '28,29,30' for 30: the days from the 28th up to the billing day. */
const daysFrom28To = (last: number): string => Array.from({ length: last - 27 }, (_, i) => 28 + i).join(',');

/**
 * The RRULE of a renewal.
 *
 * A plain `FREQ=MONTHLY` repeats on DTSTART's day of the month, and RFC 5545 skips a month that has no
 * such day: a renewal on the 31st would vanish from February, April, June, September and November.
 * For a billing day of 29 to 31 the rule is instead "the last day that exists out of 28..N":
 * `BYMONTHDAY=28,29,30,31;BYSETPOS=-1`. February (28 days, 29 in a leap year) has 28 and maybe 29, so
 * it takes its last day; a month with 31 days takes the 31st; the 28th always exists, so no month is
 * skipped. A billing day of 30 uses 28,29,30 (31 days or 30: the 30th; February: its last day), a billing
 * day of 29 uses 28,29. The same idea covers a yearly renewal on 29 February: 28 February in a common
 * year, the 29th in a leap year, where a plain `FREQ=YEARLY` would fire only every fourth year.
 *
 * DO NOT "fix" this back to the wording of issue #82 (`BYMONTHDAY=29,30,31;BYSETPOS=-1`). It differs on
 * purpose: in a common-year February none of 29, 30 and 31 exists, so by RFC 5545 §3.3.10 the list for that
 * month is empty and the month gets no instance (a renewal on the 31st would never show in February), and
 * a renewal on the 29th would land on the 31st in long months. Starting the list at 28 keeps it non-empty
 * in every month. The test file expands the written rules and shows both failures of the issue's wording.
 *
 * Null for a cadence that is not monthly, quarterly or yearly (a runtime value the types do not allow,
 * e.g. read back from storage): the caller leaves that item out rather than write a broken RRULE.
 */
function recurrenceRule(item: RenewalItem, date: CalendarDate): string | null {
  const billingDay =
    Number.isInteger(item.billingDay) && item.billingDay! >= date.day && item.billingDay! <= 31 ? item.billingDay! : date.day;
  const monthEnd = billingDay >= 29;
  switch (item.cadence) {
    case 'yearly':
      return date.month === 2 && monthEnd ? 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1' : 'FREQ=YEARLY';
    case 'quarterly':
      return `FREQ=MONTHLY;INTERVAL=3${monthEnd ? `;BYMONTHDAY=${daysFrom28To(billingDay)};BYSETPOS=-1` : ''}`;
    case 'monthly':
      return `FREQ=MONTHLY${monthEnd ? `;BYMONTHDAY=${daysFrom28To(billingDay)};BYSETPOS=-1` : ''}`;
    default:
      return null;
  }
}

// ----- text -------------------------------------------------------------------------------------

/**
 * A TEXT value (§3.3.11): `\`, `;` and `,` get a backslash, any line break becomes the two characters
 * `\n`. TEXT may not hold control characters, so they become a space, and a lone UTF-16 surrogate
 * (which has no UTF-8 form) becomes U+FFFD.
 */
function escapeText(text: string): string {
  let out = '';
  for (const ch of text.replace(/\r\n|\r|\n/g, '\n')) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff) out += '�';
    else if (ch === '\n') out += '\\n';
    else if (cp < 0x20 || cp === 0x7f) out += ' ';
    else if (ch === '\\' || ch === ';' || ch === ',') out += `\\${ch}`;
    else out += ch;
  }
  return out;
}

/** UTF-8 length of a string without encoding it (every character is a whole code point here). */
function octets(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

/**
 * Folds one content line (§3.1): no physical line is longer than 75 octets, the leading space of a
 * continuation line included. It breaks only between code points, so a multi-octet UTF-8 sequence is
 * never split, and keeps an escape sequence (`\,`) together, so a line never ends in a lone backslash.
 */
function fold(line: string): string {
  const chars = Array.from(line);
  const physical: string[] = [];
  let current = '';
  let used = 0;
  for (let i = 0; i < chars.length; i++) {
    let unit = chars[i]!;
    if (unit === '\\' && i + 1 < chars.length) unit += chars[++i]!;
    const size = octets(unit);
    if (used + size > FOLD_AT_OCTETS) {
      physical.push(current);
      current = ' ';
      used = 1;
    }
    current += unit;
    used += size;
  }
  physical.push(current);
  return physical.join(CRLF);
}

// ----- the file ---------------------------------------------------------------------------------

function eventLines(item: RenewalItem, date: CalendarDate, rule: string, dtstamp: string, trigger: string, prefix: string): string[] {
  const summary = escapeText(
    `${prefix}${item.label}${wording.summarySeparator}${formatMoney(item.amount, { cents: true })}`,
  );
  return [
    'BEGIN:VEVENT',
    `UID:sub-${escapeText(item.id)}-${dateValue(date)}@${UID_DOMAIN}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateValue(date)}`,
    `RRULE:${rule}`,
    `SUMMARY:${summary}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    `TRIGGER:${trigger}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

/**
 * The renewals as an iCalendar file: one all-day, free (TRANSP:TRANSPARENT) event per item, repeating
 * with its cadence, with a reminder `alarmDaysBefore` days ahead. CRLF line endings, folded at 75
 * octets, always ends with `END:VCALENDAR` and a line break.
 *
 * - Two items with the same `id`: the later one wins and keeps the earlier one's place in the file. This
 *   is settled first, before anything is checked, so a later item that turns out to be unusable (next
 *   bullet) leaves the id with no event: the earlier item was replaced, and it does not come back.
 * - An item whose date is not a real day (29 February 2027, month '2026-13') or whose cadence is not
 *   monthly, quarterly or yearly is left out: a calendar would refuse the whole file for it.
 * - No items gives a valid calendar with no events. Throws a RangeError only for a `now` that is not a
 *   date or an `alarmDaysBefore` that is not a whole number of days from 0 to 365.
 */
export function renewalsToIcs(items: readonly RenewalItem[], opts: IcsOptions): string {
  if (!Number.isFinite(opts.now.getTime())) throw new RangeError('renewalsToIcs: `now` is not a valid date');
  const alarmDays = opts.alarmDaysBefore ?? DEFAULT_ALARM_DAYS_BEFORE;
  if (!Number.isInteger(alarmDays) || alarmDays < 0 || alarmDays > MAX_ALARM_DAYS_BEFORE) {
    throw new RangeError(`renewalsToIcs: \`alarmDaysBefore\` must be a whole number from 0 to ${MAX_ALARM_DAYS_BEFORE}`);
  }
  const dtstamp = utcStamp(opts.now);
  const trigger = alarmDays === 0 ? 'PT0S' : `-P${alarmDays}D`;

  const byId = new Map<string, RenewalItem>();
  for (const item of items) byId.set(item.id, item); // a repeated id keeps its first position, with the later item
  const events = [...byId.values()].flatMap((item) => {
    const date = toCalendarDate(item.next);
    const rule = date && recurrenceRule(item, date);
    return date && rule ? eventLines(item, date, rule, dtstamp, trigger, opts.summaryPrefix ?? wording.summaryPrefix) : [];
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(opts.calendarName || wording.calendarName)}`, // `||`: a blank name is no name
    ...events,
    'END:VCALENDAR',
  ];
  return lines.map((line) => fold(line) + CRLF).join('');
}

// ----- from the audit ---------------------------------------------------------------------------

/**
 * The billing day, when the finding's next date was shortened to fit its month: the next date is the
 * last day of its month and the last charge was on a later day (charged on 31 January, next expected
 * 28 February). Otherwise undefined: the next date is the billing day.
 */
function shortenedBillingDay(last: ChargeDate | null, next: ChargeDate): number | undefined {
  const date = toCalendarDate(next);
  if (!last || !date || last.day <= next.day || next.day !== daysInMonth(date.year, date.month)) return undefined;
  return last.day;
}

/**
 * The renewals of a subscription audit: active findings that have a next expected date. A finding of
 * low confidence is a guess, so it is left out until the user has confirmed it (`opts.confirmed` holds
 * the confirmed finding ids, like `detectSubscriptions`). A stopped finding, and a service that was only
 * ticked (no statement, so no date), have nothing to remind about. The audit's order is kept.
 */
export function renewalsFromFindings(
  findings: readonly SubscriptionFinding[],
  opts: { confirmed?: ReadonlySet<string> } = {},
): RenewalItem[] {
  const items: RenewalItem[] = [];
  for (const f of findings) {
    if (f.status !== 'active' || !f.nextExpected) continue;
    if (f.confidence === 'low' && !opts.confirmed?.has(f.id)) continue;
    const next: ChargeDate = { month: f.nextExpected.month, day: f.nextExpected.day };
    const item: RenewalItem = { id: f.id, label: f.label, amount: f.amount, cadence: f.cadence, next };
    const billingDay = shortenedBillingDay(f.lastCharge, next);
    if (billingDay !== undefined) item.billingDay = billingDay;
    items.push(item);
  }
  return items;
}
