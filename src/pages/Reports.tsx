import { useState, useMemo } from 'react';
import { Download, TrendingUp, Car, Receipt, FileCheck2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MobileFilterSheet } from '../components/MobileFilterSheet';
import { useIncome } from '../hooks/useIncome';
import { useExpenses } from '../hooks/useExpenses';
import { useVehicles } from '../hooks/useVehicles';
import { useLicensing } from '../hooks/useLicensing';

const REPORT_TYPES = [
    { id: 'profit_loss', label: 'Profit & Loss', desc: 'Income vs Expenses summary by period', icon: TrendingUp, color: '#3b82f6' },
    { id: 'vehicle_performance', label: 'Vehicle Performance', desc: 'Earnings and costs per vehicle', icon: Car, color: '#8b5cf6' },
    { id: 'expense_breakdown', label: 'Expense Breakdown', desc: 'Costs categorised by type', icon: Receipt, color: '#ef4444' },
    { id: 'license_summary', label: 'License Status', desc: 'Active, expiring and expired licenses', icon: FileCheck2, color: '#f59e0b' },
] as const;

type ReportId = typeof REPORT_TYPES[number]['id'];

const EXPENSE_CAT_LABELS: Record<string, string> = {
    fuel: 'Fuel', service: 'Service', tyre: 'Tyre', licensing: 'Licensing',
    insurance: 'Insurance', repairs: 'Repairs', salary: 'Salary', wash: 'Wash', other: 'Other',
};
const EXPENSE_CAT_COLORS: Record<string, string> = {
    fuel: '#f59e0b', service: '#3b82f6', tyre: '#8b5cf6', licensing: '#06b6d4',
    insurance: '#10b981', repairs: '#ef4444', salary: '#a855f7', wash: '#64748b', other: '#94a3b8',
};

const LICENSE_TYPE_LABELS: Record<string, string> = {
    road_tax: 'Road Tax',
    fitness_certificate: 'Fitness Certificate',
    insurance: 'Insurance',
    council_permit: 'Council Permit',
    other: 'Other',
};

const VEHICLE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    active: { bg: '#22c55e20', text: '#22c55e' },
    inactive: { bg: '#94a3b820', text: '#94a3b8' },
    maintenance: { bg: '#f59e0b20', text: '#f59e0b' },
};

function getLastNMonths(n: number): string[] {
    const months: string[] = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
        months.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
}

