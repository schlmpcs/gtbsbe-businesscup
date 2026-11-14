import type { Migration } from './types';

// Pro entitlements (S15), moved from the JSON-file stopgap (server/pro/store.ts) onto the store.
// Same rules as the file: anonymous ids are kept as sha256 hashes; a Checkout Session unlocks Pro
// for exactly one id (the primary key on session_id makes the claim atomic).
export const m002ProEntitlements: Migration = {
  version: 2,
  name: 'pro_entitlements',
  sql: `
CREATE TABLE pro_entitlements (
  anon_key   text PRIMARY KEY CHECK (anon_key ~ '^[0-9a-f]{64}$'),
  source     text NOT NULL CHECK (source IN ('stripe_test', 'demo')),
  plan       text CHECK (plan IN ('yearly', 'monthly')),
  since      timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pro_checkout_sessions (
  session_id text PRIMARY KEY,
  anon_key   text NOT NULL CHECK (anon_key ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz NOT NULL DEFAULT now()
);
`,
};
