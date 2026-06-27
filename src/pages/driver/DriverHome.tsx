import { Car, CalendarClock } from 'lucide-react';
import { useDriver } from '../../contexts/DriverContext';

export function DriverHome() {
    const { driver, loading, error } = useDriver();

    if (loading) {
        return <p className="text-sm py-10 text-center" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>;
    }
    if (error) {
        return (
            <div className="p-4 rounded-xl text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>
                {error}
            </div>
        );
    }
    if (!driver) {
        return (
            <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-muted)', border: '1px solid var(--ff-border)' }}>
                Your driver profile isn't set up yet. Please contact your manager.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                    Hi {driver.name.split(' ')[0]}
                </h1>
                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Welcome to your driver dashboard.</p>
            </div>

            <div className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--ff-accent)20', color: 'var(--ff-accent)' }}>
                    <Car size={20} />
                </div>
                <div>
                    <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Your vehicle</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                        {driver.vehicle
                            ? `${driver.vehicle.plate} — ${driver.vehicle.make} ${driver.vehicle.model}`
                            : 'No vehicle assigned yet'}
                    </p>
                </div>
            </div>

            {/* Phase 4 will replace this with the current cashing week + on-time record. */}
            <div className="rounded-xl p-5 flex flex-col items-center text-center gap-2"
                style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)' }}>
                <CalendarClock size={28} style={{ color: 'var(--ff-text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>Cashing schedule</p>
                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                    Your current week and on-time record will appear here soon.
                </p>
            </div>
        </div>
    );
}
