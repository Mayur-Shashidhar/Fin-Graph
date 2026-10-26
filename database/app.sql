BEGIN;
-- Keep update tokens distinct even for edits in the same millisecond. The pg
-- driver exposes Date values at millisecond precision, unlike TIMESTAMPTZ.
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = GREATEST(clock_timestamp(), OLD.updated_at + INTERVAL '1 millisecond');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TABLE IF NOT EXISTS investigation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  author VARCHAR(80) NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_alert ON investigation_notes(alert_id, created_at);
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  target_id UUID NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_id, created_at DESC);
CREATE TABLE IF NOT EXISTS transfer_requests (
  idempotency_key UUID PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_graph_projection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  snapshot JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
