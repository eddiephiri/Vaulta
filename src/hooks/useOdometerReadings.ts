import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { OdometerReading } from '../types';

interface UseOdometerReadingsReturn {
    readings: OdometerReading[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useOdometerReadings(vehicleId?: string): UseOdometerReadingsReturn {
    const { workspace } = useWorkspace();
    const [readings, setReadings] = useState<OdometerReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReadings = useCallback(async () => {
        if (!workspace) { setLoading(false); return; }
        setLoading(true);
        setError(null);

        let query = supabase
            .from('odometer_readings')
            .select(`
                *,
                vehicle:vehicles(id, plate, make, model),
                driver:drivers(id, name)
            `)
            .eq('workspace_id', workspace.id)
            .order('submitted_at', { ascending: false });

        if (vehicleId) {
            query = query.eq('vehicle_id', vehicleId);
        }

        const { data, error: err } = await query;

        if (err) setError(err.message);
        else setReadings((data ?? []) as OdometerReading[]);
        setLoading(false);
    }, [workspace, vehicleId]);

    useEffect(() => { fetchReadings(); }, [fetchReadings]);

    return { readings, loading, error, refetch: fetchReadings };
}
