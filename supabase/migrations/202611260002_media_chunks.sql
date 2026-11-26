BEGIN;
CREATE TABLE IF NOT EXISTS saoviet_private.mkt_media_chunks (
  media_id text NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  body bytea NOT NULL CHECK (octet_length(body) <= 3500000),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, chunk_index)
);
ALTER TABLE saoviet_private.mkt_media_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE saoviet_private.mkt_media_chunks FROM PUBLIC, anon, authenticated;
COMMIT;
