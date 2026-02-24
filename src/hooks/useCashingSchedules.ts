import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CashingSchedule } from '../types';

interface UseCashingSchedulesReturn {
    schedules: CashingSchedule[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useCashingSchedules(vehicleId?: string): UseCashingSchedulesReturn {
    const [schedules, setSchedules] = useState<CashingSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSchedules = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from('cashing_schedules')
            .select('*, vehicle:vehicles(id, plate, make, model)')
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (vehicleId) query = query.eq('vehicle_id', vehicleId);

        const { data, error: supaErr } = await query;

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setSchedules(data ?? []);
        }
        setLoading(false);
    }, [vehicleId]);

    useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

    return { schedules, loading, error, refetch: fetchSchedules };
}
