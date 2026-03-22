import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import type { BudgetAccount } from '../../types';

interface UseBudgetAccountsReturn {
    accounts: BudgetAccount[];
    loading: boolean;
    error: string | null;
    addAccount: (data: Omit<BudgetAccount, 'id' | 'workspace_id' | 'created_at'>) => Promise<void>;
    updateAccount: (id: string, data: Partial<BudgetAccount>) => Promise<void>;
    refetch: () => void;
}

export function useBudgetAccounts(): UseBudgetAccountsReturn {
    const { activeWorkspaceId } = useWorkspace();
    const [accounts, setAccounts] = useState<BudgetAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAccounts = useCallback(async () => {
        if (!activeWorkspaceId) return;
        setLoading(true);
        setError(null);

        const { data, error: supaErr } = await supabase
            .from('budget_accounts')
            .select('*')
            .eq('workspace_id', activeWorkspaceId)
            .order('name', { ascending: true });

        if (supaErr) setError(supaErr.message);
        else setAccounts(data ?? []);
        setLoading(false);
    }, [activeWorkspaceId]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const addAccount = async (data: Omit<BudgetAccount, 'id' | 'workspace_id' | 'created_at'>) => {
        if (!activeWorkspaceId) return;
        const { error } = await supabase
            .from('budget_accounts')
            .insert({ ...data, workspace_id: activeWorkspaceId });
        if (error) throw new Error(error.message);
        await fetchAccounts();
    };

    const updateAccount = async (id: string, data: Partial<BudgetAccount>) => {
        const { error } = await supabase
            .from('budget_accounts')
            .update(data)
            .eq('id', id);
        if (error) throw new Error(error.message);
        await fetchAccounts();
    };

    return { accounts, loading, error, addAccount, updateAccount, refetch: fetchAccounts };
}
