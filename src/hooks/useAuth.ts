import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthSession, User } from '@supabase/supabase-js';

interface UseAuthReturn {
    session: AuthSession | null;
    user: User | null;
    loading: boolean;
    authEvent: string | null;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

export function useAuth(): UseAuthReturn {
    const [session, setSession] = useState<AuthSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [authEvent, setAuthEvent] = useState<string | null>(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            setSession(newSession);
            setAuthEvent(event);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (data.user && !error) {
            const { registerDeviceSession } = await import('./useSessionSecurity');
            await registerDeviceSession(data.user.id);
        }
        return { error: error as Error | null };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const resetPassword = async (email: string) => {
        const baseUrl = import.meta.env.PROD ? 'https://myvaultr.com' : window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${baseUrl}/reset-password`,
        });
        return { error: error as Error | null };
    };

    const updatePassword = async (password: string) => {
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error as Error | null };
    };

    return {
        session,
        user: session?.user ?? null,
        loading,
        authEvent,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
    };
}
