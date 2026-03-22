import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useBudgetIncome } from '../../hooks/budget/useBudgetIncome';
import { useBudgetExpenses } from '../../hooks/budget/useBudgetExpenses';
import { useBudgetAccounts } from '../../hooks/budget/useBudgetAccounts';

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
    bank: '#3b82f6',
    mobile_money: '#ef4444',
    cash: '#f59e0b',
    savings: '#10b981',
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    bank: 'Bank',
    mobile_money: 'Mobile Money',
    cash: 'Cash',
    savings: 'Savings',
};

export function BudgetDashboard() {
    const navigate = useNavigate();
    const { records: incomeRecords, totalThisMonth: incomeMonth, loading: incomeLoading } = useBudgetIncome();
    const { records: expenseRecords, totalThisMonth: expenseMonth, loading: expenseLoading } = useBudgetExpenses();
    const { accounts, loading: accountsLoading } = useBudgetAccounts();

    const netBalance = incomeMonth - expenseMonth;

    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Category breakdown for expenses this month
    const thisMonth = new Date().toISOString().slice(0, 7);
    const expenseByCategory = useMemo(() => {
        const map: Record<string, { name: string; total: number; color: string }> = {};
        expenseRecords
            .filter(r => r.date.startsWith(thisMonth))
            .forEach(r => {
                const key = r.metadata?.category_name ?? 'Uncategorised';
                if (!map[key]) map[key] = { name: key, total: 0, color: '#6b7280' };
                map[key].total += Number(r.amount_zmw);
            });
        return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 6);
    }, [expenseRecords, thisMonth]);

    const recentTransactions = useMemo(() => {
        const all = [
            ...incomeRecords.map(r => ({ ...r, txType: 'income' as const })),
            ...expenseRecords.map(r => ({ ...r, txType: 'expense' as const })),
        ];
        return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    }, [incomeRecords, expenseRecords]);

    const loading = incomeLoading || expenseLoading;

    return (
        <div>
            <PageHeader title="Dashboard" subtitle="Your household financial summary" />

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { id: 'income', label: 'Income This Month', value: incomeMonth, color: '#22c55e', icon: TrendingUp },
                    { id: 'expenses', label: 'Expenses This Month', value: expenseMonth, color: '#ef4444', icon: ShoppingCart },
                    { id: 'net', label: 'Net Balance', value: netBalance, color: netBalance >= 0 ? '#22c55e' : '#ef4444', icon: Wallet },
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
                {/* Accounts */}
                <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--ff-text-primary)' }}>Accounts</h2>
                    {accountsLoading ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                    ) : accounts.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No accounts yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {accounts.map(acc => (
                                <div key={acc.id} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `${acc.color}20` }}>
                                        <Wallet size={14} style={{ color: acc.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--ff-text-primary)' }}>{acc.name}</p>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                            {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                                        </p>
                                    </div>
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ACCOUNT_TYPE_COLORS[acc.type] ?? '#6b7280' }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Spending by Category */}
                <div className="rounded-xl p-5" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                        Spending This Month
                    </h2>
                    {expenseByCategory.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No expenses recorded this month.</p>
                    ) : (
                        <div className="space-y-3">
                            {expenseByCategory.map(cat => (
                                <div key={cat.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span style={{ color: 'var(--ff-text-primary)' }}>{cat.name}</span>
                                        <span style={{ color: 'var(--ff-text-muted)' }}>ZMW {fmt(cat.total)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                        <div className="h-full rounded-full" style={{
                                            width: `${Math.min(100, (cat.total / expenseMonth) * 100)}%`,
                                            background: '#ef4444',
                                        }} />
                                    </div>
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
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No transactions yet. Add income or expenses to get started.</p>
                ) : (
                    <div className="space-y-2">
                        {recentTransactions.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between py-2.5 border-b last:border-b-0"
                                style={{ borderColor: 'var(--ff-border)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg" style={{
                                        background: tx.txType === 'income' ? '#22c55e20' : '#ef444420'
                                    }}>
                                        {tx.txType === 'income'
                                            ? <ArrowUpRight size={14} style={{ color: '#22c55e' }} />
                                            : <ArrowDownRight size={14} style={{ color: '#ef4444' }} />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>
                                            {tx.description || tx.metadata?.category_name || (tx.txType === 'income' ? 'Income' : 'Expense')}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                            {tx.date} · {tx.metadata?.account_name ?? 'No account'}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm font-bold" style={{ color: tx.txType === 'income' ? '#22c55e' : '#ef4444' }}>
                                    {tx.txType === 'income' ? '+' : '-'}ZMW {fmt(Number(tx.amount_zmw))}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
