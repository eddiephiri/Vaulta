import { useState, useMemo } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useBudgetIncome } from '../../hooks/budget/useBudgetIncome';
import { useBudgetExpenses } from '../../hooks/budget/useBudgetExpenses';

function getLastNMonths(n: number): string[] {
    const months: string[] = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
        months.push(dd.toISOString().slice(0, 7));
    }
    return months;
}

export function BudgetReports() {
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

    const { records: incomeRecords, loading: incomeLoading } = useBudgetIncome();
    const { records: expenseRecords, loading: expenseLoading } = useBudgetExpenses();

    const loading = incomeLoading || expenseLoading;
    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Monthly income vs expense for chart (last 6 months)
    const months = getLastNMonths(6);
    const monthlyData = useMemo(() => months.map(m => ({
        month: m,
        label: new Date(m + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }),
        income: incomeRecords.filter(r => r.date.startsWith(m)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
        expense: expenseRecords.filter(r => r.date.startsWith(m)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
    })), [incomeRecords, expenseRecords, months.join(',')]);

    const maxVal = Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1);

    // Category breakdown for selected month
    const categoryBreakdown = useMemo(() => {
        const map: Record<string, { name: string; total: number; color: string }> = {};
        expenseRecords
            .filter(r => r.date.startsWith(monthFilter))
            .forEach(r => {
                const key = r.metadata?.category_name ?? 'Uncategorised';
                if (!map[key]) map[key] = { name: key, total: 0, color: '#ef4444' };
                map[key].total += Number(r.amount_zmw);
            });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [expenseRecords, monthFilter]);

    const monthTotal = {
        income: incomeRecords.filter(r => r.date.startsWith(monthFilter)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
        expense: expenseRecords.filter(r => r.date.startsWith(monthFilter)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
    };

    // CSV Export
    const handleExport = () => {
        const rows = [
            ['Date', 'Type', 'Description', 'Category', 'Account', 'Amount ZMW'],
            ...[...incomeRecords, ...expenseRecords]
                .filter(r => r.date.startsWith(monthFilter))
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(r => [
                    r.date,
                    r.type,
                    r.description ?? '',
                    r.metadata?.category_name ?? '',
                    r.metadata?.account_name ?? '',
                    Number(r.amount_zmw).toFixed(2),
                ]),
        ];
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-report-${monthFilter}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <PageHeader
                title="Reports"
                subtitle="Monthly income and expense analysis"
                action={
                    <button onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'var(--ff-surface)' }}>
                        <Download size={16} /> Export CSV
                    </button>
                }
            />

            {/* Month selector */}
            <div className="flex items-center gap-3 mb-6">
                <label className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Viewing month:</label>
                <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }} />
            </div>

            {/* Monthly summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Income', value: monthTotal.income, color: '#22c55e' },
                    { label: 'Expenses', value: monthTotal.expense, color: '#ef4444' },
                    { label: 'Net', value: monthTotal.income - monthTotal.expense, color: monthTotal.income - monthTotal.expense >= 0 ? '#22c55e' : '#ef4444' },
                ].map(s => (
                    <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                        <p className="text-xl font-bold" style={{ color: s.color }}>
                            {loading ? '—' : `ZMW ${fmt(s.value)}`}
                        </p>
                    </div>
                ))}
            </div>

            {/* 6-Month Bar Chart */}
            <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <h2 className="font-semibold text-sm mb-5" style={{ color: 'var(--ff-text-primary)' }}>
                    Income vs Expenses — Last 6 Months
                </h2>
                <div className="flex items-end gap-3" style={{ height: 160 }}>
                    {monthlyData.map(m => (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex gap-1 items-end" style={{ height: 130 }}>
                                <div className="flex-1 rounded-t transition-all duration-500"
                                    style={{ height: `${(m.income / maxVal) * 100}%`, background: '#22c55e', minHeight: m.income > 0 ? 4 : 0 }}
                                    title={`Income: ZMW ${fmt(m.income)}`} />
                                <div className="flex-1 rounded-t transition-all duration-500"
                                    style={{ height: `${(m.expense / maxVal) * 100}%`, background: '#ef4444', minHeight: m.expense > 0 ? 4 : 0 }}
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

            {/* Expense category breakdown */}
            <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--ff-text-primary)' }}>
                    Expense Breakdown — {new Date(monthFilter + '-01').toLocaleString('en', { month: 'long', year: 'numeric' })}
                </h2>
                {loading ? (
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                ) : categoryBreakdown.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-24">
                        <BarChart3 size={28} style={{ color: 'var(--ff-border)' }} className="mb-2" />
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No expense data for this month.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {categoryBreakdown.map(cat => (
                            <div key={cat.name}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span style={{ color: 'var(--ff-text-primary)' }}>{cat.name}</span>
                                    <span style={{ color: 'var(--ff-text-muted)' }}>ZMW {fmt(cat.total)} · {Math.round((cat.total / monthTotal.expense) * 100)}%</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                        width: `${(cat.total / monthTotal.expense) * 100}%`,
                                        background: '#ef4444',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
