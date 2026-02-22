import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Vehicle } from '../types';

interface UseVehiclesReturn {
    vehicles: Vehicle[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useVehicles(): UseVehiclesReturn {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        setError(null);

        const { data, error: supaErr } = await supabase
            .from('vehicles')
            .select('*')
            .order('plate', { ascending: true });

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setVehicles(data ?? []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    return { vehicles, loading, error, refetch: fetchVehicles };
}
