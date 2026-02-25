-- ============================================================
--  Vaulta — Supabase Schema
--  Run this entire file in the Supabase SQL Editor
--  Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Vehicles ───────────────────────────────────────────────
create table if not exists public.vehicles (
    id          uuid primary key default gen_random_uuid(),
    plate       text not null unique,
    make        text not null,
    model       text not null,
    year        int  not null,
    color       text not null default '',
    status      text not null default 'active'
                    check (status in ('active', 'inactive', 'maintenance')),
    odometer_km numeric not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger vehicles_updated_at
    before update on public.vehicles
    for each row execute procedure public.set_updated_at();

-- ─── Service History ────────────────────────────────────────
create table if not exists public.service_history (
    id               uuid primary key default gen_random_uuid(),
    vehicle_id       uuid not null references public.vehicles(id) on delete cascade,
    date             date not null,
    description      text not null,
    service_provider text,
    cost_zmw         numeric not null default 0,
    odometer_km      numeric,
    notes            text,
    created_at       timestamptz not null default now()
);

-- ─── Tyre Changes ───────────────────────────────────────────
create table if not exists public.tyre_changes (
    id          uuid primary key default gen_random_uuid(),
    vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
    date        date not null,
    position    text not null
                    check (position in ('front_left','front_right','rear_left','rear_right','spare')),
    brand       text,
    tyre_size   text,
    cost_zmw    numeric not null default 0,
    odometer_km numeric,
    notes       text,
    created_at  timestamptz not null default now()
);

-- ─── Licensing ──────────────────────────────────────────────
create table if not exists public.licensing (
    id                  uuid primary key default gen_random_uuid(),
    vehicle_id          uuid not null references public.vehicles(id) on delete cascade,
    license_type        text not null
                            check (license_type in ('road_tax','fitness_certificate','insurance','council_permit','other')),
    issued_date         date not null,
    expiry_date         date not null,
    cost_zmw            numeric not null default 0,
    document_url        text,
    reminder_days_before int not null default 14,
    notes               text,
    created_at          timestamptz not null default now()
);

-- ─── Income ─────────────────────────────────────────────────
create table if not exists public.income (
    id          uuid primary key default gen_random_uuid(),
    vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
    date        date not null,
    amount_zmw  numeric not null default 0,
    source      text not null
                    check (source in ('yango','rental','other')),
    reference   text,
    notes       text,
    created_at  timestamptz not null default now()
);

-- ─── Expenses ───────────────────────────────────────────────
create table if not exists public.expenses (
    id           uuid primary key default gen_random_uuid(),
    vehicle_id   uuid not null references public.vehicles(id) on delete cascade,
    date         date not null,
    amount_zmw   numeric not null default 0,
    category     text not null
                     check (category in ('fuel','service','tyre','licensing','insurance','repairs','salary','wash','other')),
    description  text,
    notes        text,
    -- set by triggers when auto-generated from service_history / tyre_changes / licensing
    source_table text,
    source_id    uuid,
    created_at   timestamptz not null default now()
);

-- NOTE: Auto-expense triggers are in supabase/triggers.sql
-- Run triggers.sql after this file to enable auto-population of expenses.

-- ─── Row-Level Security (RLS) ───────────────────────────────
-- Enable RLS on all tables (blocks public access by default)
alter table public.vehicles        enable row level security;
alter table public.service_history enable row level security;
alter table public.tyre_changes    enable row level security;
alter table public.licensing       enable row level security;
alter table public.income          enable row level security;
alter table public.expenses        enable row level security;

-- Single-admin policy: only authenticated users can read/write everything.
-- Since FleetFlow has one admin user, we simply allow all operations for
-- any authenticated session. You can tighten this later with user_id checks.

create policy "Authenticated full access — vehicles"
    on public.vehicles for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access — service_history"
    on public.service_history for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access — tyre_changes"
    on public.tyre_changes for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access — licensing"
    on public.licensing for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access — income"
    on public.income for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access — expenses"
    on public.expenses for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─── Useful views (optional) ────────────────────────────────

-- Monthly income summary per vehicle
create or replace view public.v_monthly_income
    with (security_invoker = true)
as
select
    vehicle_id,
    date_trunc('month', date) as month,
    sum(amount_zmw)           as total_zmw
from public.income
group by vehicle_id, date_trunc('month', date);

-- Monthly expense summary per vehicle
create or replace view public.v_monthly_expenses
    with (security_invoker = true)
as
select
    vehicle_id,
    date_trunc('month', date) as month,
    category,
    sum(amount_zmw)           as total_zmw
from public.expenses
group by vehicle_id, date_trunc('month', date), category;

-- Licensing records expiring within the next 30 days
create or replace view public.v_expiring_licenses
    with (security_invoker = true)
as
select
    l.*,
    v.plate,
    v.make,
    v.model,
    (l.expiry_date - current_date) as days_remaining
from public.licensing l
join public.vehicles v on v.id = l.vehicle_id
where l.expiry_date between current_date and (current_date + interval '30 days')
order by l.expiry_date;
