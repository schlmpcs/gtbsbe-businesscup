import type { Forecast, Money, Rate, Source } from './index';
// ----- Life events: the what-if timeline (/tools/life-events) ------------------------------------
// The person places life events on a 10-year timeline; the rules engine (`lifeEvents()` in
// packages/engine/lifeEvents.ts) simulates the plan with and without them. Browser only: nothing
// here is sent to a server. Money is in today's dollars; `startYear` counts whole years from today.

export type LifeEventKind = 'baby' | 'move' | 'car' | 'raise' | 'purchase';

/** Whole years from today, 0 (this month) to 10 (the end of the forecast: no effect inside it). */
export type LifeEventYear = number;

export type LifeEvent =
  /** A new child: childcare, the child's groceries and other kid costs, priced in the area you live in then. */
  | { id: string; kind: 'baby'; startYear: LifeEventYear }
  /**
   * A move to another covered area (`toZip` is a ZIP in the area data). Your own rent, groceries and
   * childcare are scaled by the price difference between the two areas; car insurance and fuel change
   * by the difference in their area prices when you have a car. `bedrooms` (default 2) picks the rent.
   */
  | { id: string; kind: 'move'; startYear: LifeEventYear; toZip: string; bedrooms?: 0 | 1 | 2 | 3 | 4 }
  /** Another car, bought on a loan: price and down payment in today's dollars, plus insurance and fuel. */
  | { id: string; kind: 'car'; startYear: LifeEventYear; price: Money; downPayment: Money; apr: Rate; termMonths: number }
  /**
   * A raise or a new job: take-home pay (monthly) changes by an amount, or by a share of today's
   * take-home pay (`rate: 0.1` = +10%). Negative values are a pay cut.
   */
  | { id: string; kind: 'raise'; startYear: LifeEventYear; change: { by: 'amount'; amount: Money } | { by: 'rate'; rate: Rate } }
  /** A one-off purchase (a wedding, a trip), paid from cash in its start month; today's dollars. */
  | { id: string; kind: 'purchase'; startYear: LifeEventYear; amount: Money };

/** What one line of an event's monthly change is (the UI names it). */
export type LifeEventLineItem =
  | 'childcare' | 'kidGroceries' | 'kidOther'                 // baby
  | 'rent' | 'groceries' | 'childcareNow' | 'carInsurance' | 'fuel' // move (changes to your own costs) and car
  | 'carLoan' | 'takeHome';                                   // car loan payment; pay change (a cost < 0 = more pay)

/**
 * One line of an event's monthly change, in today's dollars, in the month the event starts.
 * `monthly` > 0 = more money out (or less pay in); < 0 = money saved (or more pay).
 */
export type LifeEventLine = { item: LifeEventLineItem; monthly: Money; source: Source; isEstimate: boolean };

export type LifeEventEffect = {
  id: string;
  kind: LifeEventKind;
  startYear: LifeEventYear;
  /** 0-based month the event starts (startYear × 12). */
  startMonth: number;
  /** Σ lines.monthly: the net monthly change when it starts (today's dollars; > 0 costs you). */
  monthly: Money;
  /** Paid once in the start month (a purchase's amount, a car's down payment); today's dollars. */
  oneOff: Money;
  lines: LifeEventLine[];
  /** True when any line rests on an estimate or an assumption. */
  isEstimate: boolean;
  /** The event alone: net worth in 10 years with only this event minus without (mid, same units as the result). */
  effect10yAlone: Money;
  /** For a baby: the area had no childcare price, so childcare is not counted. */
  missingChildcare?: boolean;
  /** For a move: the area you are moving to (from the area data). */
  toMetro?: string;
};

export type LifeEventsResult = {
  /** Net worth month by month without the events, and with them (same rates and units). */
  base: Forecast;
  with: Forecast;
  /** with.in10y.mid − base.in10y.mid (< 0: the events cost you that much in 10 years). */
  delta: Money;
  /** One per input event, in input order. */
  events: LifeEventEffect[];
  todaysDollars: boolean;
};
