-- =============================================================================
-- Security Hardening Migrations
-- Run in Supabase SQL Editor AFTER reviewing and adjusting to your needs.
-- =============================================================================

-- ─── C-01 prep: Verify sign-up is disabled ──────────────────────────────────
-- Go to Supabase Dashboard → Authentication → Settings → Toggle OFF "Enable sign-up"
-- This prevents anyone from creating their own account.

-- ─── H-02: Tighten RLS with user_id (future multi-user readiness) ───────────
-- For single-admin apps, pinning to a specific user UUID is the safest approach.
-- Replace 'YOUR-ADMIN-USER-UUID' with your actual auth.uid() from the users table.
-- You can find it in Supabase Dashboard → Authentication → Users → copy the UID.

-- Option A: Pin to a single admin UUID (recommended for single-admin)
-- Uncomment and run after replacing the UUID:

-- DROP POLICY IF EXISTS "Authenticated full access — vehicles" ON public.vehicles;
-- CREATE POLICY "Admin-only access — vehicles"
--     ON public.vehicles FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — service_history" ON public.service_history;
-- CREATE POLICY "Admin-only access — service_history"
--     ON public.service_history FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — tyre_changes" ON public.tyre_changes;
-- CREATE POLICY "Admin-only access — tyre_changes"
--     ON public.tyre_changes FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — licensing" ON public.licensing;
-- CREATE POLICY "Admin-only access — licensing"
--     ON public.licensing FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — income" ON public.income;
-- CREATE POLICY "Admin-only access — income"
--     ON public.income FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — expenses" ON public.expenses;
-- CREATE POLICY "Admin-only access — expenses"
--     ON public.expenses FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — drivers" ON public.drivers;
-- CREATE POLICY "Admin-only access — drivers"
--     ON public.drivers FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — cashing_schedules" ON public.cashing_schedules;
-- CREATE POLICY "Admin-only access — cashing_schedules"
--     ON public.cashing_schedules FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- DROP POLICY IF EXISTS "Authenticated full access — expected_cashings" ON public.expected_cashings;
-- CREATE POLICY "Admin-only access — expected_cashings"
--     ON public.expected_cashings FOR ALL
--     USING (auth.uid() = 'YOUR-ADMIN-USER-UUID')
--     WITH CHECK (auth.uid() = 'YOUR-ADMIN-USER-UUID');


-- ─── H-03: Explicitly set SECURITY INVOKER on trigger functions ─────────────
-- This is for clarity and defense-in-depth.

CREATE OR REPLACE FUNCTION fn_service_to_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO expenses (vehicle_id, date, amount_zmw, category, description, source_table, source_id)
    VALUES (NEW.vehicle_id, NEW.date, NEW.cost_zmw, 'service', NEW.description, 'service_history', NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE expenses SET amount_zmw = NEW.cost_zmw, date = NEW.date, description = NEW.description
    WHERE source_table = 'service_history' AND source_id = OLD.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM expenses WHERE source_table = 'service_history' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tyre_to_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_desc TEXT;
BEGIN
  v_desc := trim(coalesce(NEW.brand, '') || ' ' || coalesce(NEW.tyre_size, '') || ' (' || replace(NEW.position, '_', ' ') || ')');
  IF TG_OP = 'INSERT' THEN
    INSERT INTO expenses (vehicle_id, date, amount_zmw, category, description, source_table, source_id)
    VALUES (NEW.vehicle_id, NEW.date, NEW.cost_zmw, 'tyre', v_desc, 'tyre_changes', NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE expenses SET amount_zmw = NEW.cost_zmw, date = NEW.date, description = v_desc
    WHERE source_table = 'tyre_changes' AND source_id = OLD.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM expenses WHERE source_table = 'tyre_changes' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_license_to_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO expenses (vehicle_id, date, amount_zmw, category, description, source_table, source_id)
    VALUES (NEW.vehicle_id, NEW.issued_date, NEW.cost_zmw, 'licensing',
            replace(NEW.license_type, '_', ' '), 'licensing', NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE expenses SET amount_zmw = NEW.cost_zmw, date = NEW.issued_date,
           description = replace(NEW.license_type, '_', ' ')
    WHERE source_table = 'licensing' AND source_id = OLD.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM expenses WHERE source_table = 'licensing' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


-- ─── M-04: Validate document_url to HTTPS only ─────────────────────────────
ALTER TABLE public.licensing
    DROP CONSTRAINT IF EXISTS chk_document_url;

ALTER TABLE public.licensing
    ADD CONSTRAINT chk_document_url
    CHECK (document_url IS NULL OR document_url ~ '^https://');
