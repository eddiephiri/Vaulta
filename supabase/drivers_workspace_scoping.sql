-- ============================================================
--  Vaulta — Workspace-Scope the Drivers Table
--  Run in Supabase SQL Editor AFTER:
--    drivers_and_schedules.sql, modular_erp_phase1.sql,
--    phase4_security_rbac.sql, guest_granular_permissions.sql
--
--  Brings `drivers` in line with `vehicles`: tenant-isolated via
--  workspace_id + RLS using the transport app's access helpers.
--  Before this, the table used "Authenticated full access", so any
--  logged-in user could read/write every workspace's drivers.
-- ============================================================

-- ─── 1. SCHEMA: add workspace_id (nullable for now, backfill follows) ─────────
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ─── 2. BACKFILL ──────────────────────────────────────────────────────────────

-- 2a. Drivers assigned to a vehicle inherit that vehicle's workspace.
UPDATE public.drivers d
SET workspace_id = v.workspace_id
FROM public.vehicles v
WHERE d.vehicle_id = v.id
  AND d.workspace_id IS NULL
  AND v.workspace_id IS NOT NULL;

-- 2b. Orphan drivers (no vehicle, or vehicle had no workspace): only safe to
-- auto-assign when the database has exactly ONE workspace (single-tenant
-- install). In a multi-workspace install we cannot infer ownership, so we
-- leave them NULL and emit a notice for manual assignment.
DO $$
DECLARE
  v_ws_count INTEGER;
  v_ws_id    UUID;
  v_orphans  INTEGER;
BEGIN
  SELECT count(*) INTO v_orphans FROM public.drivers WHERE workspace_id IS NULL;
  IF v_orphans = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_ws_count FROM public.workspaces;

  IF v_ws_count = 1 THEN
    SELECT id INTO v_ws_id FROM public.workspaces LIMIT 1;
    UPDATE public.drivers SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    RAISE NOTICE 'Assigned % orphan driver(s) to the sole workspace %.', v_orphans, v_ws_id;
  ELSE
    RAISE WARNING '% driver(s) have no workspace_id and % workspaces exist. '
      'Assign them manually, e.g. UPDATE public.drivers SET workspace_id = ''<id>'' WHERE id = ''<driver_id>'';',
      v_orphans, v_ws_count;
  END IF;
END;
$$;

-- ─── 3. CONSTRAINTS & INDEX ─────────────────────────────────────────────────────

-- Index the new FK for RLS/lookup performance.
CREATE INDEX IF NOT EXISTS drivers_workspace_id_idx ON public.drivers (workspace_id);

-- Enforce NOT NULL only once every row is backfilled. If orphans remain
-- (multi-workspace install — see 2b), this is skipped; re-run after manual
-- assignment to lock it in.
DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT count(*) INTO v_remaining FROM public.drivers WHERE workspace_id IS NULL;
  IF v_remaining = 0 THEN
    ALTER TABLE public.drivers ALTER COLUMN workspace_id SET NOT NULL;
  ELSE
    RAISE WARNING 'Skipping NOT NULL on drivers.workspace_id: % row(s) still NULL.', v_remaining;
  END IF;
END;
$$;

-- ─── 4. ROW LEVEL SECURITY ──────────────────────────────────────────────────────

-- Drop the old permissive policy.
DROP POLICY IF EXISTS "Authenticated full access — drivers" ON public.drivers;

-- Members/owners/admins: full access. Guests: read+write gated on their
-- authorized/editable transport-app grants — mirrors the vehicles policy.
DROP POLICY IF EXISTS "Workspace Members Only — drivers" ON public.drivers;

CREATE POLICY "Workspace Members Only — drivers"
ON public.drivers
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));
