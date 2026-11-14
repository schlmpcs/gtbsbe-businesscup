// Zod schemas for the subscription audit (M1): what the detector finds in a statement. The catalogue
// schemas (CadenceSchema, ServiceCategorySchema, KnownServiceSchema) are in ./subscriptions, and the
// ChargeDateSchema in ./schemas. Findings and audits are read back from local storage, so they check
// the whole shape, including the arithmetic a finding must satisfy. An audit's totals are only
// bounded (see SubscriptionAuditSchema), not recomputed.
//
// Units follow the contracts: Money = unrounded US dollars, rates = decimals per year.
import { z } from 'zod';
import {
  CADENCE_MONTHS, MAX_ID_LENGTH, SUBSCRIPTION_CONFIDENCES, SUBSCRIPTION_FINDINGS_MAX, SUBSCRIPTION_FLAGS,
  SUBSCRIPTION_ORIGINS, SUBSCRIPTION_STATUSES,
} from './constants';
import { ChargeDateSchema, NonNegativeMoneySchema } from './schemas';
import { CadenceSchema, ServiceCategorySchema } from './subscriptions';

export const SubscriptionFlagSchema = z.enum(SUBSCRIPTION_FLAGS);

/** A finding id or a service id: short, never empty. */
const shortId = z.string().min(1).max(MAX_ID_LENGTH);
/** Strictly positive dollars: the amount of one charge. */
const PositiveMoneySchema = z.number().positive();
/** Money rounded to cents is compared to its exact value within this much. */
const CENT = 0.01;
const hasDuplicates = (values: readonly unknown[]) => new Set(values).size !== values.length;
/** Is calendar day `a` later than `b`? ('YYYY-MM' strings sort in time order.) */
const isAfter = (a: { month: string; day: number }, b: { month: string; day: number }) =>
  a.month > b.month || (a.month === b.month && a.day > b.day);
type Issue = (path: (string | number)[], message: string) => void;
const issuer = (ctx: z.RefinementCtx): Issue => (path, message) => ctx.addIssue({ code: 'custom', path, message });

