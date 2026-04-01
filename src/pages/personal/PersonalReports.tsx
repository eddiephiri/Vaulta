import { useState, useMemo } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { usePersonalExpenses } from '../../hooks/personal/usePersonalExpenses';
import type { PersonalExpenseCategory } from '../../types';

const CATEGORY_META: Record<PersonalExpenseCategory, { label: string; color: string }> = {
    fuel: { label: 'Fuel & Gas', color: '#f59e0b' },
    food: { label: 'Food & Drinks', color: '#ef4444' },
    clothing: { label: 'Clothing', color: '#ec4899' },
    transport: { label: 'Transport & Travel', color: '#3b82f6' },
    entertainment: { label: 'Entertainment', color: '#8b5cf6' },
    health: { label: 'Health & Wellness', color: '#10b981' },
    education: { label: 'Education', color: '#6366f1' },
    gifts: { label: 'Gifts & Donations', color: '#f97316' },
    subscriptions: { label: 'Subscriptions', color: '#06b6d4' },
    other: { label: 'Other', color: '#6b7280' },
};

const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash',
    mobile_money: 'Mobile Money',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
};

function getLastNMonths(n: number): string[] {
    const months: string[] = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
        months.push(dd.toISOString().slice(0, 7));
    }
    return months;
}

