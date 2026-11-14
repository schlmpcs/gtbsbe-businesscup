// Test helpers for the subscription audit (M5): a small catalogue, an in-memory stand-in for the
// tool's slice of the local store, a fake statement categorizer and a File made of CSV text.
// Everything the feature takes from outside (catalogue, store, categorizer, events) is faked here,
// never in the feature's own files.
import sampleStatementCsv from '@lifeguessr/data/fixtures/statement.sample.csv?raw';
import type { KnownService, ServiceCategory, StatementCategorizeResponse, StatementClass, StatementItem } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import type { CategorizeOptions } from '@/lib/api/statement';
import { ruleClass } from '@/server/statement/rules';
import type { SubscriptionsStore, SubscriptionsToolState } from '@/features/subscriptions/model/state';

type PlanSpec = [id: string, price: number, cadence?: 'monthly' | 'quarterly' | 'yearly'];

function service(
  id: string,
  name: string,
  category: ServiceCategory,
  matchers: string[],
  plans: PlanSpec[],
  extra: Partial<Pick<KnownService, 'ambiguous' | 'isEstimate' | 'priceYear'>> = {},
): KnownService {
  return {
    id, name, category, matchers,
    plans: plans.map(([planId, price, cadence = 'monthly']) => ({ id: planId, name: `${name} ${planId}`, price, cadence })),
    priceYear: extra.priceYear ?? 2026,
    source: { name: 'Test catalogue (public price pages)', year: 2026 },
    isEstimate: extra.isEstimate ?? true,
    ...(extra.ambiguous ? { ambiguous: true } : {}),
  };
}

/**
 * The catalogue the tests use. The ids and matchers that the sample statement needs are the ones the
 * golden audit fixes (M1/M3): netflix, spotify, planet-fitness, amazon-prime, and Apple as ambiguous.
 * Extra services cover a second plan, a quarterly plan, a free plan and a service the sample never charges.
 */
export const testCatalogue: readonly KnownService[] = [
  service('netflix', 'Netflix', 'video', ['NETFLIX', 'NETFLIX COM'], [['ads', 7.99], ['standard', 17.99], ['premium', 24.99]]),
  service('spotify', 'Spotify', 'music', ['SPOTIFY', 'SPOTIFY USA'], [['individual', 11.99], ['duo', 16.99]]),
  service('planet-fitness', 'Planet Fitness', 'fitness', ['PLANET FITNESS', 'PLANET FITNESS CLUB FEES'], [['black-card', 24.99]]),
  service('amazon-prime', 'Amazon Prime', 'other', ['AMAZON PRIME'], [['annual', 139, 'yearly'], ['monthly', 14.99]]),
  service('disney-plus', 'Disney+', 'video', ['DISNEY PLUS'], [['basic', 7.99]]),
  service('quarterly-gym', 'Quarterly Gym', 'fitness', ['QUARTERLY GYM'], [['quarter', 30, 'quarterly']]),
  service('free-tier', 'Free Tier Cloud', 'cloud', ['FREE TIER CLOUD'], [['free', 0]]),
  service('apple', 'Apple', 'other', ['APPLE COM BILL'], [['icloud', 0.99]], { ambiguous: true }),
];

/** A catalogue of `n` unambiguous services, for the 40-service cap. */
export function bigCatalogue(n: number): KnownService[] {
  return Array.from({ length: n }, (_, i) =>
    service(`svc-${String(i).padStart(2, '0')}`, `Service ${i}`, 'other', [`SERVICE ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`], [['basic', 5 + i]]));
}

/**
 * The class the keyword rules give each distinct label (what /api/statement/categorize returns in
 * `classes` on its no-API-key path, and what the golden audit of M3 runs on).
 */
export function ruleClasses(items: readonly StatementItem[]): { label: string; class: StatementClass }[] {
  const direction = new Map<string, 'in' | 'out'>();
  for (const item of items) if (item.amount > 0 || !direction.has(item.label)) direction.set(item.label, item.amount > 0 ? 'out' : 'in');
  return [...direction].map(([label, dir]) => ({ label, class: ruleClass(label, dir).cls }));
}

/** A statement categorizer that answers without a network: no months, the given classes (rules classes by default). */
export function fakeCategorize(
  classesOf: (items: readonly StatementItem[]) => StatementCategorizeResponse['classes'] = ruleClasses,
) {
  const calls: { items: readonly StatementItem[]; opts: CategorizeOptions | undefined }[] = [];
  const fn = async (items: readonly StatementItem[], opts?: CategorizeOptions): Promise<StatementCategorizeResponse> => {
    calls.push({ items, opts });
    return { months: [], categorizedBy: 'rules', classes: classesOf(items) };
  };
  return Object.assign(fn, { calls });
}

/** The sample bank statement (170 lines, July to 12 November 2026) as a file, named like a real export. */
export const sampleStatementFile = (): File => new File([sampleStatementCsv], 'Chase1234_Activity.CSV', { type: 'text/csv' });

/** A CSV file with `lines` as 'YYYY-MM-DD,LABEL,-amount' rows (money out is negative). */
export function csvFile(lines: readonly string[], name = 'statement.csv'): File {
  return new File([['Date,Description,Amount', ...lines].join('\n')], name, { type: 'text/csv' });
}

/**
 * An in-memory stand-in for the tool's slice of the local store: React state with the store's
 * three operations. Call it inside the hook under test; `saves` records every state it was given.
 */
export function useMemoryStore(initial?: SubscriptionsToolState): SubscriptionsStore & { saves: SubscriptionsToolState[] } {
  const [state, setState] = useState<SubscriptionsToolState | undefined>(initial);
  const [saves] = useState<SubscriptionsToolState[]>([]);
  const save = useCallback((next: SubscriptionsToolState) => {
    saves.push(next);
    setState(next);
  }, [saves]);
  const clear = useCallback(() => setState(undefined), []);
  return useMemo(() => ({ state, save, clear, saves }), [state, save, clear, saves]);
}
