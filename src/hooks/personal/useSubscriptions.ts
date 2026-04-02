import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Subscription } from '../../types';

export interface UseSubscriptionsReturn {
    subscriptions: Subscription[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useSubscriptions(): UseSubscriptionsReturn {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubscriptions = useCallback(async () => {
        setLoading(true);
        setError(null);

        const { data, error: supaErr } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('app_id', 'personal')
            .order('next_billing_date', { ascending: true });

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setSubscriptions((data ?? []) as Subscription[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

    return {
        subscriptions,
        loading,
        error,
        refetch: fetchSubscriptions,
    };
}
