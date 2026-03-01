import { useState } from 'react';
import { Plus, FileCheck2, AlertTriangle, Pencil } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useLicensing } from '../hooks/useLicensing';
import { useVehicles } from '../hooks/useVehicles';
import { AddLicenseModal } from '../components/AddLicenseModal';
import { SearchInput } from '../components/SearchInput';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import type { LicenseRecord } from '../types';

const LICENSE_TYPE_LABELS: Record<string, string> = {
    road_tax: 'Road Tax',
    fitness_certificate: 'Fitness Certificate',
    insurance: 'Insurance',
    council_permit: 'Council Permit',
    other: 'Other',
};

const LICENSE_TYPES = Object.keys(LICENSE_TYPE_LABELS);

export function Licensing() {
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<LicenseRecord | null>(null);

    const { vehicles } = useVehicles();
    const { records, loading, error, expiring, refetch } = useLicensing(vehicleFilter || undefined);
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = records.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (r.notes && r.notes.toLowerCase().includes(q)) ||
            (r.vehicle?.plate && r.vehicle.plate.toLowerCase().includes(q)) ||
            (r.license_type && r.license_type.toLowerCase().includes(q))
        );
    });

    const { currentPage, totalPages, setCurrentPage, paginatedItems } = usePagination(filtered, 10);

    const countByType = (type: string) =>
        records.filter(r => r.license_type === type).length;

    const today = new Date().toISOString().slice(0, 10);
    const expired = records.filter(r => r.expiry_date < today);

    const fmt = (n: number) =>
        n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const openAdd = () => { setEditing(null); setShowModal(true); };
    const openEdit = (r: LicenseRecord) => { setEditing(r); setShowModal(true); };
    const handleClose = () => { setShowModal(false); setEditing(null); };

    return (
        <div>
            <PageHeader
                title="Licensing"
                subtitle="Track road tax, fitness certificates, insurance and permits"
                action={
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={openAdd}
                    >
                        <Plus size={16} />
                        Add License
                    </button>
                }
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                    {error}
                </div>
            )}

            {/* Expiration alerts */}
            {expiring.length > 0 && (
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl"
                    style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}>
                    <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                    <p className="text-sm" style={{ color: '#f59e0b' }}>
                        {expiring.length} license{expiring.length > 1 ? 's' : ''} expiring within 30 days.
                    </p>
                </div>
            )}
            {expired.length > 0 && (
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl"
                    style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
                    <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                    <p className="text-sm" style={{ color: '#ef4444' }}>
                        {expired.length} license{expired.length > 1 ? 's are' : ' is'} expired.
                    </p>
                </div>
            )}

            {/* License type overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {LICENSE_TYPES.map(type => (
                    <div key={type} className="rounded-xl p-4 text-center"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <FileCheck2 size={24} className="mx-auto mb-2" style={{ color: 'var(--ff-border)' }} />
                        <p className="text-xs font-medium" style={{ color: 'var(--ff-text-muted)' }}>
                            {LICENSE_TYPE_LABELS[type]}
                        </p>
                        <p className="text-lg font-bold mt-1" style={{ color: 'var(--ff-text-primary)' }}>
                            {loading ? '—' : countByType(type)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex gap-3 mb-6 p-4 rounded-xl flex-wrap"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <select
                    value={vehicleFilter}
                    onChange={e => { setVehicleFilter(e.target.value); setCurrentPage(1); }}
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                >
                    <option value="">All Vehicles</option>
                    {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>
                    ))}
                </select>
                <div className="flex-1 min-w-[200px]">
                    <SearchInput
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
                        placeholder="Search by type, notes, or vehicle plate..."
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading licenses…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No licensing records yet. Add your first record above.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedItems.map(r => {
                        const isExpired = r.expiry_date < today;
                        const isExpSoon = !isExpired && expiring.some(e => e.id === r.id);
                        const statusColor = isExpired ? '#ef4444' : isExpSoon ? '#f59e0b' : '#22c55e';
                        const statusLabel = isExpired ? 'Expired' : isExpSoon ? 'Expiring Soon' : 'Active';

                        return (
                            <div key={r.id} className="rounded-xl p-5"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                                                {LICENSE_TYPE_LABELS[r.license_type] ?? r.license_type}
                                            </p>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                style={{ background: `${statusColor}20`, color: statusColor }}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                            {r.vehicle?.plate} — {r.vehicle?.make} {r.vehicle?.model}
                                        </p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                                            Issued: {r.issued_date} · Expires: {r.expiry_date}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                        <p className="font-bold text-sm" style={{ color: '#ef4444' }}>
                                            ZMW {fmt(Number(r.cost_zmw))}
                                        </p>
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
                        );
                    })}
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            <AddLicenseModal
                open={showModal}
                onClose={handleClose}
                onSuccess={refetch}
                vehicles={vehicles}
                initialData={editing ?? undefined}
            />
        </div>
    );
}
