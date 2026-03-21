import { Car, TrendingUp, Receipt, AlertTriangle, CheckCircle, CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { useVehicles } from '../hooks/useVehicles';
import { useIncome } from '../hooks/useIncome';
import { useExpenses } from '../hooks/useExpenses';
import { useLicensing } from '../hooks/useLicensing';
import { useExpectedCashings } from '../hooks/useExpectedCashings';

export function Dashboard() {
    const { vehicles, loading: vLoading } = useVehicles();
    const { records: incomeRecords, totalThisMonth: monthIncome, loading: iLoading } = useIncome();
    const { records: expenseRecords, totalThisMonth: monthExpenses, loading: eLoading } = useExpenses();
    const { expiring, records: licRecords, loading: lLoading } = useLicensing();
    const { overdue } = useExpectedCashings();

    const loading = vLoading || iLoading || eLoading || lLoading;
    const activeCount = vehicles.filter(v => v.status === 'active').length;
    const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;

    const fmt = (n: number) =>
        n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const today = new Date().toISOString().slice(0, 10);
    const expired = licRecords.filter(r => r.expiry_date < today);

    return (
        <div>
            <PageHeader
                title="Dashboard"
                subtitle="Welcome back — here's your fleet overview"
            />

            {/* Overdue cashing reminder banner */}
            {overdue.length > 0 && (
                <Link to="/transport/cashing-schedules" style={{ textDecoration: 'none' }}>
                    <div className="mb-6 p-4 rounded-xl flex items-start gap-3 cursor-pointer"
                        style={{ background: '#f59e0b15', border: '1px solid #f59e0b50' }}>
                        <CalendarClock size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                                {overdue.length} overdue cashing{overdue.length > 1 ? 's' : ''}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                {overdue.map(c =>
                                    `${c.vehicle?.plate ?? 'Vehicle'}${c.is_salary_week ? ' (salary wk)' : ''}`
                                ).join(' · ')} — tap to review
                            </p>
                        </div>
                    </div>
                </Link>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    label="Total Vehicles"
                    value={loading ? '—' : vehicles.length}
                    icon={Car}
                    accent="#3b82f6"
                />
                <StatCard
                    label="Active Vehicles"
                    value={loading ? '—' : activeCount}
                    icon={CheckCircle}
                    accent="#22c55e"
                />
                <StatCard
                    label="In Maintenance"
                    value={loading ? '—' : maintenanceCount}
                    icon={AlertTriangle}
                    accent="#f59e0b"
                />
                <StatCard
                    label="Month Income"
                    value={iLoading ? '—' : `ZMW ${fmt(monthIncome)}`}
                    icon={TrendingUp}
                    accent="#8b5cf6"
                    trend={monthExpenses > 0 ? { value: `ZMW ${fmt(monthExpenses)} expenses`, positive: false } : undefined}
                />
            </div>

            {/* Quick Summary — placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Income */}
                <div
                    className="rounded-xl p-5"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} style={{ color: '#22c55e' }} />
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                            Recent Income
                        </h3>
                    </div>
                    {iLoading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : incomeRecords.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                            No income records yet. Add your first entry on the Income page.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {incomeRecords.slice(0, 5).map(r => (
                                <li key={r.id} className="flex items-center justify-between">
                                    <span className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                                        {r.vehicle?.plate} · {r.date}
                                    </span>
                                    <span className="text-sm font-semibold" style={{ color: '#22c55e' }}>
                                        ZMW {fmt(Number(r.amount_zmw))}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Upcoming Expirations */}
                <div
                    className="rounded-xl p-5"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                            Upcoming License Expirations
                        </h3>
                    </div>
                    {lLoading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : expiring.length === 0 && expired.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                            All licensing records are current. No upcoming expirations.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {[...expired, ...expiring].slice(0, 5).map(r => {
                                const isExp = r.expiry_date < today;
                                return (
                                    <li key={r.id} className="flex items-center justify-between">
                                        <span className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                                            {r.vehicle?.plate} · {r.license_type.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{ background: isExp ? '#ef444420' : '#f59e0b20', color: isExp ? '#ef4444' : '#f59e0b' }}>
                                            {isExp ? 'Expired' : 'Expiring Soon'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Monthly Expenses */}
                <div
                    className="rounded-xl p-5"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Receipt size={16} style={{ color: '#ef4444' }} />
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                            Monthly Expenses
                        </h3>
                    </div>
                    {eLoading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : expenseRecords.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                            No expense records yet. Track costs on the Expenses page.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {expenseRecords.slice(0, 5).map(r => (
                                <li key={r.id} className="flex items-center justify-between">
                                    <span className="text-sm capitalize" style={{ color: 'var(--ff-text-muted)' }}>
                                        {r.vehicle?.plate} · {r.metadata?.category}
                                    </span>
                                    <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                                        ZMW {fmt(Number(r.amount_zmw))}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Fleet Overview */}
                <div
                    className="rounded-xl p-5"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Car size={16} style={{ color: '#3b82f6' }} />
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                            Fleet Status
                        </h3>
                    </div>
                    {loading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : vehicles.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                            No vehicles registered yet. Add yours on the Vehicles page.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {vehicles.slice(0, 5).map(v => (
                                <li key={v.id} className="flex items-center justify-between">
                                    <span className="text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                                        {v.plate} — {v.make} {v.model}
                                    </span>
                                    <span
                                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{
                                            background: v.status === 'active' ? '#22c55e20' : v.status === 'maintenance' ? '#f59e0b20' : '#94a3b820',
                                            color: v.status === 'active' ? '#22c55e' : v.status === 'maintenance' ? '#f59e0b' : '#94a3b8',
                                        }}
                                    >
                                        {v.status}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
