import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetIncomeRecord } from '../../types';

function startOf(unit: 'day' | 'week' | 'month'): string {
    const d = new Date();
    if (unit === 'day') d.setHours(0, 0, 0, 0);
    else if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); }
    else { d.setDate(1); d.setHours(0, 0, 0, 0); }
    return d.toISOString().slice(0, 10);
}

interface UseBudgetIncomeReturn {
    records: BudgetIncomeRecord[];
    loading: boolean;
    error: string | null;
    totalToday: number;
    totalThisWeek: number;
    totalThisMonth: number;
    refetch: () => void;
}

export function useBudgetIncome(): UseBudgetIncomeReturn {
    const [records, setRecords] = useState<BudgetIncomeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError(null);

        const { data, error: supaErr } = await supabase
            .from('transactions')
            .select('*')
            .eq('type', 'income')
            .eq('app_id', 'budget')
            .order('date', { ascending: false });

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setRecords((data ?? []) as BudgetIncomeRecord[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const sum = (from: string) =>
        records.filter(r => r.date >= from).reduce((acc, r) => acc + Number(r.amount_zmw), 0);

    return {
        records,
        loading,
        error,
        totalToday: sum(startOf('day')),
        totalThisWeek: sum(startOf('week')),
        totalThisMonth: sum(startOf('month')),
        refetch: fetchRecords,
    };
}
