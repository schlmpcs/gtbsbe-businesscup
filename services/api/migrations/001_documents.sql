-- JSON documents are individually locked for atomic read/modify/write operations.
CREATE TABLE IF NOT EXISTS lifeguessr_documents (
 key text PRIMARY KEY,
 value jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Application roles must not expose this table through Supabase browser APIs.
ALTER TABLE lifeguessr_documents ENABLE ROW LEVEL SECURITY;
