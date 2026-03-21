import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { IncomeRecord } from '../types';

interface UseIncomeReturn {
    records: IncomeRecord[];
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

export function useIncome(vehicleId?: string): UseIncomeReturn {
    const [records, setRecords] = useState<IncomeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from('transactions')
            .select('*')
            .eq('type', 'income')
            .eq('app_id', 'transport')
            .order('date', { ascending: false });

        if (vehicleId) query = query.eq('reference_entity_id', vehicleId);

        const { data, error: supaErr } = await query;

        if (supaErr) {
            setError(supaErr.message);
        } else if (data) {
            // Fetch basic vehicle info to satisfy the 'vehicle' property for UI
            const { data: vData } = await supabase.from('vehicles').select('id, plate, make, model');
            const vMap = new Map(vData?.map(v => [v.id, v]) ?? []);
            
            const mapped = data.map(record => ({
                ...record,
                vehicle: vMap.get(record.reference_entity_id)
            })) as unknown as IncomeRecord[];
            
            setRecords(mapped);
        } else {
            setRecords([]);
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
