-- =============================================================================
-- Vaulta — Auto-Expense Triggers
-- Run once in Supabase SQL Editor.
-- These triggers keep the `expenses` table in sync with operational records
-- so users never need to double-enter a cost.
-- =============================================================================

-- Add source-tracking columns (idempotent)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS source_table TEXT,
  ADD COLUMN IF NOT EXISTS source_id   UUID;

-- =============================================================================
-- service_history → expenses (category = 'service')
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_service_to_expense()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO transactions (
      workspace_id, app_id, type, amount_zmw, date, description, reference_entity_id, metadata
    )
    SELECT
      v.workspace_id, 'transport', 'expense', NEW.cost_zmw, NEW.date, NEW.description, NEW.vehicle_id,
      jsonb_build_object('category', 'service', 'source_table', 'service_history', 'source_id', NEW.id)
    FROM vehicles v WHERE v.id = NEW.vehicle_id;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE transactions SET
      amount_zmw  = NEW.cost_zmw,
      date        = NEW.date,
      description = NEW.description
    WHERE type = 'expense' AND metadata->>'source_table' = 'service_history' AND metadata->>'source_id' = OLD.id::text;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM transactions WHERE type = 'expense' AND metadata->>'source_table' = 'service_history' AND metadata->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_service_to_expense
AFTER INSERT OR UPDATE OR DELETE ON service_history
FOR EACH ROW EXECUTE FUNCTION fn_service_to_expense();

-- =============================================================================
-- tyre_changes → expenses (category = 'tyre')
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_tyre_to_expense()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_desc TEXT;
BEGIN
  v_desc := trim(
    coalesce(NEW.brand, '') || ' ' ||
    coalesce(NEW.tyre_size, '') || ' (' ||
    replace(NEW.position, '_', ' ') || ')'
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO transactions (
      workspace_id, app_id, type, amount_zmw, date, description, reference_entity_id, metadata
    )
    SELECT
      v.workspace_id, 'transport', 'expense', NEW.cost_zmw, NEW.date, v_desc, NEW.vehicle_id,
      jsonb_build_object('category', 'tyre', 'source_table', 'tyre_changes', 'source_id', NEW.id)
    FROM vehicles v WHERE v.id = NEW.vehicle_id;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE transactions SET
      amount_zmw  = NEW.cost_zmw,
      date        = NEW.date,
      description = v_desc
    WHERE type = 'expense' AND metadata->>'source_table' = 'tyre_changes' AND metadata->>'source_id' = OLD.id::text;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM transactions WHERE type = 'expense' AND metadata->>'source_table' = 'tyre_changes' AND metadata->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_tyre_to_expense
AFTER INSERT OR UPDATE OR DELETE ON tyre_changes
FOR EACH ROW EXECUTE FUNCTION fn_tyre_to_expense();

-- =============================================================================
-- licensing → expenses (category = 'licensing')
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_license_to_expense()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO transactions (
      workspace_id, app_id, type, amount_zmw, date, description, reference_entity_id, metadata
    )
    SELECT
      v.workspace_id, 'transport', 'expense', NEW.cost_zmw, NEW.issued_date, replace(NEW.license_type, '_', ' '), NEW.vehicle_id,
      jsonb_build_object('category', 'licensing', 'source_table', 'licensing', 'source_id', NEW.id)
    FROM vehicles v WHERE v.id = NEW.vehicle_id;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE transactions SET
      amount_zmw  = NEW.cost_zmw,
      date        = NEW.issued_date,
      description = replace(NEW.license_type, '_', ' ')
    WHERE type = 'expense' AND metadata->>'source_table' = 'licensing' AND metadata->>'source_id' = OLD.id::text;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM transactions WHERE type = 'expense' AND metadata->>'source_table' = 'licensing' AND metadata->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_license_to_expense
AFTER INSERT OR UPDATE OR DELETE ON licensing
FOR EACH ROW EXECUTE FUNCTION fn_license_to_expense();
