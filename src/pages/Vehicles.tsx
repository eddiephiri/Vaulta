import { useState } from 'react';
import { Plus, Car, Pencil } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useVehicles } from '../hooks/useVehicles';
import { AddVehicleModal } from '../components/AddVehicleModal';
import { SearchInput } from '../components/SearchInput';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { Vehicle } from '../types';

const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: '#22c55e20', text: '#22c55e' },
    inactive: { bg: '#94a3b820', text: '#94a3b8' },
    maintenance: { bg: '#f59e0b20', text: '#f59e0b' },
};

export function Vehicles() {
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Vehicle | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { canEditApp } = useWorkspace();
    const { vehicles, loading, error, refetch } = useVehicles();

    const filteredVehicles = vehicles.filter((v) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            v.plate.toLowerCase().includes(q) ||
            v.make.toLowerCase().includes(q) ||
            v.model.toLowerCase().includes(q) ||
            v.status.toLowerCase().includes(q)
        );
    });

    const { currentPage, totalPages, setCurrentPage, paginatedItems } = usePagination(filteredVehicles, 9);


    const openAdd = () => { setEditing(null); setShowModal(true); };
    const openEdit = (v: Vehicle) => { setEditing(v); setShowModal(true); };
    const handleClose = () => { setShowModal(false); setEditing(null); };

    return (
        <div>
            <PageHeader
                title="Vehicles"
                subtitle="Manage your fleet of up to 5 vehicles"
                action={canEditApp('transport') && (
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--ff-accent-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--ff-accent)')}
                        onClick={openAdd}
                    >
                        <Plus size={16} />
                        Add Vehicle
                    </button>
                )}
            />

            {error && (
                <div
                    className="mb-4 p-4 rounded-lg text-sm"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
                >
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading vehicles…</p>
                </div>
            ) : (
                <>
                    <div className="mb-6">
                        <SearchInput
                            value={searchQuery}
                            onChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
                            placeholder="Search vehicles by plate, make, model, or status..."
                        />
                    </div>
                    {filteredVehicles.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center h-48 rounded-xl"
                            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                        >
                            <Car size={40} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                                No vehicles yet. Click "Add Vehicle" to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paginatedItems.map(v => {
                                const sc = statusColors[v.status] ?? statusColors.inactive;
                                return (
                                    <div
                                        key={v.id}
                                        className="rounded-xl p-5 transition-transform hover:-translate-y-0.5"
                                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-bold text-lg" style={{ color: 'var(--ff-text-primary)' }}>
                                                    {v.plate}
                                                </p>
                                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                                                    {v.year} {v.make} {v.model}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-xs px-2.5 py-1 rounded-full font-medium capitalize"
                                                    style={{ background: sc.bg, color: sc.text }}
                                                >
                                                    {v.status}
                                                </span>
                                                {canEditApp('transport') && (
                                                    <button
                                                        onClick={() => openEdit(v)}
                                                        title="Edit vehicle"
                                                        style={{ background: 'none', border: 'none', padding: 4, color: 'var(--ff-text-muted)', borderRadius: 6 }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ff-accent)')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid var(--ff-border)' }}>
                                            <div>
                                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Color</p>
                                                <p className="text-sm font-medium capitalize" style={{ color: 'var(--ff-text-primary)' }}>{v.color}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Odometer</p>
                                                <p className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>{v.odometer_km.toLocaleString()} km</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && filteredVehicles.length > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </>
            )}

            <AddVehicleModal
                open={showModal}
                onClose={handleClose}
                onSuccess={refetch}
                initialData={editing ?? undefined}
            />
        </div>
    );
}
