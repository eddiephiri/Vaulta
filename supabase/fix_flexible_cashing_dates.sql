-- =============================================================================
-- Migration: Fix Expected Cashing Dates for Flexible Schedules
-- Run in Supabase SQL Editor.
--
-- Problem: Schedules with "No fixed day" defaulted the expected date to 
-- CURRENT_DATE instead of the end of the driver's week. This caused the
-- app to think the first cashing was due immediately today, even if the 
-- week just started.
--
-- Fix: Expected dates are now rigorously aligned to the `anchor_date` week 
-- cycle. Flexible schedules will expect cashing at the "end of the week"
-- relative to the driver's start date (anchor_date + 6). Data is automatically
-- regenerated upon running this to fix existing entries.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_expected_cashings(
    p_schedule_id uuid,
    p_weeks       int DEFAULT 12
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_schedule        public.cashing_schedules%ROWTYPE;
    v_anchor          date;
    v_days_elapsed    int;
    v_start_n         int;
    v_week_start      date;
    v_candidate       date;
    v_week_in_cycle   int;
    i                 int;
BEGIN
    SELECT * INTO v_schedule FROM public.cashing_schedules WHERE id = p_schedule_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule % not found', p_schedule_id;
    END IF;

    -- ── Determine anchor date ──────────────────────────────────────────────
    v_anchor := COALESCE(v_schedule.anchor_date, v_schedule.created_at::date);

    -- ── Delete any existing PENDING future rows for this schedule ──────────
    DELETE FROM public.expected_cashings
    WHERE schedule_id = p_schedule_id
      AND status = 'pending'
      AND expected_date >= CURRENT_DATE;

    -- ── Find the current week offset (N) from the anchor ───────────────────
    v_days_elapsed := (CURRENT_DATE - v_anchor);
    v_start_n := FLOOR(v_days_elapsed::numeric / 7)::int;

    -- ── Generate p_weeks upcoming cashing dates ────────────────────────────
    i := 0;
    WHILE i < p_weeks LOOP

        -- The start date for week N
        v_week_start := v_anchor + (v_start_n * 7);

        IF v_schedule.cashing_day_of_week IS NOT NULL THEN
            -- Find the exact date in this week [v_week_start, v_week_start + 6]
            -- that matches the required DOW
            v_candidate := v_week_start + (
                (v_schedule.cashing_day_of_week
                 - EXTRACT(DOW FROM v_week_start)::int + 7) % 7
            )::int;
        ELSE
            -- No fixed weekday — expect cashing by the END of the 7-day week
            v_candidate := v_week_start + 6;
        END IF;

        IF v_candidate >= CURRENT_DATE THEN

            -- Week number within the cycle (1-indexed)
            v_week_in_cycle := (v_start_n % v_schedule.cycle_weeks);
            IF v_week_in_cycle < 0 THEN
                v_week_in_cycle := v_week_in_cycle + v_schedule.cycle_weeks;
            END IF;
            v_week_in_cycle := v_week_in_cycle + 1;

            INSERT INTO public.expected_cashings
                (vehicle_id, schedule_id, expected_date, is_salary_week, week_number)
            VALUES (
                v_schedule.vehicle_id,
                v_schedule.id,
                v_candidate,
                v_week_in_cycle = v_schedule.salary_week,
                v_week_in_cycle
            )
            ON CONFLICT DO NOTHING;

            i := i + 1;
        END IF;

        v_start_n := v_start_n + 1;
    END LOOP;
END;
$$;

-- ── Regenerate cashings for existing schedules to apply the fix ──────────
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT id FROM public.cashing_schedules LOOP
        PERFORM public.generate_expected_cashings(r.id, 12);
    END LOOP;
END;
$$;
