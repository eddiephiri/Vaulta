-- =============================================================================
-- Fix: Security Definer Views → Security Invoker
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
--
-- By default, Postgres views run as the VIEW OWNER (security definer),
-- which means they bypass Row Level Security on their underlying tables.
-- Supabase flags this as a security risk.
--
-- Recreating the views WITH (security_invoker = true) ensures they execute
-- with the permissions of the CALLING user, so RLS is always enforced.
-- =============================================================================

-- ─── v_monthly_income ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_monthly_income
    WITH (security_invoker = true)
AS
SELECT
    vehicle_id,
    date_trunc('month', date) AS month,
    sum(amount_zmw)           AS total_zmw
FROM public.income
GROUP BY vehicle_id, date_trunc('month', date);

-- ─── v_monthly_expenses ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_monthly_expenses
    WITH (security_invoker = true)
AS
SELECT
    vehicle_id,
    date_trunc('month', date) AS month,
    category,
    sum(amount_zmw)           AS total_zmw
FROM public.expenses
GROUP BY vehicle_id, date_trunc('month', date), category;

-- ─── v_expiring_licenses ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_expiring_licenses
    WITH (security_invoker = true)
AS
SELECT
    l.*,
    v.plate,
    v.make,
    v.model,
    (l.expiry_date - current_date) AS days_remaining
FROM public.licensing l
JOIN public.vehicles v ON v.id = l.vehicle_id
WHERE l.expiry_date BETWEEN current_date AND (current_date + INTERVAL '30 days')
ORDER BY l.expiry_date;
