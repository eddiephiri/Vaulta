import { useState, useEffect, useMemo } from 'react';
import { CalendarClock, Banknote, CheckCircle2, Clock, AlertTriangle, Calendar, CornerDownRight, MessageSquare, Phone, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDriver } from '../../contexts/DriverContext';
import { useDriverCashings } from '../../hooks/useDriverCashings';
import { EnableNotificationsButton } from '../../components/EnableNotificationsButton';
import { OdometerReminderCard } from '../../components/OdometerReminderCard';
import type { CashingStatus, ExpectedCashing } from '../../types';

const STATUS_META: Record<CashingStatus, { label: string; color: string }> = {
    recorded: { label: 'On time', color: '#22c55e' },
    late_driver: { label: 'Late', color: '#ef4444' },
    late_admin: { label: 'Recorded (Office Delay)', color: '#94a3b8' }, // office delay — not the driver's fault
    pending: { label: 'Upcoming', color: 'var(--ff-text-muted)' },
    deferred_to_salary: { label: 'Deferred', color: '#a855f7' },
};

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export function DriverHome() {
    const { driver, loading: driverLoading, error: driverError } = useDriver();
    const { cashings, schedule, loading, error, refetch } = useDriverCashings(driver?.vehicle_id);

    const today = new Date().toISOString().slice(0, 10);

    // Swap Request states
    const [swappingWeek, setSwappingWeek] = useState<ExpectedCashing | null>(null);
    const [swapReason, setSwapReason] = useState('');
    const [submittingSwap, setSubmittingSwap] = useState(false);
    const [swapError, setSwapError] = useState<string | null>(null);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);

    // Log Cashing states
    const [loggingCashing, setLoggingCashing] = useState<ExpectedCashing | null>(null);
    const [cashingAmount, setCashingAmount] = useState('');
    const [txnId, setTxnId] = useState('');
    const [cashingNotes, setCashingNotes] = useState('');
    const [submittingCashing, setSubmittingCashing] = useState(false);
    const [cashingError, setCashingError] = useState<string | null>(null);

    const fetchPendingRequests = async () => {
        if (!driver) return;
        const { data } = await supabase
            .from('driver_swap_requests')
            .select('*')
            .eq('driver_id', driver.id)
            .eq('status', 'pending');
        setPendingRequests(data ?? []);
    };

    useEffect(() => {
        if (driver) {
            fetchPendingRequests();
        }
    }, [driver]);

    const handleSubmitSwap = async () => {
        if (!driver || !swappingWeek) return;
        
        const salaryCashing = cycleCashings.find(c => c.is_salary_week);
        if (!salaryCashing) {
            setSwapError('No salary week found in current cycle.');
            return;
        }

        setSubmittingSwap(true);
        setSwapError(null);

        const { error: supaErr } = await supabase
            .from('driver_swap_requests')
            .insert({
                workspace_id: driver.workspace_id,
                driver_id: driver.id,
                cashing_id_1: swappingWeek.id,
                cashing_id_2: salaryCashing.id,
                reason: swapReason.trim() || null,
                status: 'pending'
            });

        setSubmittingSwap(false);

        if (supaErr) {
            setSwapError(supaErr.message);
        } else {
            setSwappingWeek(null);
            setSwapReason('');
            fetchPendingRequests();
        }
    };

    const handleSubmitCashing = async () => {
        if (!driver || !loggingCashing) return;

        const amount = Number(cashingAmount);
        if (isNaN(amount) || amount <= 0 || amount > 999999.99) {
            setCashingError('Enter a valid amount (0.01 – 999,999.99, max 2 decimal places).');
            return;
        }

        if (!txnId.trim()) {
            setCashingError('Airtel Money Transaction ID is required.');
            return;
        }

        setSubmittingCashing(true);
        setCashingError(null);

        const { error: supaErr } = await supabase
            .rpc('driver_log_cashing', {
                p_expected_cashing_id: loggingCashing.id,
                p_amount_zmw: amount,
                p_reference: txnId.trim(),
                p_notes: cashingNotes.trim() || null
            });

        setSubmittingCashing(false);

        if (supaErr) {
            setCashingError(supaErr.message);
        } else {
            setLoggingCashing(null);
            setCashingAmount('');
            setTxnId('');
            setCashingNotes('');
            refetch();
        }
    };

    // Current/next cashing: prefer the nearest PENDING upcoming row so that an
    // already-completed entry never hijacks the action card. Fall back to the
    // nearest future row of any status, then to the most recent past row.
    const current = useMemo(() => {
        const pendingUpcoming = cashings.find(
            c => c.expected_date >= today && c.status === 'pending'
        );
        if (pendingUpcoming) return pendingUpcoming;

        const anyUpcoming = cashings.find(c => c.expected_date >= today);
        return anyUpcoming ?? (cashings.length ? cashings[cashings.length - 1] : null);
    }, [cashings, today]);

    // Current cycle expected cashings (consistent with Admin tracking cycle).
    // Built from the date-window that contains `current` rather than a
    // backwards array-index walk, which broke when there were gaps or rows from
    // prior cycles sitting earlier in the sorted array.
    const cycleCashings = useMemo(() => {
        if (!cashings.length || !schedule || !current) return [];

        const cycleWeeks = schedule.cycle_weeks;
        const wkNum = current.week_number;

        // The cycle that contains `current` starts (wkNum - 1) weeks before it.
        const cycleStartMs =
            new Date(current.expected_date).getTime() - (wkNum - 1) * 7 * 86_400_000;
        const cycleEndMs = cycleStartMs + cycleWeeks * 7 * 86_400_000 - 1;

        const cycleStart = new Date(cycleStartMs).toISOString().slice(0, 10);
        const cycleEnd   = new Date(cycleEndMs).toISOString().slice(0, 10);

        return cashings
            .filter(c => c.expected_date >= cycleStart && c.expected_date <= cycleEnd)
            .sort((a, b) => a.week_number - b.week_number);
    }, [cashings, schedule, current]);

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
            {/* Header Greeting & Vehicle Details */}
            <div className="flex flex-col gap-4 p-5 rounded-2xl border transition-all"
                style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, var(--ff-accent), #1d4ed8)' }}>
                        {driver.name ? driver.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'DR'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-extrabold truncate" style={{ color: 'var(--ff-text-primary)' }}>
                                Hi {driver.name.split(' ')[0]}
                            </h1>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: '#22c55e20', color: '#22c55e' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Active
                            </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                            Welcome back to your dashboard
                        </p>
                    </div>
                </div>

                {/* Zambian-style License Plate Card */}
                {driver.vehicle ? (
                    <div className="flex items-center justify-between p-3 rounded-xl border"
                        style={{ background: 'var(--ff-bg)', borderColor: 'var(--ff-border)' }}>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ff-text-muted)' }}>
                                Assigned Vehicle
                            </span>
                            <span className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                {driver.vehicle.make} {driver.vehicle.model}
                            </span>
                        </div>
                        {/* Zambian Plate representation */}
                        <div className="px-3.5 py-1 rounded border border-slate-700 bg-amber-400 font-mono font-bold text-slate-900 tracking-wider text-xs shadow-sm flex items-center gap-1.5 select-none">
                            <span className="text-[8px] font-sans font-extrabold text-slate-700 border-r border-slate-600/40 pr-1.5">ZM</span>
                            {driver.vehicle.plate.toUpperCase()}
                        </div>
                    </div>
                ) : (
                    <div className="p-3 rounded-xl border text-center text-sm"
                        style={{ background: 'var(--ff-bg)', borderColor: 'var(--ff-border)', color: 'var(--ff-text-muted)' }}>
                        No vehicle assigned yet
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>{error}</div>
            )}

            <div className="rounded-xl p-4 border flex flex-col gap-3" style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ff-text-muted)' }}>Reminders</p>
                <EnableNotificationsButton />
                {driver && driver.active && driver.vehicle_id && <OdometerReminderCard driver={driver} />}
            </div>

            {/* This week schedule details / loading state */}
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
                <>
                    {/* Visual Cashing Cycle Progress (Stepper) */}
                    <div className="rounded-2xl p-5 border"
                        style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ff-text-muted)' }}>
                                Cashing Cycle Progress
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'color-mix(in srgb, var(--ff-accent) 15%, transparent)', color: 'var(--ff-accent)' }}>
                                Week {current.week_number} of {schedule.cycle_weeks}
                            </span>
                        </div>

                        {/* Progress timeline */}
                        <div className="flex items-center justify-between relative px-2 mb-2">
                            {/* Connection line */}
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-slate-200 dark:bg-slate-700 z-0"></div>
                            
                            {cycleCashings.map((c) => {
                                const wkNum = c.week_number;
                                const isPast = c.status !== 'pending';
                                const isCurrent = c.id === current.id;
                                const isSalary = c.is_salary_week;

                                const hasPendingSwap = pendingRequests.some(
                                    r => r.cashing_id_1 === c.id || r.cashing_id_2 === c.id
                                );

                                // Check if this node is clickable for swap request:
                                // Must be a future pending week and NOT currently a salary week.
                                const isClickable = !isPast && !isSalary && c.status === 'pending';

                                const handleNodeClick = () => {
                                    if (!isClickable) return;
                                    if (pendingRequests.length > 0) {
                                        alert('You already have a pending swap request. Please wait for your manager to review it.');
                                        return;
                                    }
                                    setSwapError(null);
                                    setSwapReason('');
                                    setSwappingWeek(c);
                                };

                                return (
                                    <div key={c.id} 
                                        onClick={handleNodeClick}
                                        className={`flex flex-col items-center gap-1.5 z-10 relative ${isClickable ? 'cursor-pointer group' : ''}`}
                                        title={isClickable ? 'Tap to request salary swap' : undefined}
                                    >
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm relative"
                                            style={{
                                                background: isPast
                                                    ? '#22c55e'
                                                    : isCurrent
                                                    ? 'var(--ff-accent)'
                                                    : 'var(--ff-surface)',
                                                color: isPast || isCurrent ? 'white' : 'var(--ff-text-muted)',
                                                border: `2px solid ${
                                                    isPast
                                                        ? '#22c55e'
                                                        : isCurrent
                                                        ? 'var(--ff-accent)'
                                                        : 'var(--ff-border)'
                                                }`,
                                                boxShadow: isCurrent ? '0 0 10px color-mix(in srgb, var(--ff-accent) 50%, transparent)' : 'none'
                                            }}>
                                            {isPast ? '✓' : wkNum}
                                            
                                            {/* Salary week badge overlay */}
                                            {isSalary && (
                                                <div className="absolute -top-2.5 -right-1.5 bg-purple-600 text-white rounded-full p-0.5 shadow-sm"
                                                    title="Salary Week">
                                                    <Banknote size={10} />
                                                </div>
                                            )}

                                            {/* Pending swap badge overlay */}
                                            {hasPendingSwap && (
                                                <div className="absolute -bottom-1 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 shadow-sm animate-pulse"
                                                    title="Pending Swap Request">
                                                    <Clock size={9} />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-medium"
                                            style={{
                                                color: isCurrent
                                                    ? 'var(--ff-text-primary)'
                                                    : 'var(--ff-text-muted)',
                                                fontWeight: isCurrent ? 'bold' : 'normal'
                                            }}>
                                            {isSalary ? 'Payday' : `Wk ${wkNum}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <p className="text-[11px] text-center mt-3" style={{ color: 'var(--ff-text-muted)' }}>
                            {current.is_salary_week
                                ? '🎉 This is your salary/deduction week. Enjoy your payout!'
                                : `Currently in Week ${current.week_number}. Salary week occurs in Week ${cycleCashings.find(c => c.is_salary_week)?.week_number ?? schedule.salary_week}.`}
                        </p>

                        {/* Pending swap list for transparency */}
                        {pendingRequests.length > 0 && (
                            <div className="mt-4 p-3 rounded-xl border" style={{ borderColor: 'var(--ff-border)', background: 'var(--ff-bg)' }}>
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#f59e0b' }}>
                                    Pending Swap Request
                                </p>
                                {pendingRequests.map(r => {
                                    const cashing1 = cashings.find(c => c.id === r.cashing_id_1);
                                    const cashing2 = cashings.find(c => c.id === r.cashing_id_2);
                                    return (
                                        <div key={r.id} className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                            Requested to swap <strong>Week {cashing1?.week_number}</strong> with Salary <strong>Week {cashing2?.week_number}</strong>.
                                            {r.reason && <p className="mt-1 italic text-[11px]">Reason: "{r.reason}"</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Dynamic Urgency / Next Cashing Card */}
                    {(() => {
                        const isOverdue = current.expected_date < today && current.status === 'pending';
                        const isDueToday = current.expected_date === today && current.status === 'pending';
                        
                        // Calculate days remaining or overdue
                        const expDateObj = new Date(current.expected_date);
                        const todayObj = new Date(today);
                        const diffTime = expDateObj.getTime() - todayObj.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        let urgencyColor = 'var(--ff-accent)';
                        let urgencyBg = 'color-mix(in srgb, var(--ff-accent) 10%, transparent)';
                        let urgencyTitle = 'Upcoming Cashing';
                        let urgencyText = `Due in ${diffDays} days (${fmtDate(current.expected_date)})`;
                        let statusIcon = <CalendarClock size={24} style={{ color: 'var(--ff-accent)' }} />;

                        if (current.status !== 'pending') {
                            urgencyColor = '#22c55e';
                            urgencyBg = '#22c55e10';
                            urgencyTitle = 'Cashing Completed';
                            urgencyText = `Recorded successfully for ${fmtDate(current.expected_date)}`;
                            statusIcon = <CheckCircle2 size={24} style={{ color: '#22c55e' }} />;
                        } else if (isOverdue) {
                            urgencyColor = '#ef4444';
                            urgencyBg = '#ef444410';
                            urgencyTitle = '⚠️ Cashing Overdue';
                            urgencyText = `Expected on ${fmtDate(current.expected_date)} (Overdue by ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'})`;
                            statusIcon = <AlertTriangle size={24} style={{ color: '#ef4444' }} />;
                        } else if (isDueToday) {
                            urgencyColor = '#f59e0b';
                            urgencyBg = '#f59e0b10';
                            urgencyTitle = '⚡ Due Today!';
                            urgencyText = `Please submit your returns today, ${fmtDate(current.expected_date)}`;
                            statusIcon = <Clock size={24} style={{ color: '#f59e0b' }} />;
                        } else if (diffDays === 1) {
                            urgencyColor = '#f59e0b';
                            urgencyBg = '#f59e0b10';
                            urgencyTitle = '⏰ Due Tomorrow';
                            urgencyText = `Expected tomorrow (${fmtDate(current.expected_date)})`;
                            statusIcon = <Clock size={24} style={{ color: '#f59e0b' }} />;
                        }

                        return (
                            <div className="rounded-2xl p-5 border flex items-start gap-4 transition-all"
                                style={{
                                    background: urgencyBg,
                                    borderColor: `color-mix(in srgb, ${urgencyColor} 20%, transparent)`,
                                }}>
                                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex-shrink-0">
                                    {statusIcon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: urgencyColor }}>
                                        {current.is_salary_week ? 'Salary Week Payout' : 'Cashing Details'}
                                    </span>
                                    <h2 className="text-base font-extrabold mt-0.5" style={{ color: 'var(--ff-text-primary)' }}>
                                        {urgencyTitle}
                                    </h2>
                                    <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                                        {urgencyText}
                                    </p>
                                    {current.notes && (
                                        <p className="text-xs italic mt-2 p-2 rounded bg-white/40 dark:bg-slate-900/40 border border-black/5 dark:border-white/5 truncate" style={{ color: 'var(--ff-text-muted)' }}>
                                            "{current.notes}"
                                        </p>
                                    )}
                                    {current.status === 'pending' && (
                                        <button
                                            onClick={() => {
                                                setLoggingCashing(current);
                                                setCashingAmount('');
                                                setTxnId('');
                                                setCashingError(null);
                                            }}
                                            className="mt-3 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-transform active:scale-95 shadow-sm"
                                            style={{
                                                background: urgencyColor,
                                                border: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <Banknote size={14} />
                                            Log This Cashing
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </>
            )}

            {/* On-time record */}
            {stats.total > 0 && (
                <div className="rounded-xl p-4 border" style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs uppercase tracking-wide font-bold" style={{ color: 'var(--ff-text-muted)' }}>
                            On-Time Record
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                                background: stats.rate! >= 80 ? '#22c55e20' : stats.rate! >= 50 ? '#f59e0b20' : '#ef444420',
                                color: stats.rate! >= 80 ? '#22c55e' : stats.rate! >= 50 ? '#f59e0b' : '#ef4444'
                            }}>
                            {stats.rate! >= 80 ? 'Excellent' : stats.rate! >= 50 ? 'Good' : 'Needs Work'}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-extrabold" style={{ color: stats.rate! >= 80 ? '#22c55e' : stats.rate! >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {stats.rate}%
                        </span>
                        <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                            ({stats.onTime} of {stats.total} cashings submitted on time)
                        </span>
                    </div>

                    {/* Dynamic progress bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3">
                        <div className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${stats.rate}%`,
                                background: stats.rate! >= 80 ? '#22c55e' : stats.rate! >= 50 ? '#f59e0b' : '#ef4444'
                            }}
                        />
                    </div>

                    <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--ff-text-muted)' }}>
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {stats.onTime} on time
                        </span>
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--ff-text-muted)' }}>
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            {stats.late} late
                        </span>
                    </div>
                </div>
            )}

            {/* Recent cashings timeline */}
            {recent.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs uppercase tracking-wide font-bold px-1" style={{ color: 'var(--ff-text-muted)' }}>
                        Recent Cashings History
                    </p>
                    <div className="rounded-xl border divide-y overflow-hidden" 
                        style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                        {recent.map(c => {
                            const meta = STATUS_META[c.status];
                            let statusIcon = <Clock size={16} style={{ color: meta.color }} />;
                            if (c.status === 'recorded') statusIcon = <CheckCircle2 size={16} style={{ color: '#22c55e' }} />;
                            else if (c.status === 'late_driver') statusIcon = <AlertTriangle size={16} style={{ color: '#ef4444' }} />;
                            else if (c.status === 'deferred_to_salary') statusIcon = <CornerDownRight size={16} style={{ color: '#a855f7' }} />;
                            else if (c.status === 'pending') statusIcon = <Calendar size={16} style={{ color: 'var(--ff-text-muted)' }} />;

                            return (
                                <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                            {statusIcon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                                {fmtDate(c.expected_date)}
                                            </p>
                                            <p className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                                                Week {c.week_number} • {c.is_salary_week ? 'Salary Payout' : 'Regular Cashing'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: `${meta.color}15`, color: meta.color }}>
                                        {meta.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Support Quick Contact card */}
            <div className="rounded-xl p-4 border flex flex-col gap-3"
                style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--ff-accent) 12%, transparent)', color: 'var(--ff-accent)' }}>
                        <MessageSquare size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                            Need Help or Support?
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                            Have questions about your schedule, payouts, or vehicle? Speak to your manager directly.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 mt-1">
                    <a href="tel:+260978699706"
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 select-none text-center"
                        style={{ borderColor: 'var(--ff-border)', color: 'var(--ff-text-primary)', textDecoration: 'none' }}>
                        <Phone size={14} /> Call Manager
                    </a>
                    <a href="https://wa.me/260978699706" target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 select-none text-center"
                        style={{ background: '#25D366', textDecoration: 'none' }}>
                        <MessageSquare size={14} /> WhatsApp Support
                    </a>
                </div>
            </div>

            {/* Swap Request Modal */}
            {swappingWeek && (
                <div onClick={() => setSwappingWeek(null)} style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16,
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'var(--ff-surface)',
                        border: '1px solid var(--ff-border)',
                        borderRadius: 16, width: '100%', maxWidth: 'min(380px, 95vw)', padding: '24px 20px',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                        maxHeight: '90vh', overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                                Request Salary Week Swap
                            </h2>
                            <button onClick={() => setSwappingWeek(null)} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                                <X size={18} />
                            </button>
                        </div>

                        {swapError && (
                            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 12 }}>
                                {swapError}
                            </div>
                        )}

                        <p className="text-xs leading-relaxed" style={{ color: 'var(--ff-text-muted)' }}>
                            Would you like to request a swap of your upcoming <strong>Week {swappingWeek.week_number}</strong> (Cashing) with the cycle's <strong>Week {cycleCashings.find(c => c.is_salary_week)?.week_number}</strong> (Salary)? 
                            This requires approval from your manager.
                        </p>

                        <div className="mt-4">
                            <label className="block text-[11px] mb-1.5" style={{ color: 'var(--ff-text-muted)' }}>
                                Reason for request (optional)
                            </label>
                            <textarea
                                rows={2}
                                style={{
                                    background: 'var(--ff-surface)',
                                    color: 'var(--ff-text-primary)',
                                    border: '1px solid var(--ff-border)',
                                    borderRadius: 8,
                                    padding: '8px 10px',
                                    fontSize: 13,
                                    width: '100%',
                                    outline: 'none',
                                    resize: 'none',
                                    boxSizing: 'border-box',
                                }}
                                placeholder="E.g. low income, personal emergency..."
                                value={swapReason}
                                onChange={e => setSwapReason(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button type="button" onClick={() => setSwappingWeek(null)} style={{
                                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
                                background: 'var(--ff-surface)', color: 'var(--ff-text-muted)',
                                border: '1px solid var(--ff-border)',
                            }}>Cancel</button>
                            <button type="button" disabled={submittingSwap} onClick={handleSubmitSwap} style={{
                                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
                                fontWeight: 600, background: submittingSwap ? '#334155' : 'var(--ff-accent)',
                                color: 'white', border: 'none',
                            }}>{submittingSwap ? 'Submitting…' : 'Submit Request'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Cashing Modal */}
            {loggingCashing && (
                <div onClick={() => setLoggingCashing(null)} style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16,
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'var(--ff-surface)',
                        border: '1px solid var(--ff-border)',
                        borderRadius: 16, width: '100%', maxWidth: 'min(380px, 95vw)', padding: '24px 20px',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                        maxHeight: '90vh', overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                                Log Weekly Cashing
                            </h2>
                            <button onClick={() => setLoggingCashing(null)} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                                <X size={18} />
                            </button>
                        </div>

                        {cashingError && (
                            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 12 }}>
                                {cashingError}
                            </div>
                        )}

                        <div style={{ marginBottom: 16 }}>
                            <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                Period: <strong>Week {loggingCashing.week_number}</strong> ({fmtDate(loggingCashing.expected_date)})
                            </p>
                        </div>

                        <form onSubmit={e => { e.preventDefault(); handleSubmitCashing(); }} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-[11px] mb-1.5 font-bold uppercase tracking-wider" style={{ color: 'var(--ff-text-muted)' }}>
                                    Amount (ZMW) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    style={{
                                        background: 'var(--ff-surface)',
                                        color: 'var(--ff-text-primary)',
                                        border: '1px solid var(--ff-border)',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                        fontSize: 13,
                                        width: '100%',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                    placeholder="Enter cashing amount, e.g. 1500"
                                    value={cashingAmount}
                                    onChange={e => setCashingAmount(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] mb-1.5 font-bold uppercase tracking-wider" style={{ color: 'var(--ff-text-muted)' }}>
                                    Airtel Money Transaction ID *
                                </label>
                                <input
                                    type="text"
                                    required
                                    style={{
                                        background: 'var(--ff-surface)',
                                        color: 'var(--ff-text-primary)',
                                        border: '1px solid var(--ff-border)',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                        fontSize: 13,
                                        width: '100%',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                    placeholder="Enter Txn ID, e.g. AP260805..."
                                    value={txnId}
                                    onChange={e => setTxnId(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] mb-1.5 font-bold uppercase tracking-wider" style={{ color: 'var(--ff-text-muted)' }}>
                                    Reason / Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                                </label>
                                <textarea
                                    rows={2}
                                    style={{
                                        background: 'var(--ff-surface)',
                                        color: 'var(--ff-text-primary)',
                                        border: '1px solid var(--ff-border)',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                        fontSize: 13,
                                        width: '100%',
                                        outline: 'none',
                                        resize: 'none',
                                        boxSizing: 'border-box',
                                    } as React.CSSProperties}
                                    placeholder="e.g. Low income week, Yango promo cut earnings…"
                                    value={cashingNotes}
                                    onChange={e => setCashingNotes(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                <button type="button" onClick={() => setLoggingCashing(null)} style={{
                                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
                                    background: 'var(--ff-surface)', color: 'var(--ff-text-muted)',
                                    border: '1px solid var(--ff-border)',
                                    cursor: 'pointer',
                                }}>Cancel</button>
                                <button type="submit" disabled={submittingCashing} style={{
                                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
                                    fontWeight: 600, background: submittingCashing ? '#334155' : 'var(--ff-accent)',
                                    color: 'white', border: 'none',
                                    cursor: 'pointer',
                                }}>{submittingCashing ? 'Logging…' : 'Submit Cashing'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
