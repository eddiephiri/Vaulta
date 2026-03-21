-- ============================================================
--  Vaulta Modular ERP — Phase 1 Schema Migration
--  Core Workspaces, Apps, Users, and Shared Ledger
-- ============================================================

-- Enable UUID extension if missing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. CORE FRAMEWORK TABLES ────────────────────────────────

-- Workspaces: The highest-level boundary (e.g., "Family/Personal Hub")
CREATE TABLE IF NOT EXISTS public.workspaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apps: The available modules (e.g., 'transport', 'budget')
CREATE TABLE IF NOT EXISTS public.apps (
    id          TEXT PRIMARY KEY, -- Using slug as ID for simplicity (e.g., 'transport')
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace Apps: What apps is this workspace using?
CREATE TABLE IF NOT EXISTS public.workspace_apps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    app_id       TEXT NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, app_id)
);

-- Workspace Users / RBAC: Maps auth.users to workspaces with roles
CREATE TABLE IF NOT EXISTS public.workspace_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
    access_duration TEXT, -- Expected timeframe at invitation, e.g., '1 Day', '1 Week', 'Permanent'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);


-- ─── 2. THE UNIFIED LEDGER ───────────────────────────────────

-- Transactions: Double-Entry Lite Shared Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    app_id                TEXT NOT NULL REFERENCES public.apps(id),
    type                  TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount_zmw            NUMERIC NOT NULL DEFAULT 0,
    date                  DATE NOT NULL,
    description           TEXT,
    linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL, -- For Double-Entry pairs
    reference_entity_id   UUID, -- e.g., A Vehicle ID, or Home ID, relating the transaction to a domain asset
    created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── 3. REFACTOR EXISTING TABLES ─────────────────────────────

-- Add workspace_id to vehicles
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to service_history
ALTER TABLE public.service_history
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Note: In a production migration with existing data, you'd insert a default workspace 
-- and update all existing rows before making `workspace_id` NOT NULL. 
-- Assuming for now that we will backfill the data:
-- INSERT INTO workspaces (name) VALUES ('Default Hub') RETURNING id;
-- UPDATE vehicles SET workspace_id = <the_new_id>;
-- UPDATE service_history SET workspace_id = <the_new_id>;
-- ALTER TABLE vehicles ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE service_history ALTER COLUMN workspace_id SET NOT NULL;


-- ─── 4. SECURITY & ROW LEVEL SECURITY (RLS) TEMPLATE ─────────

-- Enable RLS on core framework tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check Workspace Access efficiently to use in RLS policies without recursive joins
CREATE OR REPLACE FUNCTION public.has_workspace_access(_workspace_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass RLS on workspace_users during calculation
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.workspace_users wu
    WHERE wu.workspace_id = _workspace_id
      AND wu.user_id = auth.uid()
  );
END;
$$;

-- RLS Policy Example: Vehicles
-- Drop existing over-permissive policy if it exists
DROP POLICY IF EXISTS "Authenticated full access — vehicles" ON public.vehicles;

-- New Workspace-bound Policy
CREATE POLICY "Workspace Members Only — vehicles"
ON public.vehicles
FOR ALL
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- RLS Policy Example: Transactions
CREATE POLICY "Workspace Members Only — transactions"
ON public.transactions
FOR ALL
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- RLS Policy Example: Workspaces (Only view workspaces you belong to)
CREATE POLICY "View own workspaces"
ON public.workspaces
FOR SELECT
USING (
  id IN (
    SELECT workspace_id 
    FROM public.workspace_users 
    WHERE user_id = auth.uid()
  )
);
