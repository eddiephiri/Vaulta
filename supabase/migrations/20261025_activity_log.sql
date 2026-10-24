-- Workspace activity history. Apply manually in Supabase SQL Editor.
-- Events start on deployment; existing history is not backfilled.
-- No automatic retention cleanup. No credentials, tokens, free-text notes,
-- bank details, phone numbers, licence numbers, or document contents are stored.
BEGIN;

CREATE TABLE public.activity_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL,
    actor_id uuid,
    actor_label text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    module text NOT NULL,
    action text NOT NULL CHECK (action IN ('created','updated','deleted','signed_in','signed_out','session_ended')),
    source text NOT NULL CHECK (source IN ('database','app_reported')),
    entity_table text NOT NULL,
    entity_id text,
    entity_label text NOT NULL,
    before_values jsonb,
    after_values jsonb,
    dedup_key text UNIQUE
);
CREATE INDEX activity_workspace_date ON public.activity_events(workspace_id, occurred_at DESC, id DESC);
CREATE INDEX activity_workspace_actor ON public.activity_events(workspace_id, actor_id, occurred_at DESC);
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_events FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.activity_events_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.activity_events TO authenticated;

CREATE FUNCTION public.can_view_activity(p_workspace uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.workspace_users
        WHERE workspace_id = p_workspace AND user_id = auth.uid()
        AND role IN ('owner','admin') AND (expires_at IS NULL OR expires_at > now()));
$$;
REVOKE ALL ON FUNCTION public.can_view_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_activity(uuid) TO authenticated;
CREATE POLICY activity_admin_read ON public.activity_events FOR SELECT TO authenticated
USING (public.can_view_activity(workspace_id));

CREATE FUNCTION public.activity_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    RAISE EXCEPTION 'Activity history is append-only';
END $$;
CREATE TRIGGER activity_no_changes BEFORE UPDATE OR DELETE OR TRUNCATE ON public.activity_events
FOR EACH STATEMENT EXECUTE FUNCTION public.activity_immutable();

CREATE FUNCTION public.activity_actor_label() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE WHEN auth.uid() IS NULL THEN 'System / database administrator'
        ELSE coalesce((SELECT left(coalesce(nullif(raw_user_meta_data->>'full_name',''),
            nullif(raw_user_meta_data->>'name',''),email),120) FROM auth.users WHERE id = auth.uid()), auth.uid()::text) END;
$$;

