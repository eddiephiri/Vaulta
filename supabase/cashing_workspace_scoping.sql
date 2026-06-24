-- ============================================================
--  Vaulta — Workspace-Scope the Cashing Tables
--  Run in Supabase SQL Editor AFTER:
--    drivers_and_schedules.sql, anchor_date_migration.sql,
--    modular_erp_phase1.sql, phase4_security_rbac.sql,
--    guest_granular_permissions.sql
--
--  Brings `cashing_schedules` and `expected_cashings` in line with
--  `vehicles`/`drivers`: tenant-isolated via workspace_id + RLS using
--  the transport app's access helpers. Both tables have a NOT NULL
--  vehicle_id, so workspace ownership is derived from the vehicle —
--  no orphan rows are possible.
-- ============================================================

-- ─── 1. SCHEMA: add workspace_id (nullable for now, backfill follows) ─────────
ALTER TABLE public.cashing_schedules
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.expected_cashings
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ─── 2. BACKFILL from the owning vehicle ──────────────────────────────────────
UPDATE public.cashing_schedules cs
SET workspace_id = v.workspace_id
FROM public.vehicles v
WHERE cs.vehicle_id = v.id
  AND cs.workspace_id IS NULL;

UPDATE public.expected_cashings ec
SET workspace_id = v.workspace_id
FROM public.vehicles v
WHERE ec.vehicle_id = v.id
  AND ec.workspace_id IS NULL;

-- ─── 3. INDEX & NOT NULL ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS cashing_schedules_workspace_id_idx ON public.cashing_schedules (workspace_id);
CREATE INDEX IF NOT EXISTS expected_cashings_workspace_id_idx ON public.expected_cashings (workspace_id);

-- Enforce NOT NULL only when fully backfilled. A row can only remain NULL if its
-- vehicle had a NULL workspace_id (pre-existing data issue) — surface that rather
-- than failing the whole migration.
DO $$
DECLARE
  v_cs INTEGER;
  v_ec INTEGER;
BEGIN
  SELECT count(*) INTO v_cs FROM public.cashing_schedules WHERE workspace_id IS NULL;
  IF v_cs = 0 THEN
    ALTER TABLE public.cashing_schedules ALTER COLUMN workspace_id SET NOT NULL;
  ELSE
    RAISE WARNING 'Skipping NOT NULL on cashing_schedules.workspace_id: % row(s) still NULL (vehicle lacks workspace_id).', v_cs;
  END IF;

  SELECT count(*) INTO v_ec FROM public.expected_cashings WHERE workspace_id IS NULL;
  IF v_ec = 0 THEN
    ALTER TABLE public.expected_cashings ALTER COLUMN workspace_id SET NOT NULL;
  ELSE
    RAISE WARNING 'Skipping NOT NULL on expected_cashings.workspace_id: % row(s) still NULL (vehicle lacks workspace_id).', v_ec;
  END IF;
END;
$$;

-- ─── 4. ROW LEVEL SECURITY ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated full access — cashing_schedules" ON public.cashing_schedules;
DROP POLICY IF EXISTS "Workspace Members Only — cashing_schedules" ON public.cashing_schedules;

CREATE POLICY "Workspace Members Only — cashing_schedules"
ON public.cashing_schedules
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

DROP POLICY IF EXISTS "Authenticated full access — expected_cashings" ON public.expected_cashings;
DROP POLICY IF EXISTS "Workspace Members Only — expected_cashings" ON public.expected_cashings;

CREATE POLICY "Workspace Members Only — expected_cashings"
ON public.expected_cashings
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- ─── 5. KEEP generate_expected_cashings() WORKSPACE-AWARE ─────────────────────
-- Re-defines the anchor_date_migration.sql version so generated rows carry the
-- schedule's workspace_id. Without this the INSERT below produces NULL
-- workspace_id rows that the new WITH CHECK policy would reject.
CREATE OR REPLACE FUNCTION public.generate_expected_cashings(
    p_schedule_id uuid,
    p_weeks       int DEFAULT 12
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_schedule        public.cashing_schedules%ROWTYPE;
    v_anchor          date;
    v_base            date;
    v_candidate       date;
    v_days_since      int;
    v_week_in_cycle   int;
    i                 int;
BEGIN
    SELECT * INTO v_schedule FROM public.cashing_schedules WHERE id = p_schedule_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule % not found', p_schedule_id;
    END IF;

    -- ── Determine anchor date ──────────────────────────────────────────────
    -- Priority: explicit anchor_date → schedule created_at (cast to date)
    v_anchor := COALESCE(v_schedule.anchor_date, v_schedule.created_at::date);

    -- ── Delete any existing PENDING future rows for this schedule ──────────
    -- (so we can safely re-generate without duplicates)
    DELETE FROM public.expected_cashings
    WHERE schedule_id = p_schedule_id
      AND status = 'pending'
      AND expected_date >= CURRENT_DATE;

    -- ── Generate p_weeks upcoming cashing dates ────────────────────────────
    FOR i IN 1..p_weeks LOOP

        -- Base date for this iteration = today + (i-1) weeks
        v_base := CURRENT_DATE + ((i - 1) * 7);

        IF v_schedule.cashing_day_of_week IS NOT NULL THEN
            -- Snap forward to the next occurrence of the target weekday
            v_candidate := v_base + (
                (v_schedule.cashing_day_of_week
                 - EXTRACT(DOW FROM v_base)::int + 7) % 7
            )::int;
        ELSE
            -- No fixed weekday — just use the base date
            v_candidate := v_base;
        END IF;

        -- ── Week-in-cycle derived from anchor, not loop index ──────────────
        v_days_since    := v_candidate - v_anchor;
        -- If the candidate is before the anchor (shouldn't normally happen
        -- but guard against negative mod in Postgres)
        IF v_days_since < 0 THEN
            -- Shift weeks backward until non-negative (cycle still aligns)
            v_days_since := v_days_since
                + ((ABS(v_days_since) / (v_schedule.cycle_weeks * 7) + 1)
                   * v_schedule.cycle_weeks * 7);
        END IF;

        v_week_in_cycle := (FLOOR(v_days_since::numeric / 7)::int
                            % v_schedule.cycle_weeks) + 1;

        INSERT INTO public.expected_cashings
            (vehicle_id, schedule_id, expected_date, is_salary_week, week_number, workspace_id)
        VALUES (
            v_schedule.vehicle_id,
            v_schedule.id,
            v_candidate,
            v_week_in_cycle = v_schedule.salary_week,
            v_week_in_cycle,
            v_schedule.workspace_id
        )
        ON CONFLICT DO NOTHING;

    END LOOP;
END;
$$;
