import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ExpectedCashing } from '../types';

interface UseExpectedCashingsReturn {
    cashings: ExpectedCashing[];
    overdue: ExpectedCashing[];   // pending and past expected_date
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useExpectedCashings(vehicleId?: string): UseExpectedCashingsReturn {
    const [cashings, setCashings] = useState<ExpectedCashing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCashings = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from('expected_cashings')
            .select('*, vehicle:vehicles(id, plate, make, model)')
            .order('expected_date', { ascending: true });

        if (vehicleId) query = query.eq('vehicle_id', vehicleId);

        const { data, error: supaErr } = await query;

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setCashings(data ?? []);
        }
        setLoading(false);
    }, [vehicleId]);

    useEffect(() => { fetchCashings(); }, [fetchCashings]);

    const today = new Date().toISOString().slice(0, 10);
    const overdue = cashings.filter(
        c => c.status === 'pending' && c.expected_date <= today && !c.is_salary_week
    );

    return { cashings, overdue, loading, error, refetch: fetchCashings };
}
