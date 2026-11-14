import type { Migration } from './types';

// "Together" shared plans (server/store/together.ts). Keyed by the random plan id (the link), not
// by anon_key: a plan belongs to no one, it is shared by whoever holds the link. Only the numbers
// the household math needs are stored (TogetherPartnerSchema), and every plan expires.
export const m009TogetherPlans: Migration = {
  version: 9,
  name: 'together_plans',
  sql: `
CREATE TABLE together_plans (
  plan_id    text PRIMARY KEY CHECK (plan_id ~ '^[A-Za-z0-9_-]{22}$'),
  partner1   jsonb NOT NULL CHECK (jsonb_typeof(partner1) = 'object'),
  partner2   jsonb CHECK (partner2 IS NULL OR jsonb_typeof(partner2) = 'object'),
  goal       jsonb CHECK (goal IS NULL OR jsonb_typeof(goal) = 'object'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX together_plans_expires_at ON together_plans (expires_at);
`,
};
