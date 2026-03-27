-- =============================================================================
-- Migration: Add "deferred_to_salary" option for expected_cashings.status
-- Run this in the Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.expected_cashings
    DROP CONSTRAINT IF EXISTS expected_cashings_status_check;

ALTER TABLE public.expected_cashings
    ADD CONSTRAINT expected_cashings_status_check
    CHECK (status IN ('pending', 'recorded', 'late_driver', 'late_admin', 'deferred_to_salary'));
