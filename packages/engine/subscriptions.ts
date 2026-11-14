// Subscription audit (M3): recurring charges in a statement, including ones the user forgot, with
// price rises, intro prices that ended, overlapping services and yearly charges. Pure and
// deterministic: it reads the masked `StatementItem[]` the browser already parsed, never the clock
// ("today" is the newest line, `asOf`), and no model is involved. Spec: GitHub issue #79.
//
// How a line becomes a finding, in order:
// 1. Candidates. Money out, grouped by `merchantKey`. A group is kept when the categorizer's class
//    for its latest label is `subscriptions` or `other`, or the catalogue recognises it (a known
//    service is a subscription whatever the class). With no class (no `classOf`, or no entry for the
//    label) only the catalogue admits a group, and its confidence is capped at `medium`.
// 2. Lanes. Within a group, charges of (nearly) one amount form a lane. A lane needs at most one
//    charge a month, on the same day of the month give or take a few days (a charge off that day
//    is left out, and a month-end day is clamped to the month's length).
// 3. Chains. Lanes that follow each other in time on the same day of the month are one series when
//    the step between them is a price change: an intro price that ended, a rise or a drop after a
//    steady amount. Lanes that overlap in time (two plans of one merchant) stay separate series.
// 4. Runs. A series is charges in consecutive periods, one missed period allowed between two
//    charges (and at least one pair in adjacent periods). Monthly first, then quarterly (a 3-month
//    gap). The latest run with at least two charges is the finding.
// 5. Yearly and one-off sightings. Not inferable from under 12 months of data, so only the
//    catalogue finds them: a charge that matches a yearly or quarterly plan price, or a single
//    charge of a service with a monthly plan, at a price near that plan's (within a factor of 2).
//
// All thresholds are named in assumptions.ts (subs*) with a rationale. Money is worked in whole
// cents until the end.
import {
  CADENCE_MONTHS, MAX_ID_LENGTH, SUBSCRIPTION_FINDINGS_MAX, SUBSCRIPTION_FLAGS,
  type Cadence, type ChargeDate, type KnownService, type Money, type ServiceCategory, type StatementClass,
  type StatementItem, type SubscriptionAudit, type SubscriptionFinding, type SubscriptionFlag,
} from '@lifeguessr/types';
import {
  subsAmountTolerance, subsCandidateClasses, subsDayWindow, subsDaysPerMonth, subsDoubledMonthsMaxShare,
  subsHighConfidenceMinCharges, subsIntroMaxCharges, subsIntroMaxRatio, subsMinAdjacentPairs, subsMinAmount, subsMinCharges,
  subsMissedPeriodsAllowed, subsOverlapCategories, subsPatternHighClasses, subsPlanGapSlackMonths, subsPlanPriceTolerance,
  subsPriceUpMinDollars, subsPriceUpMinRatio,
  subsReportStoppedSightings, subsSteadyMinCharges, subsStepMaxRatio, subsStoppedAfterPeriods,
} from './assumptions';
import { merchantKey } from './statement';

/** What `detectSubscriptions` takes besides the statement lines: all optional, all data from outside the engine. */
export type DetectSubscriptionsOptions = {
  /**
   * The categorizer's class for a masked label (M4: `classes` of /api/statement/categorize). Without
   * it, or for a label it does not know, only the catalogue admits a merchant and confidence is
   * capped at `medium`.
   */
  classOf?: (label: string) => StatementClass | undefined;
  /** Known services (M4). Default none. */
  catalogue?: readonly KnownService[];
  /** Ids of `low`-confidence findings the user confirmed: they count in the totals. */
  confirmed?: ReadonlySet<string>;
};

// ----- dates -----------------------------------------------------------------------------------
// The engine may not use `Date`, so calendar maths is done on month indexes (year × 12 + month - 1).

const EPSILON = 1e-9;

/** 'YYYY-MM' → month index, or null when it is not a month. */
function monthIndexOf(month: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const n = Number(m[2]);
  return n >= 1 && n <= 12 ? Number(m[1]) * 12 + n - 1 : null;
}

