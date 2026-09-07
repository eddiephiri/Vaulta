import { useState, useEffect, useMemo } from 'react';
import { Plus, CalendarClock, RefreshCw, ArrowLeftRight, Banknote, ChevronLeft, ChevronRight, CheckCircle2, Check, List, Grid3x3, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/PageHeader';
import { useCashingSchedules } from '../hooks/useCashingSchedules';
import { useExpectedCashings } from '../hooks/useExpectedCashings';
import { useVehicles } from '../hooks/useVehicles';
import { useDrivers } from '../hooks/useDrivers';
import { useIncome } from '../hooks/useIncome';
import { AddCashingScheduleModal } from '../components/AddCashingScheduleModal';
import { AddIncomeModal } from '../components/AddIncomeModal';
import { ResolveCashingModal } from '../components/ResolveCashingModal';
import { SwapWeeksModal } from '../components/SwapWeeksModal';
import { ParseCashingSmsModal } from '../components/ParseCashingSmsModal';
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

function ymOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonth(): string {
    return ymOf(new Date());
}

function monthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

function shiftMonthStr(ym: string, delta: number): string {
    const [y, m] = ym.split('-').map(Number);
    return ymOf(new Date(y, m - 1 + delta, 1));
}

/** Padded grid of ISO date strings (or null for leading/trailing blanks) covering the given month, Sun-first. */
function buildCalendarCells(ym: string): (string | null)[] {
    const [y, m] = ym.split('-').map(Number);
    const startWeekday = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym}-${String(d).padStart(2, '0')}`);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

function cashingStatusMeta(c: ExpectedCashing, today: string): { label: string; color: string } {
    if (c.status === 'recorded' || c.status === 'late_admin') return { label: 'Collected', color: '#22c55e' };
    if (c.status === 'late_driver') return { label: 'Collected (Late)', color: '#22c55e' };
    if (c.status === 'deferred_to_salary') return { label: 'Deferred to Salary', color: '#a855f7' };
    if (c.expected_date < today) return { label: 'Overdue', color: '#f59e0b' };
    if (c.expected_date === today) return { label: 'Due Today', color: '#3b82f6' };
    return { label: 'Upcoming', color: '#94a3b8' };
}

const getCurrentCycleCashings = (vCashings: ExpectedCashing[], cycleWeeks: number) => {
    if (!vCashings.length) return [];
    const today = new Date().toISOString().slice(0, 10);

    // Priority chain for determining which cashing to centre the cycle window on:
    //
    //  1. Oldest overdue pending — the one the admin/driver most needs to act on.
    //     Anchoring here keeps the stepper focused on the unresolved debt rather
    //     than jumping forward to a future resolved week.
    //  2. Next upcoming pending — when there's no overdue, show what's next.
    //  3. Last resolved (non-pending) — pure fallback when all pending rows are
    //     in the future or none exist yet.
    //
    const overdueIdx = vCashings.findIndex(
        c => c.status === 'pending' && c.expected_date <= today
    );
    const upcomingIdx = vCashings.findIndex(
        c => c.status === 'pending' && c.expected_date > today
    );
    const lastResolvedIdx = (() => {
        const idx = [...vCashings].map((c, i) => ({ c, i }))
            .filter(({ c }) => c.status !== 'pending')
            .pop();
        return idx ? idx.i : -1;
    })();

    let anchorIdx =
        overdueIdx !== -1  ? overdueIdx  :
        upcomingIdx !== -1 ? upcomingIdx :
        lastResolvedIdx !== -1 ? lastResolvedIdx :
        vCashings.length - 1;

    const anchorCashing = vCashings[anchorIdx];
    const wkNum = anchorCashing.week_number;

    // Walk back (wkNum - 1) positions to reach week 1 of this cycle.
    const startIdx = Math.max(0, anchorIdx - (wkNum - 1));
    return vCashings.slice(startIdx, startIdx + cycleWeeks);
};

export function CashingSchedules() {
    const { activeWorkspaceId, canEditApp } = useWorkspace();
    const [showModal, setShowModal] = useState(false);
    const [showParseModal, setShowParseModal] = useState(false);
    const { schedules, loading: schedLoading, error: schedError, refetch } = useCashingSchedules();
    const { cashings, overdue, loading: overdueLoading, refetch: refetchOverdue } = useExpectedCashings();
    const { vehicles } = useVehicles();
    const { drivers } = useDrivers();   // all drivers for hire-date lookup
    const { records: incomeRecords } = useIncome();   // all vehicles — used to resolve actual "cashed" dates
    const [searchQuery, setSearchQuery] = useState('');
    const [swappingVehicle, setSwappingVehicle] = useState<{ id: string; plate: string } | null>(null);

    // Modal states for resolving overdue cashings
    const [overdueExpanded, setOverdueExpanded] = useState(false);
    const [resolvingCashing, setResolvingCashing] = useState<ExpectedCashing | null>(null);
    const [incomePrefill, setIncomePrefill] = useState<{
        vehicle_id: string;
        expected_cashing_id: string;
        expected_date: string;
        is_salary_week: boolean;
    } | null>(null);

    const [clearingOverdue, setClearingOverdue] = useState(false);

    // Monthly cashing overview
    const [cashingMonth, setCashingMonth] = useState<string>(() => currentMonth());
    const [monthCashingsExpanded, setMonthCashingsExpanded] = useState(false);
    const [cashingView, setCashingView] = useState<'list' | 'calendar'>('list');
    const [cashingVehicleFilter, setCashingVehicleFilter] = useState('');
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const monthCashings = useMemo(
        () => cashings
            .filter(c => c.expected_date.startsWith(cashingMonth))
            .filter(c => !cashingVehicleFilter || c.vehicle_id === cashingVehicleFilter)
            .sort((a, b) => a.expected_date.localeCompare(b.expected_date)),
        [cashings, cashingMonth, cashingVehicleFilter]
    );

    const monthCounts = useMemo(() => {
        const counts = { collected: 0, pending: 0, missed: 0, deferred: 0 };
        monthCashings.forEach(c => {
            if (c.status === 'recorded' || c.status === 'late_admin' || c.status === 'late_driver') counts.collected++;
            else if (c.status === 'deferred_to_salary') counts.deferred++;
            else counts.pending++;
        });
        return counts;
    }, [monthCashings]);

    // Actual recorded date per cashing (may differ from expected_date when paid late/early)
    const transactionDateById = useMemo(
        () => new Map(incomeRecords.map(r => [r.id, r.date])),
        [incomeRecords]
    );

    const calendarCells = useMemo(() => buildCalendarCells(cashingMonth), [cashingMonth]);

    const dayEvents = useMemo(() => {
        const map = new Map<string, { type: 'expected' | 'cashed'; cashing: ExpectedCashing; label: string; color: string }[]>();
        const add = (date: string, ev: { type: 'expected' | 'cashed'; cashing: ExpectedCashing; label: string; color: string }) => {
            if (!map.has(date)) map.set(date, []);
            map.get(date)!.push(ev);
        };
        const today = new Date().toISOString().slice(0, 10);
        monthCashings.forEach(c => {
            const meta = cashingStatusMeta(c, today);
            add(c.expected_date, { type: 'expected', cashing: c, ...meta });
            const actualDate = c.transaction_id ? transactionDateById.get(c.transaction_id) : undefined;
            if (actualDate && actualDate !== c.expected_date && actualDate.startsWith(cashingMonth)) {
                add(actualDate, { type: 'cashed', cashing: c, label: 'Cashed', color: '#22c55e' });
            }
        });
        return map;
    }, [monthCashings, transactionDateById, cashingMonth]);

    // Swap requests states
    const [swapRequests, setSwapRequests] = useState<any[]>([]);

    const fetchSwapRequests = async () => {
        if (!activeWorkspaceId) return;
        const { data } = await supabase
            .from('driver_swap_requests')
            .select('*, driver:drivers(id, name, phone, vehicle:vehicles(id, plate))')
            .eq('workspace_id', activeWorkspaceId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        setSwapRequests(data ?? []);
    };

    useEffect(() => {
        fetchSwapRequests();
    }, [activeWorkspaceId]);

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

    const renderCashingRow = (c: ExpectedCashing) => {
        const today = new Date().toISOString().slice(0, 10);
        const meta = cashingStatusMeta(c, today);
        return (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg"
                style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)' }}>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                            {c.vehicle?.plate} — {c.vehicle?.make} {c.vehicle?.model}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${meta.color}20`, color: meta.color }}>
                            {meta.label}
                        </span>
                        {c.is_salary_week && (
                            <span className="px-1.5 py-0.5 rounded text-xs flex items-center gap-1"
                                style={{ background: '#a855f720', color: '#a855f7' }}>
                                <Banknote size={10} /> Salary
                            </span>
                        )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                        Expected {c.expected_date} · Week {c.week_number}
                    </p>
                </div>
                {canEditApp('transport') ? (
                    <div className="flex items-center gap-2">
                        {c.status === 'pending' ? (
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
                        ) : null}
                        <button
                            onClick={() => setResolvingCashing(c)}
                            className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors hover:opacity-80"
                            style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                        >
                            {c.status === 'pending' ? 'Resolve Manually' : 'Update Record'}
                        </button>
                    </div>
                ) : (
                    <CheckCircle2 size={18} style={{ color: 'var(--ff-border)' }} className="hidden sm:block" />
                )}
            </div>
        );
    };

    return (
        <div>
            <PageHeader
                title="Cashing Schedules"
                subtitle="Configure expected cashing rhythms and track overdue payments"
                action={canEditApp('transport') && (
                    <div className="flex gap-2">
                        <button
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
                            onClick={() => setShowParseModal(true)}
                        >
                            <Banknote size={16} />
                            Parse SMS
                        </button>
                        <button
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                            style={{ background: 'var(--ff-accent)', color: 'white' }}
                            onClick={() => setShowModal(true)}
                        >
                            <Plus size={16} />
                            New Schedule
                        </button>
                    </div>
                )}
            />

            {/* Pending Swap Requests */}
            {canEditApp('transport') && swapRequests.length > 0 && (
                <div className="mb-6 p-4 rounded-xl border border-purple-200"
                    style={{ background: 'color-mix(in srgb, var(--ff-accent) 8%, transparent)' }}>
                    <p className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--ff-accent)' }}>
                        <ArrowLeftRight size={16} />
                        Pending Driver Week Swap Requests ({swapRequests.length})
                    </p>
                    <div className="flex flex-col gap-3">
                        {swapRequests.map(req => {
                            const cashing1 = cashings.find(c => c.id === req.cashing_id_1);
                            const cashing2 = cashings.find(c => c.id === req.cashing_id_2);

                            const handleApprove = async () => {
                                if (!window.confirm(`Approve request from ${req.driver?.name} to swap Week ${cashing1?.week_number} with Week ${cashing2?.week_number}?`)) return;
                                const { error } = await supabase.rpc('approve_swap_request', { p_request_id: req.id });
                                if (error) alert('Failed to approve: ' + error.message);
                                else {
                                    fetchSwapRequests();
                                    refetch();
                                    refetchOverdue();
                                }
                            };

                            const handleReject = async () => {
                                const notes = window.prompt('Enter reason for rejection (optional):');
                                if (notes === null) return; // user cancelled
                                const { error } = await supabase.rpc('reject_swap_request', { 
                                    p_request_id: req.id,
                                    p_notes: notes.trim() || null 
                                });
                                if (error) alert('Failed to reject: ' + error.message);
                                else {
                                    fetchSwapRequests();
                                    refetch();
                                    refetchOverdue();
                                }
                            };

                            return (
                                <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg"
                                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                    <div className="text-xs leading-relaxed" style={{ color: 'var(--ff-text-primary)' }}>
                                        <p className="font-semibold text-sm">
                                            {req.driver?.name} ({req.driver?.vehicle?.plate ?? 'No Vehicle Assigned'})
                                        </p>
                                        <p className="mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                                            Requested to swap <strong>Week {cashing1?.week_number}</strong> (Cashing) with <strong>Week {cashing2?.week_number}</strong> (Salary).
                                        </p>
                                        {req.reason && (
                                            <p className="mt-1 italic text-slate-400">
                                                Reason: "{req.reason}"
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0 self-end md:self-center">
                                        <button onClick={handleReject} className="px-3 py-1.5 rounded text-xs font-semibold border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/30 dark:hover:bg-red-950/20 cursor-pointer">
                                            Reject
                                        </button>
                                        <button onClick={handleApprove} className="px-3 py-1.5 rounded text-xs font-semibold text-white cursor-pointer"
                                            style={{ background: 'var(--ff-accent)' }}>
                                            Approve Swap
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Overdue alert */}
            {!overdueLoading && overdue.length > 0 && (
                <div className="mb-6 p-4 rounded-xl"
                    style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-amber-500" style={{ color: '#f59e0b' }}>
                                ⚠ {overdue.length} overdue cashing{overdue.length > 1 ? 's' : ''}
                            </p>
                            <button
                                onClick={() => setOverdueExpanded(!overdueExpanded)}
                                className="text-[11px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer hover:bg-[#f59e0b15]"
                                style={{
                                    borderColor: '#f59e0b50',
                                    color: '#f59e0b',
                                    border: '1px solid #f59e0b30',
                                    background: 'transparent'
                                }}
                            >
                                {overdueExpanded ? 'Hide Details' : 'Show Details'}
                            </button>
                        </div>
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
                    {overdueExpanded && (
                        <div className="space-y-2 mt-3 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
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
                    )}
                </div>
            )}

            {/* This Month's Cashings */}
            <div className="mb-6 rounded-xl" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <div className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <p className="text-sm font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                            This Month's Cashings
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCashingView('list')}
                                    title="List view"
                                    className="flex items-center justify-center rounded-lg touch-target"
                                    style={{
                                        background: cashingView === 'list' ? 'var(--ff-accent)' : 'var(--ff-bg)',
                                        border: '1px solid var(--ff-border)',
                                        color: cashingView === 'list' ? 'white' : 'var(--ff-text-muted)',
                                    }}
                                >
                                    <List size={16} />
                                </button>
                                <button
                                    onClick={() => setCashingView('calendar')}
                                    title="Calendar view"
                                    className="flex items-center justify-center rounded-lg touch-target"
                                    style={{
                                        background: cashingView === 'calendar' ? 'var(--ff-accent)' : 'var(--ff-bg)',
                                        border: '1px solid var(--ff-border)',
                                        color: cashingView === 'calendar' ? 'white' : 'var(--ff-text-muted)',
                                    }}
                                >
                                    <Grid3x3 size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { setCashingMonth(m => shiftMonthStr(m, -1)); setSelectedDay(null); }}
                                    title="Previous month"
                                    className="flex items-center justify-center rounded-lg touch-target"
                                    style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <p className="text-xs font-semibold w-[130px] text-center" style={{ color: 'var(--ff-text-primary)' }}>
                                    {monthLabel(cashingMonth)}
                                </p>
                                <button
                                    onClick={() => { setCashingMonth(m => shiftMonthStr(m, 1)); setSelectedDay(null); }}
                                    title="Next month"
                                    className="flex items-center justify-center rounded-lg touch-target"
                                    style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <select
                        value={cashingVehicleFilter}
                        onChange={e => { setCashingVehicleFilter(e.target.value); setSelectedDay(null); }}
                        className="text-sm px-3 py-2 rounded-lg w-full sm:w-auto mb-4"
                        style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                    >
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>
                        ))}
                    </select>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Collected', value: monthCounts.collected, color: '#22c55e' },
                            { label: 'Pending', value: monthCounts.pending, color: '#f59e0b' },
                            { label: 'Missed', value: monthCounts.missed, color: '#ef4444' },
                            { label: 'Deferred', value: monthCounts.deferred, color: '#a855f7' },
                        ].map(s => (
                            <div key={s.label} className="text-center rounded-lg p-2" style={{ background: 'var(--ff-bg)' }}>
                                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                                <p className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {cashingView === 'list' && monthCashings.length > 0 && (
                        <button
                            onClick={() => setMonthCashingsExpanded(!monthCashingsExpanded)}
                            className="mt-4 text-xs font-medium px-3 py-1.5 rounded-lg w-full text-center transition-colors"
                            style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)' }}
                        >
                            {monthCashingsExpanded ? 'Hide' : 'Show'} all {monthCashings.length} cashing{monthCashings.length !== 1 ? 's' : ''} for {monthLabel(cashingMonth)}
                        </button>
                    )}
                </div>

                {cashingView === 'list' && monthCashingsExpanded && (
                    <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--ff-border)' }}>
                        {monthCashings.length === 0 ? (
                            <p className="text-sm py-4 text-center" style={{ color: 'var(--ff-text-muted)' }}>
                                No cashings scheduled for {monthLabel(cashingMonth)}.
                            </p>
                        ) : (
                            <div className="space-y-2 mt-3 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                {monthCashings.map(renderCashingRow)}
                            </div>
                        )}
                    </div>
                )}

                {cashingView === 'calendar' && (
                    <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: 'var(--ff-border)' }}>
                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {DAYS.map(d => (
                                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide py-1"
                                    style={{ color: 'var(--ff-text-muted)' }}>
                                    {d}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {calendarCells.map((date, idx) => {
                                if (!date) return <div key={idx} />;
                                const events = dayEvents.get(date) ?? [];
                                const dayNum = Number(date.slice(-2));
                                const todayIso = new Date().toISOString().slice(0, 10);
                                const isToday = date === todayIso;
                                const isSelected = date === selectedDay;
                                const visible = events.slice(0, 4);
                                return (
                                    <button
                                        key={date}
                                        onClick={() => events.length > 0 && setSelectedDay(isSelected ? null : date)}
                                        className="aspect-square rounded-lg p-1 flex flex-col items-center transition-colors"
                                        style={{
                                            background: isSelected ? 'color-mix(in srgb, var(--ff-accent) 12%, transparent)' : 'var(--ff-bg)',
                                            border: isToday ? '1px solid var(--ff-accent)' : '1px solid var(--ff-border)',
                                            cursor: events.length > 0 ? 'pointer' : 'default',
                                        }}
                                    >
                                        <span className="text-[11px] font-medium mt-0.5"
                                            style={{ color: isToday ? 'var(--ff-accent)' : 'var(--ff-text-primary)' }}>
                                            {dayNum}
                                        </span>
                                        <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1">
                                            {visible.map((ev, i) => (
                                                ev.type === 'cashed'
                                                    ? <Check key={i} size={9} strokeWidth={3} style={{ color: ev.color }} />
                                                    : <span key={i} className="rounded-full" style={{ width: 6, height: 6, background: ev.color }} />
                                            ))}
                                            {events.length > 4 && (
                                                <span className="text-[8px] font-bold" style={{ color: 'var(--ff-text-muted)' }}>
                                                    +{events.length - 4}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                            <span className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 6, height: 6, background: '#94a3b8' }} /> Upcoming</span>
                            <span className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 6, height: 6, background: '#f59e0b' }} /> Overdue</span>
                            <span className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 6, height: 6, background: '#ef4444' }} /> Missed</span>
                            <span className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 6, height: 6, background: '#22c55e' }} /> Collected</span>
                            <span className="flex items-center gap-1.5"><span className="rounded-full ring-1 ring-amber-500" style={{ width: 6, height: 6, background: '#22c55e' }} /> Collected (Late)</span>
                            <span className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 6, height: 6, background: '#a855f7' }} /> Deferred</span>
                            <span className="flex items-center gap-1.5"><Check size={10} strokeWidth={3} style={{ color: '#22c55e' }} /> Actually cashed</span>
                        </div>

                        {selectedDay && (
                            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ff-border)' }}>
                                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--ff-text-muted)' }}>
                                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                <div className="space-y-2">
                                    {Array.from(new Map((dayEvents.get(selectedDay) ?? []).map(ev => [ev.cashing.id, ev.cashing])).values())
                                        .map(renderCashingRow)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
                                                            let isLateDriver = false;

                                                            if (c.status === 'recorded' || c.status === 'late_admin') {
                                                                borderColor = '#22c55e';
                                                                bgColor = '#22c55e';
                                                                textColor = 'white';
                                                                nodeLabel = '✓';
                                                            } else if (c.status === 'late_driver') {
                                                                // Collected, but late by driver — primary green checkmark with amber accent
                                                                borderColor = '#f59e0b';
                                                                bgColor = '#22c55e';
                                                                textColor = 'white';
                                                                nodeLabel = '✓';
                                                                isLateDriver = true;
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
                                                            const statusTooltip =
                                                                c.status === 'recorded' ? 'Collected (On Time)' :
                                                                c.status === 'late_driver' ? 'Collected (Late by Driver)' :
                                                                c.status === 'late_admin' ? 'Collected (Late by Admin)' :
                                                                c.status === 'deferred_to_salary' ? 'Deferred to Salary Week' :
                                                                isOverdue ? 'Overdue Pending' :
                                                                isToday ? 'Due Today' : 'Upcoming';

                                                            return (
                                                                <div
                                                                    key={c.id}
                                                                    onClick={() => canEditApp('transport') && setResolvingCashing(c)}
                                                                    className={`flex flex-col items-center gap-1 z-10 relative group ${canEditApp('transport') ? 'cursor-pointer hover:scale-110' : 'cursor-help'} transition-transform`}
                                                                    title={`${isSalary ? 'Salary Week • ' : ''}Expected ${c.expected_date} [${statusTooltip}]${canEditApp('transport') ? ' • Click to view/edit' : ''}`}
                                                                >
                                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] border-2 shadow-sm transition-transform relative"
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
                                                                        {isLateDriver && (
                                                                            <span className="absolute -bottom-1 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 shadow-sm" title="Collected late">
                                                                                <Clock size={8} />
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

            <ParseCashingSmsModal
                isOpen={showParseModal}
                onClose={() => setShowParseModal(false)}
                onSuccess={() => {
                    refetchOverdue();
                }}
                vehicles={vehicles}
                drivers={drivers}
                cashings={cashings}
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
