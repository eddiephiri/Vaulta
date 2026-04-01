import { useMemo } from 'react';
import { CreditCard, TrendingDown, Calendar, ArrowDownRight } from 'lucide-react';
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

export function PersonalDashboard() {
    const { records, loading, totalToday, totalThisWeek, totalThisMonth } = usePersonalExpenses();
    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const thisMonth = new Date().toISOString().slice(0, 7);

    // Category breakdown for this month
    const categoryBreakdown = useMemo(() => {
        const map: Record<string, { name: string; total: number; color: string }> = {};
        records
            .filter(r => r.date.startsWith(thisMonth))
            .forEach(r => {
                const cat = r.metadata?.category ?? 'other';
                const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                if (!map[cat]) map[cat] = { name: meta.label, total: 0, color: meta.color };
                map[cat].total += Number(r.amount_zmw);
            });
        return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
    }, [records, thisMonth]);

    // Recent transactions (last 10)
    const recentTransactions = useMemo(() =>
        records.slice(0, 10),
        [records]
    );

    return (
        <div>
            <PageHeader title="Dashboard" subtitle="Your personal spending at a glance" />

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { id: 'today', label: 'Spent Today', value: totalToday, icon: CreditCard, color: '#8b5cf6' },
                    { id: 'week', label: 'Spent This Week', value: totalThisWeek, icon: Calendar, color: '#f59e0b' },
                    { id: 'month', label: 'Spent This Month', value: totalThisMonth, icon: TrendingDown, color: '#ef4444' },
                ].map(card => (
                    <div key={card.id} className="rounded-xl p-5"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg" style={{ background: `${card.color}20` }}>
                                <card.icon size={16} style={{ color: card.color }} />
                            </div>
                            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--ff-text-muted)' }}>
                                {card.label}
                            </p>
                        </div>
                        <p className="text-2xl font-bold" style={{ color: card.color }}>
                            {loading ? '—' : `ZMW ${fmt(card.value)}`}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Spending by Category */}
                <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                        Spending This Month
                    </h2>
                    {categoryBreakdown.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No expenses recorded this month.</p>
                    ) : (
                        <div className="space-y-3">
                            {categoryBreakdown.map(cat => (
                                <div key={cat.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--ff-text-primary)' }}>{cat.name}</span>
                                        <span style={{ color: 'var(--ff-text-muted)' }}>ZMW {fmt(cat.total)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{
                                            width: `${Math.min(100, totalThisMonth > 0 ? (cat.total / totalThisMonth) * 100 : 0)}%`,
                                            background: cat.color,
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Stats */}
                <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--ff-text-primary)' }}>Quick Stats</h2>
                    {loading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : (
                        <div className="space-y-4">
                            {[
                                { label: 'Total Transactions', value: String(records.filter(r => r.date.startsWith(thisMonth)).length), color: '#8b5cf6' },
                                { label: 'Daily Average', value: `ZMW ${fmt(totalThisMonth / Math.max(1, new Date().getDate()))}`, color: '#3b82f6' },
                                { label: 'Largest Expense', value: records.filter(r => r.date.startsWith(thisMonth)).length > 0
                                    ? `ZMW ${fmt(Math.max(...records.filter(r => r.date.startsWith(thisMonth)).map(r => Number(r.amount_zmw))))}`
                                    : '—', color: '#ef4444' },
                            ].map(stat => (
                                <div key={stat.label} className="flex items-center justify-between py-2 border-b last:border-b-0"
                                    style={{ borderColor: 'var(--ff-border)' }}>
                                    <span className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>{stat.label}</span>
                                    <span className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--ff-text-primary)' }}>Recent Transactions</h2>
                </div>
                {loading ? (
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                ) : recentTransactions.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No transactions yet. Add your first personal expense to get started.</p>
                ) : (
                    <div className="space-y-2">
                        {recentTransactions.map(tx => {
                            const cat = tx.metadata?.category ?? 'other';
                            const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                            return (
                                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b last:border-b-0"
                                    style={{ borderColor: 'var(--ff-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg" style={{ background: `${meta.color}20` }}>
                                            <ArrowDownRight size={14} style={{ color: meta.color }} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>
                                                {tx.description || meta.label}
                                            </p>
                                            <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                                {tx.date} · {meta.label}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold" style={{ color: meta.color }}>
                                        -ZMW {fmt(Number(tx.amount_zmw))}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
