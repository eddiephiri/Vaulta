-- ============================================================
-- RPC to fetch workspace members safely including emails
-- ============================================================
CREATE OR REPLACE FUNCTION get_workspace_members(p_workspace_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    access_duration TEXT,
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
        wu.created_at
    FROM public.workspace_users wu
    JOIN auth.users u ON u.id = wu.user_id
    WHERE wu.workspace_id = p_workspace_id;
END;
$$;
