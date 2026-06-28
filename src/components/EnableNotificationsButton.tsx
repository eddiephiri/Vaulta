import { Bell, BellRing, Loader2 } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

// Drop-in control to turn on push reminders. Hidden where notifications aren't
// supported. On iPhone the app must be installed to the Home Screen first.
export function EnableNotificationsButton() {
    const { status, loading, error, enable, supported } = usePushNotifications();

    if (!supported) return null;

    if (status === 'granted') {
        return (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#22c55e' }}>
                <BellRing size={16} /> Reminders on
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={enable}
                disabled={loading || status === 'denied'}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--ff-accent)', color: 'white', opacity: status === 'denied' ? 0.6 : 1 }}
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                {loading ? 'Enabling…' : 'Enable reminders'}
            </button>
            {status === 'denied' && (
                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                    Notifications are blocked. Allow them in your browser/site settings to turn on reminders.
                </p>
            )}
            {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        </div>
    );
}
