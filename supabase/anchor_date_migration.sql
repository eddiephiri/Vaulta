-- =============================================================================
-- Migration: Driver-Anchored Cashing Week Calculation
-- Run in Supabase SQL Editor AFTER drivers_and_schedules.sql.
--
-- Problem: The old generate_expected_cashings() started the cycle from
-- CURRENT_DATE, so week numbers drifted every time you regenerated.
--
-- Fix: The cycle is now anchored to `anchor_date` stored on the schedule
-- (defaulting to the driver's hire_date → schedule created_at as fallback).
-- Week numbers are derived from elapsed whole weeks since the anchor, making
-- them stable and deterministic forever.
-- =============================================================================

-- ─── 1. Add anchor_date column to cashing_schedules ──────────────────────────
-- anchor_date: the real-world date that marks the START of week 1 of this cycle.
-- Typically set to the driver's hire_date when creating the schedule.

ALTER TABLE public.cashing_schedules
    ADD COLUMN IF NOT EXISTS anchor_date date;

-- ─── 2. Replace generate_expected_cashings function ──────────────────────────
--
-- Algorithm:
--   For each upcoming week i (1 … p_weeks):
--     candidate_date = next occurrence of cashing_day_of_week on/after (today + (i-1)*7)
--     days_since_anchor = candidate_date - anchor_date
--     week_in_cycle = (floor(days_since_anchor / 7) % cycle_weeks) + 1   -- 1-indexed
--     is_salary_week = (week_in_cycle == salary_week)
--
-- This means week numbers are *position in cycle since the anchor*, not since today.
-- Existing rows are left untouched; this only affects newly generated rows.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_expected_cashings(
    p_schedule_id uuid,
    p_weeks       int DEFAULT 12
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_schedule        public.cashing_schedules%ROWTYPE;
    v_anchor          date;
    v_base            date;
    v_candidate       date;
    v_days_since      int;
    v_week_in_cycle   int;
    i                 int;
BEGIN
    SELECT * INTO v_schedule FROM public.cashing_schedules WHERE id = p_schedule_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule % not found', p_schedule_id;
    END IF;

    -- ── Determine anchor date ──────────────────────────────────────────────
    -- Priority: explicit anchor_date → schedule created_at (cast to date)
    v_anchor := COALESCE(v_schedule.anchor_date, v_schedule.created_at::date);

    -- ── Delete any existing PENDING future rows for this schedule ──────────
    -- (so we can safely re-generate without duplicates)
    DELETE FROM public.expected_cashings
    WHERE schedule_id = p_schedule_id
      AND status = 'pending'
      AND expected_date >= CURRENT_DATE;

    -- ── Generate p_weeks upcoming cashing dates ────────────────────────────
    FOR i IN 1..p_weeks LOOP

        -- Base date for this iteration = today + (i-1) weeks
        v_base := CURRENT_DATE + ((i - 1) * 7);

        IF v_schedule.cashing_day_of_week IS NOT NULL THEN
            -- Snap forward to the next occurrence of the target weekday
            v_candidate := v_base + (
                (v_schedule.cashing_day_of_week
                 - EXTRACT(DOW FROM v_base)::int + 7) % 7
            )::int;
        ELSE
            -- No fixed weekday — just use the base date
            v_candidate := v_base;
        END IF;

        -- ── Week-in-cycle derived from anchor, not loop index ──────────────
        v_days_since    := v_candidate - v_anchor;
        -- If the candidate is before the anchor (shouldn't normally happen
        -- but guard against negative mod in Postgres)
        IF v_days_since < 0 THEN
            -- Shift weeks backward until non-negative (cycle still aligns)
            v_days_since := v_days_since
                + ((ABS(v_days_since) / (v_schedule.cycle_weeks * 7) + 1)
                   * v_schedule.cycle_weeks * 7);
        END IF;

        v_week_in_cycle := (FLOOR(v_days_since::numeric / 7)::int
                            % v_schedule.cycle_weeks) + 1;

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

    END LOOP;
END;
$$;
