-- Additive graph migration. Apply AFTER schema.sql. Safe to re-run.
BEGIN;
CREATE TABLE IF NOT EXISTS graph_outbox (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ACCOUNT', 'TRANSACTION')),
  entity_id UUID NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED', 'DEAD')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  PRIMARY KEY (entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_graph_outbox_pending ON graph_outbox(available_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE OR REPLACE FUNCTION enqueue_graph_entity(kind TEXT, entity UUID) RETURNS VOID AS $$
BEGIN
  INSERT INTO graph_outbox(entity_type, entity_id) VALUES (kind, entity)
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    version = graph_outbox.version + 1, status = 'PENDING', attempts = 0,
    available_at = NOW(), updated_at = NOW(), last_error = NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION graph_entity_changed() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM enqueue_graph_entity(TG_ARGV[0], OLD.id);
    RETURN OLD;
  END IF;
  PERFORM enqueue_graph_entity(TG_ARGV[0], NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_graph_account ON accounts;
CREATE TRIGGER trg_graph_account AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION graph_entity_changed('ACCOUNT');
DROP TRIGGER IF EXISTS trg_graph_transaction ON transactions;
CREATE TRIGGER trg_graph_transaction AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION graph_entity_changed('TRANSACTION');

CREATE OR REPLACE FUNCTION graph_customer_changed() RETURNS TRIGGER AS $$
DECLARE account_record RECORD;
BEGIN
  FOR account_record IN SELECT id FROM accounts WHERE customer_id = NEW.id LOOP
    PERFORM enqueue_graph_entity('ACCOUNT', account_record.id);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_graph_customer ON customers;
CREATE TRIGGER trg_graph_customer AFTER UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION graph_customer_changed();

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS detection_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_detection_fingerprint ON alerts(detection_fingerprint);
CREATE TABLE IF NOT EXISTS graph_detection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Bootstrap existing data; triggers capture all subsequent committed changes.
INSERT INTO graph_outbox(entity_type, entity_id) SELECT 'ACCOUNT', id FROM accounts ON CONFLICT DO NOTHING;
INSERT INTO graph_outbox(entity_type, entity_id) SELECT 'TRANSACTION', id FROM transactions ON CONFLICT DO NOTHING;
COMMIT;
