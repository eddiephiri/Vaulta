-- ============================================================
--  Vaulta — Granular Guest Permissions
-- ============================================================

-- 1. Update Schema
ALTER TABLE public.workspace_users 
ADD COLUMN IF NOT EXISTS editable_apps TEXT[] DEFAULT '{}';

ALTER TABLE public.workspace_access_codes 
ADD COLUMN IF NOT EXISTS editable_apps TEXT[] DEFAULT '{}';

-- 2. Helper Functions

-- Random code generator (RE-DEFINED for robustness)
CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- No I, O, 0, 1 for clarity
  result TEXT := 'VLT-';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Check if user has specific app access (RE-DEFINED for robustness)
CREATE OR REPLACE FUNCTION public.has_app_access(_workspace_id UUID, _app_id TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_apps TEXT[];
BEGIN
  SELECT role, authorized_apps INTO v_role, v_apps
  FROM public.workspace_users
  WHERE workspace_id = _workspace_id
    AND user_id = auth.uid()
    AND (expires_at IS NULL OR expires_at > now());

  IF v_role IN ('owner', 'admin', 'member') THEN
    RETURN TRUE;
  ELSIF v_role = 'guest' THEN
    -- If guest, check if the app is in their authorized list
    RETURN _app_id = ANY(v_apps);
  END IF;

  RETURN FALSE;
END;
$$;
CREATE OR REPLACE FUNCTION public.has_app_write_access(_workspace_id UUID, _app_id TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_edit_apps TEXT[];
BEGIN
  SELECT role, editable_apps INTO v_role, v_edit_apps
  FROM public.workspace_users
  WHERE workspace_id = _workspace_id
    AND user_id = auth.uid()
    AND (expires_at IS NULL OR expires_at > now());

  IF v_role IN ('owner', 'admin', 'member') THEN
    RETURN TRUE;
  ELSIF v_role = 'guest' THEN
    -- If guest, check if the app is in their editable list
    RETURN _app_id = ANY(v_edit_apps);
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. Update RLS Policies for Transactions (Write Access)
DROP POLICY IF EXISTS "Workspace Members Only — transactions" ON public.transactions;

CREATE POLICY "Workspace Members Only — transactions"
ON public.transactions
FOR ALL
USING (public.has_app_access(workspace_id, app_id))
WITH CHECK (public.has_app_write_access(workspace_id, app_id));

-- 4. Update Vehicles RLS (Write Access)
DROP POLICY IF EXISTS "Workspace Members Only — vehicles" ON public.vehicles;

CREATE POLICY "Workspace Members Only — vehicles"
ON public.vehicles
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (public.has_app_write_access(workspace_id, 'transport'));

-- 5. Update RPC: create_workspace_access_code
-- DROP OLD SIGNATURE (to avoid conflicts with changed arguments)
DROP FUNCTION IF EXISTS public.create_workspace_access_code(UUID, TEXT, TEXT[], INTEGER);

CREATE OR REPLACE FUNCTION public.create_workspace_access_code(
  p_workspace_id UUID,
  p_role TEXT,
  p_authorized_apps TEXT[],
  p_editable_apps TEXT[] DEFAULT '{}',
  p_expires_in_hours INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_expires_at TIMESTAMPTZ := NULL;
BEGIN
  -- Check permission
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_users 
    WHERE workspace_id = p_workspace_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only owners and admins can create access codes.';
  END IF;

  IF p_expires_in_hours IS NOT NULL THEN
    v_expires_at := now() + (p_expires_in_hours || ' hours')::interval;
  END IF;

  v_code := public.generate_access_code();
  
  INSERT INTO public.workspace_access_codes (code, workspace_id, role, authorized_apps, editable_apps, expires_at, created_by)
  VALUES (v_code, p_workspace_id, p_role, p_authorized_apps, p_editable_apps, v_expires_at, auth.uid());

  RETURN v_code;
END;
$$;

-- 6. Update RPC: join_workspace_via_code
CREATE OR REPLACE FUNCTION public.join_workspace_via_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_role TEXT;
  v_apps TEXT[];
  v_edit_apps TEXT[];
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Find the code
  SELECT workspace_id, role, authorized_apps, editable_apps, expires_at 
  INTO v_workspace_id, v_role, v_apps, v_edit_apps, v_expires_at
  FROM public.workspace_access_codes
  WHERE code = p_code
    AND (expires_at IS NULL OR expires_at > now());

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired access code.';
  END IF;

  -- 2. Check if already a member (Update existing if found to pick up new permissions)
  IF EXISTS (
    SELECT 1 FROM public.workspace_users 
    WHERE workspace_id = v_workspace_id AND user_id = auth.uid()
  ) THEN
    UPDATE public.workspace_users 
    SET role = v_role, 
        authorized_apps = v_apps, 
        editable_apps = v_edit_apps, 
        expires_at = v_expires_at
    WHERE workspace_id = v_workspace_id AND user_id = auth.uid();
    RETURN v_workspace_id;
  END IF;

  -- 3. Link user
  INSERT INTO public.workspace_users (workspace_id, user_id, role, authorized_apps, editable_apps, expires_at)
  VALUES (v_workspace_id, auth.uid(), v_role, v_apps, v_edit_apps, v_expires_at);

  RETURN v_workspace_id;
END;
$$;