export function PersonalReports() {
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
    const { records, loading } = usePersonalExpenses();
    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Monthly totals for the bar chart (last 6 months)
    const months = getLastNMonths(6);
    const monthlyData = useMemo(() => months.map(m => ({
        month: m,
        label: new Date(m + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }),
        total: records.filter(r => r.date.startsWith(m)).reduce((acc, r) => acc + Number(r.amount_zmw), 0),
    })), [records, months.join(',')]);

    const maxVal = Math.max(...monthlyData.map(m => m.total), 1);

    // Selected month totals
    const monthRecords = records.filter(r => r.date.startsWith(monthFilter));
    const monthTotal = monthRecords.reduce((acc, r) => acc + Number(r.amount_zmw), 0);
    const daysInMonth = new Date(parseInt(monthFilter.slice(0, 4)), parseInt(monthFilter.slice(5, 7)), 0).getDate();
    const currentDay = monthFilter === new Date().toISOString().slice(0, 7) ? new Date().getDate() : daysInMonth;
    const dailyAverage = monthTotal / Math.max(1, currentDay);

    // Category breakdown for selected month
    const categoryBreakdown = useMemo(() => {
        const map: Record<string, { name: string; total: number; color: string; count: number }> = {};
        monthRecords.forEach(r => {
            const cat = r.metadata?.category ?? 'other';
            const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
            if (!map[cat]) map[cat] = { name: meta.label, total: 0, color: meta.color, count: 0 };
            map[cat].total += Number(r.amount_zmw);
            map[cat].count++;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [monthRecords]);

    // Payment method breakdown
    const paymentBreakdown = useMemo(() => {
        const map: Record<string, { name: string; total: number; count: number }> = {};
        monthRecords.forEach(r => {
            const pm = r.metadata?.payment_method ?? 'unspecified';
            const label = PAYMENT_LABELS[pm] ?? 'Unspecified';
            if (!map[pm]) map[pm] = { name: label, total: 0, count: 0 };
            map[pm].total += Number(r.amount_zmw);
            map[pm].count++;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [monthRecords]);

    // Top expense
    const topExpense = monthRecords.length > 0
        ? monthRecords.reduce((max, r) => Number(r.amount_zmw) > Number(max.amount_zmw) ? r : max, monthRecords[0])
        : null;
    const topCat = topExpense ? (CATEGORY_META[topExpense.metadata?.category ?? 'other'] ?? CATEGORY_META.other) : null;

    // CSV Export
    const handleExport = () => {
        const rows = [
            ['Date', 'Category', 'Payment Method', 'Description', 'Notes', 'Amount ZMW'],
            ...monthRecords
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(r => [
                    r.date,
                    CATEGORY_META[r.metadata?.category ?? 'other']?.label ?? 'Other',
                    PAYMENT_LABELS[r.metadata?.payment_method ?? ''] ?? '',
                    r.description ?? '',
                    r.metadata?.notes ?? '',
                    Number(r.amount_zmw).toFixed(2),
                ]),
        ];
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personal-expenses-${monthFilter}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <PageHeader
                title="Reports"
                subtitle="Monthly spending analysis & insights"
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

            {/* Monthly summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Spent', value: monthTotal, color: '#8b5cf6' },
                    { label: 'Daily Average', value: dailyAverage, color: '#3b82f6' },
                    { label: 'Transactions', value: monthRecords.length, color: 'var(--ff-text-primary)', isCount: true },
                ].map(s => (
                    <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                        <p className="text-xl font-bold" style={{ color: s.color }}>
                            {loading ? '—' : s.isCount ? s.value : `ZMW ${fmt(s.value as number)}`}
                        </p>
                    </div>
                ))}
            </div>

            {/* Top Expense callout */}
            {topExpense && topCat && (
                <div className="rounded-xl p-4 mb-6 flex items-center gap-4"
                    style={{ background: `${topCat.color}10`, border: `1px solid ${topCat.color}30` }}>
                    <div className="p-2.5 rounded-lg" style={{ background: `${topCat.color}20` }}>
                        <BarChart3 size={18} style={{ color: topCat.color }} />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--ff-text-muted)' }}>Largest Expense This Month</p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                            {topExpense.description || topCat.label} — <span style={{ color: topCat.color }}>ZMW {fmt(Number(topExpense.amount_zmw))}</span>
                        </p>
                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{topExpense.date} · {topCat.label}</p>
                    </div>
                </div>
            )}

            {/* 6-Month Spending Trend */}
            <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <h2 className="font-semibold text-sm mb-5" style={{ color: 'var(--ff-text-primary)' }}>
                    Spending Trend — Last 6 Months
                </h2>
                <div className="flex items-end gap-3" style={{ height: 160 }}>
                    {monthlyData.map(m => (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex items-end justify-center" style={{ height: 130 }}>
                                <div className="w-full max-w-[40px] rounded-t transition-all duration-500"
                                    style={{
                                        height: `${(m.total / maxVal) * 100}%`,
                                        background: m.month === monthFilter
                                            ? 'linear-gradient(180deg, #8b5cf6, #6d28d9)'
                                            : '#8b5cf630',
                                        minHeight: m.total > 0 ? 4 : 0,
                                    }}
                                    title={`ZMW ${fmt(m.total)}`} />
                            </div>
                            <p className="text-xs" style={{ color: m.month === monthFilter ? '#8b5cf6' : 'var(--ff-text-muted)' }}>
                                {m.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category breakdown */}
                <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--ff-text-primary)' }}>
                        By Category — {new Date(monthFilter + '-01').toLocaleString('en', { month: 'long', year: 'numeric' })}
                    </h2>
                    {loading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : categoryBreakdown.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24">
                            <BarChart3 size={28} style={{ color: 'var(--ff-border)' }} className="mb-2" />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No data for this month.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {categoryBreakdown.map(cat => (
                                <div key={cat.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--ff-text-primary)' }}>{cat.name} <span style={{ color: 'var(--ff-text-muted)' }}>({cat.count})</span></span>
                                        <span style={{ color: 'var(--ff-text-muted)' }}>ZMW {fmt(cat.total)} · {monthTotal > 0 ? Math.round((cat.total / monthTotal) * 100) : 0}%</span>
                                    </div>
                                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{
                                            width: `${monthTotal > 0 ? (cat.total / monthTotal) * 100 : 0}%`,
                                            background: cat.color,
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Payment method breakdown */}
                <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--ff-text-primary)' }}>
                        By Payment Method
                    </h2>
                    {loading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : paymentBreakdown.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24">
                            <BarChart3 size={28} style={{ color: 'var(--ff-border)' }} className="mb-2" />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No data for this month.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {paymentBreakdown.map(pm => (
                                <div key={pm.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--ff-text-primary)' }}>{pm.name} <span style={{ color: 'var(--ff-text-muted)' }}>({pm.count})</span></span>
                                        <span style={{ color: 'var(--ff-text-muted)' }}>ZMW {fmt(pm.total)} · {monthTotal > 0 ? Math.round((pm.total / monthTotal) * 100) : 0}%</span>
                                    </div>
                                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{
                                            width: `${monthTotal > 0 ? (pm.total / monthTotal) * 100 : 0}%`,
                                            background: '#8b5cf6',
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
