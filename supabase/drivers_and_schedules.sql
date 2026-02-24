-- =============================================================================
-- Vaulta — Driver Management, Cashing Schedules & Reminders
-- Run once in Supabase SQL Editor after schema.sql and triggers.sql.
-- =============================================================================

-- ─── 1. Drivers ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drivers (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text        NOT NULL,
    phone           text,
    license_number  text,
    vehicle_id      uuid        REFERENCES public.vehicles(id) ON DELETE SET NULL,
    salary_zmw      numeric     NOT NULL DEFAULT 0,
    hire_date       date,
    active          boolean     NOT NULL DEFAULT true,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access — drivers"
    ON public.drivers FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ─── 2. Cashing Schedules ────────────────────────────────────────────────────
-- One row per vehicle per income source describing the expected cashing rhythm.

CREATE TABLE IF NOT EXISTS public.cashing_schedules (
    id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id          uuid    NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    income_source       text    NOT NULL
                                    CHECK (income_source IN ('yango','public_transport','rental','other')),
    -- Day of week (0=Sun … 6=Sat). NULL means no fixed cashing day (e.g. bus).
    cashing_day_of_week int     CHECK (cashing_day_of_week BETWEEN 0 AND 6),
    -- Total weeks in one cycle before it resets.
    cycle_weeks         int     NOT NULL DEFAULT 4,
    -- Which week of the cycle is the salary/deduction week (1-indexed).
    salary_week         int     NOT NULL DEFAULT 4,
    active              boolean NOT NULL DEFAULT true,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashing_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access — cashing_schedules"
    ON public.cashing_schedules FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ─── 3. Expected Cashings ────────────────────────────────────────────────────
-- One row per expected cashing event.
-- Auto-generated based on schedule, or inserted manually.

CREATE TABLE IF NOT EXISTS public.expected_cashings (
    id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id       uuid    NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    schedule_id      uuid    REFERENCES public.cashing_schedules(id) ON DELETE SET NULL,
    expected_date    date    NOT NULL,
    is_salary_week   boolean NOT NULL DEFAULT false,
    week_number      int     NOT NULL DEFAULT 1,  -- position in cycle (1 … cycle_weeks)
    -- linked to an income record once the cashing is logged
    income_record_id uuid    REFERENCES public.income(id) ON DELETE SET NULL,
    -- pending = not yet logged; recorded = logged on time;
    -- late_driver = driver was late; late_admin = admin forgot to log
    status           text    NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','recorded','late_driver','late_admin')),
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expected_cashings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access — expected_cashings"
    ON public.expected_cashings FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ─── 4. Extend income table ──────────────────────────────────────────────────

-- Period dates: the week/range this cashing covers (gross income, Approach A).
ALTER TABLE public.income
    ADD COLUMN IF NOT EXISTS period_start        date,
    ADD COLUMN IF NOT EXISTS period_end          date,
    ADD COLUMN IF NOT EXISTS driver_id           uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expected_cashing_id uuid REFERENCES public.expected_cashings(id) ON DELETE SET NULL;

-- Add public_transport to allowed sources (drop + recreate constraint).
ALTER TABLE public.income
    DROP CONSTRAINT IF EXISTS income_source_check;

ALTER TABLE public.income
    ADD CONSTRAINT income_source_check
    CHECK (source IN ('yango','public_transport','rental','other'));

-- ─── 5. Extend expenses table ────────────────────────────────────────────────

-- Link salary expense entries to the driver being paid.
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL;

-- =============================================================================
-- Helper function: generate expected_cashings for the next N weeks
-- from a given schedule. Call after inserting a cashing_schedule.
--
-- Usage:
--   SELECT generate_expected_cashings('<schedule_id>', 12);
--   (generates 12 weeks of expected cashing rows)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_expected_cashings(
    p_schedule_id uuid,
    p_weeks       int DEFAULT 12
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_schedule      public.cashing_schedules%ROWTYPE;
    v_start_date    date;
    v_expected_date date;
    v_week_in_cycle int;
    i               int;
BEGIN
    SELECT * INTO v_schedule FROM public.cashing_schedules WHERE id = p_schedule_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule % not found', p_schedule_id;
    END IF;

    -- Start from today's date or the next occurrence of the cashing day
    v_start_date := CURRENT_DATE;

    FOR i IN 1..p_weeks LOOP
        -- Week number within the cycle (1-indexed)
        v_week_in_cycle := ((i - 1) % v_schedule.cycle_weeks) + 1;

        IF v_schedule.cashing_day_of_week IS NOT NULL THEN
            -- Advance to the next occurrence of the target day of week
            v_expected_date := v_start_date + (
                (v_schedule.cashing_day_of_week - EXTRACT(DOW FROM v_start_date)::int + 7) % 7
                + (i - 1) * 7
            )::int;
        ELSE
            -- No fixed day — just space weeks evenly from today
            v_expected_date := v_start_date + ((i - 1) * 7)::int;
        END IF;

        INSERT INTO public.expected_cashings
            (vehicle_id, schedule_id, expected_date, is_salary_week, week_number)
        VALUES (
            v_schedule.vehicle_id,
            v_schedule.id,
            v_expected_date,
            v_week_in_cycle = v_schedule.salary_week,
            v_week_in_cycle
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
