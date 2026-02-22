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
    INSERT INTO expenses (vehicle_id, date, amount_zmw, category, description, source_table, source_id)
    VALUES (NEW.vehicle_id, NEW.date, NEW.cost_zmw, 'service', NEW.description, 'service_history', NEW.id);

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE expenses SET
      amount_zmw  = NEW.cost_zmw,
      date        = NEW.date,
      description = NEW.description
    WHERE source_table = 'service_history' AND source_id = OLD.id;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM expenses WHERE source_table = 'service_history' AND source_id = OLD.id;
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
    INSERT INTO expenses (vehicle_id, date, amount_zmw, category, description, source_table, source_id)
    VALUES (NEW.vehicle_id, NEW.date, NEW.cost_zmw, 'tyre', v_desc, 'tyre_changes', NEW.id);

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE expenses SET
      amount_zmw  = NEW.cost_zmw,
      date        = NEW.date,
      description = v_desc
    WHERE source_table = 'tyre_changes' AND source_id = OLD.id;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM expenses WHERE source_table = 'tyre_changes' AND source_id = OLD.id;
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
    INSERT INTO expenses (vehicle_id, date, amount_zmw, category, description, source_table, source_id)
    VALUES (NEW.vehicle_id, NEW.issued_date, NEW.cost_zmw, 'licensing',
            replace(NEW.license_type, '_', ' '),
            'licensing', NEW.id);

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE expenses SET
      amount_zmw  = NEW.cost_zmw,
      date        = NEW.issued_date,
      description = replace(NEW.license_type, '_', ' ')
    WHERE source_table = 'licensing' AND source_id = OLD.id;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM expenses WHERE source_table = 'licensing' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_license_to_expense
AFTER INSERT OR UPDATE OR DELETE ON licensing
FOR EACH ROW EXECUTE FUNCTION fn_license_to_expense();
