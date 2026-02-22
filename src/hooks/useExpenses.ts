import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ExpenseRecord } from '../types';

interface UseExpensesReturn {
    records: ExpenseRecord[];
    loading: boolean;
    error: string | null;
    totalToday: number;
    totalThisWeek: number;
    totalThisMonth: number;
    refetch: () => void;
}

function startOf(unit: 'day' | 'week' | 'month'): string {
    const d = new Date();
    if (unit === 'day') {
        d.setHours(0, 0, 0, 0);
    } else if (unit === 'week') {
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
    } else {
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
    }
    return d.toISOString().slice(0, 10);
}

export function useExpenses(vehicleId?: string): UseExpensesReturn {
    const [records, setRecords] = useState<ExpenseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from('expenses')
            .select('*, vehicle:vehicles(id, plate, make, model)')
            .order('date', { ascending: false });

        if (vehicleId) query = query.eq('vehicle_id', vehicleId);

        const { data, error: supaErr } = await query;

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setRecords(data ?? []);
        }
        setLoading(false);
    }, [vehicleId]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const sum = (from: string) =>
        records
            .filter(r => r.date >= from)
            .reduce((acc, r) => acc + Number(r.amount_zmw), 0);

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
