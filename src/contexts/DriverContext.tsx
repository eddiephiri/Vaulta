import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Driver } from '../types';

interface DriverContextType {
    driver: Driver | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

const DriverContext = createContext<DriverContextType | undefined>(undefined);

// Drivers are not workspace_users members; their identity and workspace come
// from the drivers row linked by user_id. RLS ("Drivers view own record" +
// "Drivers view own vehicle") scopes this query to the signed-in driver.
export function DriverProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [driver, setDriver] = useState<Driver | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDriver = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
            .from('drivers')
            .select('*, vehicle:vehicles(id, plate, make, model)')
            .eq('user_id', user.id)
            .maybeSingle();

        if (err) setError(err.message);
        else setDriver(data as Driver | null);
        setLoading(false);
    }, [user]);

    useEffect(() => { fetchDriver(); }, [fetchDriver]);

    return (
        <DriverContext.Provider value={{ driver, loading, error, refetch: fetchDriver }}>
            {children}
        </DriverContext.Provider>
    );
}

export function useDriver() {
    const ctx = useContext(DriverContext);
    if (ctx === undefined) throw new Error('useDriver must be used within a DriverProvider');
    return ctx;
}