CREATE FUNCTION public.activity_snapshot(p_row jsonb, p_fields text[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE result jsonb; vehicle_label text;
BEGIN
    IF p_row IS NULL THEN RETURN NULL; END IF;
    SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO result
        FROM jsonb_each(p_row) WHERE key = ANY(p_fields);
    IF 'vehicle_id' = ANY(p_fields) AND p_row->>'vehicle_id' IS NOT NULL THEN
        SELECT concat_ws(' — ',plate,concat_ws(' ',make,model)) INTO vehicle_label FROM public.vehicles
            WHERE id = (p_row->>'vehicle_id')::uuid AND workspace_id = (p_row->>'workspace_id')::uuid;
        result := result || jsonb_build_object('assigned_vehicle',coalesce(vehicle_label,p_row->>'vehicle_id'));
    END IF;
    RETURN result;
END;
$$;

CREATE FUNCTION public.capture_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    old_row jsonb;
    new_row jsonb;
    old_values jsonb;
    new_values jsonb;
    old_ws uuid;
    new_ws uuid;
    row_data jsonb;
    workspace uuid;
    fields text[] := string_to_array(TG_ARGV[1], ',');
    event_module text;
    label text;
    actor text := public.activity_actor_label();
BEGIN
    IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
    old_values := public.activity_snapshot(old_row, fields);
    new_values := public.activity_snapshot(new_row, fields);
    -- Exclude timestamp churn, session heartbeats and untracked/sensitive fields.
    IF TG_OP = 'UPDATE' AND old_values IS NOT DISTINCT FROM new_values
        AND old_row->>'workspace_id' IS NOT DISTINCT FROM new_row->>'workspace_id' THEN RETURN NEW; END IF;
    old_ws := (CASE WHEN TG_TABLE_NAME = 'workspaces' THEN old_row->>'id' ELSE old_row->>'workspace_id' END)::uuid;
    new_ws := (CASE WHEN TG_TABLE_NAME = 'workspaces' THEN new_row->>'id' ELSE new_row->>'workspace_id' END)::uuid;
    row_data := coalesce(new_row,old_row);
    event_module := CASE WHEN TG_ARGV[0] = 'ledger' THEN coalesce(row_data->>'app_id','workspace') ELSE TG_ARGV[0] END;
    label := coalesce(row_data->>'plate',row_data->>'name',row_data->>'expected_date',row_data->>'type',TG_TABLE_NAME);
    -- A workspace transfer produces isolated departure/arrival events, never
    -- exposing the other workspace's snapshot to the current reader.
    IF TG_OP = 'UPDATE' AND old_ws IS DISTINCT FROM new_ws THEN
        IF old_ws IS NOT NULL THEN
            INSERT INTO public.activity_events(workspace_id,actor_id,actor_label,module,action,source,entity_table,entity_id,entity_label,before_values)
            VALUES(old_ws,auth.uid(),actor,CASE WHEN TG_ARGV[0] = 'ledger' THEN coalesce(old_row->>'app_id','workspace') ELSE TG_ARGV[0] END,
                'deleted','database',TG_TABLE_NAME,old_row->>'id',left(coalesce(old_row->>'plate',old_row->>'name',TG_TABLE_NAME),160),old_values);
        END IF;
        IF new_ws IS NOT NULL THEN
            INSERT INTO public.activity_events(workspace_id,actor_id,actor_label,module,action,source,entity_table,entity_id,entity_label,after_values)
            VALUES(new_ws,auth.uid(),actor,event_module,'created','database',TG_TABLE_NAME,new_row->>'id',left(label,160),new_values);
        END IF;
    ELSE
        workspace := coalesce(new_ws,old_ws);
        IF workspace IS NOT NULL THEN
            INSERT INTO public.activity_events(workspace_id,actor_id,actor_label,module,action,source,entity_table,entity_id,entity_label,before_values,after_values)
            VALUES(workspace,auth.uid(),actor,event_module,
                CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END,
                'database',TG_TABLE_NAME,row_data->>'id',left(label,160),old_values,new_values);
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

-- Explicit field allowlists; no whole-row JSON capture. Optional feature
-- tables are skipped if absent; apply this migration after feature migrations.
DO $$
DECLARE spec record;
BEGIN
    FOR spec IN SELECT * FROM (VALUES
        ('vehicles','transport','plate,make,model,year,status,odometer_km'),
        ('drivers','transport','name,vehicle_id,salary_zmw,hire_date,active'),
        ('transactions','ledger','app_id,type,amount_zmw,date,reference_entity_id,linked_transaction_id,created_by'),
        ('income','transport','vehicle_id,driver_id,amount_zmw,date,source,expected_cashing_id'),
        ('expenses','transport','vehicle_id,driver_id,amount_zmw,date,category'),
        ('cashing_schedules','transport','vehicle_id,income_source,cashing_day_of_week,cycle_weeks,salary_week,anchor_date,target_amount_zmw,active'),
        ('expected_cashings','transport','vehicle_id,schedule_id,expected_date,is_salary_week,week_number,status,transaction_id,income_record_id,target_amount_zmw,shortfall_zmw'),
        ('driver_advances','transport','driver_id,amount_zmw,issued_date,repayment_type,deduction_per_week_zmw,remaining_balance_zmw,status'),
        ('driver_cashing_corrections','transport','driver_id,transaction_id,proposed_amount_zmw,status,reviewed_by,reviewed_at'),
        ('driver_swap_requests','transport','driver_id,status,reviewed_by,reviewed_at'),
        ('driver_profile_edits','transport','driver_id,field,reviewed,reverted,reviewed_by,reviewed_at'),
        ('service_history','transport','vehicle_id,date,odometer_km,cost_zmw'),
        ('tyre_changes','transport','vehicle_id,date,odometer_km,cost_zmw'),
        ('licensing','transport','vehicle_id,license_type,issued_date,expiry_date,cost_zmw'),
        ('budget_accounts','budget','name,type,currency'),
        ('budget_categories','budget','name,type'),
        ('budget_sheets','budget','name,month,status'),
        ('budget_sheet_items','budget','sheet_id,name,category,estimated_zmw,actual_zmw,is_purchased,purchased_at'),
        ('subscriptions','personal','name,amount_zmw,billing_cycle,next_billing_date,status,active'),
        ('workspace_users','workspace','user_id,role,expires_at,authorized_apps,editable_apps'),
        ('workspace_access_codes','workspace','role,authorized_apps,editable_apps,expires_at,created_by'),
        ('workspace_apps','workspace','app_id'),
        ('workspaces','workspace','name')
    ) AS config(table_name,module,fields) LOOP
        IF to_regclass('public.' || spec.table_name) IS NOT NULL THEN
            EXECUTE format('CREATE TRIGGER capture_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_activity(%L,%L)',spec.table_name,spec.module,spec.fields);
        END IF;
    END LOOP;
END $$;

-- Auth events are explicitly APP-REPORTED, not authoritative provider logs.
-- Identity, workspace membership, timestamp and deduplication are server-derived.
-- Only the caller's current session can be reported; no arbitrary audit payload.
CREATE FUNCTION public.record_my_auth_activity(p_action text, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    session_id text := auth.jwt()->>'session_id';
    workspace uuid;
BEGIN
    IF auth.uid() IS NULL OR session_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF p_action NOT IN ('signed_in','signed_out','session_ended') THEN RAISE EXCEPTION 'Invalid auth event'; END IF;
    IF p_reason IS NOT NULL AND p_reason NOT IN ('idle_timeout','another_device','session_expired') THEN RAISE EXCEPTION 'Invalid session reason'; END IF;
    FOR workspace IN
        SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND (expires_at IS NULL OR expires_at > now())
        UNION SELECT workspace_id FROM public.drivers WHERE user_id = auth.uid() AND active = true AND workspace_id IS NOT NULL
    LOOP
        INSERT INTO public.activity_events(workspace_id,actor_id,actor_label,module,action,source,entity_table,entity_id,entity_label,after_values,dedup_key)
        VALUES(workspace,auth.uid(),public.activity_actor_label(),'authentication',p_action,'app_reported','auth_session',NULL,'Account session',
            CASE WHEN p_reason IS NULL THEN NULL ELSE jsonb_build_object('reason',p_reason) END,
            md5(workspace::text || auth.uid()::text || session_id || p_action))
        ON CONFLICT (dedup_key) DO NOTHING;
    END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.record_my_auth_activity(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_my_auth_activity(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.capture_activity(), public.activity_actor_label(), public.activity_snapshot(jsonb,text[]), public.activity_immutable() FROM PUBLIC, anon, authenticated;
COMMIT;

-- Review the installed coverage after applying (optional feature tables must
-- already exist when this migration runs).
SELECT event_object_table AS tracked_table, string_agg(event_manipulation, ', ' ORDER BY event_manipulation) AS captured_actions
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'capture_activity'
GROUP BY event_object_table ORDER BY event_object_table;