const monthString = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function daysInMonthIndex(index: number): number {
  const month = index % 12;
  if (month === 1) return isLeapYear(Math.floor(index / 12)) ? 29 : 28;
  return month === 3 || month === 5 || month === 8 || month === 10 ? 30 : 31;
}

/** Days since 1970-01-01 of a calendar day (Hinnant's days_from_civil), to count days between two charges. */
function dayNumber(index: number, day: number): number {
  const month = (index % 12) + 1;
  const year = Math.floor(index / 12) - (month <= 2 ? 1 : 0);
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

const chargeDate = (index: number, day: number): ChargeDate => ({ month: monthString(index), day });

// ----- small helpers ---------------------------------------------------------------------------

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Code-unit order, so the result does not depend on the locale. */
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const slugOf = (key: string) => key.toLowerCase().replace(/ /g, '-');

type Charge = { mi: number; day: number; cents: number; label: string };
const byTime = (a: Charge, b: Charge) => a.mi - b.mi || a.day - b.day || a.cents - b.cents || compareText(a.label, b.label);

// ----- the catalogue ---------------------------------------------------------------------------

type CatalogueEntry = { service: KnownService; matchers: string[] };

const prepareCatalogue = (catalogue: readonly KnownService[]): CatalogueEntry[] =>
  catalogue.map((service) => ({ service, matchers: service.matchers.map(merchantKey).filter((m) => m !== '') }));

/**
 * The catalogue service whose matcher is a whole-word run inside the merchant key, or null. When
 * several services match, the one with the longest matcher wins (SPOTIFY PREMIUM over SPOTIFY: the
 * more specific name); two services whose longest matchers are equally long stay unresolved, and
 * so is no match (a guess would be wrong half the time).
 */
function matchService(key: string, catalogue: readonly CatalogueEntry[]): KnownService | null {
  const padded = ` ${key} `;
  let best: KnownService | null = null;
  let bestLength = 0;
  let tied = false;
  for (const entry of catalogue) {
    const length = Math.max(0, ...entry.matchers.filter((m) => padded.includes(` ${m} `)).map((m) => m.length));
    if (length === 0) continue;
    if (length > bestLength) {
      best = entry.service;
      bestLength = length;
      tied = false;
    } else if (length === bestLength) {
      tied = true;
    }
  }
  return tied ? null : best;
}

const withinPlanPrice = (cents: number, price: Money) =>
  Math.abs(cents - price * 100) <= subsPlanPriceTolerance.value * price * 100 + EPSILON;

/** A charge at most a factor of `subsStepMaxRatio` (2) above or below a plan price: near it, though no longer at it. */
const nearPlanPrice = (cents: number, price: Money) =>
  cents <= subsStepMaxRatio.value * price * 100 + EPSILON && price * 100 <= subsStepMaxRatio.value * cents + EPSILON;

// ----- lanes, chains, runs ---------------------------------------------------------------------

/** Charges of one amount: at most one a month, on one day of the month. */
type Lane = { charges: Charge[]; cents: number; day: number };
type Segment = { cents: number; charges: Charge[] };

/** Whether a charge's day is within the window of the usual day, with the usual day clamped to a short month. */
const onUsualDay = (c: Charge, usualDay: number) =>
  Math.abs(c.day - Math.min(usualDay, daysInMonthIndex(c.mi))) <= subsDayWindow.value + EPSILON;

function buildLanes(charges: readonly Charge[]): Lane[] {
  const sorted = [...charges].sort((a, b) => a.cents - b.cents || byTime(a, b));
  const clusters: Charge[][] = [];
  let anchor = 0;
  for (const c of sorted) {
    const current = clusters.at(-1);
    if (current && c.cents <= anchor * (1 + subsAmountTolerance.value) + EPSILON) {
      current.push(c);
    } else {
      clusters.push([c]);
      anchor = c.cents;
    }
  }
  const lanes: Lane[] = [];
  for (const cluster of clusters) {
    const byMonth = new Map<number, Charge[]>();
    for (const c of cluster) byMonth.set(c.mi, [...(byMonth.get(c.mi) ?? []), c]);
    // Charged two or more times in most months: weekly, or two identical plans. Not one monthly charge.
    const doubled = [...byMonth.values()].filter((month) => month.length > 1).length;
    if (doubled > subsDoubledMonthsMaxShare.value * byMonth.size) continue;
    // An occasional second line in a month (a retry, a duplicate) counts once: the one nearest the usual day.
    const usualDay = median(cluster.map((c) => c.day));
    const distance = (c: Charge) => Math.abs(c.day - Math.min(usualDay, daysInMonthIndex(c.mi)));
    const kept = [...byMonth.values()]
      .map((month) => [...month].sort((a, b) => distance(a) - distance(b) || byTime(a, b))[0]!)
      .filter((c) => onUsualDay(c, usualDay))
      .sort(byTime);
    if (kept.length === 0) continue;
    lanes.push({ charges: kept, cents: Math.round(median(kept.map((c) => c.cents))), day: median(kept.map((c) => c.day)) });
  }
  return lanes.sort((a, b) => byTime(a.charges[0]!, b.charges[0]!) || a.cents - b.cents);
}

/**
 * The first charges were an intro price: at most 2, at most half the amount that followed, which
 * has to be a steady amount itself (2 or more charges). One smaller charge and then one bigger one
 * on the same day is also what a shop visited monthly looks like, so it is not enough. Monthly
 * series only.
 */
const isIntroStep = (prev: Segment, next: Segment, months: number) =>
  months === 1
  && prev.charges.length <= subsIntroMaxCharges.value
  && next.charges.length >= subsSteadyMinCharges.value
  && prev.cents <= subsIntroMaxRatio.value * next.cents + EPSILON;

/** A steady amount (2 or more charges) changed by at most a factor of 2 either way. */
const isPriceChangeStep = (prev: Segment, next: Segment) =>
  prev.charges.length >= subsSteadyMinCharges.value
  && next.cents <= subsStepMaxRatio.value * prev.cents + EPSILON
  && prev.cents <= subsStepMaxRatio.value * next.cents + EPSILON;

/** A rise worth a flag: at least the ratio and the dollars above the steady amount. */
const isPriceRise = (prev: Segment, next: Segment) =>
  prev.charges.length >= subsSteadyMinCharges.value
  && next.cents >= prev.cents * subsPriceUpMinRatio.value - EPSILON
  && next.cents - prev.cents >= subsPriceUpMinDollars.value * 100 - EPSILON;

const segmentOf = (lane: Lane): Segment => ({ cents: lane.cents, charges: lane.charges });

/** Two charges of one series are a whole number of periods apart: one period, or one with missed periods in between (up to the allowance). */
const isSeriesGap = (gap: number, months: number) =>
  gap >= months && gap % months === 0 && gap <= (1 + subsMissedPeriodsAllowed.value) * months;

function canExtend(chain: readonly Lane[], lane: Lane, months: number): boolean {
  const prev = chain.at(-1)!;
  const gap = lane.charges[0]!.mi - prev.charges.at(-1)!.mi;
  if (!isSeriesGap(gap, months)) return false;
  if (Math.abs(lane.day - prev.day) > subsDayWindow.value + EPSILON) return false;
  const [from, to] = [segmentOf(prev), segmentOf(lane)];
  return (chain.length === 1 && isIntroStep(from, to, months)) || isPriceChangeStep(from, to);
}

function buildChains(lanes: readonly Lane[], months: number): Lane[][] {
  const chains: Lane[][] = [];
  for (const lane of lanes) {
    const chain = chains.find((c) => canExtend(c, lane, months));
    if (chain) chain.push(lane);
    else chains.push([lane]);
  }
  return chains;
}

type Detected = {
  /** Months in one billing period: 1, 3 or 12. */
  months: 1 | 3 | 12;
  charges: Charge[];
  /** The steady amounts in time order, for the price flags. Empty for a catalogue sighting. */
  segments: Segment[];
  amountCents: number;
};

/**
 * The latest run of a chain with enough charges in consecutive periods (one missed period allowed
 * between two charges, never two), or null. A run needs at least one pair of charges in adjacent
 * periods: charges every other month are a two-month cycle, not a monthly one with misses.
 */
function latestRun(chain: readonly Lane[], months: 1 | 3): Detected | null {
  const flat = chain.flatMap((lane, laneIndex) => lane.charges.map((charge) => ({ charge, laneIndex })));
  const runs: (typeof flat)[] = [];
  for (const entry of flat) {
    const run = runs.at(-1);
    const gap = run ? entry.charge.mi - run.at(-1)!.charge.mi : 0;
    if (run && isSeriesGap(gap, months)) run.push(entry);
    else runs.push([entry]);
  }
  const adjacentPairs = (r: typeof flat) => r.filter((e, i) => i > 0 && e.charge.mi - r[i - 1]!.charge.mi === months).length;
  const run = runs.filter((r) => r.length >= subsMinCharges.value && adjacentPairs(r) >= subsMinAdjacentPairs.value).at(-1);
  if (!run) return null;
  const segments: Segment[] = [];
  let last = -1;
  for (const { charge, laneIndex } of run) {
    if (laneIndex !== last) segments.push({ cents: 0, charges: [] });
    segments.at(-1)!.charges.push(charge);
    last = laneIndex;
  }
  for (const s of segments) s.cents = Math.round(median(s.charges.map((c) => c.cents)));
  return { months, charges: run.map((r) => r.charge), segments, amountCents: segments.at(-1)!.cents };
}

/** Recurring series of one merchant for one period (1 = monthly, 3 = quarterly). */
function findSeries(charges: readonly Charge[], months: 1 | 3): Detected[] {
  const found: Detected[] = [];
  for (const chain of buildChains(buildLanes(charges), months)) {
    const run = latestRun(chain, months);
    if (run && run.amountCents >= subsMinAmount.value * 100 - EPSILON) found.push(run);
  }
  return found;
}

/**
 * A yearly or quarterly service found by its price alone: charges within tolerance of one of its
 * plans of that cadence, a period apart (a year give or take a month; a quarter exactly). The latest
 * charge and the earlier ones that line up with it.
 */
function findPlanPriced(charges: readonly Charge[], service: KnownService, months: 12 | 3): Detected | null {
  const cadence: Cadence = months === 12 ? 'yearly' : 'quarterly';
  const prices = service.plans.filter((p) => p.cadence === cadence).map((p) => p.price);
  const candidates = charges.filter((c) => prices.some((price) => withinPlanPrice(c.cents, price)));
  if (candidates.length === 0) return null;
  const slack = subsPlanGapSlackMonths.value[cadence];
  const chain = [candidates.at(-1)!];
  for (const c of candidates.slice(0, -1).reverse()) {
    const gap = chain[0]!.mi - c.mi;
    if (gap >= months - slack && gap <= months + slack) chain.unshift(c);
  }
  const amountCents = Math.round(median(chain.map((c) => c.cents)));
  if (amountCents < subsMinAmount.value * 100 - EPSILON) return null;
  return { months, charges: chain, segments: [], amountCents };
}

/**
 * The latest charge of a recognised service that bills monthly: at a monthly plan's price (within
 * the plan tolerance), or, when every plan is monthly, within a factor of 2 either way of one of
 * them (a plan whose price drifted or was discounted; not a one-off purchase or a yearly
 * prepayment from the same vendor, which have no business being read as a month's bill). This is
 * the issue's "medium for a catalogue match with 1": a known merchant whose charges form no series
 * (one charge in a one-month statement, or several that do not repeat on a pattern) is reported by
 * its latest charge alone, as a single sighting. When that charge is outside the bound nothing is
 * reported, whatever the earlier charges were. The earlier charges are not counted (`chargesSeen`
 * is 1), and no price or intro flag is raised: those need a steady amount held for 2 or more
 * charges, which is what was not found.
 */
function findLatestMonthly(charges: readonly Charge[], service: KnownService): Detected | null {
  const c = charges.at(-1)!;
  const monthlyPrices = service.plans.filter((p) => p.cadence === 'monthly').map((p) => p.price);
  const priced = monthlyPrices.some((price) => withinPlanPrice(c.cents, price));
  const onlyMonthly = service.plans.every((p) => p.cadence === 'monthly');
  const nearAPlan = onlyMonthly && monthlyPrices.some((price) => nearPlanPrice(c.cents, price));
  if (!priced && !nearAPlan) return null;
  if (c.cents < subsMinAmount.value * 100 - EPSILON) return null;
  return { months: 1, charges: [c], segments: [], amountCents: c.cents };
}

// ----- findings --------------------------------------------------------------------------------

type Draft = {
  key: string;
  detected: Detected;
  service: KnownService | null;       // recognised, never ambiguous: what `serviceId` and the confidence use
  category: ServiceCategory;
  matched: boolean;                   // a catalogue entry matched, ambiguous or not
  cls: StatementClass | undefined;    // the categorizer's class for the latest label
  capped: boolean;                    // no class for the label: nothing above `medium`
};

const CADENCE_OF_MONTHS: Record<1 | 3 | 12, Cadence> = { 1: 'monthly', 3: 'quarterly', 12: 'yearly' };

/** `priceUp` (with the amount it rose from) and `introEnded`, read off the series' steady amounts. */
function priceFlags(segments: readonly Segment[], months: number): { flags: SubscriptionFlag[]; previousAmount?: Money } {
  const flags: SubscriptionFlag[] = [];
  const [first, second] = [segments[0], segments[1]];
  const introEnded = first !== undefined && second !== undefined && isIntroStep(first, second, months);
  if (introEnded) flags.push('introEnded');
  const prev = segments.at(-2);
  const next = segments.at(-1);
  // With only two steady amounts the one step is the intro: it is not also a price rise.
  if (prev && next && !(introEnded && segments.length === 2) && isPriceRise(prev, next)) {
    flags.push('priceUp');
    return { flags, previousAmount: prev.cents / 100 };
  }
  return { flags };
}

/**
 * How sure the detector is, in order:
 * - A catalogue entry matched the merchant (an ambiguous one such as Apple counts for the match but
 *   not as a recognised service): 3 or more charges `high`; 2 charges `high` when the service is
 *   recognised and `low` when it is only an ambiguous match; 1 charge `medium`.
 * - No catalogue entry, a pattern alone. The issue says both "a pattern alone is `low`, shown to
 *   confirm and not counted until confirmed" (decision 2) and "`high` with 3 or more charges"
 *   (confidence rule). Reading (owner's decision): the categorizer's class settles it. Class
 *   `subscriptions` with 3 or more charges is `high`; with 2 charges, and class `other` at any
 *   number of charges (a transfer to a person, rent, a regular shop), it is `low`: shown to the user,
 *   not counted in the totals until confirmed.
 * Without a class for the label (strict mode) nothing is above `medium`.
 */
function confidenceOf(chargesSeen: number, draft: Draft): SubscriptionFinding['confidence'] {
  let base: SubscriptionFinding['confidence'];
  if (!draft.matched) {
    const classLiftsPattern = draft.cls !== undefined && subsPatternHighClasses.value.includes(draft.cls);
    base = classLiftsPattern && chargesSeen >= subsHighConfidenceMinCharges.value ? 'high' : 'low';
  } else if (chargesSeen >= subsHighConfidenceMinCharges.value) {
    base = 'high';
  } else if (chargesSeen >= subsMinCharges.value) {
    base = draft.service !== null ? 'high' : 'low';
  } else {
    base = 'medium';
  }
  return draft.capped && base === 'high' ? 'medium' : base;
}

function toFinding(draft: Draft, id: string, asOf: { mi: number; day: number }): SubscriptionFinding {
  const { detected: d, service } = draft;
  const last = d.charges.at(-1)!;
  const months = d.months;
  const cadence = CADENCE_OF_MONTHS[months];
  const { flags, previousAmount } = priceFlags(d.segments, months);
  if (d.charges.length === 1 && months !== 1) flags.push('seenOnce');
  const stopped = dayNumber(asOf.mi, asOf.day) - dayNumber(last.mi, last.day)
    > subsStoppedAfterPeriods.value * months * subsDaysPerMonth.value;
  const billingDay = Math.round(median(d.charges.map((c) => c.day)));
  const nextMonth = last.mi + months;
  const amount = d.amountCents / 100;
  return {
    id,
    merchantKey: draft.key,
    label: last.label,
    ...(service ? { serviceId: service.id } : {}),
    category: draft.category,
    cadence,
    amount,
    monthly: Math.round(d.amountCents / months) / 100,
    yearly: Math.round((d.amountCents * 12) / months) / 100,
    chargesSeen: d.charges.length,
    lastCharge: chargeDate(last.mi, last.day),
    nextExpected: stopped ? null : chargeDate(nextMonth, Math.min(billingDay, daysInMonthIndex(nextMonth))),
    status: stopped ? 'stopped' : 'active',
    flags: flags.sort((a, b) => SUBSCRIPTION_FLAGS.indexOf(a) - SUBSCRIPTION_FLAGS.indexOf(b)),
    ...(previousAmount !== undefined ? { previousAmount } : {}),
    confidence: confidenceOf(d.charges.length, draft),
    origin: 'statement',
    isEstimate: false,
  };
}

/** Ids are the merchant key as a slug; findings sharing a merchant add their amount in cents; names that still collide add -2, -3. */
function idAssigner(): (key: string, suffix: string) => string {
  const used = new Set<string>();
  return (key, suffix) => {
    const base = slugOf(key);
    for (let n = 1; ; n++) {
      const tail = suffix + (n > 1 ? `-${n}` : '');
      const id = base.slice(0, MAX_ID_LENGTH - tail.length).replace(/-+$/, '') + tail;
      if (!used.has(id)) {
        used.add(id);
        return id;
      }
    }
  };
}

/** Marks every active finding that shares an overlap category with another active finding. */
function markOverlaps(findings: SubscriptionFinding[]): SubscriptionFinding[] {
  const byCategory = new Map<ServiceCategory, SubscriptionFinding[]>();
  for (const f of findings) {
    if (f.status !== 'active' || !subsOverlapCategories.value.includes(f.category)) continue;
    byCategory.set(f.category, [...(byCategory.get(f.category) ?? []), f]);
  }
  // A service never overlaps itself (two plans of one service are two findings, not a duplicate service).
  const serviceOf = (f: SubscriptionFinding) => f.serviceId ?? f.merchantKey;
  const overlaps = new Map<string, string[]>();
  for (const group of byCategory.values()) {
    if (new Set(group.map(serviceOf)).size < 2) continue;
    for (const f of group) overlaps.set(f.id, group.filter((o) => serviceOf(o) !== serviceOf(f)).map((o) => o.id).sort(compareText));
  }
  return findings.map((f) => {
    const overlapsWith = overlaps.get(f.id);
    if (!overlapsWith) return f;
    return { ...f, flags: [...f.flags, 'overlap' as const].sort((a, b) => SUBSCRIPTION_FLAGS.indexOf(a) - SUBSCRIPTION_FLAGS.indexOf(b)), overlapsWith };
  });
}

// ----- public API ------------------------------------------------------------------------------

/**
 * Finds the recurring charges in a statement. `items` are the masked lines the browser parsed (money
 * out positive, money in negative; refunds and pay are ignored). Pure and deterministic: the same
 * lines in any order give the same audit, and the input is not changed. `asOf` is the newest line,
 * and an empty statement gives an empty audit with `asOf: null`. Without `opts.classOf` only
 * catalogue matches are found and none is above `medium` confidence. Spec: issue #79.
 */
export function detectSubscriptions(items: readonly StatementItem[], opts: DetectSubscriptionsOptions = {}): SubscriptionAudit {
  const catalogue = prepareCatalogue(opts.catalogue ?? []);
  const candidateClasses: readonly StatementClass[] = subsCandidateClasses.value;

  let asOf: { mi: number; day: number } | null = null;
  const months = new Set<number>();
  const groups = new Map<string, Charge[]>();
  for (const item of items) {
    const mi = monthIndexOf(item.month);
    // A line that is not a real calendar day (31 February) is ignored: it could not be a charge date or the as-of date.
    if (mi === null || !Number.isFinite(item.amount) || !Number.isInteger(item.day) || item.day < 1 || item.day > daysInMonthIndex(mi)) continue;
    months.add(mi);
    if (asOf === null || mi > asOf.mi || (mi === asOf.mi && item.day > asOf.day)) asOf = { mi, day: item.day };
    const cents = Math.round(item.amount * 100);
    if (cents < 1) continue;                                   // money in, a zero line or less than a cent
    const key = merchantKey(item.label);
    if (key === '') continue;
    const group = groups.get(key) ?? [];
    group.push({ mi, day: item.day, cents, label: item.label });
    groups.set(key, group);
  }
  if (asOf === null) return { findings: [], monthlyTotal: 0, yearlyTotal: 0, monthsCovered: 0, asOf: null };

  const drafts: Draft[] = [];
  for (const key of [...groups.keys()].sort(compareText)) {
    const charges = groups.get(key)!.sort(byTime);
    const matched = matchService(key, catalogue);
    const cls = opts.classOf?.(charges.at(-1)!.label);
    if (matched === null && !(cls !== undefined && candidateClasses.includes(cls))) continue;
    const service = matched !== null && matched.ambiguous !== true ? matched : null;
    // An ambiguous entry (Apple, Google, Amazon) bills many products: no service id and no category guessed.
    const category = service?.category ?? 'other';
    const capped = cls === undefined;
    const draft = (detected: Detected): Draft => ({ key, detected, service, category, matched: matched !== null, cls, capped });

    const series = findSeries(charges, 1);
    if (series.length === 0) series.push(...findSeries(charges, 3));
    if (series.length > 0) {
      drafts.push(...series.map(draft));
    } else if (service !== null) {
      const single = findPlanPriced(charges, service, 12) ?? findPlanPriced(charges, service, 3) ?? findLatestMonthly(charges, service);
      if (single) drafts.push(draft(single));
    }
  }

  const assignId = idAssigner();
  const perMerchant = new Map<string, number>();
  for (const d of drafts) perMerchant.set(d.key, (perMerchant.get(d.key) ?? 0) + 1);
  const findings = drafts
    .map((d) => {
      const suffix = perMerchant.get(d.key)! > 1 ? `-${d.detected.amountCents}` : '';
      return toFinding(d, assignId(d.key, suffix), asOf!);
    })
    // A single monthly sighting that already looks stopped shows no recurrence at all: not reported.
    .filter((f) => subsReportStoppedSightings.value || !(f.chargesSeen === 1 && f.cadence === 'monthly' && f.status === 'stopped'));

  // The contract caps an audit at SUBSCRIPTION_FINDINGS_MAX findings: keep the costliest (a statement
  // with hundreds of recurring merchants is not a subscription list anyone reads), before the overlaps
  // name each other so they never point at a finding that was cut.
  const kept = findings.sort((a, b) => b.yearly - a.yearly || compareText(a.id, b.id)).slice(0, SUBSCRIPTION_FINDINGS_MAX);
  const marked = markOverlaps(kept);
  return {
    findings: marked,
    ...auditTotals(marked, opts.confirmed),
    monthsCovered: months.size,
    asOf: chargeDate(asOf.mi, asOf.day),
  };
}

/**
 * The monthly and yearly cost of the findings that count: active ones that are not `low`
 * confidence, plus `low` ones whose id is in `confirmed`. Each charge is normalized to a month
 * (yearly ÷ 12, quarterly ÷ 3) and a year, and the sum is rounded to whole cents once, at the end.
 */
export function auditTotals(
  findings: readonly SubscriptionFinding[],
  confirmed?: ReadonlySet<string>,
): { monthlyTotal: Money; yearlyTotal: Money } {
  let monthlyCents = 0;
  let yearlyCents = 0;
  for (const f of findings) {
    if (f.status !== 'active') continue;
    if (f.confidence === 'low' && !confirmed?.has(f.id)) continue;
    const cents = f.amount * 100;
    monthlyCents += cents / CADENCE_MONTHS[f.cadence];
    yearlyCents += (cents * 12) / CADENCE_MONTHS[f.cadence];
  }
  return { monthlyTotal: Math.round(monthlyCents) / 100, yearlyTotal: Math.round(yearlyCents) / 100 };
}
