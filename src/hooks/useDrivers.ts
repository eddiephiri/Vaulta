import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Driver } from '../types';

interface UseDriversReturn {
    drivers: Driver[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useDrivers(activeOnly = false): UseDriversReturn {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDrivers = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from('drivers')
            .select('*, vehicle:vehicles(id, plate, make, model)')
            .order('name', { ascending: true });

        if (activeOnly) query = query.eq('active', true);

        const { data, error: supaErr } = await query;

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setDrivers(data ?? []);
        }
        setLoading(false);
    }, [activeOnly]);

    useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

    return { drivers, loading, error, refetch: fetchDrivers };
}
