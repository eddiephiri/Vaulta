import { useState } from 'react';
import { Plus, Receipt, Pencil, Lock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useExpenses } from '../hooks/useExpenses';
import { useVehicles } from '../hooks/useVehicles';
import { useDrivers } from '../hooks/useDrivers';
import { AddExpenseModal } from '../components/AddExpenseModal';
import type { ExpenseRecord } from '../types';

const EXPENSE_CATEGORIES = ['fuel', 'service', 'tyre', 'licensing', 'insurance', 'repairs', 'salary', 'wash', 'other'] as const;
const CAT_LABELS: Record<string, string> = {
    fuel: 'Fuel', service: 'Service', tyre: 'Tyre', licensing: 'Licensing',
    insurance: 'Insurance', repairs: 'Repairs', salary: 'Salary', wash: 'Wash', other: 'Other',
};
const CAT_COLORS: Record<string, string> = {
    fuel: '#f59e0b', service: '#3b82f6', tyre: '#8b5cf6', licensing: '#06b6d4',
    insurance: '#10b981', repairs: '#ef4444', salary: '#a855f7', wash: '#64748b', other: '#94a3b8',
};

export function Expenses() {
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<ExpenseRecord | null>(null);

    const { vehicles } = useVehicles();
    const { drivers } = useDrivers(true);  // active only
    const { records, loading, error, totalToday, totalThisWeek, totalThisMonth, refetch } =
        useExpenses(vehicleFilter || undefined);

    const filtered = records.filter(r => {
        if (categoryFilter && r.category !== categoryFilter) return false;
        if (monthFilter && !r.date.startsWith(monthFilter)) return false;
        return true;
    });

    const fmt = (n: number) =>
        n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const catTotals = EXPENSE_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
        acc[cat] = records
            .filter(r => r.category === cat)
            .reduce((s, r) => s + Number(r.amount_zmw), 0);
        return acc;
    }, {});

    const openAdd = () => { setEditing(null); setShowModal(true); };
    const openEdit = (r: ExpenseRecord) => { setEditing(r); setShowModal(true); };
    const handleClose = () => { setShowModal(false); setEditing(null); };

    return (
        <div>
            <PageHeader
                title="Expenses"
                subtitle="Track all costs associated with running your fleet in ZMW"
                action={
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}
                        onClick={openAdd}
                    >
                        <Plus size={16} />
                        Add Expense
                    </button>
                }
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
                    { label: 'Today', value: loading ? '—' : `ZMW ${fmt(totalToday)}` },
                    { label: 'This Week', value: loading ? '—' : `ZMW ${fmt(totalThisWeek)}` },
                    { label: 'This Month', value: loading ? '—' : `ZMW ${fmt(totalThisMonth)}` },
                ].map(s => (
                    <div key={s.label} className="rounded-xl p-4"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                            {s.label}
                        </p>
                        <p className="text-xl font-bold" style={{ color: '#ef4444' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Category breakdown chips */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setCategoryFilter('')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                        background: categoryFilter === '' ? 'var(--ff-accent)' : 'var(--ff-surface)',
                        border: '1px solid var(--ff-border)',
                        color: categoryFilter === '' ? 'white' : 'var(--ff-text-muted)',
                    }}
                >
                    All
                </button>
                {EXPENSE_CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                            background: categoryFilter === cat ? `${CAT_COLORS[cat]}30` : 'var(--ff-surface)',
                            border: `1px solid ${categoryFilter === cat ? CAT_COLORS[cat] : 'var(--ff-border)'}`,
                            color: categoryFilter === cat ? CAT_COLORS[cat] : 'var(--ff-text-muted)',
                        }}
                    >
                        {CAT_LABELS[cat]}
                        {!loading && catTotals[cat] > 0 && (
                            <span className="ml-1 opacity-75">· {fmt(catTotals[cat])}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}>
                    <option value="">All Vehicles</option>
                    {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>
                    ))}
                </select>
                <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }} />
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading expense records…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <Receipt size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        No expense records yet. Add your first entry above.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(r => {
                        const isAuto = !!r.source_table;
                        const color = CAT_COLORS[r.category] ?? '#94a3b8';
                        return (
                            <div key={r.id} className="flex items-center justify-between rounded-xl px-5 py-4"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{ background: `${color}20`, color }}>
                                            {CAT_LABELS[r.category] ?? r.category}
                                        </span>
                                        {isAuto && (
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                style={{ background: '#33415530', color: 'var(--ff-text-muted)', border: '1px solid var(--ff-border)' }}>
                                                Auto
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                        {r.vehicle?.plate} — {r.vehicle?.make} {r.vehicle?.model} · {r.date}
                                    </p>
                                    {r.description && (
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>{r.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                    <p className="font-bold text-base" style={{ color: '#ef4444' }}>
                                        ZMW {fmt(Number(r.amount_zmw))}
                                    </p>
                                    {isAuto ? (
                                        <span title="Auto-generated — edit the source record" style={{ padding: 4, color: 'var(--ff-text-muted)' }}>
                                            <Lock size={14} />
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => openEdit(r)}
                                            title="Edit expense"
                                            style={{ background: 'none', border: 'none', padding: 4, color: 'var(--ff-text-muted)', borderRadius: 6 }}
                                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ff-accent)')}
                                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <AddExpenseModal
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
