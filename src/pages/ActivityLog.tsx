import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, activityChanges } from '../lib/activity';
import type { ActivityEvent } from '../lib/activity';

const MODULES: Record<string, string> = {
    transport: 'Transport Business', budget: 'Home Budgeting', personal: 'Personal Expenses',
    workspace: 'Workspace', authentication: 'Authentication',
};
const PAGE_SIZE = 25;
const EMPTY_FILTERS = { from: '', to: '', actor: '', module: '', action: '', entity: '', record: '' };
const control = 'rounded-lg border p-2 text-sm min-w-0 w-full';
const surface = { background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', borderColor: 'var(--ff-border)' };
function display(value: unknown): string {
    if (value === undefined || value === null) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function ActivityLog() {
    const { activeWorkspaceId, userRole, loading } = useWorkspace();
    if (loading) return <p role="status">Loading workspace…</p>;
    if (!activeWorkspaceId || !['owner', 'admin'].includes(userRole ?? '')) {
        return <div className="p-6"><h1 className="text-xl font-bold">Activity Log</h1>
            <p className="my-4">Only workspace owners and administrators can view activity history.</p><Link to="/settings">Back to settings</Link></div>;
    }
    return <ActivityLogContent key={activeWorkspaceId} workspaceId={activeWorkspaceId} />;
}

function ActivityLogContent({ workspaceId }: { workspaceId: string }) {
    const [draft, setDraft] = useState(EMPTY_FILTERS);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(0);
    const [refresh, setRefresh] = useState(0);
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [validation, setValidation] = useState('');
    const [recordNotice, setRecordNotice] = useState('');
    const [checking, setChecking] = useState<number | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        let current = true;
        async function load() {
            setLoading(true); setError(null); setEvents([]); setHasMore(false);
            let query = supabase.from('activity_events')
                .select('id,workspace_id,actor_id,actor_label,occurred_at,module,action,source,entity_table,entity_id,entity_label,before_values,after_values')
                .eq('workspace_id', workspaceId)
                .order('occurred_at', { ascending: false }).order('id', { ascending: false });
            if (filters.from) query = query.gte('occurred_at', new Date(`${filters.from}T00:00:00`).toISOString());
            if (filters.to) {
                const end = new Date(`${filters.to}T00:00:00`); end.setDate(end.getDate() + 1);
                query = query.lt('occurred_at', end.toISOString());
            }
            if (filters.actor) query = query.ilike('actor_label', `%${filters.actor.replace(/[%_\\]/g, '\\$&')}%`);
            if (filters.module) query = query.eq('module', filters.module);
            if (filters.action) query = query.eq('action', filters.action);
            if (filters.entity) query = query.eq('entity_table', filters.entity);
            if (filters.record) query = query.eq('entity_id', filters.record);
            try {
                const { data, error: loadError } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).abortSignal(controller.signal);
                if (!current) return;
                if (loadError) setError(['42P01', 'PGRST205'].includes(loadError.code)
                    ? 'Activity tracking is not installed yet. Apply the activity log SQL migration first.'
                    : 'Could not load activity history. Check your access and connection, then retry.');
                else { setEvents((data ?? []).slice(0, PAGE_SIZE) as ActivityEvent[]); setHasMore((data?.length ?? 0) > PAGE_SIZE); }
            } catch { if (current) setError('Could not load activity history. Please retry.'); }
            finally { if (current) setLoading(false); }
        }
        void load();
        return () => { current = false; controller.abort(); };
    }, [workspaceId, filters, page, refresh]);

    // Existing screens are list views. Verify the source record still exists
    // before offering its section; retain the snapshot when it was deleted later.
    const sections: Record<string, string> = {
        vehicles: '/transport/vehicles', drivers: '/transport/drivers',
        cashing_schedules: '/transport/cashing-schedules', expected_cashings: '/transport/cashing-schedules',
        service_history: '/transport/service-history', tyre_changes: '/transport/tyre-changes', licensing: '/transport/licensing',
        budget_sheets: '/budget/budget-sheets', budget_sheet_items: '/budget/budget-sheets',
        budget_accounts: '/budget/settings', budget_categories: '/budget/settings',
        driver_advances: '/transport/drivers', driver_cashing_corrections: '/transport/cashing-schedules',
        driver_swap_requests: '/transport/cashing-schedules', subscriptions: '/personal/subscriptions',
    };
    function sectionFor(event: ActivityEvent) {
        if (event.entity_table === 'transactions' && ['transport', 'budget', 'personal'].includes(event.module)) {
            const type = (event.after_values ?? event.before_values)?.type;
            if (type === 'income' && event.module !== 'personal') return `/${event.module}/income`;
            if (type === 'expense') return `/${event.module}/expenses`;
        }
        return sections[event.entity_table];
    }
    async function checkRecord(event: ActivityEvent) {
        const section = sectionFor(event);
        if (!event.entity_id || !section) return;
        setChecking(event.id); setRecordNotice('');
        try {
            const { data, error: checkError } = await supabase.from(event.entity_table).select('id')
                .eq('id', event.entity_id).eq('workspace_id', workspaceId).maybeSingle();
            if (checkError) setRecordNotice('Could not check the record. Please try again.');
            else if (!data) setRecordNotice('This record is no longer available. Its history remains below.');
            else window.location.assign(section);
        } catch { setRecordNotice('Could not check the record. Please try again.'); }
        finally { setChecking(null); }
    }

    return <main className="min-h-screen p-4 sm:p-8" style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-primary)' }}>
        <div className="max-w-5xl mx-auto">
            <Link to="/settings" className="text-sm underline">← Workspace settings</Link>
            <div className="flex justify-between items-center gap-3 my-5"><h1 className="text-2xl font-bold">Activity Log</h1>
                <button className={control + ' !w-auto'} style={surface} onClick={() => { setPage(0); setRefresh(value => value + 1); }}>Refresh</button></div>
            <p className="text-sm mb-5" style={{ color: 'var(--ff-text-muted)' }}>Business changes are recorded automatically from the date tracking was installed. Times use your device’s timezone. Authentication events are reported by the app and may be incomplete. History is retained without automatic deletion.</p>
            <form className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border rounded-xl mb-5" style={surface} onSubmit={event => {
                event.preventDefault();
                if (draft.from && draft.to && draft.from > draft.to) { setValidation('The end date must be on or after the start date.'); return; }
                setValidation(''); setPage(0); setFilters({ ...draft, actor: draft.actor.trim(), record: draft.record.trim() });
            }}>
                <label className="text-xs">From<input type="date" className={control} style={surface} value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
                <label className="text-xs">To<input type="date" className={control} style={surface} value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
                <label className="text-xs">User<input className={control} style={surface} placeholder="Name or email" value={draft.actor} onChange={event => setDraft({ ...draft, actor: event.target.value })} /></label>
                {(['module', 'action', 'entity'] as const).map(key => <label className="text-xs capitalize" key={key}>{key === 'entity' ? 'Record type' : key}
                    <select className={control} style={surface} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })}>
                        <option value="">All</option>{Object.entries(key === 'module' ? MODULES : key === 'action' ? ACTIVITY_ACTIONS : ACTIVITY_ENTITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select></label>)}
                <label className="text-xs col-span-full">Record ID<input className={control} style={surface} placeholder="Optional: exact record ID from an event" value={draft.record} onChange={event => setDraft({ ...draft, record: event.target.value })} /></label>
                {validation && <p role="alert" className="col-span-full text-sm text-red-500">{validation}</p>}
                <div className="col-span-full flex gap-3"><button className={control + ' !w-auto'} style={surface}>Apply filters</button>
                    <button type="button" className="text-sm underline" onClick={() => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(0); setValidation(''); }}>Clear filters</button></div>
            </form>
            {recordNotice && <p role="status" className="mb-4">{recordNotice}</p>}
            {loading ? <p role="status">Loading activity…</p> : error ? <p role="alert">{error}</p> : events.length === 0 ? <p>No activity matches these filters. Earlier activity is not backfilled.</p> :
                <div className="space-y-3">{events.map(event => <article key={event.id} className="border rounded-xl p-4" style={surface}>
                    <p className="text-sm font-semibold">{event.actor_label} · {ACTIVITY_ACTIONS[event.action] ?? event.action} · {ACTIVITY_ENTITIES[event.entity_table] ?? event.entity_table}: {event.entity_label}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}><time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</time> · {MODULES[event.module] ?? event.module} · {event.source === 'database' ? 'Database recorded' : 'Reported by app'}</p>
                    <details className="mt-3 text-sm"><summary className="cursor-pointer">View changes</summary>
                        <p className="text-xs my-2 break-all">Record ID: {event.entity_id ?? 'Account session'} · User ID: {event.actor_id ?? 'System / administrator'}</p>
                        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Field</th><th className="p-2">Before</th><th className="p-2">After</th></tr></thead><tbody>
                            {activityChanges(event).map(change => <tr key={change.field} className="border-t" style={{ borderColor: 'var(--ff-border)' }}><td className="p-2">{change.field.replaceAll('_', ' ')}</td><td className="p-2 break-all">{display(change.before)}</td><td className="p-2 break-all">{display(change.after)}</td></tr>)}
                        </tbody></table></div>
                        {event.action !== 'deleted' && sectionFor(event) && <button className="mt-3 underline" disabled={checking !== null} onClick={() => void checkRecord(event)}>Open record section</button>}
                    </details>
                </article>)}</div>}
            <div className="flex items-center justify-between mt-5 gap-3"><button className={control + ' !w-auto disabled:opacity-40'} style={surface} disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous</button>
                <span className="text-sm">Page {page + 1}</span><button className={control + ' !w-auto disabled:opacity-40'} style={surface} disabled={loading || !hasMore} onClick={() => setPage(value => value + 1)}>Next</button></div>
        </div>
    </main>;
}
