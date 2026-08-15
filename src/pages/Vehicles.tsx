import { useState } from 'react';
import { Plus, Car, Pencil, Gauge, ArrowDownUp } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useVehicles } from '../hooks/useVehicles';
import { useOdometerReadings } from '../hooks/useOdometerReadings';
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

const fmtKm = (km: number) => km.toLocaleString('en-ZA', { minimumFractionDigits: 0 });

const fmtDateTime = (ts: string) =>
    new Date(ts).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }) + ' · ' + new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ─── Photo lightbox ───────────────────────────────────────────────────────────
function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: '#000000cc' }}
            onClick={onClose}
        >
            <img
                src={url}
                alt="Odometer"
                className="max-w-full max-h-full rounded-xl shadow-2xl"
                onClick={e => e.stopPropagation()}
            />
        </div>
    );
}

// ─── Odometer Readings Table ──────────────────────────────────────────────────
function OdometerReadingsSection() {
    const [filterVehicleId, setFilterVehicleId] = useState<string>('');
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(false);

    const { readings, loading, error } = useOdometerReadings(filterVehicleId || undefined);
    const { vehicles } = useVehicles();

    const sorted = sortAsc ? [...readings].reverse() : readings;

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Gauge size={18} style={{ color: 'var(--ff-accent)' }} />
                    <h2 className="text-base font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                        Odometer Readings
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {/* Vehicle filter */}
                    <select
                        id="odometer-vehicle-filter"
                        value={filterVehicleId}
                        onChange={e => setFilterVehicleId(e.target.value)}
                        className="text-xs px-3 py-1.5 rounded-lg border outline-none"
                        style={{
                            background: 'var(--ff-surface)',
                            border: '1px solid var(--ff-border)',
                            color: 'var(--ff-text-primary)',
                        }}
                    >
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.plate} — {v.make} {v.model}
                            </option>
                        ))}
                    </select>
                    {/* Sort toggle */}
                    <button
                        onClick={() => setSortAsc(a => !a)}
                        title={sortAsc ? 'Oldest first' : 'Newest first'}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                        style={{
                            background: 'var(--ff-surface)',
                            border: '1px solid var(--ff-border)',
                            color: 'var(--ff-text-muted)',
                        }}
                    >
                        <ArrowDownUp size={13} />
                        {sortAsc ? 'Oldest first' : 'Newest first'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg text-sm mb-3" style={{ background: '#ef444415', color: '#ef4444' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-32 rounded-xl" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading readings…</p>
                </div>
            ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 rounded-xl gap-2" style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)' }}>
                    <Gauge size={28} style={{ color: 'var(--ff-border)' }} />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No odometer readings yet.</p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--ff-border)' }}>
                    {/* Table header */}
                    <div
                        className="grid text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 gap-4"
                        style={{
                            gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto',
                            background: 'var(--ff-surface)',
                            borderBottom: '1px solid var(--ff-border)',
                            color: 'var(--ff-text-muted)',
                        }}
                    >
                        <span>Vehicle</span>
                        <span>Driver</span>
                        <span>Reading</span>
                        <span>Week</span>
                        <span>Submitted</span>
                        <span>Photo</span>
                    </div>

                    {/* Rows */}
                    {sorted.map((r, i) => {
                        const prevReading = sorted[i + 1];
                        const delta = prevReading && prevReading.vehicle_id === r.vehicle_id
                            ? r.reading_km - prevReading.reading_km
                            : null;

                        return (
                            <div
                                key={r.id}
                                className="grid items-center px-4 py-3 gap-4 transition-colors"
                                style={{
                                    gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto',
                                    background: i % 2 === 0 ? 'var(--ff-surface)' : 'var(--ff-bg)',
                                    borderBottom: '1px solid var(--ff-border)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ff-accent)08')}
                                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--ff-surface)' : 'var(--ff-bg)')}
                            >
                                {/* Vehicle */}
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                        {r.vehicle?.plate ?? '—'}
                                    </p>
                                    <p className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                                        {r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : ''}
                                    </p>
                                </div>

                                {/* Driver */}
                                <p className="text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                                    {r.driver?.name ?? '—'}
                                </p>

                                {/* Reading */}
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                        {fmtKm(r.reading_km)} km
                                    </p>
                                    {delta !== null && (
                                        <span
                                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                            style={{
                                                background: delta >= 0 ? '#22c55e15' : '#ef444415',
                                                color: delta >= 0 ? '#22c55e' : '#ef4444',
                                            }}
                                        >
                                            +{fmtKm(delta)} km
                                        </span>
                                    )}
                                    {r.notes && (
                                        <p className="text-[10px] italic mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                            "{r.notes}"
                                        </p>
                                    )}
                                </div>

                                {/* ISO week */}
                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                    {r.iso_week}
                                </p>

                                {/* Submitted date */}
                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                    {fmtDateTime(r.submitted_at)}
                                </p>

                                {/* Photo */}
                                <div>
                                    {r.photo_url ? (
                                        <button
                                            onClick={() => setLightboxUrl(r.photo_url!)}
                                            title="View odometer photo"
                                            className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 transition-opacity hover:opacity-80"
                                        >
                                            <img
                                                src={r.photo_url}
                                                alt="odometer"
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ) : (
                                        <span className="text-[11px]" style={{ color: 'var(--ff-border)' }}>—</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
        </div>
    );
}

// ─── Main Vehicles Page ───────────────────────────────────────────────────────

type VehiclesTab = 'fleet' | 'odometer';

export function Vehicles() {
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Vehicle | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<VehiclesTab>('fleet');
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

    const tabs: { key: VehiclesTab; label: string; icon: React.ReactNode }[] = [
        { key: 'fleet', label: 'Fleet', icon: <Car size={14} /> },
        { key: 'odometer', label: 'Odometer Readings', icon: <Gauge size={14} /> },
    ];

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

            {/* Tabs */}
            <div
                className="flex gap-0 mb-6"
                style={{ borderBottom: '2px solid var(--ff-border)' }}
            >
                {tabs.map(t => (
                    <button
                        key={t.key}
                        id={`vehicles-tab-${t.key}`}
                        onClick={() => setActiveTab(t.key)}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all relative"
                        style={{
                            background: 'transparent',
                            color: activeTab === t.key ? 'var(--ff-accent)' : 'var(--ff-text-muted)',
                            border: 'none',
                            borderBottom: activeTab === t.key ? '2px solid var(--ff-accent)' : '2px solid transparent',
                            marginBottom: '-2px',
                            cursor: 'pointer',
                        }}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>


            {/* ─── Fleet tab ──────────────────────────────────────────────── */}
            {activeTab === 'fleet' && (
                <>
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
                </>
            )}

            {/* ─── Odometer Readings tab ────────────────────────────────── */}
            {activeTab === 'odometer' && <OdometerReadingsSection />}

            <AddVehicleModal
                open={showModal}
                onClose={handleClose}
                onSuccess={refetch}
                initialData={editing ?? undefined}
            />
        </div>
    );
}
