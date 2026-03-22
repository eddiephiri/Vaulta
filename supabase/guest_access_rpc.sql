-- ============================================================
-- RPC to fetch workspace members safely including emails
-- ============================================================
CREATE OR REPLACE FUNCTION get_workspace_members(p_workspace_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    access_duration TEXT,
    expires_at TIMESTAMPTZ,
    authorized_apps TEXT[],
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Security check: ensure the caller is a member of this workspace
    IF NOT public.has_workspace_access(p_workspace_id) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    RETURN QUERY
    SELECT 
        wu.user_id,
        u.email::text,
        wu.role,
        wu.access_duration,
        wu.expires_at,
        wu.authorized_apps,
        wu.created_at
    FROM public.workspace_users wu
    JOIN auth.users u ON u.id = wu.user_id
    WHERE wu.workspace_id = p_workspace_id;
END;
$$;

-- ============================================================
-- RPC to fetch unredeemed access codes
-- ============================================================
CREATE OR REPLACE FUNCTION get_workspace_access_codes(p_workspace_id UUID)
RETURNS TABLE (
    id UUID,
    code TEXT,
    role TEXT,
    authorized_apps TEXT[],
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Security check: ensure the caller is an admin/owner
    IF NOT EXISTS (
        SELECT 1 FROM public.workspace_users 
        WHERE workspace_id = p_workspace_id 
          AND user_id = auth.uid() 
          AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    RETURN QUERY
    SELECT 
        ac.id,
        ac.code,
        ac.role,
        ac.authorized_apps,
        ac.expires_at,
        ac.created_at
    FROM public.workspace_access_codes ac
    WHERE ac.workspace_id = p_workspace_id
      AND (ac.expires_at IS NULL OR ac.expires_at > now())
    ORDER BY ac.created_at DESC;
END;
$$;
