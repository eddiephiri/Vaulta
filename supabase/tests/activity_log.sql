-- DESTRUCTIVE FIXTURE SETUP: run ONLY in a fresh disposable test database.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/activity_log.sql
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.workspaces(id uuid PRIMARY KEY,name text);
CREATE TABLE public.workspace_users(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,workspace_id uuid,user_id uuid,role text,expires_at timestamptz,last_active_workspace boolean);
CREATE TABLE public.vehicles(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,workspace_id uuid,plate text,make text,model text,status text CHECK(status IN ('active','inactive')),notes text);
CREATE TABLE public.drivers(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,workspace_id uuid,user_id uuid,name text,vehicle_id uuid,salary_zmw numeric,active boolean,phone text);
CREATE TABLE public.transactions(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,workspace_id uuid,app_id text,type text,amount_zmw numeric,date date,description text,metadata jsonb);
INSERT INTO auth.users VALUES
 ('11111111-1111-1111-1111-111111111111','owner@example.test','{}'),
 ('22222222-2222-2222-2222-222222222222','member@example.test','{}'),
 ('33333333-3333-3333-3333-333333333333','other@example.test','{}'),
 ('44444444-4444-4444-4444-444444444444','admin@example.test','{}'),
 ('55555555-5555-5555-5555-555555555555','expired@example.test','{}');
INSERT INTO public.workspaces VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','First'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Second');
INSERT INTO public.workspace_users(workspace_id,user_id,role,expires_at) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','owner',NULL),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','member',NULL),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333','owner',NULL),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','44444444-4444-4444-4444-444444444444','admin',NULL),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555','admin',now()-interval '1 day');
\ir ../migrations/20261025_activity_log.sql
CREATE FUNCTION public.test_assert(condition boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;

BEGIN;
-- Direct SQL captures a system actor. Created/updated/deleted snapshots survive
-- source record deletion, and only configured fields may be stored.
INSERT INTO public.vehicles(workspace_id,plate,make,model,status,notes)
VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','TEST 1','Honda','Fit','active','PRIVATE');
SELECT public.test_assert((SELECT count(*)=1 FROM public.activity_events),'one create event');
SELECT public.test_assert((SELECT actor_id IS NULL AND source='database' FROM public.activity_events LIMIT 1),'SQL actor is system');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.activity_events WHERE after_values ? 'notes'),'notes excluded');
UPDATE public.vehicles SET notes='OTHER PRIVATE';
SELECT public.test_assert((SELECT count(*)=1 FROM public.activity_events),'sensitive-only update not logged');
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","session_id":"session-test"}',false);
INSERT INTO public.drivers(workspace_id,name,vehicle_id,salary_zmw,active,phone)
SELECT workspace_id,'Driver test',id,2000,true,'PRIVATE PHONE' FROM public.vehicles;
UPDATE public.drivers SET vehicle_id=NULL;
SELECT public.test_assert((SELECT before_values->>'assigned_vehicle'='TEST 1 — Honda Fit' AND after_values->>'vehicle_id' IS NULL
    FROM public.activity_events WHERE entity_table='drivers' AND action='updated'),'assignment shows readable previous vehicle');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.activity_events WHERE after_values ? 'phone'),'phone excluded');
UPDATE public.vehicles SET status='inactive';
SELECT public.test_assert((SELECT before_values->>'status'='active' AND after_values->>'status'='inactive' AND actor_id=auth.uid()
    FROM public.activity_events WHERE entity_table='vehicles' AND action='updated'),'actor and before/after values');
INSERT INTO public.transactions(workspace_id,app_id,type,amount_zmw,date,description,metadata)
VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','budget','income',100,CURRENT_DATE,'PRIVATE','{"password":"PRIVATE"}');
SELECT public.test_assert((SELECT module='budget' AND NOT(after_values ? 'metadata') AND NOT(after_values ? 'description')
    FROM public.activity_events WHERE entity_table='transactions'),'ledger module and sensitive metadata excluded');
UPDATE public.vehicles SET workspace_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',plate='SECOND WORKSPACE LABEL';
SELECT public.test_assert((SELECT count(*)=2 FROM public.activity_events WHERE entity_table='vehicles' AND action IN ('created','deleted') AND entity_label='TEST 1'),'departure retains old label');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.activity_events WHERE workspace_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND (after_values->>'plate'='SECOND WORKSPACE LABEL' OR entity_label='SECOND WORKSPACE LABEL')),'transfer does not leak new workspace values');
DELETE FROM public.vehicles;
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.activity_events WHERE entity_table='vehicles' AND action='deleted'),'deletion retained');

DO $$ DECLARE previous bigint; BEGIN
    SELECT count(*) INTO previous FROM public.activity_events;
    BEGIN
        INSERT INTO public.vehicles(workspace_id,plate,status) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ROLLED BACK','active');
        RAISE EXCEPTION 'deliberate rollback';
    EXCEPTION WHEN raise_exception THEN NULL; END;
    PERFORM public.test_assert((SELECT count(*)=previous FROM public.activity_events),'rolled back change has no event');
    BEGIN
        INSERT INTO public.vehicles(workspace_id,plate,status) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','INVALID','invalid');
    EXCEPTION WHEN check_violation THEN NULL; END;
    PERFORM public.test_assert((SELECT count(*)=previous FROM public.activity_events),'failed change has no event');
    BEGIN DELETE FROM public.activity_events; RAISE EXCEPTION 'delete unexpectedly allowed';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Activity history is append-only' THEN RAISE; END IF;
    END;
END $$;

SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*)>0 FROM public.activity_events),'owner can read own history');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.activity_events WHERE workspace_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),'owner cannot read another workspace');
SELECT public.record_my_auth_activity('signed_in');
SELECT public.record_my_auth_activity('signed_in');
SELECT public.test_assert((SELECT count(*)=1 FROM public.activity_events WHERE action='signed_in'),'sign-in deduplicated');
SELECT public.test_assert((SELECT source='app_reported' AND actor_id=auth.uid() FROM public.activity_events WHERE action='signed_in'),'auth source and actor');
DO $$ BEGIN
    BEGIN
        INSERT INTO public.activity_events(workspace_id,actor_label,module,action,source,entity_table,entity_label)
        VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','forged','transport','created','database','vehicles','forged');
        RAISE EXCEPTION 'direct insert unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN UPDATE public.activity_events SET actor_label='forged'; RAISE EXCEPTION 'update unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM public.record_my_auth_activity('created'); RAISE EXCEPTION 'invalid auth event allowed';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid auth event' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
SELECT public.test_assert((SELECT count(*)>0 FROM public.activity_events),'admin can read');
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
SELECT public.test_assert((SELECT count(*)=0 FROM public.activity_events),'member cannot read');
SELECT set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
SELECT public.test_assert((SELECT count(*)=0 FROM public.activity_events),'expired admin cannot read');
SELECT set_config('request.jwt.claims','{}',false);
SELECT public.test_assert((SELECT count(*)=0 FROM public.activity_events),'no identity cannot read');
RESET ROLE;
ROLLBACK;
\echo 'Activity log integration checks passed'
