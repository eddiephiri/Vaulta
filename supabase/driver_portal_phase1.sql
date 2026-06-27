-- ============================================================
--  Vaulta — Driver Portal, Phase 1 (data model + RLS + storage)
--  Run in Supabase SQL Editor AFTER:
--    drivers_and_schedules.sql, drivers_workspace_scoping.sql,
--    cashing_workspace_scoping.sql, transport_rls_hardening.sql,
--    phase4_security_rbac.sql, guest_granular_permissions.sql
--
--  Foundation for driver logins. Drivers are identified by
--  drivers.user_id = auth.uid() and are NOT members in workspace_users
--  (so they never satisfy has_workspace_access / has_app_access and can
--  only reach data through the explicit driver policies below). Phone+
--  password accounts are provisioned server-side in Phase 2.
-- ============================================================

-- ─── 1. DRIVER IDENTITY & PROFILE FIELDS ──────────────────────────────────────
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS nrc_number text;

-- One auth user maps to at most one driver record.
CREATE UNIQUE INDEX IF NOT EXISTS drivers_user_id_key
  ON public.drivers (user_id) WHERE user_id IS NOT NULL;

-- ─── 2. INCOME ATTRIBUTION (admin-side; NOT driver-facing) ────────────────────
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL;

-- Backfill from the JSON metadata written by the income modal. Guard the value
-- so malformed/non-UUID metadata is ignored rather than erroring the migration.
UPDATE public.transactions
SET driver_id = (metadata->>'driver_id')::uuid
WHERE driver_id IS NULL
  AND metadata->>'driver_id' IS NOT NULL
  AND metadata->>'driver_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE INDEX IF NOT EXISTS transactions_driver_id_idx ON public.transactions (driver_id);

-- ─── 3. HELPER: the driver record linked to the current user ──────────────────
CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.drivers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ─── 4. DRIVER DOCUMENTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  doc_type     text NOT NULL CHECK (doc_type IN ('license','nrc','photo','police_clearance')),
  storage_path text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at  timestamptz,
  superseded   boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_documents_driver_id_idx ON public.driver_documents (driver_id);
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- A new upload of the same doc_type supersedes the driver's prior ones.
-- SECURITY DEFINER so the cascade UPDATE isn't blocked by RLS for driver users.
CREATE OR REPLACE FUNCTION public.supersede_prior_driver_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.driver_documents
  SET superseded = true
  WHERE driver_id = NEW.driver_id
    AND doc_type  = NEW.doc_type
    AND id <> NEW.id
    AND superseded = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supersede_driver_docs ON public.driver_documents;
CREATE TRIGGER trg_supersede_driver_docs
  AFTER INSERT ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.supersede_prior_driver_documents();

-- ─── 5. DRIVER PROFILE EDIT HISTORY (append-only audit trail) ─────────────────
CREATE TABLE IF NOT EXISTS public.driver_profile_edits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  changed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field        text NOT NULL,
  old_value    text,
  new_value    text,
  reverted     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_profile_edits_driver_id_idx ON public.driver_profile_edits (driver_id);
ALTER TABLE public.driver_profile_edits ENABLE ROW LEVEL SECURITY;

-- ─── 6. DRIVER-SCOPED RLS (additive to existing admin has_app_access policies) ─
-- Drivers are not workspace members, so the admin/member/guest policies never
-- match them; these are the ONLY rows a driver can reach.

-- Own driver record (read).
DROP POLICY IF EXISTS "Drivers view own record" ON public.drivers;
CREATE POLICY "Drivers view own record"
ON public.drivers FOR SELECT
USING (user_id = auth.uid());

-- Own assigned vehicle (read) — for displaying plate/make/model.
DROP POLICY IF EXISTS "Drivers view own vehicle" ON public.vehicles;
CREATE POLICY "Drivers view own vehicle"
ON public.vehicles FOR SELECT
USING (id = (SELECT vehicle_id FROM public.drivers WHERE user_id = auth.uid()));

-- Own vehicle's cashing schedule (read) — for "which week is it".
DROP POLICY IF EXISTS "Drivers view own schedules" ON public.cashing_schedules;
CREATE POLICY "Drivers view own schedules"
ON public.cashing_schedules FOR SELECT
USING (vehicle_id = (SELECT vehicle_id FROM public.drivers WHERE user_id = auth.uid()));

-- Own vehicle's expected cashings (read) — week + on-time status. NO amounts here.
DROP POLICY IF EXISTS "Drivers view own cashings" ON public.expected_cashings;
CREATE POLICY "Drivers view own cashings"
ON public.expected_cashings FOR SELECT
USING (vehicle_id = (SELECT vehicle_id FROM public.drivers WHERE user_id = auth.uid()));

-- NOTE: deliberately NO driver policy on public.transactions — gross amounts
-- are never reachable by a driver.

