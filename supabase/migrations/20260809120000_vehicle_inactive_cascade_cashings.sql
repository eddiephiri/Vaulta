-- =============================================================================
-- Vaulta — Cascade vehicle deactivation to cashing schedules
-- Run in Supabase SQL Editor.
--
-- Setting a vehicle's status to 'inactive' previously had no effect on its
-- cashing schedule: cashing_schedules.active and expected_cashings are both
-- independent of vehicles.status, so an inactive vehicle kept generating and
-- showing "pending"/"overdue" cashings in the Schedules UI indefinitely.
--
-- This trigger, when a vehicle transitions to 'inactive':
--   1. Deactivates any active cashing_schedules for that vehicle, so no
--      further expected_cashings get generated for it.
--   2. Cancels already-generated future pending expected_cashings for that
--      vehicle (expected_date >= today), so they stop appearing as due or
--      overdue. Past/recorded/resolved history is left untouched.
--
-- Reactivating a vehicle does NOT automatically re-enable its schedules —
-- that's a deliberate admin action (Cashing Schedules → New Schedule / edit),
-- since a schedule may have been intentionally deactivated for other reasons.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_vehicle_deactivate_cashings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'inactive' AND OLD.status IS DISTINCT FROM 'inactive' THEN
    UPDATE public.cashing_schedules
    SET active = false
    WHERE vehicle_id = NEW.id AND active = true;

    DELETE FROM public.expected_cashings
    WHERE vehicle_id = NEW.id
      AND status = 'pending'
      AND expected_date >= CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_vehicle_deactivate_cashings
AFTER UPDATE OF status ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION fn_vehicle_deactivate_cashings();
