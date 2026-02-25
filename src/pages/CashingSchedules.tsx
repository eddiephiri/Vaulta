import { useState } from 'react';
import { Plus, CalendarClock, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useCashingSchedules } from '../hooks/useCashingSchedules';
import { useExpectedCashings } from '../hooks/useExpectedCashings';
import { useVehicles } from '../hooks/useVehicles';
import { useDrivers } from '../hooks/useDrivers';
import { AddCashingScheduleModal } from '../components/AddCashingScheduleModal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SOURCE_LABELS: Record<string, string> = {
    yango: 'Yango',
    public_transport: 'Bus / Public Transport',
    rental: 'Rental',
    other: 'Other',
};
const SOURCE_COLORS: Record<string, string> = {
    yango: '#f59e0b',
    public_transport: '#3b82f6',
    rental: '#10b981',
    other: '#94a3b8',
};

export function CashingSchedules() {
    const [showModal, setShowModal] = useState(false);
    const { schedules, loading: schedLoading, error: schedError, refetch } = useCashingSchedules();
    const { overdue, loading: overdueLoading } = useExpectedCashings();
    const { vehicles } = useVehicles();
    const { drivers } = useDrivers();   // all drivers for hire-date lookup

    return (
        <div>
            <PageHeader
                title="Cashing Schedules"
                subtitle="Configure expected cashing rhythms and track overdue payments"
                action={
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={() => setShowModal(true)}
                    >
                        <Plus size={16} />
                        New Schedule
                    </button>
                }
            />

            {/* Overdue alert */}
            {!overdueLoading && overdue.length > 0 && (
                <div className="mb-6 p-4 rounded-xl"
                    style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: '#f59e0b' }}>
                        ⚠ {overdue.length} overdue cashing{overdue.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                        {overdue.map(c => (
                            <p key={c.id} className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                {c.vehicle?.plate} — {c.vehicle?.make} {c.vehicle?.model}
                                {' · '}Expected {c.expected_date}
                                {' · '}Week {c.week_number}
                                {c.is_salary_week && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs"
                                        style={{ background: '#a855f720', color: '#a855f7' }}>
                                        Salary week
                                    </span>
                                )}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {schedError && (
                <div className="mb-4 p-4 rounded-lg text-sm"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                    {schedError}
                </div>
            )}

            {schedLoading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading schedules…</p>
                </div>
            ) : schedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <CalendarClock size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No schedules yet. Create one to start tracking cashings.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {schedules.map(s => {
                        const color = SOURCE_COLORS[s.income_source] ?? '#94a3b8';
                        return (
                            <div key={s.id} className="rounded-xl p-5"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-semibold text-sm">
                                            {s.vehicle?.plate} — {s.vehicle?.make} {s.vehicle?.model}
                                        </p>
                                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{ background: `${color}20`, color }}>
                                            {SOURCE_LABELS[s.income_source] ?? s.income_source}
                                        </span>
                                    </div>
                                    <RefreshCw size={14} style={{ color: 'var(--ff-text-muted)' }} />
                                </div>

                                <div className="grid grid-cols-4 gap-3 mt-3">
                                    <div className="text-center rounded-lg p-2"
                                        style={{ background: 'var(--ff-navy)' }}>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Anchor</p>
                                        <p className="text-xs font-semibold mt-0.5">
                                            {s.anchor_date ?? '—'}
                                        </p>
                                    </div>
                                    <div className="text-center rounded-lg p-2"
                                        style={{ background: 'var(--ff-navy)' }}>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Cashing Day</p>
                                        <p className="text-sm font-semibold mt-0.5">
                                            {s.cashing_day_of_week != null ? DAYS[s.cashing_day_of_week] : 'Flexible'}
                                        </p>
                                    </div>
                                    <div className="text-center rounded-lg p-2"
                                        style={{ background: 'var(--ff-navy)' }}>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Cycle</p>
                                        <p className="text-sm font-semibold mt-0.5">{s.cycle_weeks} weeks</p>
                                    </div>
                                    <div className="text-center rounded-lg p-2"
                                        style={{ background: 'var(--ff-navy)' }}>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Salary Wk</p>
                                        <p className="text-sm font-semibold mt-0.5">Week {s.salary_week}</p>
                                    </div>
                                </div>

                                {s.notes && (
                                    <p className="mt-3 text-xs italic" style={{ color: 'var(--ff-text-muted)' }}>
                                        {s.notes}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <AddCashingScheduleModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={refetch}
                vehicles={vehicles}
                drivers={drivers}
            />
        </div>
    );
}
