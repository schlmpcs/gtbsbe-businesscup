// Sample props for the design previews (/preview/*). Made-up numbers, shown under a "Design
// preview: sample numbers, not computed" banner. The one exception is S29: its loan numbers come
// from the engine (`compareLoans` on the demo profile), because that math already exists.
import { compareLoans } from '@lifeguessr/engine';
import { profileDemo } from '@/fixtures';
import type {
  CalendarPreviewProps,
  CheckinMonth,
  CheckinPreviewProps,
  CheckinRow,
  DecisionPath,
  LeaderboardPreviewProps,
  ManageProPreviewProps,
  SharedDecisionPreviewProps,
} from './types';

const sum = (rows: CheckinRow[], key: 'forecast' | 'actual') => rows.reduce((s, r) => s + r[key], 0);

function month(m: Omit<CheckinMonth, 'forecastTotal' | 'actualTotal'>): CheckinMonth {
  return { ...m, forecastTotal: sum(m.rows, 'forecast'), actualTotal: sum(m.rows, 'actual') };
}

const FORECAST = { housing: 2100, food: 650, transport: 480, childcare: 900, fun: 300, other: 420 };

export const checkinSample: CheckinPreviewProps = {
  currentMonthLabel: 'November 2026',
  months: [
    month({
      monthLabel: 'December 2026',
      rows: [
        { id: 'housing', label: 'Housing', forecast: FORECAST.housing, actual: 2100 },
        { id: 'food', label: 'Food', forecast: FORECAST.food, actual: 712 },
        { id: 'transport', label: 'Transport', forecast: FORECAST.transport, actual: 436 },
        { id: 'childcare', label: 'Childcare', forecast: FORECAST.childcare, actual: 900 },
        { id: 'fun', label: 'Fun and eating out', forecast: FORECAST.fun, actual: 254 },
        { id: 'other', label: 'Everything else', forecast: FORECAST.other, actual: 468 },
      ],
      move: { name: 'Pay off the credit card', paid: 1470, total: 4200, share: 0.35, payoffLabel: 'August 2027' },
      goal: { name: 'Emergency fund', saved: 3800, target: 10000, share: 0.38, paceLabel: 'October 2027' },
      value: { paidDown: 1470, vsForecast: 640 },
    }),
    month({
      monthLabel: 'January 2027',
      rows: [
        { id: 'housing', label: 'Housing', forecast: FORECAST.housing, actual: 2100 },
        { id: 'food', label: 'Food', forecast: FORECAST.food, actual: 598 },
        { id: 'transport', label: 'Transport', forecast: FORECAST.transport, actual: 505 },
        { id: 'childcare', label: 'Childcare', forecast: FORECAST.childcare, actual: 900 },
        { id: 'fun', label: 'Fun and eating out', forecast: FORECAST.fun, actual: 310 },
        { id: 'other', label: 'Everything else', forecast: FORECAST.other, actual: 380 },
      ],
      move: { name: 'Pay off the credit card', paid: 1960, total: 4200, share: 0.4667, payoffLabel: 'July 2027' },
      goal: { name: 'Emergency fund', saved: 4150, target: 10000, share: 0.415, paceLabel: 'September 2027' },
      value: { paidDown: 1960, vsForecast: 730 },
    }),
  ],
};

export const manageProSample: ManageProPreviewProps = {
  plan: 'Yearly',
  price: 39.99,
  priceInterval: 'per year',
  renewsOn: 'November 14, 2027',
  pausedUntil: { 1: 'December 14, 2026', 2: 'January 14, 2027', 3: 'February 14, 2027' },
  value: { paidDown: 1470, vsForecast: 640, checkinsSaved: 2, goalShare: 0.38, goalName: 'Emergency fund' },
};

export const calendarSample: CalendarPreviewProps = {
  moments: [
    {
      id: 'black-friday',
      title: 'Black Friday',
      dateLabel: 'Friday, November 27, 2026',
      action: { label: 'Can I afford it?', href: '/afford' },
    },
    {
      id: 'checkin',
      title: 'Monthly check-in',
      dateLabel: 'The 1st of every month',
      action: { label: 'Open check-in', href: '/checkin' },
    },
    {
      id: 'tax-refund',
      title: 'Tax refund',
      dateLabel: 'February to March 2027',
      isEstimate: true,
      action: { label: 'See your moves', href: '/future' },
    },
    { id: 'lease-end', title: 'Lease ends', dateLabel: 'June 30, 2027', userDate: true, action: { label: 'Keep or lease?', href: '/decide' } },
    { id: 'car-loan', title: 'Car loan paid off', dateLabel: 'March 2029', userDate: true, action: { label: 'See your moves', href: '/future' } },
  ],
};

// S29: two terms for the same car, run through the engine's loan math on the demo profile.
const CAR = { amount: 28000, downPayment: 3000 };
const OFFERS = [
  { ...CAR, apr: 0.069, termMonths: 36 },
  { ...CAR, apr: 0.079, termMonths: 60 },
] as const;
const [a, b] = compareLoans(profileDemo, OFFERS);
const path = (id: DecisionPath['id'], o: (typeof OFFERS)[number], r: NonNullable<typeof a>): DecisionPath => ({
  id,
  termMonths: o.termMonths,
  apr: o.apr,
  monthly: r.monthly,
  totalInterest: r.totalInterest,
  effect10y: r.effect10y,
});

export const sharedDecisionSample: SharedDecisionPreviewProps = {
  amount: CAR.amount,
  downPayment: CAR.downPayment,
  paths: [path('A', OFFERS[0], a!), path('B', OFFERS[1], b!)],
  monthlySaving: Math.max(0, a!.monthly - b!.monthly),
  interestSaving: Math.max(0, b!.totalInterest - a!.totalInterest),
  ctaHref: '/',
};

export const leaderboardSample: LeaderboardPreviewProps = {
  dateLabel: 'November 14',
  rounds: 5,
  countdown: '9 h 12 min',
  top: [
    { rank: 1, handle: 'Thrifty Otter 12', right: 5, points: 4870 },
    { rank: 2, handle: 'Frugal Heron 88', right: 5, points: 4715 },
    { rank: 3, handle: 'Canny Badger 7', right: 5, points: 4590 },
    { rank: 4, handle: 'Sharp Lynx 31', right: 4, points: 4120 },
    { rank: 5, handle: 'Steady Moose 64', right: 4, points: 3985 },
    { rank: 6, handle: 'Wise Owl 03', right: 4, points: 3840 },
    { rank: 7, handle: 'Calm Walrus 59', right: 4, points: 3610 },
    { rank: 8, handle: 'Bold Finch 26', right: 3, points: 3305 },
    { rank: 9, handle: 'Quick Fox 71', right: 3, points: 3170 },
    { rank: 10, handle: 'Lucky Seal 45', right: 3, points: 2950 },
  ],
  you: { rank: 238, handle: 'Brave Heron 41', right: 3, points: 2410, you: true },
  playHref: '/play',
};
