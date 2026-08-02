import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';

export interface DriverAdvance {
    id: string;
    workspace_id: string;
    driver_id: string;
    amount_zmw: number;
    issued_date: string;
    repayment_type: 'salary_deduction' | 'cash' | 'other';
    deduction_per_week_zmw: number;
    remaining_balance_zmw: number;
    status: 'active' | 'repaid' | 'cancelled';
    notes?: string;
    created_at: string;
}

export function useDriverAdvances() {
    const { activeWorkspaceId } = useWorkspace();
    const [advances, setAdvances] = useState<DriverAdvance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAdvances = useCallback(async () => {
        if (!activeWorkspaceId) return;
        setLoading(true);
        setError(null);

        const { data, error: supaErr } = await supabase
            .from('driver_advances')
            .select('*')
            .eq('workspace_id', activeWorkspaceId)
            .order('issued_date', { ascending: false });

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setAdvances(data ?? []);
        }
        setLoading(false);
    }, [activeWorkspaceId]);

    useEffect(() => {
        fetchAdvances();
    }, [fetchAdvances]);

    return { advances, loading, error, refetch: fetchAdvances };
}
