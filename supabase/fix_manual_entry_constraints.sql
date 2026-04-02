-- =============================================================================
-- Vaulta — Missing check constraint fixes
-- Run this in your Supabase SQL Editor to fix manual entry errors.
-- =============================================================================

-- 1. Fix the error when resolving overdue cashings as "Deferred to salary week"
ALTER TABLE public.expected_cashings
    DROP CONSTRAINT IF EXISTS expected_cashings_status_check;

ALTER TABLE public.expected_cashings
    ADD CONSTRAINT expected_cashings_status_check
    CHECK (status IN ('pending', 'recorded', 'late_driver', 'late_admin', 'deferred_to_salary'));

-- 2. Fix the error if you try to log a manual expense under the "Service" category
ALTER TABLE public.expenses
    DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses
    ADD CONSTRAINT expenses_category_check
    CHECK (category IN ('fuel','service','tyre','licensing','insurance','repairs','salary','wash','other'));
