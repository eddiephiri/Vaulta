-- =============================================================================
-- Vaulta Driver Portal — Cashing Submission RPC
-- Run in Supabase SQL Editor AFTER modular_erp_phase2_ledger_migration.sql
--
-- Enables drivers to log their own cashings securely.
-- Bypasses general transactions table write restrictions by checking ownership
-- of the expected cashing row and executing as SECURITY DEFINER.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.driver_log_cashing(
	  p_expected_cashing_id uuid,
	  p_amount_zmw          numeric,
	  p_reference           text -- Required: Airtel Money Transaction ID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ec               public.expected_cashings%ROWTYPE;
  v_income_source    text;
  v_workspace_id     uuid;
  v_driver_id        uuid;
  v_transaction_id   uuid;
  v_status           text;
BEGIN
	  -- 1. Validate inputs
  IF p_reference IS NULL OR trim(p_reference) = '' THEN
	    RAISE EXCEPTION 'Airtel Money Transaction ID is required.';
	  END IF;

	  -- 2. Fetch expected cashing and verify ownership
  SELECT ec.*, cs.income_source, cs.workspace_id, d.id
  INTO v_ec, v_income_source, v_workspace_id, v_driver_id
  FROM public.expected_cashings ec
  JOIN public.cashing_schedules cs ON cs.id = ec.schedule_id
  JOIN public.drivers d ON d.vehicle_id = ec.vehicle_id
  WHERE ec.id = p_expected_cashing_id
    AND d.user_id = auth.uid()
    AND d.active = true;

  IF NOT FOUND THEN
	    RAISE EXCEPTION 'Access Denied: Cashing schedule not found or you are not authorized.';
	  END IF;

	  -- 3. Verify it is not already logged
  IF v_ec.transaction_id IS NOT NULL OR v_ec.status <> 'pending' THEN
	    RAISE EXCEPTION 'This cashing reminder has already been resolved.';
	  END IF;

	  -- 4. Determine status (on-time vs late)
  IF v_ec.expected_date < CURRENT_DATE THEN
	    v_status := 'late_driver';
	  ELSE
		    v_status := 'recorded';
		  END IF;

		  -- 5. Create the unified ledger transaction
  INSERT INTO public.transactions (
	    workspace_id,
	    app_id,
	    type,
	    amount_zmw,
	    date,
	    description,
	    reference_entity_id,
	    created_by,
	    metadata
	  ) VALUES (
	    v_workspace_id,
	    'transport',
	    'income',
	    p_amount_zmw,
	    CURRENT_DATE,
	    'Driver-submitted cashing',
	    v_ec.vehicle_id,
	    auth.uid(),
	    jsonb_build_object(
		      'source', v_income_source,
		      'period_start', (v_ec.expected_date - 6)::text,
		      'period_end', v_ec.expected_date::text,
		      'driver_id', v_driver_id,
		      'reference', trim(p_reference),
		      'expected_cashing_id', p_expected_cashing_id
		    )
		  ) RETURNING id INTO v_transaction_id;

		  -- 6. Update the expected cashing record status and link
  UPDATE public.expected_cashings
  SET status = v_status,
      transaction_id = v_transaction_id
  WHERE id = p_expected_cashing_id;
END;
$$;

