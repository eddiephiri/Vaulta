import { useState } from 'react';
import { Plus, CalendarClock, RefreshCw, ArrowLeftRight, Banknote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/PageHeader';
import { useCashingSchedules } from '../hooks/useCashingSchedules';
import { useExpectedCashings } from '../hooks/useExpectedCashings';
import { useVehicles } from '../hooks/useVehicles';
import { useDrivers } from '../hooks/useDrivers';
import { AddCashingScheduleModal } from '../components/AddCashingScheduleModal';
import { AddIncomeModal } from '../components/AddIncomeModal';
import { ResolveCashingModal } from '../components/ResolveCashingModal';
import { SwapWeeksModal } from '../components/SwapWeeksModal';
import { SearchInput } from '../components/SearchInput';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { ExpectedCashing } from '../types';

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

const getCurrentCycleCashings = (vCashings: ExpectedCashing[], cycleWeeks: number) => {
    if (!vCashings.length) return [];
    const today = new Date().toISOString().slice(0, 10);
    
    // Find the next upcoming pending/completed cashing, or fallback to the last one
    let currentIdx = vCashings.findIndex(c => c.expected_date >= today);
    if (currentIdx === -1) currentIdx = vCashings.length - 1;
    
    const currentCashing = vCashings[currentIdx];
    const wkNum = currentCashing.week_number;
    
    // Start index is currentIdx - (wkNum - 1)
    const startIdx = Math.max(0, currentIdx - (wkNum - 1));
    return vCashings.slice(startIdx, startIdx + cycleWeeks);
};

export function CashingSchedules() {
    const { canEditApp } = useWorkspace();
    const [showModal, setShowModal] = useState(false);
    const { schedules, loading: schedLoading, error: schedError, refetch } = useCashingSchedules();
    const { cashings, overdue, loading: overdueLoading, refetch: refetchOverdue } = useExpectedCashings();
    const { vehicles } = useVehicles();
    const { drivers } = useDrivers();   // all drivers for hire-date lookup
    const [searchQuery, setSearchQuery] = useState('');
    const [swappingVehicle, setSwappingVehicle] = useState<{ id: string; plate: string } | null>(null);

    // Modal states for resolving overdue cashings
    const [resolvingCashing, setResolvingCashing] = useState<ExpectedCashing | null>(null);
    const [incomePrefill, setIncomePrefill] = useState<{
        vehicle_id: string;
        expected_cashing_id: string;
        expected_date: string;
        is_salary_week: boolean;
    } | null>(null);

    const [clearingOverdue, setClearingOverdue] = useState(false);

    const handleClearOverdue = async () => {
        if (!window.confirm('Are you sure you want to dismiss and clear all current overdue cashing reminders? This will delete the pending schedule reminders before today but will NOT remove any recorded income/salary data.')) {
            return;
        }

        setClearingOverdue(true);
        const today = new Date().toISOString().slice(0, 10);

        const { error } = await supabase
            .from('expected_cashings')
            .delete()
            .eq('status', 'pending')
            .lte('expected_date', today)
            .eq('is_salary_week', false);

        setClearingOverdue(false);

        if (error) {
            alert('Failed to clear overdue reminders: ' + error.message);
        } else {
            refetch();
            refetchOverdue();
        }
    };

    const filteredSchedules = schedules.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (s.vehicle?.plate && s.vehicle.plate.toLowerCase().includes(q)) ||
            (s.notes && s.notes.toLowerCase().includes(q))
        );
    });

    const { currentPage, totalPages, setCurrentPage, paginatedItems } = usePagination(filteredSchedules, 10);

    return (
        <div>
            <PageHeader
                title="Cashing Schedules"
                subtitle="Configure expected cashing rhythms and track overdue payments"
                action={canEditApp('transport') && (
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={() => setShowModal(true)}
                    >
                        <Plus size={16} />
                        New Schedule
                    </button>
                )}
            />

            {/* Overdue alert */}
            {!overdueLoading && overdue.length > 0 && (
                <div className="mb-6 p-4 rounded-xl"
                    style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-amber-500" style={{ color: '#f59e0b' }}>
                            ⚠ {overdue.length} overdue cashing{overdue.length > 1 ? 's' : ''}
                        </p>
                        {canEditApp('transport') && (
                            <button
                                onClick={handleClearOverdue}
                                disabled={clearingOverdue}
                                className="text-xs px-3 py-1 rounded font-semibold transition-colors border cursor-pointer"
                                style={{
                                    borderColor: '#f59e0b50',
                                    color: '#f59e0b',
                                    background: 'transparent'
                                }}
                            >
                                {clearingOverdue ? 'Clearing…' : 'Clear All Reminders'}
                            </button>
                        )}
                    </div>
                    <div className="space-y-2 mt-3">
                        {overdue.map(c => (
                            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                        {c.vehicle?.plate} — {c.vehicle?.make} {c.vehicle?.model}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                                        Expected {c.expected_date} · Week {c.week_number}
                                        {c.is_salary_week && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded text-xs"
                                                style={{ background: '#a855f720', color: '#a855f7' }}>
                                                Salary week
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canEditApp('transport') && (
                                        <button
                                            onClick={() => setIncomePrefill({
                                                vehicle_id: c.vehicle_id,
                                                expected_cashing_id: c.id,
                                                expected_date: c.expected_date,
                                                is_salary_week: c.is_salary_week,
                                            })}
                                            className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                                            style={{ background: 'var(--ff-green)', color: 'white' }}
                                        >
                                            Log Income
                                        </button>
                                    )}
                                    {canEditApp('transport') && (
                                        <button
                                            onClick={() => setResolvingCashing(c)}
                                            className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors hover:opacity-80"
                                            style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                                        >
                                            Resolve Manually
                                        </button>
                                    )}
                                </div>
                            </div>
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
            ) : (
                <>
                    <div className="mb-6">
                        <SearchInput
                            value={searchQuery}
                            onChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
                            placeholder="Search by vehicle plate, driver name, or notes..."
                        />
                    </div>
                    {filteredSchedules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                            <CalendarClock size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                                No schedules yet. Create one to start tracking cashings.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {paginatedItems.map(s => {
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

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                            <div className="text-center rounded-lg p-2"
                                                style={{ background: 'var(--ff-surface)' }}>
                                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Anchor</p>
                                                <p className="text-xs font-semibold mt-0.5">
                                                    {s.anchor_date ?? '—'}
                                                </p>
                                            </div>
                                            <div className="text-center rounded-lg p-2"
                                                style={{ background: 'var(--ff-surface)' }}>
                                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Cashing Day</p>
                                                <p className="text-sm font-semibold mt-0.5">
                                                    {s.cashing_day_of_week != null ? DAYS[s.cashing_day_of_week] : 'Flexible'}
                                                </p>
                                            </div>
                                            <div className="text-center rounded-lg p-2"
                                                style={{ background: 'var(--ff-surface)' }}>
                                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Cycle</p>
                                                <p className="text-sm font-semibold mt-0.5">{s.cycle_weeks} weeks</p>
                                            </div>
                                            <div className="text-center rounded-lg p-2"
                                                style={{ background: 'var(--ff-surface)' }}>
                                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Salary Wk</p>
                                                <p className="text-sm font-semibold mt-0.5">Week {s.salary_week}</p>
                                            </div>
                                        </div>

                                        {s.notes && (
                                            <p className="mt-3 text-xs italic" style={{ color: 'var(--ff-text-muted)' }}>
                                                {s.notes}
                                            </p>
                                        )}

                                        {/* Stepper showing current cycle cashings */}
                                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ff-border)' }}>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ff-text-muted)' }}>
                                                    Current Cycle Tracking
                                                </span>
                                                {canEditApp('transport') && (
                                                    <button
                                                        onClick={() => setSwappingVehicle({ id: s.vehicle_id, plate: s.vehicle?.plate ?? 'Vehicle' })}
                                                        className="text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 cursor-pointer"
                                                        style={{ borderColor: 'var(--ff-border)', color: 'var(--ff-text-primary)', background: 'var(--ff-surface)' }}
                                                    >
                                                        <ArrowLeftRight size={12} />
                                                        Swap Weeks
                                                    </button>
                                                )}
                                            </div>

                                            {(() => {
                                                const vCashings = cashings.filter(c => c.vehicle_id === s.vehicle_id);
                                                const cycleCashings = getCurrentCycleCashings(vCashings, s.cycle_weeks);

                                                if (cycleCashings.length === 0) {
                                                    return (
                                                        <p className="text-xs italic" style={{ color: 'var(--ff-text-muted)' }}>No expected cashings generated for this schedule.</p>
                                                    );
                                                }

                                                const today = new Date().toISOString().slice(0, 10);

                                                return (
                                                    <div className="flex items-center justify-between relative px-2 py-1">
                                                        {/* Stepper line */}
                                                        <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 z-0" style={{ background: 'var(--ff-border)' }}></div>

                                                        {cycleCashings.map((c) => {
                                                            const isSalary = c.is_salary_week;
                                                            const isToday = c.expected_date === today;
                                                            const isOverdue = c.expected_date < today && c.status === 'pending';
                                                            
                                                            let borderColor = 'var(--ff-border)';
                                                            let bgColor = 'var(--ff-surface)';
                                                            let textColor = 'var(--ff-text-muted)';
                                                            let nodeLabel = String(c.week_number);

                                                            if (c.status === 'recorded' || c.status === 'late_admin') {
                                                                borderColor = '#22c55e';
                                                                bgColor = '#22c55e';
                                                                textColor = 'white';
                                                                nodeLabel = '✓';
                                                            } else if (c.status === 'late_driver') {
                                                                borderColor = '#ef4444';
                                                                bgColor = '#ef4444';
                                                                textColor = 'white';
                                                                nodeLabel = '✗';
                                                            } else if (c.status === 'deferred_to_salary') {
                                                                borderColor = '#a855f7';
                                                                bgColor = '#a855f7';
                                                                textColor = 'white';
                                                                nodeLabel = '→';
                                                            } else if (isOverdue) {
                                                                borderColor = '#f59e0b';
                                                                bgColor = 'var(--ff-surface)';
                                                                textColor = '#f59e0b';
                                                            } else if (isToday) {
                                                                borderColor = 'var(--ff-accent)';
                                                                bgColor = 'var(--ff-surface)';
                                                                textColor = 'var(--ff-accent)';
                                                            }

                                                            const formattedDate = new Date(c.expected_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                                                            return (
                                                                <div key={c.id} className="flex flex-col items-center gap-1 z-10 relative group" title={`${isSalary ? 'Salary Week • ' : ''}Expected ${c.expected_date} [Status: ${c.status}]`}>
                                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] border-2 shadow-sm transition-transform cursor-help"
                                                                        style={{
                                                                            borderColor,
                                                                            background: bgColor,
                                                                            color: textColor,
                                                                        }}>
                                                                        {nodeLabel}
                                                                        {isSalary && (
                                                                            <span className="absolute -top-2 -right-1.5 bg-purple-600 text-white rounded-full p-0.5 shadow-sm">
                                                                                <Banknote size={8} />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] font-medium" style={{ color: 'var(--ff-text-muted)' }}>{formattedDate}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!schedLoading && filteredSchedules.length > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </>
            )}

            <AddCashingScheduleModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={refetch}
                vehicles={vehicles}
                drivers={drivers}
            />

            <AddIncomeModal
                open={!!incomePrefill}
                onClose={() => setIncomePrefill(null)}
                onSuccess={() => {
                    refetchOverdue();
                    setIncomePrefill(null);
                }}
                vehicles={vehicles}
                drivers={drivers}
                schedules={schedules}
                prefill={incomePrefill ?? undefined}
            />

            {resolvingCashing && (
                 <ResolveCashingModal
                     open={!!resolvingCashing}
                     onClose={() => setResolvingCashing(null)}
                     onSuccess={() => {
                         refetchOverdue();
                         setResolvingCashing(null);
                     }}
                     cashing={resolvingCashing}
                 />
             )}

            {swappingVehicle && (
                <SwapWeeksModal
                    open={!!swappingVehicle}
                    onClose={() => setSwappingVehicle(null)}
                    onSuccess={() => {
                        refetch();
                        refetchOverdue();
                    }}
                    vehicleId={swappingVehicle.id}
                    vehiclePlate={swappingVehicle.plate}
                />
            )}
        </div>
    );
}
