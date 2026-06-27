import { useMemo } from 'react';
import { CalendarClock, Banknote, CheckCircle2, Clock } from 'lucide-react';
import { useDriver } from '../../contexts/DriverContext';
import { useDriverCashings } from '../../hooks/useDriverCashings';
import type { CashingStatus } from '../../types';

const STATUS_META: Record<CashingStatus, { label: string; color: string }> = {
    recorded: { label: 'On time', color: '#22c55e' },
    late_driver: { label: 'Late', color: '#ef4444' },
    late_admin: { label: 'Recorded', color: 'var(--ff-text-muted)' }, // office delay — not the driver's fault
    pending: { label: 'Upcoming', color: 'var(--ff-text-muted)' },
    deferred_to_salary: { label: 'Deferred', color: 'var(--ff-text-muted)' },
};

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export function DriverHome() {
    const { driver, loading: driverLoading, error: driverError } = useDriver();
    const { cashings, schedule, loading, error } = useDriverCashings(driver?.vehicle_id);

    const today = new Date().toISOString().slice(0, 10);

    // Current/next cashing: soonest on/after today, else the most recent past one.
    const current = useMemo(() => {
        const upcoming = cashings.find(c => c.expected_date >= today);
        return upcoming ?? (cashings.length ? cashings[cashings.length - 1] : null);
    }, [cashings, today]);

    // On-time record: recorded = on time, late_driver = late. late_admin and
    // pending are excluded so office delays / future weeks don't count.
    const stats = useMemo(() => {
        const onTime = cashings.filter(c => c.status === 'recorded').length;
        const late = cashings.filter(c => c.status === 'late_driver').length;
        const total = onTime + late;
        return { onTime, late, total, rate: total ? Math.round((onTime / total) * 100) : null };
    }, [cashings]);

    const recent = useMemo(
        () => cashings.filter(c => c.expected_date <= today).slice(-6).reverse(),
        [cashings, today]
    );

    if (driverLoading) {
        return <p className="text-sm py-10 text-center" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>;
    }
    if (driverError) {
        return <div className="p-4 rounded-xl text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>{driverError}</div>;
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
                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                    {driver.vehicle
                        ? `${driver.vehicle.plate} — ${driver.vehicle.make} ${driver.vehicle.model}`
                        : 'No vehicle assigned yet'}
                </p>
            </div>

            {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>{error}</div>
            )}

            {/* This week */}
            {loading ? (
                <div className="rounded-xl p-5 text-sm text-center" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)' }}>
                    Loading your schedule…
                </div>
            ) : !schedule || !current ? (
                <div className="rounded-xl p-5 flex flex-col items-center text-center gap-2"
                    style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)' }}>
                    <CalendarClock size={28} style={{ color: 'var(--ff-text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No cashing schedule set up yet. Your manager will add one.
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl p-5"
                    style={{
                        background: current.is_salary_week ? '#a855f715' : 'var(--ff-accent)12',
                        border: `1px solid ${current.is_salary_week ? '#a855f740' : 'var(--ff-border)'}`,
                    }}>
                    <div className="flex items-center gap-2 mb-1">
                        {current.is_salary_week
                            ? <Banknote size={18} style={{ color: '#a855f7' }} />
                            : <CalendarClock size={18} style={{ color: 'var(--ff-accent)' }} />}
                        <span className="text-sm font-bold uppercase tracking-wide"
                            style={{ color: current.is_salary_week ? '#a855f7' : 'var(--ff-accent)' }}>
                            {current.is_salary_week ? 'Salary Week' : 'Cashing Week'}
                        </span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                        Week {current.week_number} of {schedule.cycle_weeks}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                        {current.expected_date >= today ? 'Next cashing' : 'Last cashing'}: {fmtDate(current.expected_date)}
                    </p>
                    {current.is_salary_week && (
                        <p className="text-xs mt-2" style={{ color: '#a855f7' }}>
                            This is the salary/deduction week.
                        </p>
                    )}
                </div>
            )}

            {/* On-time record */}
            {stats.total > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ff-text-muted)' }}>On-time record</p>
                    <div className="flex items-end gap-2 mb-3">
                        <span className="text-3xl font-bold" style={{ color: stats.rate! >= 80 ? '#22c55e' : stats.rate! >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {stats.rate}%
                        </span>
                        <span className="text-sm mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                            {stats.onTime} of {stats.total} on time
                        </span>
                    </div>
                    <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--ff-text-muted)' }}>
                            <CheckCircle2 size={14} style={{ color: '#22c55e' }} /> {stats.onTime} on time
                        </span>
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--ff-text-muted)' }}>
                            <Clock size={14} style={{ color: '#ef4444' }} /> {stats.late} late
                        </span>
                    </div>
                </div>
            )}

            {/* Recent cashings */}
            {recent.length > 0 && (
                <div>
                    <p className="text-xs uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--ff-text-muted)' }}>Recent cashings</p>
                    <div className="rounded-xl divide-y" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderColor: 'var(--ff-border)' }}>
                        {recent.map(c => {
                            const meta = STATUS_META[c.status];
                            return (
                                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                                    <div>
                                        <p className="text-sm" style={{ color: 'var(--ff-text-primary)' }}>{fmtDate(c.expected_date)}</p>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                            Week {c.week_number}{c.is_salary_week ? ' · Salary' : ''}
                                        </p>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: `${meta.color}20`, color: meta.color }}>
                                        {meta.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
