import type { Migration } from './types';

// The simulated Pro checkout (S15) adds a third way to be Pro: `demo_checkout`. Migration 002 limited
// `pro_entitlements.source` to ('stripe_test', 'demo'), so the check is widened here (fix forward,
// 002 is never edited). Postgres names a column check `<table>_<column>_check`; DROP without
// IF EXISTS on purpose, so a wrong name fails the migration instead of leaving the old check behind.
//
// Safe for a rollback: the previous build never writes `demo_checkout` and the wider check accepts
// everything it does write. A row it did not write (a demo_checkout one) is read by the previous
// build's browser code with the old source list, which shows an error on /pro for that one person,
// nothing worse.
export const m005ProDemoCheckout: Migration = {
  version: 5,
  name: 'pro_demo_checkout',
  sql: `
ALTER TABLE pro_entitlements DROP CONSTRAINT pro_entitlements_source_check;
ALTER TABLE pro_entitlements
  ADD CONSTRAINT pro_entitlements_source_check CHECK (source IN ('stripe_test', 'demo_checkout', 'demo'));
`,
};
