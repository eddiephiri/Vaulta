-- =============================================================================
-- Vaulta — Driver Swap Requests Migration
-- Run once in Supabase SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.driver_swap_requests (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid         NOT NULL,
    driver_id       uuid         NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    cashing_id_1    uuid         NOT NULL REFERENCES public.expected_cashings(id) ON DELETE CASCADE,
    cashing_id_2    uuid         NOT NULL REFERENCES public.expected_cashings(id) ON DELETE CASCADE,
    status          text         NOT NULL DEFAULT 'pending' 
                                     CHECK (status IN ('pending', 'approved', 'rejected')),
    reason          text,
    rejection_notes text,
    created_at      timestamptz  NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_swap_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated full access — driver_swap_requests" ON public.driver_swap_requests;
DROP POLICY IF EXISTS "Drivers view own requests" ON public.driver_swap_requests;
DROP POLICY IF EXISTS "Drivers insert own requests" ON public.driver_swap_requests;

-- Create RLS Policies
CREATE POLICY "Authenticated full access — driver_swap_requests"
    ON public.driver_swap_requests FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Drivers view own requests"
    ON public.driver_swap_requests FOR SELECT
    USING (
        driver_id IN (
            SELECT id FROM public.drivers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Drivers insert own requests"
    ON public.driver_swap_requests FOR INSERT
    WITH CHECK (
        driver_id IN (
            SELECT id FROM public.drivers WHERE user_id = auth.uid()
        )
    );

-- ─── 3. Swap Request Approval RPC ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_swap_request(
    p_request_id uuid
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_req public.driver_swap_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_req FROM public.driver_swap_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Swap request not found';
    END IF;

    IF v_req.status != 'pending' THEN
        RAISE EXCEPTION 'This request has already been processed';
    END IF;

    -- Swap the weeks in expected_cashings
    PERFORM public.swap_cashing_weeks(v_req.cashing_id_1, v_req.cashing_id_2);

    -- Mark this request approved
    UPDATE public.driver_swap_requests
    SET status = 'approved'
    WHERE id = p_request_id;

    -- Reject all other pending requests for the same driver to prevent conflicts
    UPDATE public.driver_swap_requests
    SET status = 'rejected',
        rejection_notes = 'Another swap request was approved'
    WHERE driver_id = v_req.driver_id 
      AND status = 'pending' 
      AND id != p_request_id;
END;
$$;

-- ─── 4. Swap Request Rejection RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_swap_request(
    p_request_id uuid,
    p_notes text
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.driver_swap_requests
    SET status = 'rejected',
        rejection_notes = p_notes
    WHERE id = p_request_id;
END;
$$;
