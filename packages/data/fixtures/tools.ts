// The micro-tool fixtures (M1): the sample statement as the browser sends it, and the audit the
// subscription detector must find in it. Kept out of the fixtures barrel (./index) on purpose, like
// the sample cards: the barrel is in every page's browser chunk, and these two files are only
// needed by tests, the detector's first wiring and an eventual "try a sample" step. Import them from
// '@lifeguessr/data/fixtures/tools' (apps/web: '@/fixtures/tools').
//
// Both are validated with their contract's zod schema when this module loads, so a bad edit fails
// loudly in tests and CI instead of producing wrong numbers later.
import {
  StatementItemSchema, SubscriptionAuditSchema, type StatementItem, type SubscriptionAudit,
} from '@lifeguessr/types';
import statementItemsJson from './statementItems.sample.json';
import subscriptionsExpectedJson from './subscriptions.expected.json';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

/**
 * The `StatementItem[]` the browser makes of statement.sample.csv (reader + masker; oldest first,
 * money out positive): the 170 lines of July to 12 November 2026. Committed so engine and view-model
 * tests need neither the CSV reader nor the masker. apps/web/src/lib/statement/sampleItems.test.ts
 * regenerates it from the CSV and fails on any drift (that file says how to update this one).
 */
export const statementItemsSample: readonly StatementItem[] = deepFreeze(StatementItemSchema.array().parse(statementItemsJson));

/**
 * The golden audit of `statementItemsSample`, worked out by hand from the CSV: what
 * `detectSubscriptions` (M3) must return for it with the catalogue (M4) and the classes the keyword
 * rules assign. Five findings: four monthly charges seen five times (Planet Fitness $24.99, Netflix
 * $17.99, Spotify $11.99, Apple $2.99) and Amazon Prime, $139 a year seen once (a yearly charge cannot
 * be inferred from five months, so it is found through the catalogue). $69.54 a month, $834.52 a year;
 * without the catalogue Prime is absent and the totals are $57.96 and $695.52.
 *
 * It fixes what the catalogue must say (M4): service ids `planet-fitness`, `netflix`, `spotify` and
 * `amazon-prime`, with categories fitness, video, music and, for the Prime bundle, `other` (a `video`
 * category would put Netflix and Prime in an `overlap`). The Apple line matches an `ambiguous` entry, so
 * it has no service id and category `other`. Finding ids are the merchantKey as a lower-case slug.
 */
export const subscriptionsExpected: Readonly<SubscriptionAudit> = deepFreeze(SubscriptionAuditSchema.parse(subscriptionsExpectedJson));
