import { useState } from 'react';
import { Plus, FileCheck2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useLicensing } from '../hooks/useLicensing';
import { useVehicles } from '../hooks/useVehicles';
import { AddLicenseModal } from '../components/AddLicenseModal';

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
    const { vehicles } = useVehicles();
    const { records, loading, error, expiring, refetch } = useLicensing(vehicleFilter || undefined);

    const countByType = (type: string) =>
        records.filter(r => r.license_type === type).length;

    const today = new Date().toISOString().slice(0, 10);
    const expired = records.filter(r => r.expiry_date < today);

    const fmt = (n: number) =>
        n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div>
            <PageHeader
                title="Licensing"
                subtitle="Track road tax, fitness certificates, insurance and permits"
                action={
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={() => setShowModal(true)}
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
            <div className="flex gap-3 mb-6 p-4 rounded-xl"
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
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading licenses…</p>
                </div>
            ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No licensing records yet. Add your first record above.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {records.map(r => {
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
                                    <p className="font-bold text-sm flex-shrink-0 ml-4" style={{ color: '#ef4444' }}>
                                        ZMW {fmt(Number(r.cost_zmw))}
                                    </p>
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

            <AddLicenseModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={refetch}
                vehicles={vehicles}
            />
        </div>
    );
}
