import { supabase } from './supabase';

export type AuthActivityAction = 'signed_in' | 'signed_out' | 'session_ended';
export type SessionEndReason = 'idle_timeout' | 'another_device' | 'session_expired';

// Best effort only: telemetry must never block signing in/out or hold the
// Supabase auth callback lock. The database derives identity and deduplicates.
export async function reportAuthActivity(action: AuthActivityAction, reason?: SessionEndReason) {
    try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 2000);
        try {
            const { error } = await supabase.rpc('record_my_auth_activity', {
                p_action: action, p_reason: reason ?? null,
            }).abortSignal(controller.signal);
            if (error && import.meta.env.DEV) console.warn('Authentication activity could not be recorded.');
        } finally { window.clearTimeout(timeout); }
    } catch {
        // Missing migrations, network failures or an already invalid session
        // must not interfere with authentication.
    }
}

export interface ActivityEvent {
    id: number;
    workspace_id: string;
    actor_id: string | null;
    actor_label: string;
    occurred_at: string;
    module: string;
    action: string;
    source: 'database' | 'app_reported';
    entity_table: string;
    entity_id: string | null;
    entity_label: string;
    before_values: Record<string, unknown> | null;
    after_values: Record<string, unknown> | null;
}

export const ACTIVITY_ACTIONS: Record<string, string> = {
    created: 'Created', updated: 'Updated', deleted: 'Deleted',
    signed_in: 'Signed in', signed_out: 'Signed out', session_ended: 'Session ended',
};
export const ACTIVITY_ENTITIES: Record<string, string> = {
    vehicles: 'Vehicle', drivers: 'Driver', transactions: 'Transaction',
    income: 'Income', expenses: 'Expense', cashing_schedules: 'Cashing schedule',
    expected_cashings: 'Expected cashing', driver_advances: 'Advance / loan',
    driver_cashing_corrections: 'Cashing correction', driver_swap_requests: 'Week swap request',
    driver_profile_edits: 'Profile review', service_history: 'Service', tyre_changes: 'Tyre change',
    licensing: 'Licence', budget_accounts: 'Budget account', budget_categories: 'Budget category',
    budget_sheets: 'Budget sheet', budget_sheet_items: 'Budget item', workspace_users: 'Membership',
    workspace_access_codes: 'Access pass', workspace_apps: 'Workspace module', workspaces: 'Workspace',
    auth_session: 'Account session',
    subscriptions: 'Subscription',
};

export function activityChanges(event: Pick<ActivityEvent, 'before_values' | 'after_values'>) {
    const before = event.before_values ?? {};
    const after = event.after_values ?? {};
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter(field => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
        .map(field => ({ field, before: before[field], after: after[field] }));
}
