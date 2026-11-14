// Wording inside the renewals calendar file (.ics, lib/ics.ts): what shows in the person's own calendar
// app. Owner: Amir (M6). Neutral on purpose: it says a charge is expected, never that it should be
// cancelled. Not part of the `copy` barrel in ./index.ts yet; M5 registers it with its own strings.

export const renewals = {
  /** Start of every event title (and its alarm text): "Renews: Netflix · $17.99". */
  summaryPrefix: 'Renews: ',
  /** Between the service and the price in that title. */
  summarySeparator: ' · ',
  /** The calendar's own name in the calendar app, unless the caller gives one. */
  calendarName: 'Subscription renewals',
} as const;
