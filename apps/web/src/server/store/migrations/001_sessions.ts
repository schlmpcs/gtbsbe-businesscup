import type { Migration } from './types';

// Sessions (T4, POST /api/session): the profile and wishlist saved under an anonymous id.
//
// anon_key is sha256(anonId) in hex (../anonKey.ts). The raw id works like a password for the
// saved profile, so the database never holds it. `revision` counts saves; every save takes the
// row lock (SELECT … FOR UPDATE), so two saves for one id never interleave.
export const m001Sessions: Migration = {
  version: 1,
  name: 'sessions',
  sql: `
CREATE TABLE sessions (
  anon_key   text PRIMARY KEY CHECK (anon_key ~ '^[0-9a-f]{64}$'),
  profile    jsonb CHECK (profile IS NULL OR jsonb_typeof(profile) = 'object'),
  wishlist   jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(wishlist) = 'array'),
  revision   integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`,
};
