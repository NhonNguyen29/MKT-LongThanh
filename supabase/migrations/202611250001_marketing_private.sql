-- Run once with an administrative connection before enabling the online app.
-- This schema must NOT be added to Supabase Data API exposed schemas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS saoviet_private;
REVOKE ALL ON SCHEMA saoviet_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS saoviet_private.mkt_state (
  id integer PRIMARY KEY CHECK (id = 1),
  body jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS saoviet_private.mkt_assets (
  name text PRIMARY KEY,
  content_type text NOT NULL,
  body bytea NOT NULL CHECK (octet_length(body) <= 4000000),
  sha256 text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saoviet_private.mkt_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE saoviet_private.mkt_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA saoviet_private FROM PUBLIC, anon, authenticated;
COMMIT;
