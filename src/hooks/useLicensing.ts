import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { LicenseRecord } from '../types';

interface UseLicensingReturn {
    records: LicenseRecord[];
    loading: boolean;
    error: string | null;
    expiring: LicenseRecord[]; // expiring within 30 days
    refetch: () => void;
}

export function useLicensing(vehicleId?: string): UseLicensingReturn {
    const [records, setRecords] = useState<LicenseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError(null);

        let query = supabase
            .from('licensing')
            .select('*, vehicle:vehicles(id, plate, make, model)')
            .order('expiry_date', { ascending: true });

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

    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    const expiring = records.filter(r => {
        const exp = new Date(r.expiry_date);
        return exp >= today && exp <= in30Days;
    });

    return { records, loading, error, expiring, refetch: fetchRecords };
}
