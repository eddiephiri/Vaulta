-- ============================================================
--  Vaulta — Transport RLS Hardening (prerequisite for driver logins)
--  Run in Supabase SQL Editor AFTER:
--    schema.sql, modular_erp_phase1.sql, phase4_security_rbac.sql,
--    guest_granular_permissions.sql
--
--  Closes a pre-existing hole: service_history, tyre_changes, licensing,
--  and the legacy income/expenses tables still carried the original
--  "Authenticated full access" policy, so ANY authenticated user could
--  read/write them across every workspace. This scopes the live child
--  tables to the transport app (matching vehicles) and locks the unused
--  legacy tables. Must run before any driver account exists.
-- ============================================================

-- ─── 1. SERVICE_HISTORY (already has workspace_id from phase1) ────────────────
UPDATE public.service_history sh
SET workspace_id = v.workspace_id
FROM public.vehicles v
WHERE sh.vehicle_id = v.id AND sh.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS service_history_workspace_id_idx ON public.service_history (workspace_id);

DROP POLICY IF EXISTS "Authenticated full access — service_history" ON public.service_history;
DROP POLICY IF EXISTS "Workspace Members Only — service_history" ON public.service_history;
CREATE POLICY "Workspace Members Only — service_history"
ON public.service_history
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- ─── 2. TYRE_CHANGES (needs workspace_id) ─────────────────────────────────────
ALTER TABLE public.tyre_changes
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.tyre_changes tc
SET workspace_id = v.workspace_id
FROM public.vehicles v
WHERE tc.vehicle_id = v.id AND tc.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS tyre_changes_workspace_id_idx ON public.tyre_changes (workspace_id);

DROP POLICY IF EXISTS "Authenticated full access — tyre_changes" ON public.tyre_changes;
DROP POLICY IF EXISTS "Workspace Members Only — tyre_changes" ON public.tyre_changes;
CREATE POLICY "Workspace Members Only — tyre_changes"
ON public.tyre_changes
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- ─── 3. LICENSING (needs workspace_id) ────────────────────────────────────────
ALTER TABLE public.licensing
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.licensing l
SET workspace_id = v.workspace_id
FROM public.vehicles v
WHERE l.vehicle_id = v.id AND l.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS licensing_workspace_id_idx ON public.licensing (workspace_id);

DROP POLICY IF EXISTS "Authenticated full access — licensing" ON public.licensing;
DROP POLICY IF EXISTS "Workspace Members Only — licensing" ON public.licensing;
CREATE POLICY "Workspace Members Only — licensing"
ON public.licensing
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- ─── 4. NOT NULL once backfilled (skipped if any vehicle lacked workspace_id) ─
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.service_history WHERE workspace_id IS NULL;
  IF n = 0 THEN ALTER TABLE public.service_history ALTER COLUMN workspace_id SET NOT NULL;
  ELSE RAISE WARNING 'service_history: % row(s) still NULL workspace_id; NOT NULL skipped.', n; END IF;

  SELECT count(*) INTO n FROM public.tyre_changes WHERE workspace_id IS NULL;
  IF n = 0 THEN ALTER TABLE public.tyre_changes ALTER COLUMN workspace_id SET NOT NULL;
  ELSE RAISE WARNING 'tyre_changes: % row(s) still NULL workspace_id; NOT NULL skipped.', n; END IF;

  SELECT count(*) INTO n FROM public.licensing WHERE workspace_id IS NULL;
  IF n = 0 THEN ALTER TABLE public.licensing ALTER COLUMN workspace_id SET NOT NULL;
  ELSE RAISE WARNING 'licensing: % row(s) still NULL workspace_id; NOT NULL skipped.', n; END IF;
END;
$$;

-- ─── 5. LEGACY income / expenses (unused by the app — lock them down) ──────────
-- The app moved to the public.transactions ledger; these tables are no longer
-- read or written by the client. Dropping their permissive policy leaves RLS
-- enabled with no policy = deny-all to API roles. Existing rows are preserved
-- and remain reachable via the service role / SQL editor for historical export.
DROP POLICY IF EXISTS "Authenticated full access — income" ON public.income;
DROP POLICY IF EXISTS "Authenticated full access — expenses" ON public.expenses;
