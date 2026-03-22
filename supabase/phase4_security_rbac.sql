-- ============================================================
--  Vaulta Modular ERP — Phase 4: Security & Guest Access
--  RBAC, Temporal Access, and Access Codes
-- ============================================================

-- ─── 1. EXTEND WORKSPACE_USERS ────────────────────────────────

ALTER TABLE public.workspace_users 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS authorized_apps TEXT[]; -- e.g. ['budget', 'transport']

-- ─── 2. ACCESS CODES TABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_access_codes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT UNIQUE NOT NULL, -- e.g. 'VLT-X9Y2'
    workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('member', 'guest')),
    authorized_apps TEXT[],
    expires_at    TIMESTAMPTZ,
    created_by    UUID REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Access Codes
ALTER TABLE public.workspace_access_codes ENABLE ROW LEVEL SECURITY;

-- Only Owners/Admins can manage access codes
CREATE POLICY "Owners and admins can manage access codes"
ON public.workspace_access_codes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_users wu
    WHERE wu.workspace_id = public.workspace_access_codes.workspace_id
      AND wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'admin')
  )
);

-- Anyone can 'lookup' an access code if they have the secret (needed for the /join flow)
-- This is a 'SECURITY DEFINER' function to allow anonymous lookup
CREATE OR REPLACE FUNCTION public.lookup_access_code(p_code TEXT)
RETURNS TABLE (
  workspace_name TEXT,
  role TEXT,
  expires_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT w.name, ac.role, ac.expires_at
  FROM public.workspace_access_codes ac
  JOIN public.workspaces w ON w.id = ac.workspace_id
  WHERE ac.code = p_code
    AND (ac.expires_at IS NULL OR ac.expires_at > now());
END;
$$;

-- Generate a random code: VLT-XXXX
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

-- Create an access code
CREATE OR REPLACE FUNCTION public.create_workspace_access_code(
  p_workspace_id UUID,
  p_role TEXT,
  p_authorized_apps TEXT[],
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
  
  INSERT INTO public.workspace_access_codes (code, workspace_id, role, authorized_apps, expires_at, created_by)
  VALUES (v_code, p_workspace_id, p_role, p_authorized_apps, v_expires_at, auth.uid());

  RETURN v_code;
END;
$$;

-- Join workspace via code
CREATE OR REPLACE FUNCTION public.join_workspace_via_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_role TEXT;
  v_apps TEXT[];
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Find the code
  SELECT workspace_id, role, authorized_apps, expires_at 
  INTO v_workspace_id, v_role, v_apps, v_expires_at
  FROM public.workspace_access_codes
  WHERE code = p_code
    AND (expires_at IS NULL OR expires_at > now());

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired access code.';
  END IF;

  -- 2. Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.workspace_users 
    WHERE workspace_id = v_workspace_id AND user_id = auth.uid()
  ) THEN
    RETURN v_workspace_id;
  END IF;

  -- 3. Link user
  INSERT INTO public.workspace_users (workspace_id, user_id, role, authorized_apps, expires_at)
  VALUES (v_workspace_id, auth.uid(), v_role, v_apps, v_expires_at);

  RETURN v_workspace_id;
END;
$$;

-- ─── 3. UPDATED SECURITY FUNCTIONS ───────────────────────────

-- Check if user has workspace access (now includes expiry check)
CREATE OR REPLACE FUNCTION public.has_workspace_access(_workspace_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.workspace_users wu
    WHERE wu.workspace_id = _workspace_id
      AND wu.user_id = auth.uid()
      AND (wu.expires_at IS NULL OR wu.expires_at > now())
  );
END;
$$;

-- Check if user has specific app access
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

-- ─── 4. UPDATED RLS POLICIES ─────────────────────────────────

-- Transactions: Restricted write for Guests
DROP POLICY IF EXISTS "Workspace Members Only — transactions" ON public.transactions;

CREATE POLICY "Workspace Members Only — transactions"
ON public.transactions
FOR ALL
USING (public.has_app_access(workspace_id, app_id))
WITH CHECK (
  public.has_app_access(workspace_id, app_id) 
  AND (
    SELECT role FROM public.workspace_users 
    WHERE workspace_id = public.transactions.workspace_id 
      AND user_id = auth.uid()
  ) != 'guest'
);

-- Allow Guests to SELECT transactions even if they can't WRITE
CREATE POLICY "Guests can VIEW transactions"
ON public.transactions
FOR SELECT
USING (public.has_app_access(workspace_id, app_id));

-- Update Vehicles RLS to use app access
DROP POLICY IF EXISTS "Workspace Members Only — vehicles" ON public.vehicles;

CREATE POLICY "Workspace Members Only — vehicles"
ON public.vehicles
FOR ALL
USING (public.has_app_access(workspace_id, 'transport'))
WITH CHECK (
  public.has_app_access(workspace_id, 'transport')
  AND (
    SELECT role FROM public.workspace_users 
    WHERE workspace_id = public.vehicles.workspace_id 
      AND user_id = auth.uid()
  ) != 'guest'
);

CREATE POLICY "Guests can VIEW vehicles"
ON public.vehicles
FOR SELECT
USING (public.has_app_access(workspace_id, 'transport'));
