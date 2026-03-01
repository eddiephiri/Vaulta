import { useState } from 'react';
import { Plus, Wrench, Pencil } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useServiceHistory } from '../hooks/useServiceHistory';
import { useVehicles } from '../hooks/useVehicles';
import { AddServiceModal } from '../components/AddServiceModal';
import { SearchInput } from '../components/SearchInput';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import type { ServiceRecord } from '../types';

export function ServiceHistory() {
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<ServiceRecord | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { vehicles } = useVehicles();
    const { records, loading, error, refetch } = useServiceHistory(vehicleFilter || undefined);

    const filtered = records.filter(r => {
        if (monthFilter && !r.date.startsWith(monthFilter)) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.description.toLowerCase().includes(q) ||
            (r.notes && r.notes.toLowerCase().includes(q)) ||
            (r.service_provider && r.service_provider.toLowerCase().includes(q))
        );
    });

    const { currentPage, totalPages, setCurrentPage, paginatedItems } = usePagination(filtered, 10);

    const fmt = (n: number) =>
        n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const openAdd = () => { setEditing(null); setShowModal(true); };
    const openEdit = (r: ServiceRecord) => { setEditing(r); setShowModal(true); };
    const handleClose = () => { setShowModal(false); setEditing(null); };

    return (
        <div>
            <PageHeader
                title="Service History"
                subtitle="Track maintenance and service events for each vehicle"
                action={
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={openAdd}
                    >
                        <Plus size={16} />
                        Log Service
                    </button>
                }
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                    {error}
                </div>
            )}

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <select
                    value={vehicleFilter}
                    onChange={e => setVehicleFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                >
                    <option value="">All Vehicles</option>
                    {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>
                    ))}
                </select>
                <input
                    type="month"
                    value={monthFilter}
                    onChange={e => { setMonthFilter(e.target.value); setCurrentPage(1); }}
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                />
                <div className="flex-1 min-w-[200px]">
                    <SearchInput
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
                        placeholder="Search by description, notes, or provider..."
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading service records…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <Wrench size={40} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No service records yet. Log your first service event above.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedItems.map(r => (
                        <div key={r.id} className="rounded-xl p-5"
                            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <p className="font-semibold text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                                        {r.description}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                        {r.vehicle?.plate} — {r.vehicle?.make} {r.vehicle?.model}
                                        {r.service_provider ? ` · ${r.service_provider}` : ''}
                                        {r.odometer_km ? ` · ${Number(r.odometer_km).toLocaleString()} km` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                    <div className="text-right">
                                        <p className="font-bold text-sm" style={{ color: '#ef4444' }}>
                                            ZMW {fmt(Number(r.cost_zmw))}
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>{r.date}</p>
                                    </div>
                                    <button
                                        onClick={() => openEdit(r)}
                                        title="Edit record"
                                        style={{ background: 'none', border: 'none', padding: 4, color: 'var(--ff-text-muted)', borderRadius: 6 }}
                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ff-accent)')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                </div>
                            </div>
                            {r.notes && (
                                <p className="text-xs mt-2 pt-2" style={{ color: 'var(--ff-text-muted)', borderTop: '1px solid var(--ff-border)' }}>
                                    {r.notes}
                                </p>
                            )}
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

            <AddServiceModal
                open={showModal}
                onClose={handleClose}
                onSuccess={refetch}
                vehicles={vehicles}
                initialData={editing ?? undefined}
            />
        </div>
    );
}
