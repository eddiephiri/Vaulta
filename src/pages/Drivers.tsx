import { useState } from 'react';
import { Plus, Users, Phone, Car, Banknote } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useDrivers } from '../hooks/useDrivers';
import { useVehicles } from '../hooks/useVehicles';
import { AddDriverModal } from '../components/AddDriverModal';

export function Drivers() {
    const [showModal, setShowModal] = useState(false);
    const { drivers, loading, error, refetch } = useDrivers();
    const { vehicles } = useVehicles();

    const fmt = (n: number) =>
        `ZMW ${n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div>
            <PageHeader
                title="Drivers"
                subtitle="Manage driver profiles, vehicle assignments, and salary information"
                action={
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={() => setShowModal(true)}
                    >
                        <Plus size={16} />
                        Add Driver
                    </button>
                }
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading drivers…</p>
                </div>
            ) : drivers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <Users size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No drivers yet. Add your first driver above.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {drivers.map(driver => (
                        <div key={driver.id} className="rounded-xl p-5"
                            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>

                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                                        style={{ background: 'var(--ff-accent)20', color: 'var(--ff-accent)' }}>
                                        {driver.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{driver.name}</p>
                                        {driver.license_number && (
                                            <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                                Lic: {driver.license_number}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                        background: driver.active ? '#22c55e20' : '#ef444420',
                                        color: driver.active ? '#22c55e' : '#ef4444',
                                    }}
                                >
                                    {driver.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            {/* Details */}
                            <div className="space-y-2">
                                {driver.phone && (
                                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                        <Phone size={12} />
                                        {driver.phone}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                    <Car size={12} />
                                    {driver.vehicle
                                        ? `${driver.vehicle.plate} — ${driver.vehicle.make} ${driver.vehicle.model}`
                                        : 'No vehicle assigned'}
                                </div>

                                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                    <Banknote size={12} />
                                    Salary: <span style={{ color: 'var(--ff-green)' }}>{fmt(driver.salary_zmw)}/mo</span>
                                </div>

                                {driver.hire_date && (
                                    <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                        Hired: {driver.hire_date}
                                    </p>
                                )}
                            </div>

                            {driver.notes && (
                                <p className="mt-3 text-xs italic" style={{ color: 'var(--ff-text-muted)' }}>
                                    {driver.notes}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <AddDriverModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={refetch}
                vehicles={vehicles}
            />
        </div>
    );
}
