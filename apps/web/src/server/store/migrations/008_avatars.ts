import type { Migration } from './types';
export const m008Avatars: Migration = {
  version: 8,
  name: 'avatars',
  sql: `
CREATE TABLE avatars (
 avatar_id text PRIMARY KEY CHECK (avatar_id ~ '^[A-Za-z0-9_-]{22}$'),
 owner_key text NOT NULL UNIQUE CHECK (owner_key ~ '^[0-9a-f]{64}$'),
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
 stamp text NOT NULL CHECK (stamp IN ('selfReported','statementVerified')),
 published_on date NOT NULL, expires_on date NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX avatars_expires_on ON avatars(expires_on);
`,
};
