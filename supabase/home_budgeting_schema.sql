-- ============================================================
--  Vaulta — Home Budgeting Module Schema
--  Run in Supabase SQL Editor after modular_erp_phase1.sql
-- ============================================================

-- ─── 1. Seed the apps table ──────────────────────────────────
INSERT INTO public.apps (id, name, description)
VALUES ('budget', 'Home Budgeting', 'Track household income, expenses, and accounts.')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Budget Accounts ──────────────────────────────────────
-- Represents a real-world money account (bank, mobile money, cash wallet)
CREATE TABLE IF NOT EXISTS public.budget_accounts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    type         TEXT        NOT NULL DEFAULT 'bank'
                                 CHECK (type IN ('bank', 'mobile_money', 'cash', 'savings')),
    currency     TEXT        NOT NULL DEFAULT 'ZMW',
    color        TEXT        NOT NULL DEFAULT '#3b82f6',
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace Members Only — budget_accounts"
    ON public.budget_accounts FOR ALL
    USING (public.has_workspace_access(workspace_id))
    WITH CHECK (public.has_workspace_access(workspace_id));

-- ─── 3. Budget Categories ────────────────────────────────────
-- User-defined income and expense categories (e.g., Groceries, Rent, Salary)
CREATE TABLE IF NOT EXISTS public.budget_categories (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    type         TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
    color        TEXT        NOT NULL DEFAULT '#6366f1',
    icon         TEXT,       -- Optional: lucide icon name string
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace Members Only — budget_categories"
    ON public.budget_categories FOR ALL
    USING (public.has_workspace_access(workspace_id))
    WITH CHECK (public.has_workspace_access(workspace_id));

-- ─── 4. Seed default categories ──────────────────────────────
-- These are inserted for EVERY workspace that runs this migration.
-- In production you'd trigger this per-workspace, but for now it's
-- safe to run once and the user can add/edit via the UI.
-- NOTE: Because workspace_id is required, seed categories must be
-- inserted after the workspace exists. Run the DO block below.

DO $$
DECLARE ws_id UUID;
BEGIN
    SELECT id INTO ws_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;
    IF ws_id IS NULL THEN RETURN; END IF;

    -- Income categories
    INSERT INTO public.budget_categories (workspace_id, name, type, color) VALUES
        (ws_id, 'Salary',           'income',  '#22c55e'),
        (ws_id, 'Freelance',        'income',  '#10b981'),
        (ws_id, 'Business Income',  'income',  '#34d399'),
        (ws_id, 'Investment',       'income',  '#6ee7b7'),
        (ws_id, 'Other Income',     'income',  '#a7f3d0')
    ON CONFLICT DO NOTHING;

    -- Expense categories
    INSERT INTO public.budget_categories (workspace_id, name, type, color) VALUES
        (ws_id, 'Rent / Mortgage',  'expense', '#ef4444'),
        (ws_id, 'Groceries',        'expense', '#f97316'),
        (ws_id, 'Transport',        'expense', '#f59e0b'),
        (ws_id, 'Utilities',        'expense', '#eab308'),
        (ws_id, 'Healthcare',       'expense', '#84cc16'),
        (ws_id, 'Education',        'expense', '#06b6d4'),
        (ws_id, 'Entertainment',    'expense', '#8b5cf6'),
        (ws_id, 'Clothing',         'expense', '#ec4899'),
        (ws_id, 'Savings',          'expense', '#14b8a6'),
        (ws_id, 'Other Expense',    'expense', '#6b7280')
    ON CONFLICT DO NOTHING;

    -- Default accounts
    INSERT INTO public.budget_accounts (workspace_id, name, type, color) VALUES
        (ws_id, 'Cash Wallet',   'cash',         '#f59e0b'),
        (ws_id, 'Airtel Money',  'mobile_money',  '#ef4444'),
        (ws_id, 'Zanaco',        'bank',          '#2563eb')
    ON CONFLICT DO NOTHING;
END $$;
