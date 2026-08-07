import { useState, useMemo } from 'react';
import { Plus, TrendingUp, Pencil, ChevronLeft, ChevronRight, Car } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useIncome } from '../hooks/useIncome';
import { useVehicles } from '../hooks/useVehicles';
import { useDrivers } from '../hooks/useDrivers';
import { useCashingSchedules } from '../hooks/useCashingSchedules';
import { AddIncomeModal } from '../components/AddIncomeModal';
import { SearchInput } from '../components/SearchInput';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { MobileFilterSheet } from '../components/MobileFilterSheet';
import type { IncomeRecord } from '../types';

const SOURCE_LABELS: Record<string, string> = {
    yango: 'Yango',
    public_transport: 'Bus',
    rental: 'Rental',
    other: 'Other',
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

function dayLabel(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getLastNMonths(n: number): string[] {
    const months: string[] = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
        months.push(ymOf(new Date(d.getFullYear(), d.getMonth() - i, 1)));
    }
    return months;
}

export function Income() {
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState<string>(() => currentMonth());
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<IncomeRecord | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { canEditApp } = useWorkspace();
    const { vehicles } = useVehicles();
    const { drivers } = useDrivers(true);  // active only
    const { schedules } = useCashingSchedules();  // active, for source auto-fill
    const { records, loading, error, totalToday, totalThisWeek, refetch } =
        useIncome(vehicleFilter || undefined);

    const isAllTime = monthFilter === '';

    const filtered = records.filter(r => {
        if (sourceFilter && r.metadata?.source !== sourceFilter) return false;
        if (!isAllTime && !r.date.startsWith(monthFilter)) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (r.metadata?.reference && r.metadata.reference.toLowerCase().includes(q)) ||
            (r.description && r.description.toLowerCase().includes(q)) ||
            (r.vehicle?.plate && r.vehicle.plate.toLowerCase().includes(q))
        );
    });

    const { currentPage, totalPages, setCurrentPage, paginatedItems } = usePagination(filtered, 10);

    const fmt = (n: number) =>
        n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const openAdd = () => { setEditing(null); setShowModal(true); };
    const openEdit = (r: IncomeRecord) => { setEditing(r); setShowModal(true); };
    const handleClose = () => { setShowModal(false); setEditing(null); };

    const periodTotal = filtered.reduce((acc, r) => acc + Number(r.amount_zmw), 0);
    const activeFilterCount = [vehicleFilter, sourceFilter, searchQuery].filter(Boolean).length;

    const goToMonth = (ym: string) => { setMonthFilter(ym); setCurrentPage(1); };
    const shiftMonth = (delta: number) => goToMonth(isAllTime ? currentMonth() : shiftMonthStr(monthFilter, delta));
    const toggleAllTime = () => goToMonth(isAllTime ? currentMonth() : '');

    // 6-month income trend (vehicle-scoped, independent of source/search/month filters)
    const trendMonths = useMemo(() => getLastNMonths(6), []);
    const monthlyTrend = useMemo(() => trendMonths.map(m => ({
        month: m,
        label: new Date(m + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }),
        income: records.filter(r => r.date.startsWith(m)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
    })), [records, trendMonths]);
    const maxTrendVal = Math.max(...monthlyTrend.map(m => m.income), 1);

    // Per-vehicle breakdown for the selected month
    const vehicleBreakdown = useMemo(() => {
        if (isAllTime) return [];
        const map = new Map<string, { plate: string; make: string; model: string; total: number }>();
        filtered.forEach(r => {
            const key = r.vehicle?.id ?? 'unknown';
            if (!map.has(key)) {
                map.set(key, {
                    plate: r.vehicle?.plate ?? 'Unassigned',
                    make: r.vehicle?.make ?? '',
                    model: r.vehicle?.model ?? '',
                    total: 0,
                });
            }
            map.get(key)!.total += Number(r.amount_zmw);
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [filtered, isAllTime]);

    // Records for the selected month, grouped by day
    const groupedByDay = useMemo(() => {
        if (isAllTime) return [];
        const map = new Map<string, IncomeRecord[]>();
        filtered.forEach(r => {
            if (!map.has(r.date)) map.set(r.date, []);
            map.get(r.date)!.push(r);
        });
        return Array.from(map.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, recs]) => ({
                date,
                records: recs,
                total: recs.reduce((acc, r) => acc + Number(r.amount_zmw), 0),
            }));
    }, [filtered, isAllTime]);

    const renderRecordRow = (r: IncomeRecord) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl px-5 py-4"
            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
            <div>
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: '#22c55e20', color: '#22c55e' }}>
                        {r.metadata && r.metadata.source ? (SOURCE_LABELS[r.metadata.source] ?? r.metadata.source) : 'Unknown'}
                    </span>
                    {r.metadata?.reference && (
                        <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>#{r.metadata.reference}</span>
                    )}
                </div>
                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                    {r.vehicle?.plate} — {r.vehicle?.make} {r.vehicle?.model} · {r.date}
                </p>
                {r.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>{r.description}</p>}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <p className="font-bold text-base" style={{ color: '#22c55e' }}>
                    ZMW {fmt(Number(r.amount_zmw))}
                </p>
                {canEditApp('transport') && (
                    <button
                        onClick={() => openEdit(r)}
                        title="Edit record"
                        className="touch-target flex items-center justify-center"
                        style={{ background: 'none', border: 'none', padding: 10, color: 'var(--ff-text-muted)', borderRadius: 8 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ff-accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}
                    >
                        <Pencil size={16} />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div>
            <PageHeader
                title="Income"
                subtitle="Track daily and monthly earnings per vehicle in ZMW"
                action={canEditApp('transport') && (
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={openAdd}
                    >
                        <Plus size={16} />
                        Add Income
                    </button>
                )}
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                    {error}
                </div>
            )}

            {/* Summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { id: 'today', label: 'Today', value: loading ? '—' : `ZMW ${fmt(totalToday)}` },
                    { id: 'week', label: 'This Week', value: loading ? '—' : `ZMW ${fmt(totalThisWeek)}` },
                    { id: 'period', label: isAllTime ? 'All Time Total' : monthLabel(monthFilter), value: loading ? '—' : `ZMW ${fmt(periodTotal)}` },
                ].map(s => (
                    <div key={s.id} className="rounded-xl p-4"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                            {s.label}
                        </p>
                        <p className="text-xl font-bold" style={{ color: '#22c55e' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Month navigator */}
            <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => shiftMonth(-1)}
                        disabled={isAllTime}
                        title="Previous month"
                        className="flex items-center justify-center rounded-lg touch-target disabled:opacity-30"
                        style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <p className="text-sm font-semibold w-[150px] text-center" style={{ color: 'var(--ff-text-primary)' }}>
                        {isAllTime ? 'All Time' : monthLabel(monthFilter)}
                    </p>
                    <button
                        onClick={() => shiftMonth(1)}
                        disabled={isAllTime}
                        title="Next month"
                        className="flex items-center justify-center rounded-lg touch-target disabled:opacity-30"
                        style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
                <button
                    onClick={toggleAllTime}
                    className="text-xs font-medium px-3 py-2 rounded-lg"
                    style={{
                        background: isAllTime ? 'var(--ff-accent)' : 'var(--ff-bg)',
                        color: isAllTime ? 'white' : 'var(--ff-text-muted)',
                        border: '1px solid var(--ff-border)',
                    }}
                >
                    {isAllTime ? 'Back to This Month' : 'View All Time'}
                </button>
            </div>

            {/* Filter bar */}
            <MobileFilterSheet open={filtersOpen} onToggle={() => setFiltersOpen(f => !f)} filterCount={activeFilterCount}>
                <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg w-full md:w-auto"
                    style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}>
                    <option value="">All Vehicles</option>
                    {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>
                    ))}
                </select>
                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg w-full md:w-auto"
                    style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}>
                    <option value="">All Sources</option>
                    {Object.entries(SOURCE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>
                <div className="flex-1 min-w-[200px]">
                    <SearchInput
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
                        placeholder="Search by reference, notes, or plate..."
                    />
                </div>
            </MobileFilterSheet>

            {/* 6-month trend */}
            <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <h2 className="font-semibold text-sm mb-5" style={{ color: 'var(--ff-text-primary)' }}>
                    Income Trend — Last 6 Months
                </h2>
                <div className="flex items-end gap-3" style={{ height: 140 }}>
                    {monthlyTrend.map(m => (
                        <button
                            key={m.month}
                            onClick={() => goToMonth(m.month)}
                            className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                        >
                            <div className="w-full flex items-end justify-center" style={{ height: 110 }}>
                                <div className="w-full max-w-[40px] rounded-t transition-all duration-500"
                                    style={{
                                        height: `${(m.income / maxTrendVal) * 100}%`,
                                        background: !isAllTime && m.month === monthFilter
                                            ? 'linear-gradient(180deg, #22c55e, #16a34a)'
                                            : '#22c55e40',
                                        minHeight: m.income > 0 ? 4 : 0,
                                    }}
                                    title={`ZMW ${fmt(m.income)}`} />
                            </div>
                            <p className="text-xs" style={{ color: !isAllTime && m.month === monthFilter ? '#22c55e' : 'var(--ff-text-muted)' }}>
                                {m.label}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Per-vehicle breakdown for the selected month */}
            {!isAllTime && vehicleBreakdown.length > 0 && (
                <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--ff-text-primary)' }}>
                        <Car size={16} /> By Vehicle — {monthLabel(monthFilter)}
                    </h2>
                    <div className="space-y-3">
                        {vehicleBreakdown.map(v => (
                            <div key={v.plate}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span style={{ color: 'var(--ff-text-primary)' }}>{v.plate} {v.make && `— ${v.make} ${v.model}`}</span>
                                    <span style={{ color: 'var(--ff-text-muted)' }}>
                                        ZMW {fmt(v.total)} · {periodTotal > 0 ? Math.round((v.total / periodTotal) * 100) : 0}%
                                    </span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${periodTotal > 0 ? (v.total / periodTotal) * 100 : 0}%`, background: '#22c55e' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Records */}
            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading income records…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <TrendingUp size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        {isAllTime ? 'No income records yet. Add your first entry above.' : `No income recorded for ${monthLabel(monthFilter)}.`}
                    </p>
                </div>
            ) : isAllTime ? (
                <div className="space-y-3">
                    {paginatedItems.map(renderRecordRow)}
                </div>
            ) : (
                <div className="space-y-5">
                    {groupedByDay.map(group => (
                        <div key={group.date}>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ff-text-muted)' }}>
                                    {dayLabel(group.date)}
                                </p>
                                <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>
                                    ZMW {fmt(group.total)}
                                </p>
                            </div>
                            <div className="space-y-3">
                                {group.records.map(renderRecordRow)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && isAllTime && filtered.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            <AddIncomeModal
                open={showModal}
                onClose={handleClose}
                onSuccess={refetch}
                vehicles={vehicles}
                drivers={drivers}
                schedules={schedules}
                initialData={editing ?? undefined}
            />
        </div>
    );
}
