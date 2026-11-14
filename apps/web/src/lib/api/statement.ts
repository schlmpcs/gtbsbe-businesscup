// Client for POST /api/statement/categorize (T7, apps/web/app/api/statement/categorize/route.ts):
//   { items: StatementItem[] } → 200 { ok: true, months: CategoryTotals[], categorizedBy }
// The items carry only masked labels, amounts, months and days (toStatementItems). The reply is
// validated with the shared contract schema.
import {
  StatementCategorizeResponseSchema, type StatementCategorizeResponse, type StatementItem,
} from '@lifeguessr/types';
import { postJson } from './http';

export type CategorizeOptions = { anonId?: string; signal?: AbortSignal };

export async function categorizeStatement(
  items: readonly StatementItem[],
  opts: CategorizeOptions = {},
): Promise<StatementCategorizeResponse> {
  const res = await postJson('/api/statement/categorize', { items }, StatementCategorizeResponseSchema, opts);
  return { months: res.months, categorizedBy: res.categorizedBy, ...(res.classes && {classes:res.classes}) };
}
