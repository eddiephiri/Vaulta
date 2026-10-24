-- One vehicle can belong to only one driver, including inactive drivers.
-- Unassign the previous driver explicitly before transferring a vehicle.
-- Run this query first to identify any existing conflicts:
-- SELECT vehicle_id, array_agg(name ORDER BY name) AS drivers
-- FROM public.drivers WHERE vehicle_id IS NOT NULL
-- GROUP BY vehicle_id HAVING count(*) > 1;

BEGIN;
-- Prevent concurrent assignment writes between the preflight and index creation.
LOCK TABLE public.drivers IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.drivers WHERE vehicle_id IS NOT NULL
        GROUP BY vehicle_id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Multiple drivers are assigned to the same vehicle.'
            USING HINT = 'Find duplicates using the query at the top of this migration, then unassign the incorrect drivers in the app and rerun. No assignments were changed.';
    END IF;
END $$;

-- Multiple NULLs remain allowed for drivers without an assigned vehicle.
-- A unique index also rejects competing saves from different admin sessions.
CREATE UNIQUE INDEX IF NOT EXISTS drivers_vehicle_id_unique
    ON public.drivers (vehicle_id) WHERE vehicle_id IS NOT NULL;
COMMIT;
