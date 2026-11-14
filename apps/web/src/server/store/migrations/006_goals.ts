import type { Migration } from './types';
/** Nullable additive field: older builds keep reading and writing their existing columns. */
export const m006Goals: Migration = {
  version: 6,
  name: 'session_goals',
  sql: `ALTER TABLE sessions ADD COLUMN goal jsonb CHECK (goal IS NULL OR jsonb_typeof(goal) = 'object');`,
};
