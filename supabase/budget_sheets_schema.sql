-- ============================================================
--  Vaulta — Budget Sheets Feature
--  Run in Supabase SQL Editor after home_budgeting_schema.sql
-- ============================================================

-- ─── 1. Budget Sheets ────────────────────────────────────────
-- A named spending plan (e.g. "April Groceries", "Holiday 2026")
CREATE TABLE IF NOT EXISTS public.budget_sheets (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    description  TEXT,
    month        TEXT,        -- YYYY-MM, optional month association
    status       TEXT        NOT NULL DEFAULT 'open'
                                 CHECK (status IN ('open', 'closed')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace Members Only — budget_sheets"
    ON public.budget_sheets FOR ALL
    USING (public.has_workspace_access(workspace_id))
    WITH CHECK (public.has_workspace_access(workspace_id));

-- ─── 2. Budget Sheet Items ───────────────────────────────────
-- Individual line items within a budget sheet
CREATE TABLE IF NOT EXISTS public.budget_sheet_items (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id       UUID        NOT NULL REFERENCES public.budget_sheets(id) ON DELETE CASCADE,
    workspace_id   UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name           TEXT        NOT NULL,
    category       TEXT,       -- free-text category
    estimated_zmw  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_zmw     NUMERIC(12, 2),   -- NULL until the user fills it in after purchase
    is_purchased   BOOLEAN     NOT NULL DEFAULT false,
    purchased_at   TIMESTAMPTZ,
    notes          TEXT,
    sort_order     INTEGER     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_sheet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace Members Only — budget_sheet_items"
    ON public.budget_sheet_items FOR ALL
    USING (public.has_workspace_access(workspace_id))
    WITH CHECK (public.has_workspace_access(workspace_id));

-- ─── 3. Auto-update updated_at ───────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER budget_sheets_updated_at
    BEFORE UPDATE ON public.budget_sheets
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER budget_sheet_items_updated_at
    BEFORE UPDATE ON public.budget_sheet_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 4. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_budget_sheets_workspace
    ON public.budget_sheets (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_sheet_items_sheet
    ON public.budget_sheet_items (sheet_id, sort_order ASC);
