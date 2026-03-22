-- ============================================================
--  Vaulta — RLS Visibility Fixes
-- ============================================================

-- Ensure workspaces policy is robust and uses the security-definer helper
DROP POLICY IF EXISTS "View own workspaces" ON public.workspaces;
CREATE POLICY "View own workspaces"
ON public.workspaces
FOR SELECT
USING (public.has_workspace_access(id));

-- Ensure workspace_users policy is robust
-- Note: 'has_workspace_access' is already defined as SECURITY DEFINER
-- but we also need a direct policy on workspace_users for the context fetch
DROP POLICY IF EXISTS "Users can view own workspace memberships" ON public.workspace_users;
CREATE POLICY "Users can view own workspace memberships"
ON public.workspace_users
FOR SELECT
USING (user_id = auth.uid());

-- Optional: If guests should see other members (e.g. for a team list)
-- we might need a more permissive read policy, but for now we stick to own membership.
