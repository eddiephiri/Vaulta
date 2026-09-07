-- =============================================================================
-- Migration: Deduplicate Cashing Transaction, Fix Status, and Harden RPC
-- Date: 2026-09-07
-- =============================================================================

-- 1. Deduplicate the duplicate cashing transaction PP260902.2311.X39854
DO $$
DECLARE
  v_kept_id uuid;
  v_cashing_id uuid;
BEGIN
  -- Find the vehicle BAZ 8243
  SELECT ec.id INTO v_cashing_id
  FROM public.expected_cashings ec
  JOIN public.vehicles v ON v.id = ec.vehicle_id
  WHERE v.plate ILIKE '%8243%'
    AND ec.expected_date = '2026-09-02';

  -- Select the first transaction with this reference to keep
  SELECT id INTO v_kept_id
  FROM public.transactions
  WHERE metadata->>'reference' ILIKE '%PP260902.2311.X39854%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_kept_id IS NOT NULL THEN
    -- Delete any other duplicate transactions with this reference
    DELETE FROM public.transactions
    WHERE metadata->>'reference' ILIKE '%PP260902.2311.X39854%'
      AND id <> v_kept_id;

    -- Update the kept transaction's date to the actual cashing date: 2026-09-02
    UPDATE public.transactions
    SET date = '2026-09-02'
    WHERE id = v_kept_id;

    -- Update the expected_cashing row to 'recorded' (on time) and link to kept transaction
    IF v_cashing_id IS NOT NULL THEN
      UPDATE public.expected_cashings
      SET status = 'recorded',
          transaction_id = v_kept_id
      WHERE id = v_cashing_id;
    END IF;
  END IF;
END $$;

-- 2. Harden driver_log_cashing RPC:
--    - Uses SELECT ... FOR UPDATE to prevent race conditions & double submissions
--    - Rejects duplicate reference codes
--    - Uses expected_date if submitted within 24h grace window (so late-night/next-morning submissions are on-time)
CREATE OR REPLACE FUNCTION public.driver_log_cashing(
  p_expected_cashing_id uuid,
  p_amount_zmw          numeric,
  p_reference           text, -- Required: Airtel Money Transaction ID
  p_notes               text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected_date      date;
  v_vehicle_id         uuid;
  v_transaction_id     uuid;
  v_current_status     text;
  v_week_number        int;
  v_income_source      text;
  v_workspace_id       uuid;
  v_driver_id          uuid;
  v_new_transaction_id uuid;
  v_status             text;
  v_txn_date           date;
  v_clean_ref          text;
BEGIN
  -- 1. Validate inputs
  v_clean_ref := trim(p_reference);
  IF v_clean_ref IS NULL OR v_clean_ref = '' THEN
    RAISE EXCEPTION 'Airtel Money Transaction ID is required.';
  END IF;

  IF p_amount_zmw IS NULL OR p_amount_zmw <= 0 THEN
    RAISE EXCEPTION 'Enter a valid cashing amount.';
  END IF;

  -- 2. Fetch expected cashing with row-level lock (FOR UPDATE) to prevent race conditions
  SELECT 
    ec.expected_date,
    ec.vehicle_id,
    ec.transaction_id,
    ec.status,
    ec.week_number,
    cs.income_source,
    cs.workspace_id,
    d.id
  INTO 
    v_expected_date,
    v_vehicle_id,
    v_transaction_id,
    v_current_status,
    v_week_number,
    v_income_source,
    v_workspace_id,
    v_driver_id
  FROM public.expected_cashings ec
  JOIN public.cashing_schedules cs ON cs.id = ec.schedule_id
  JOIN public.drivers d ON d.vehicle_id = ec.vehicle_id
  WHERE ec.id = p_expected_cashing_id
    AND d.user_id = auth.uid()
    AND d.active = true
  FOR UPDATE OF ec;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access Denied: Cashing schedule not found or you are not authorized.';
  END IF;

  -- 3. Verify it is not already resolved
  IF v_transaction_id IS NOT NULL OR v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'This cashing reminder has already been resolved.';
  END IF;

  -- 4. Check for duplicate reference ID across this workspace
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE workspace_id = v_workspace_id
      AND metadata->>'reference' = v_clean_ref
  ) THEN
    RAISE EXCEPTION 'A transaction with this Reference ID has already been recorded.';
  END IF;

  -- 5. Determine on-time vs late status with a 1-day grace period
  -- If submitted on expected_date or the following day (e.g. Wednesday night cash logged Thursday morning),
  -- record transaction date as the expected cashing date and mark as on-time 'recorded'.
  IF CURRENT_DATE <= (v_expected_date + 1) THEN
    v_status := 'recorded';
    v_txn_date := v_expected_date;
  ELSE
    v_status := 'late_driver';
    v_txn_date := CURRENT_DATE;
  END IF;

  -- 6. Create the unified ledger transaction
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
    v_txn_date,
    'Driver-submitted cashing',
    v_vehicle_id,
    auth.uid(),
    jsonb_build_object(
      'source', v_income_source,
      'period_start', (v_expected_date - 6)::text,
      'period_end', v_expected_date::text,
      'driver_id', v_driver_id,
      'reference', v_clean_ref,
      'notes', trim(p_notes),
      'expected_cashing_id', p_expected_cashing_id
    )
  ) RETURNING id INTO v_new_transaction_id;

  -- 7. Update the expected cashing record status and link
  UPDATE public.expected_cashings
  SET status = v_status,
      transaction_id = v_new_transaction_id,
      notes = COALESCE(trim(p_notes), notes)
  WHERE id = p_expected_cashing_id;
END;
$$;
