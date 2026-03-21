-- ============================================================
--  Vaulta Modular ERP — Phase 2 Ledger Migration
--  Migrate standalone income/expenses to Shared Ledger
-- ============================================================

-- 1. Add metadata JSONB column
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Migrate existing Income
INSERT INTO public.transactions (
    id, workspace_id, app_id, type, amount_zmw, date, description, reference_entity_id, created_at, metadata
)
SELECT 
    i.id, 
    v.workspace_id, 
    'transport', 
    'income', 
    i.amount_zmw, 
    i.date, 
    COALESCE(i.notes, ''), 
    i.vehicle_id, 
    i.created_at,
    jsonb_build_object(
        'source', i.source,
        'reference', i.reference,
        'period_start', i.period_start,
        'period_end', i.period_end,
        'driver_id', i.driver_id,
        'expected_cashing_id', i.expected_cashing_id
    )
FROM public.income i
JOIN public.vehicles v ON v.id = i.vehicle_id
ON CONFLICT (id) DO NOTHING;

-- 3. Migrate existing Expenses
INSERT INTO public.transactions (
    id, workspace_id, app_id, type, amount_zmw, date, description, reference_entity_id, created_at, metadata
)
SELECT 
    e.id, 
    v.workspace_id, 
    'transport', 
    'expense', 
    e.amount_zmw, 
    e.date, 
    COALESCE(e.description, '') || CASE WHEN e.notes IS NOT NULL THEN ' - ' || e.notes ELSE '' END, 
    e.vehicle_id, 
    e.created_at,
    jsonb_build_object(
        'category', e.category,
        'source_table', e.source_table,
        'source_id', e.source_id,
        'driver_id', e.driver_id
    )
FROM public.expenses e
JOIN public.vehicles v ON v.id = e.vehicle_id
ON CONFLICT (id) DO NOTHING;

-- 4. Update expected_cashings to use transactions
ALTER TABLE public.expected_cashings
    ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

UPDATE public.expected_cashings
    SET transaction_id = income_record_id
    WHERE income_record_id IS NOT NULL AND transaction_id IS NULL;

-- 5. Recreate Views to point to shared ledger
DROP VIEW IF EXISTS public.v_monthly_income CASCADE;
CREATE VIEW public.v_monthly_income WITH (security_invoker = true) AS
SELECT
    reference_entity_id as vehicle_id,
    date_trunc('month', date) as month,
    sum(amount_zmw) as total_zmw
FROM public.transactions
WHERE type = 'income' AND app_id = 'transport'
GROUP BY reference_entity_id, date_trunc('month', date);

DROP VIEW IF EXISTS public.v_monthly_expenses CASCADE;
CREATE VIEW public.v_monthly_expenses WITH (security_invoker = true) AS
SELECT
    reference_entity_id as vehicle_id,
    date_trunc('month', date) as month,
    metadata->>'category' as category,
    sum(amount_zmw) as total_zmw
FROM public.transactions
WHERE type = 'expense' AND app_id = 'transport'
GROUP BY reference_entity_id, date_trunc('month', date), metadata->>'category';
