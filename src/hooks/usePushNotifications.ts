import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { requestFcmToken } from '../lib/firebase';

type PermState = NotificationPermission | 'unsupported';

const detectPlatform = (): string => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'web';
};

const initialState = (): PermState =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

export function usePushNotifications() {
    const [status, setStatus] = useState<PermState>(initialState());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const enable = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await requestFcmToken(); // requests permission + gets the FCM token
            if (!token) {
                setStatus(initialState());
                setError('Notifications could not be enabled. Allow the permission, and on iPhone add the app to your Home Screen first.');
                return;
            }
            const { data: u } = await supabase.auth.getUser();
            if (!u.user) throw new Error('You must be signed in.');

            const { error: err } = await supabase.from('push_tokens').upsert(
                { user_id: u.user.id, token, platform: detectPlatform(), last_seen_at: new Date().toISOString() },
                { onConflict: 'token' }
            );
            if (err) throw err;
            setStatus('granted');
        } catch (e: any) {
            setError(e.message || 'Failed to enable notifications.');
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        status,
        loading,
        error,
        enable,
        supported: status !== 'unsupported',
    };
}