-- driver_documents: drivers read + upload their own; admins manage all in workspace.
DROP POLICY IF EXISTS "Drivers read own documents" ON public.driver_documents;
CREATE POLICY "Drivers read own documents"
ON public.driver_documents FOR SELECT
USING (driver_id = public.current_driver_id());

DROP POLICY IF EXISTS "Drivers upload own documents" ON public.driver_documents;
CREATE POLICY "Drivers upload own documents"
ON public.driver_documents FOR INSERT
WITH CHECK (
  driver_id = public.current_driver_id()
  AND workspace_id = (SELECT workspace_id FROM public.drivers WHERE id = driver_id)
);

DROP POLICY IF EXISTS "Admins manage workspace documents" ON public.driver_documents;
CREATE POLICY "Admins manage workspace documents"
ON public.driver_documents FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- driver_profile_edits: drivers read their own; admins read/manage workspace.
-- Inserts are made only by the SECURITY DEFINER RPC below, so no user INSERT policy.
DROP POLICY IF EXISTS "Drivers view own edit history" ON public.driver_profile_edits;
CREATE POLICY "Drivers view own edit history"
ON public.driver_profile_edits FOR SELECT
USING (driver_id = public.current_driver_id());

DROP POLICY IF EXISTS "Admins manage edit history" ON public.driver_profile_edits;
CREATE POLICY "Admins manage edit history"
ON public.driver_profile_edits FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- ─── 7. RPC: driver self-edits own profile (whitelisted fields + audit) ───────
-- Drivers have NO direct UPDATE on public.drivers; all self-edits flow through
-- here. Only name/phone/license_number/nrc_number are editable — never salary,
-- vehicle assignment, or active status. Each changed field is logged.
CREATE OR REPLACE FUNCTION public.driver_update_profile(
  p_name           text DEFAULT NULL,
  p_phone          text DEFAULT NULL,
  p_license_number text DEFAULT NULL,
  p_nrc_number     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  d public.drivers%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No driver profile is linked to this account.';
  END IF;

  IF p_name IS NOT NULL AND p_name IS DISTINCT FROM d.name THEN
    INSERT INTO public.driver_profile_edits(driver_id, workspace_id, changed_by, field, old_value, new_value)
    VALUES (d.id, d.workspace_id, auth.uid(), 'name', d.name, p_name);
    UPDATE public.drivers SET name = p_name WHERE id = d.id;
  END IF;

  IF p_phone IS NOT NULL AND p_phone IS DISTINCT FROM d.phone THEN
    INSERT INTO public.driver_profile_edits(driver_id, workspace_id, changed_by, field, old_value, new_value)
    VALUES (d.id, d.workspace_id, auth.uid(), 'phone', d.phone, p_phone);
    UPDATE public.drivers SET phone = p_phone WHERE id = d.id;
  END IF;

  IF p_license_number IS NOT NULL AND p_license_number IS DISTINCT FROM d.license_number THEN
    INSERT INTO public.driver_profile_edits(driver_id, workspace_id, changed_by, field, old_value, new_value)
    VALUES (d.id, d.workspace_id, auth.uid(), 'license_number', d.license_number, p_license_number);
    UPDATE public.drivers SET license_number = p_license_number WHERE id = d.id;
  END IF;

  IF p_nrc_number IS NOT NULL AND p_nrc_number IS DISTINCT FROM d.nrc_number THEN
    INSERT INTO public.driver_profile_edits(driver_id, workspace_id, changed_by, field, old_value, new_value)
    VALUES (d.id, d.workspace_id, auth.uid(), 'nrc_number', d.nrc_number, p_nrc_number);
    UPDATE public.drivers SET nrc_number = p_nrc_number WHERE id = d.id;
  END IF;
END;
$$;

-- ─── 8. STORAGE: private bucket + path-scoped policies ────────────────────────
-- Path convention: '<workspace_id>/<driver_id>/<doc_type>/<filename>'
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Driver: read + upload only within their own '<ws>/<driver_id>/...' prefix.
DROP POLICY IF EXISTS "Drivers read own docs (storage)" ON storage.objects;
CREATE POLICY "Drivers read own docs (storage)"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[2] = public.current_driver_id()::text
);

DROP POLICY IF EXISTS "Drivers upload own docs (storage)" ON storage.objects;
CREATE POLICY "Drivers upload own docs (storage)"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[2] = public.current_driver_id()::text
);

-- Admin: full access to documents in workspaces they have transport access to.
DROP POLICY IF EXISTS "Admins manage docs (storage)" ON storage.objects;
CREATE POLICY "Admins manage docs (storage)"
ON storage.objects FOR ALL
USING (
  bucket_id = 'driver-documents'
  AND public.has_app_access(((storage.foldername(name))[1])::uuid, 'transport')
)
WITH CHECK (
  bucket_id = 'driver-documents'
  AND public.has_app_write_access(((storage.foldername(name))[1])::uuid, 'transport')
);
