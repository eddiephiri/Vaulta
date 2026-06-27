import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ExpectedCashing, CashingSchedule } from '../types';

interface UseDriverCashingsReturn {
    cashings: ExpectedCashing[];
    schedule: CashingSchedule | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

// Read-only cashing data for the driver's own vehicle. RLS ("Drivers view own
// cashings" / "Drivers view own schedules") restricts this to the signed-in
// driver. Note: expected_cashings carries no monetary amount — the driver
// never sees gross figures.
export function useDriverCashings(vehicleId?: string | null): UseDriverCashingsReturn {
    const [cashings, setCashings] = useState<ExpectedCashing[]>([]);
    const [schedule, setSchedule] = useState<CashingSchedule | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!vehicleId) { setCashings([]); setSchedule(null); setLoading(false); return; }
        setLoading(true);
        setError(null);

        const [ecRes, schedRes] = await Promise.all([
            supabase
                .from('expected_cashings')
                .select('*')
                .eq('vehicle_id', vehicleId)
                .order('expected_date', { ascending: true }),
            supabase
                .from('cashing_schedules')
                .select('*')
                .eq('vehicle_id', vehicleId)
                .eq('active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        if (ecRes.error) setError(ecRes.error.message);
        else setCashings(ecRes.data ?? []);
        if (!ecRes.error && schedRes.error) setError(schedRes.error.message);
        else setSchedule(schedRes.data as CashingSchedule | null);

        setLoading(false);
    }, [vehicleId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return { cashings, schedule, loading, error, refetch: fetchData };
}
