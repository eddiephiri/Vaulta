-- ============================================================
--  Vaulta — Odometer / Mileage Tracking
--  Run in Supabase SQL Editor AFTER driver_portal_phase1.sql.
--
--  1. Creates odometer_readings table (per-submission log).
--  2. Trigger: after each INSERT, updates vehicles.odometer_km
--     ONLY when the new reading is higher than the current value.
--  3. RLS: drivers INSERT/SELECT own rows; admins full access.
--  4. Storage bucket + policies for odometer photos.
--  5. Helper RPC: driver_submit_odometer (safe, SECURITY DEFINER).
-- ============================================================

-- ─── 1. TABLE ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.odometer_readings (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    vehicle_id    uuid        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id     uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    reading_km    numeric     NOT NULL CHECK (reading_km >= 0),
    photo_url     text,
    notes         text,
    -- ISO week deduplication: YYYY-W## (e.g. '2026-W32')
    iso_week      text        NOT NULL,
    submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS odometer_readings_vehicle_id_idx  ON public.odometer_readings (vehicle_id);
CREATE INDEX IF NOT EXISTS odometer_readings_driver_id_idx   ON public.odometer_readings (driver_id);
CREATE INDEX IF NOT EXISTS odometer_readings_workspace_id_idx ON public.odometer_readings (workspace_id);
-- Enforce one submission per driver per ISO week
CREATE UNIQUE INDEX IF NOT EXISTS odometer_readings_driver_week_key
    ON public.odometer_readings (driver_id, iso_week);

ALTER TABLE public.odometer_readings ENABLE ROW LEVEL SECURITY;

-- ─── 2. TRIGGER: auto-update vehicle odometer ─────────────────────────────────
-- Only advances the odometer; lower values are silently ignored (i.e. the row
-- is still inserted as the history record but the vehicle's current km stays put).
-- The RPC below enforces a hard BLOCK on lower values at the application layer.

CREATE OR REPLACE FUNCTION public.sync_vehicle_odometer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.vehicles
    SET    odometer_km = NEW.reading_km,
           updated_at  = now()
    WHERE  id = NEW.vehicle_id
      AND  NEW.reading_km > odometer_km;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vehicle_odometer ON public.odometer_readings;
CREATE TRIGGER trg_sync_vehicle_odometer
    AFTER INSERT ON public.odometer_readings
    FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_odometer();

-- ─── 3. RLS POLICIES ─────────────────────────────────────────────────────────

-- Drivers: INSERT own readings.
DROP POLICY IF EXISTS "Drivers insert own odometer readings" ON public.odometer_readings;
CREATE POLICY "Drivers insert own odometer readings"
ON public.odometer_readings FOR INSERT
WITH CHECK (
    driver_id    = public.current_driver_id()
    AND vehicle_id = (SELECT vehicle_id FROM public.drivers WHERE id = public.current_driver_id())
);

-- Drivers: SELECT own readings.
DROP POLICY IF EXISTS "Drivers view own odometer readings" ON public.odometer_readings;
CREATE POLICY "Drivers view own odometer readings"
ON public.odometer_readings FOR SELECT
USING (driver_id = public.current_driver_id());

-- Admins: full access within their workspace.
DROP POLICY IF EXISTS "Admins manage odometer readings" ON public.odometer_readings;
CREATE POLICY "Admins manage odometer readings"
ON public.odometer_readings FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- ─── 4. STORAGE: odometer-photos bucket ──────────────────────────────────────
-- Path convention: '<workspace_id>/<driver_id>/<filename>'
-- NOTE: You must also create the bucket manually in the Supabase Dashboard:
--   Storage → New Bucket → Name: "odometer-photos", Public: OFF

INSERT INTO storage.buckets (id, name, public)
VALUES ('odometer-photos', 'odometer-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Drivers upload to their own path prefix.
DROP POLICY IF EXISTS "Drivers upload odometer photos (storage)" ON storage.objects;
CREATE POLICY "Drivers upload odometer photos (storage)"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'odometer-photos'
    AND (storage.foldername(name))[2] = public.current_driver_id()::text
);

-- Drivers read their own photos.
DROP POLICY IF EXISTS "Drivers read own odometer photos (storage)" ON storage.objects;
CREATE POLICY "Drivers read own odometer photos (storage)"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'odometer-photos'
    AND (storage.foldername(name))[2] = public.current_driver_id()::text
);

-- Admins full access for their workspace.
DROP POLICY IF EXISTS "Admins manage odometer photos (storage)" ON storage.objects;
CREATE POLICY "Admins manage odometer photos (storage)"
ON storage.objects FOR ALL
USING (
    bucket_id = 'odometer-photos'
    AND public.has_app_access(((storage.foldername(name))[1])::uuid, 'transport')
)
WITH CHECK (
    bucket_id = 'odometer-photos'
    AND public.has_app_write_access(((storage.foldername(name))[1])::uuid, 'transport')
);

-- ─── 5. RPC: driver_submit_odometer ──────────────────────────────────────────
-- Safe, SECURITY DEFINER function — drivers call this instead of a direct INSERT.
-- Enforces:
--   • Driver must be linked to a vehicle.
--   • New reading must be >= vehicle's current odometer_km (strict block).
--   • Only one submission per ISO week (upsert via the unique index).
--
-- Returns: 'ok' on success, or raises an exception with a user-friendly message.

CREATE OR REPLACE FUNCTION public.driver_submit_odometer(
    p_reading_km  numeric,
    p_photo_url   text    DEFAULT NULL,
    p_notes       text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver      public.drivers%ROWTYPE;
    v_vehicle     public.vehicles%ROWTYPE;
    v_iso_week    text;
BEGIN
    -- Resolve calling driver.
    SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No driver profile linked to this account.';
    END IF;

    IF v_driver.vehicle_id IS NULL THEN
        RAISE EXCEPTION 'No vehicle is assigned to you yet.';
    END IF;

    -- Load current vehicle odometer.
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_driver.vehicle_id;

    -- Strict validation: reading must be >= current odometer.
    IF p_reading_km < v_vehicle.odometer_km THEN
        RAISE EXCEPTION 'Reading (% km) is lower than the vehicle''s current odometer (% km). Please check and try again.',
            p_reading_km, v_vehicle.odometer_km;
    END IF;

    -- Compute ISO week label: e.g. '2026-W32'
    v_iso_week := to_char(now() AT TIME ZONE 'Africa/Harare', 'IYYY"-W"IW');

    -- Insert (or update if driver re-submits within the same week).
    INSERT INTO public.odometer_readings
        (workspace_id, vehicle_id, driver_id, reading_km, photo_url, notes, iso_week)
    VALUES
        (v_driver.workspace_id, v_driver.vehicle_id, v_driver.id,
         p_reading_km, p_photo_url, p_notes, v_iso_week)
    ON CONFLICT (driver_id, iso_week)
    DO UPDATE SET
        reading_km   = EXCLUDED.reading_km,
        photo_url    = EXCLUDED.photo_url,
        notes        = EXCLUDED.notes,
        submitted_at = now();
END;
$$;