export const SubscriptionFindingSchema = z.object({
  id: shortId,
  merchantKey: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  serviceId: shortId.optional(),
  category: ServiceCategorySchema,
  cadence: CadenceSchema,
  amount: PositiveMoneySchema,                     // per cadence
  monthly: PositiveMoneySchema,
  yearly: PositiveMoneySchema,
  chargesSeen: z.number().int().min(0).max(1_000),
  lastCharge: ChargeDateSchema.nullable(),
  nextExpected: ChargeDateSchema.nullable(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  flags: z.array(SubscriptionFlagSchema).max(SUBSCRIPTION_FLAGS.length),
  previousAmount: PositiveMoneySchema.optional(),
  overlapsWith: z.array(shortId).max(50).optional(),
  confidence: z.enum(SUBSCRIPTION_CONFIDENCES),
  origin: z.enum(SUBSCRIPTION_ORIGINS),
  isEstimate: z.boolean(),
}).superRefine((f, ctx) => {
  const issue = issuer(ctx);
  // The normalized figures follow from the amount and the cadence (to the cent).
  const months = CADENCE_MONTHS[f.cadence];
  if (Math.abs(f.monthly - f.amount / months) > CENT / 2 + 1e-9) issue(['monthly'], `expected amount ÷ ${months} (to the cent)`);
  if (Math.abs(f.yearly - (f.amount * 12) / months) > CENT / 2 + 1e-9) issue(['yearly'], `expected amount × ${12 / months} (to the cent)`);
  if (f.origin === 'tickList') {
    // A tick is something the user said they pay for: no charge was seen, and the price is an estimate.
    if (f.chargesSeen !== 0) issue(['chargesSeen'], 'a ticked service has no charges seen');
    if (f.lastCharge !== null) issue(['lastCharge'], 'a ticked service has no last charge');
    if (f.nextExpected !== null) issue(['nextExpected'], 'a ticked service has no next date');
    if (f.status !== 'active') issue(['status'], 'a ticked service is active');
    if (!f.isEstimate) issue(['isEstimate'], 'a ticked service is an estimate');
  } else {
    if (f.chargesSeen < 1) issue(['chargesSeen'], 'a statement finding has at least one charge');
    if (f.lastCharge === null) issue(['lastCharge'], 'a statement finding has a last charge');
  }
  if (f.status === 'stopped' && f.nextExpected !== null) issue(['nextExpected'], 'a stopped finding has no next date');
  if (f.lastCharge && f.nextExpected && !isAfter(f.nextExpected, f.lastCharge)) {
    issue(['nextExpected'], 'next date is not after the last charge');
  }
  if (hasDuplicates(f.flags)) issue(['flags'], 'flags must be unique');
  if (f.flags.includes('priceUp') && (f.previousAmount === undefined || f.previousAmount >= f.amount)) {
    issue(['previousAmount'], 'a price rise needs the lower amount it rose from');
  }
  if (!f.flags.includes('priceUp') && f.previousAmount !== undefined) {
    issue(['previousAmount'], 'a previous amount belongs to the priceUp flag');
  }
  if (f.flags.includes('overlap') && (f.overlapsWith?.length ?? 0) === 0) issue(['overlapsWith'], 'an overlap names the findings it overlaps');
  if (!f.flags.includes('overlap') && (f.overlapsWith?.length ?? 0) > 0) {
    issue(['overlapsWith'], 'a list of overlapping findings belongs to the overlap flag');
  }
  if (f.overlapsWith?.includes(f.id)) issue(['overlapsWith'], 'a finding cannot overlap itself');
  if (f.flags.includes('seenOnce') && f.chargesSeen !== 1) issue(['flags'], 'seenOnce means exactly one charge');
});

export const SubscriptionAuditSchema = z.object({
  findings: z.array(SubscriptionFindingSchema).max(SUBSCRIPTION_FINDINGS_MAX),
  monthlyTotal: NonNegativeMoneySchema,
  yearlyTotal: NonNegativeMoneySchema,
  monthsCovered: z.number().int().min(0).max(600),
  asOf: ChargeDateSchema.nullable(),
}).superRefine((audit, ctx) => {
  const issue = issuer(ctx);
  const ids = audit.findings.map((f) => f.id);
  if (hasDuplicates(ids)) issue(['findings'], 'finding ids must be unique');
  audit.findings.forEach((f, i) => {
    for (const other of f.overlapsWith ?? []) {
      if (!ids.includes(other)) issue(['findings', i, 'overlapsWith'], `${other} is not a finding of this audit`);
    }
  });
  if (audit.findings.length > 0 && audit.asOf === null) issue(['asOf'], 'an audit with findings has an as-of date');
  // "Today" for the audit is the latest day of the statement, so no charge is later than it.
  if (audit.asOf) {
    audit.findings.forEach((f, i) => {
      if (f.lastCharge && isAfter(f.lastCharge, audit.asOf!)) issue(['findings', i, 'lastCharge'], 'a charge is later than the as-of date');
    });
  }
  // Totals are only bounded here, because which findings M3 counts also depends on the confirmations
  // the user has made (a low-confidence finding counts once confirmed). Every active finding that is
  // not low confidence is counted, so the totals are at least their sum; nothing but a finding can be
  // counted, so they are at most the sum of all findings. Each figure may be exact or rounded to the
  // cent, so the bounds give each finding, and the total, half a cent of slack.
  const slack = ((audit.findings.length + 1) * CENT) / 2 + 1e-9;
  const counted = audit.findings.filter((f) => f.status === 'active' && f.confidence !== 'low');
  for (const [total, figure] of [['monthlyTotal', 'monthly'], ['yearlyTotal', 'yearly']] as const) {
    const least = counted.reduce((sum, f) => sum + f[figure], 0);
    const most = audit.findings.reduce((sum, f) => sum + f[figure], 0);
    if (audit[total] < least - slack) issue([total], `less than the active findings that are not low confidence (${figure} sum ${least})`);
    if (audit[total] > most + slack) issue([total], `more than all the findings together (${figure} sum ${most})`);
  }
});
