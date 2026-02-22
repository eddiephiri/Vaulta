import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ServiceRecord } from '../types';

interface UseServiceHistoryReturn {
    records: ServiceRecord[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useServiceHistory(vehicleId?: string): UseServiceHistoryReturn {
    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from('service_history')
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

    return { records, loading, error, refetch: fetchRecords };
}
