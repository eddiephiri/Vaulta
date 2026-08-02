-- =============================================================================
-- Vaulta — Driver Loans & Advances, Week Swapping RPC
-- Run once in Supabase SQL Editor.
-- =============================================================================

-- ─── 1. Driver Loans & Advances Table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.driver_advances (
    id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           uuid         NOT NULL,
    driver_id              uuid         NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    amount_zmw             numeric      NOT NULL CHECK (amount_zmw > 0),
    issued_date            date         NOT NULL DEFAULT CURRENT_DATE,
    repayment_type         text         NOT NULL DEFAULT 'salary_deduction' 
                                            CHECK (repayment_type IN ('salary_deduction', 'cash', 'other')),
    deduction_per_week_zmw numeric      NOT NULL DEFAULT 0 CHECK (deduction_per_week_zmw >= 0),
    remaining_balance_zmw  numeric      NOT NULL DEFAULT 0 CHECK (remaining_balance_zmw >= 0),
    status                 text         NOT NULL DEFAULT 'active' 
                                            CHECK (status IN ('active', 'repaid', 'cancelled')),
    notes                  text,
    created_at             timestamptz  NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_advances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated full access — driver_advances" ON public.driver_advances;
DROP POLICY IF EXISTS "Drivers view own advances" ON public.driver_advances;

-- Create RLS Policies
CREATE POLICY "Authenticated full access — driver_advances"
    ON public.driver_advances FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Drivers view own advances"
    ON public.driver_advances FOR SELECT
    USING (
        driver_id IN (
            SELECT id FROM public.drivers WHERE user_id = auth.uid()
        )
    );

-- ─── 2. Cashing Weeks Swapping Function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.swap_cashing_weeks(
    p_cashing_id_1 uuid,
    p_cashing_id_2 uuid
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_cashing_1 public.expected_cashings%ROWTYPE;
    v_cashing_2 public.expected_cashings%ROWTYPE;
    v_temp_salary boolean;
BEGIN
    SELECT * INTO v_cashing_1 FROM public.expected_cashings WHERE id = p_cashing_id_1;
    SELECT * INTO v_cashing_2 FROM public.expected_cashings WHERE id = p_cashing_id_2;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'One or both expected cashing records not found';
    END IF;

    IF v_cashing_1.vehicle_id != v_cashing_2.vehicle_id THEN
        RAISE EXCEPTION 'Cannot swap weeks across different vehicles';
    END IF;

    v_temp_salary := v_cashing_1.is_salary_week;

    -- Swap the is_salary_week values
    UPDATE public.expected_cashings
    SET is_salary_week = v_cashing_2.is_salary_week
    WHERE id = p_cashing_id_1;

    UPDATE public.expected_cashings
    SET is_salary_week = v_temp_salary
    WHERE id = p_cashing_id_2;
END;
$$;