function toCsv(rows: (string | number)[][]): string {
    return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function Reports() {
    const [activeReport, setActiveReport] = useState<ReportId>('profit_loss');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const activeFilterCount = [vehicleFilter, fromDate, toDate].filter(Boolean).length;

    const { vehicles } = useVehicles();
    const { records: incomeRecords, loading: incomeLoading } = useIncome(vehicleFilter || undefined);
    const { records: expenseRecords, loading: expenseLoading } = useExpenses(vehicleFilter || undefined);
    const { records: licenseRecords, loading: licenseLoading, expiring } = useLicensing(vehicleFilter || undefined);

    const loading = incomeLoading || expenseLoading || licenseLoading;
    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const filteredIncome = useMemo(
        () => incomeRecords.filter(r => (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate)),
        [incomeRecords, fromDate, toDate]
    );
    const filteredExpenses = useMemo(
        () => expenseRecords.filter(r => (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate)),
        [expenseRecords, fromDate, toDate]
    );

    const totalIncome = filteredIncome.reduce((acc, r) => acc + Number(r.amount_zmw), 0);
    const totalExpense = filteredExpenses.reduce((acc, r) => acc + Number(r.amount_zmw), 0);
    const netProfit = totalIncome - totalExpense;

    // 6-month trend (independent of the date-range filter, mirrors Budget/Personal reports)
    const months = useMemo(() => getLastNMonths(6), []);
    const monthlyTrend = useMemo(() => months.map(m => ({
        month: m,
        label: new Date(m + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }),
        income: incomeRecords.filter(r => r.date.startsWith(m)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
        expense: expenseRecords.filter(r => r.date.startsWith(m)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
    })), [incomeRecords, expenseRecords, months]);
    const maxTrendVal = Math.max(...monthlyTrend.flatMap(m => [m.income, m.expense]), 1);

    // Vehicle performance
    const vehiclePerformance = useMemo(() => {
        const map = new Map<string, { vehicle: typeof vehicles[number]; income: number; expense: number }>();
        vehicles.forEach(v => map.set(v.id, { vehicle: v, income: 0, expense: 0 }));
        filteredIncome.forEach(r => {
            const id = r.vehicle?.id ?? r.reference_entity_id;
            if (id && map.has(id)) map.get(id)!.income += Number(r.amount_zmw);
        });
        filteredExpenses.forEach(r => {
            const id = r.vehicle?.id ?? r.reference_entity_id;
            if (id && map.has(id)) map.get(id)!.expense += Number(r.amount_zmw);
        });
        return Array.from(map.values())
            .map(v => ({ ...v, net: v.income - v.expense }))
            .sort((a, b) => b.net - a.net);
    }, [vehicles, filteredIncome, filteredExpenses]);

    // Expense breakdown by category
    const categoryBreakdown = useMemo(() => {
        const map: Record<string, { name: string; total: number; color: string; count: number }> = {};
        filteredExpenses.forEach(r => {
            const cat = r.metadata?.category ?? 'other';
            if (!map[cat]) map[cat] = { name: EXPENSE_CAT_LABELS[cat] ?? cat, total: 0, color: EXPENSE_CAT_COLORS[cat] ?? '#94a3b8', count: 0 };
            map[cat].total += Number(r.amount_zmw);
            map[cat].count++;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [filteredExpenses]);

    // License status
    const today = new Date().toISOString().slice(0, 10);
    const licenseStatus = (r: typeof licenseRecords[number]) => {
        const isExpired = r.expiry_date < today;
        const isExpSoon = !isExpired && expiring.some(e => e.id === r.id);
        return isExpired
            ? { label: 'Expired', color: '#ef4444' }
            : isExpSoon
                ? { label: 'Expiring Soon', color: '#f59e0b' }
                : { label: 'Active', color: '#22c55e' };
    };
    const licenseCounts = useMemo(() => {
        const counts = { active: 0, expiring: 0, expired: 0 };
        licenseRecords.forEach(r => {
            const isExpired = r.expiry_date < today;
            const isExpSoon = !isExpired && expiring.some(e => e.id === r.id);
            if (isExpired) counts.expired++;
            else if (isExpSoon) counts.expiring++;
            else counts.active++;
        });
        return counts;
    }, [licenseRecords, expiring, today]);
    const sortedLicenses = useMemo(
        () => [...licenseRecords].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)),
        [licenseRecords]
    );

    const handleExport = () => {
        const dateSuffix = fromDate || toDate ? `${fromDate || 'start'}_to_${toDate || 'today'}` : new Date().toISOString().slice(0, 10);

        if (activeReport === 'profit_loss') {
            const rows: (string | number)[][] = [
                ['Date', 'Type', 'Description', 'Vehicle', 'Amount ZMW'],
                ...[...filteredIncome, ...filteredExpenses]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(r => [r.date, r.type, r.description ?? '', r.vehicle?.plate ?? '', Number(r.amount_zmw).toFixed(2)]),
            ];
            downloadCsv(toCsv(rows), `profit-loss-report-${dateSuffix}.csv`);
        } else if (activeReport === 'vehicle_performance') {
            const rows: (string | number)[][] = [
                ['Vehicle', 'Make/Model', 'Status', 'Income ZMW', 'Expenses ZMW', 'Net ZMW'],
                ...vehiclePerformance.map(v => [
                    v.vehicle.plate, `${v.vehicle.make} ${v.vehicle.model}`, v.vehicle.status,
                    v.income.toFixed(2), v.expense.toFixed(2), v.net.toFixed(2),
                ]),
            ];
            downloadCsv(toCsv(rows), `vehicle-performance-report-${dateSuffix}.csv`);
        } else if (activeReport === 'expense_breakdown') {
            const rows: (string | number)[][] = [
                ['Category', 'Total ZMW', 'Transaction Count', 'Share %'],
                ...categoryBreakdown.map(c => [
                    c.name, c.total.toFixed(2), c.count, totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0,
                ]),
            ];
            downloadCsv(toCsv(rows), `expense-breakdown-report-${dateSuffix}.csv`);
        } else {
            const rows: (string | number)[][] = [
                ['Vehicle', 'License Type', 'Issued', 'Expiry', 'Status', 'Cost ZMW'],
                ...sortedLicenses.map(r => [
                    r.vehicle?.plate ?? '', LICENSE_TYPE_LABELS[r.license_type] ?? r.license_type,
                    r.issued_date, r.expiry_date, licenseStatus(r).label, Number(r.cost_zmw).toFixed(2),
                ]),
            ];
            downloadCsv(toCsv(rows), `license-status-report-${dateSuffix}.csv`);
        }
    };

    return (
        <div>
            <PageHeader
                title="Reports"
                subtitle="Generate and export business reports in ZMW"
                action={
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                }
            />

            {/* Date range picker */}
            <MobileFilterSheet open={filtersOpen} onToggle={() => setFiltersOpen(f => !f)} filterCount={activeFilterCount}>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <label className="text-xs shrink-0" style={{ color: 'var(--ff-text-muted)' }}>From</label>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg w-full"
                        style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <label className="text-xs shrink-0" style={{ color: 'var(--ff-text-muted)' }}>To</label>
                    <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg w-full"
                        style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                    />
                </div>
                <select
                    value={vehicleFilter}
                    onChange={e => setVehicleFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg w-full md:w-auto"
                    style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                >
                    <option value="">All Vehicles</option>
                    {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>
                    ))}
                </select>
            </MobileFilterSheet>

            {/* Report type cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {REPORT_TYPES.map(rt => {
                    const Icon = rt.icon;
                    const isActive = activeReport === rt.id;
                    return (
                        <button
                            key={rt.id}
                            onClick={() => setActiveReport(rt.id)}
                            className="flex items-start gap-4 p-5 rounded-xl text-left transition-transform hover:-translate-y-0.5"
                            style={{
                                background: isActive ? `${rt.color}10` : 'var(--ff-surface)',
                                border: `1px solid ${isActive ? rt.color : 'var(--ff-border)'}`,
                            }}
                        >
                            <div
                                className="flex items-center justify-center rounded-lg flex-shrink-0"
                                style={{ width: 44, height: 44, background: `${rt.color}20` }}
                            >
                                <Icon size={20} style={{ color: rt.color }} />
                            </div>
                            <div>
                                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ff-text-primary)' }}>
                                    {rt.label}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                    {rt.desc}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div
                    className="flex flex-col items-center justify-center h-32 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                >
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading report data…</p>
                </div>
            ) : activeReport === 'profit_loss' ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        {[
                            { label: 'Income', value: totalIncome, color: '#22c55e' },
                            { label: 'Expenses', value: totalExpense, color: '#ef4444' },
                            { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? '#22c55e' : '#ef4444' },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                                <p className="text-xl font-bold" style={{ color: s.color }}>ZMW {fmt(s.value)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <h2 className="font-semibold text-sm mb-5" style={{ color: 'var(--ff-text-primary)' }}>
                            Income vs Expenses — Last 6 Months
                        </h2>
                        <div className="flex items-end gap-3" style={{ height: 160 }}>
                            {monthlyTrend.map(m => (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full flex gap-1 items-end" style={{ height: 130 }}>
                                        <div className="flex-1 rounded-t transition-all duration-500"
                                            style={{ height: `${(m.income / maxTrendVal) * 100}%`, background: '#22c55e', minHeight: m.income > 0 ? 4 : 0 }}
                                            title={`Income: ZMW ${fmt(m.income)}`} />
                                        <div className="flex-1 rounded-t transition-all duration-500"
                                            style={{ height: `${(m.expense / maxTrendVal) * 100}%`, background: '#ef4444', minHeight: m.expense > 0 ? 4 : 0 }}
                                            title={`Expenses: ZMW ${fmt(m.expense)}`} />
                                    </div>
                                    <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{m.label}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4 mt-3">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#22c55e' }} /><span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Income</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#ef4444' }} /><span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Expenses</span></div>
                        </div>
                    </div>
                </>
            ) : activeReport === 'vehicle_performance' ? (
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    {vehiclePerformance.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32">
                            <Car size={28} style={{ color: 'var(--ff-border)' }} className="mb-2" />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No vehicles to report on.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--ff-border)' }}>
                                        <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Vehicle</th>
                                        <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Status</th>
                                        <th className="text-right px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Income</th>
                                        <th className="text-right px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Expenses</th>
                                        <th className="text-right px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vehiclePerformance.map(v => {
                                        const sc = VEHICLE_STATUS_COLORS[v.vehicle.status] ?? VEHICLE_STATUS_COLORS.inactive;
                                        return (
                                            <tr key={v.vehicle.id} style={{ borderBottom: '1px solid var(--ff-border)' }}>
                                                <td className="px-5 py-3">
                                                    <p className="font-medium" style={{ color: 'var(--ff-text-primary)' }}>{v.vehicle.plate}</p>
                                                    <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{v.vehicle.make} {v.vehicle.model}</p>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: sc.bg, color: sc.text }}>
                                                        {v.vehicle.status}
                                                    </span>
                                                </td>
                                                <td className="text-right px-5 py-3" style={{ color: '#22c55e' }}>ZMW {fmt(v.income)}</td>
                                                <td className="text-right px-5 py-3" style={{ color: '#ef4444' }}>ZMW {fmt(v.expense)}</td>
                                                <td className="text-right px-5 py-3 font-semibold" style={{ color: v.net >= 0 ? '#22c55e' : '#ef4444' }}>ZMW {fmt(v.net)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : activeReport === 'expense_breakdown' ? (
                <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--ff-text-primary)' }}>
                        Expenses by Category {(fromDate || toDate) && `— ${fromDate || '…'} to ${toDate || '…'}`}
                    </h2>
                    {categoryBreakdown.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24">
                            <Receipt size={28} style={{ color: 'var(--ff-border)' }} className="mb-2" />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No expense data for the selected filters.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {categoryBreakdown.map(cat => (
                                <div key={cat.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--ff-text-primary)' }}>{cat.name} <span style={{ color: 'var(--ff-text-muted)' }}>({cat.count})</span></span>
                                        <span style={{ color: 'var(--ff-text-muted)' }}>ZMW {fmt(cat.total)} · {totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0}%</span>
                                    </div>
                                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{
                                            width: `${totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0}%`,
                                            background: cat.color,
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        {[
                            { label: 'Active', value: licenseCounts.active, color: '#22c55e' },
                            { label: 'Expiring Soon', value: licenseCounts.expiring, color: '#f59e0b' },
                            { label: 'Expired', value: licenseCounts.expired, color: '#ef4444' },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        {sortedLicenses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32">
                                <FileCheck2 size={28} style={{ color: 'var(--ff-border)' }} className="mb-2" />
                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No licensing records for the selected filters.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--ff-border)' }}>
                                            <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Vehicle</th>
                                            <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Type</th>
                                            <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Expiry</th>
                                            <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Status</th>
                                            <th className="text-right px-5 py-3 font-medium" style={{ color: 'var(--ff-text-muted)' }}>Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedLicenses.map(r => {
                                            const status = licenseStatus(r);
                                            return (
                                                <tr key={r.id} style={{ borderBottom: '1px solid var(--ff-border)' }}>
                                                    <td className="px-5 py-3" style={{ color: 'var(--ff-text-primary)' }}>{r.vehicle?.plate}</td>
                                                    <td className="px-5 py-3" style={{ color: 'var(--ff-text-primary)' }}>{LICENSE_TYPE_LABELS[r.license_type] ?? r.license_type}</td>
                                                    <td className="px-5 py-3" style={{ color: 'var(--ff-text-muted)' }}>{r.expiry_date}</td>
                                                    <td className="px-5 py-3">
                                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${status.color}20`, color: status.color }}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="text-right px-5 py-3" style={{ color: 'var(--ff-text-primary)' }}>ZMW {fmt(Number(r.cost_zmw))}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
