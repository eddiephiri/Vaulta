import { useState } from 'react';
import { Plus, TrendingUp, Pencil } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useIncome } from '../hooks/useIncome';
import { useVehicles } from '../hooks/useVehicles';
import { useDrivers } from '../hooks/useDrivers';
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

export function Income() {
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<IncomeRecord | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const { canEditApp } = useWorkspace();
    const { vehicles } = useVehicles();
    const { drivers } = useDrivers(true);  // active only
    const { records, loading, error, totalToday, totalThisWeek, totalThisMonth, refetch } =
        useIncome(vehicleFilter || undefined);
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = records.filter(r => {
        if (sourceFilter && r.metadata?.source !== sourceFilter) return false;
        if (monthFilter && !r.date.startsWith(monthFilter)) return false;
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

    const isFiltered = Boolean(monthFilter || vehicleFilter || sourceFilter || searchQuery);
    const filteredTotal = filtered.reduce((acc, r) => acc + Number(r.amount_zmw), 0);
    const activeFilterCount = [vehicleFilter, sourceFilter, monthFilter, searchQuery].filter(Boolean).length;

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
                    { id: 'filtered', label: isFiltered ? (monthFilter ? `Total (${monthFilter})` : 'Filtered Total') : 'This Month', value: loading ? '—' : `ZMW ${fmt(isFiltered ? filteredTotal : totalThisMonth)}` },
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
                <input type="month" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setCurrentPage(1); }}
                    className="text-sm px-3 py-2 rounded-lg w-full md:w-auto"
                    style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }} />
                <div className="flex-1 min-w-[200px]">
                    <SearchInput
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
                        placeholder="Search by reference, notes, or plate..."
                    />
                </div>
            </MobileFilterSheet>

            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading income records…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <TrendingUp size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No income records yet. Add your first entry above.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedItems.map(r => (
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
                    ))}
                </div>
            )}

            {!loading && filtered.length > 0 && (
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
                initialData={editing ?? undefined}
            />
        </div>
    );
}
