import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import type { BudgetCategory, BudgetCategoryType } from '../../types';

interface UseBudgetCategoriesReturn {
    categories: BudgetCategory[];
    incomeCategories: BudgetCategory[];
    expenseCategories: BudgetCategory[];
    loading: boolean;
    error: string | null;
    addCategory: (data: Omit<BudgetCategory, 'id' | 'workspace_id' | 'created_at'>) => Promise<void>;
    updateCategory: (id: string, data: Partial<BudgetCategory>) => Promise<void>;
    refetch: () => void;
}

export function useBudgetCategories(typeFilter?: BudgetCategoryType): UseBudgetCategoriesReturn {
    const { activeWorkspaceId } = useWorkspace();
    const [categories, setCategories] = useState<BudgetCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = useCallback(async () => {
        if (!activeWorkspaceId) return;
        setLoading(true);
        setError(null);

        let query = supabase
            .from('budget_categories')
            .select('*')
            .eq('workspace_id', activeWorkspaceId)
            .order('name', { ascending: true });

        if (typeFilter) query = query.eq('type', typeFilter);

        const { data, error: supaErr } = await query;

        if (supaErr) setError(supaErr.message);
        else setCategories(data ?? []);
        setLoading(false);
    }, [activeWorkspaceId, typeFilter]);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    const addCategory = async (data: Omit<BudgetCategory, 'id' | 'workspace_id' | 'created_at'>) => {
        if (!activeWorkspaceId) return;
        const { error } = await supabase
            .from('budget_categories')
            .insert({ ...data, workspace_id: activeWorkspaceId });
        if (error) throw new Error(error.message);
        await fetchCategories();
    };

    const updateCategory = async (id: string, data: Partial<BudgetCategory>) => {
        const { error } = await supabase
            .from('budget_categories')
            .update(data)
            .eq('id', id);
        if (error) throw new Error(error.message);
        await fetchCategories();
    };

    return {
        categories,
        incomeCategories: categories.filter(c => c.type === 'income'),
        expenseCategories: categories.filter(c => c.type === 'expense'),
        loading,
        error,
        addCategory,
        updateCategory,
        refetch: fetchCategories,
    };
}
