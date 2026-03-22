import { useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useBudgetExpenses } from '../../hooks/budget/useBudgetExpenses';
import { useBudgetCategories } from '../../hooks/budget/useBudgetCategories';
import { useBudgetAccounts } from '../../hooks/budget/useBudgetAccounts';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../../components/Pagination';
import { SearchInput } from '../../components/SearchInput';

export function BudgetExpenses() {
    const { activeWorkspaceId, isGuest } = useWorkspace();
    const [showModal, setShowModal] = useState(false);
    const [monthFilter, setMonthFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        amount_zmw: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        category_id: '',
        account_id: '',
        notes: '',
    });

    const { records, loading, error, totalThisMonth, refetch } = useBudgetExpenses();
    const { expenseCategories } = useBudgetCategories();
    const { accounts } = useBudgetAccounts();

    const filtered = records.filter(r => {
        if (monthFilter && !r.date.startsWith(monthFilter)) return false;
        if (categoryFilter && r.metadata?.category_id !== categoryFilter) return false;
        if (accountFilter && r.metadata?.account_id !== accountFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                (r.description ?? '').toLowerCase().includes(q) ||
                (r.metadata?.category_name ?? '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const { currentPage, totalPages, setCurrentPage, paginatedItems } = usePagination(filtered, 15);
    const isFiltered = Boolean(monthFilter || categoryFilter || accountFilter || searchQuery);
    const filteredTotal = filtered.reduce((acc, r) => acc + Number(r.amount_zmw), 0);
    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeWorkspaceId) return;
        setSaving(true);

        const category = expenseCategories.find(c => c.id === form.category_id);
        const account = accounts.find(a => a.id === form.account_id);

        const { error } = await supabase.from('transactions').insert({
            workspace_id: activeWorkspaceId,
            app_id: 'budget',
            type: 'expense',
            amount_zmw: parseFloat(form.amount_zmw),
            date: form.date,
            description: form.description || null,
            metadata: {
                category_id: form.category_id || null,
                account_id: form.account_id || null,
                category_name: category?.name ?? null,
                account_name: account?.name ?? null,
                notes: form.notes || null,
            },
        });

        setSaving(false);
        if (!error) {
            setShowModal(false);
            setForm({ amount_zmw: '', date: new Date().toISOString().slice(0, 10), description: '', category_id: '', account_id: '', notes: '' });
            refetch();
        }
    };

    const inputStyle = { background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: '8px 12px', width: '100%' };

    return (
        <div>
            <PageHeader
                title="Expenses"
                subtitle="Track all money leaving your household"
                action={!isGuest && (
                    <button onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-accent)', color: 'white' }}>
                        <Plus size={16} /> Add Expense
                    </button>
                )}
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                    {error}
                </div>
            )}

            {/* Summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {[
                    { id: 'month', label: isFiltered ? 'Filtered Total' : 'This Month', value: isFiltered ? filteredTotal : totalThisMonth, color: '#ef4444' },
                    { id: 'count', label: 'Records', value: filtered.length, color: 'var(--ff-text-primary)' },
                ].map(s => (
                    <div key={s.id} className="rounded-xl p-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                        <p className="text-xl font-bold" style={{ color: s.color }}>
                            {s.id !== 'count' && typeof s.value === 'number' ? `ZMW ${fmt(s.value as number)}` : s.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="">All Categories</option>
                    {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="">All Accounts</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input type="month" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, width: 'auto' }} />
                <div className="flex-1 min-w-[200px]">
                    <SearchInput value={searchQuery} onChange={v => { setSearchQuery(v); setCurrentPage(1); }} placeholder="Search description or category…" />
                </div>
            </div>

            {/* Records list */}
            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading expenses…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <ShoppingCart size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No expense records yet. Add your first entry above.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedItems.map(r => (
                        <div key={r.id} className="flex items-center justify-between rounded-xl px-5 py-4"
                            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: '#ef444420', color: '#ef4444' }}>
                                        {r.metadata?.category_name ?? 'Expense'}
                                    </span>
                                    {r.metadata?.account_name && (
                                        <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{r.metadata.account_name}</span>
                                    )}
                                </div>
                                <p className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>
                                    {r.description || r.metadata?.category_name || 'Expense'}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{r.date}</p>
                            </div>
                            <p className="font-bold text-base" style={{ color: '#ef4444' }}>
                                ZMW {fmt(Number(r.amount_zmw))}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}

            {/* Add Expense Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--ff-text-primary)' }}>Add Expense</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Amount (ZMW) *</label>
                                <input type="number" step="0.01" required value={form.amount_zmw}
                                    onChange={e => setForm(f => ({ ...f, amount_zmw: e.target.value }))} style={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Date *</label>
                                <input type="date" required value={form.date}
                                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Category</label>
                                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} style={inputStyle}>
                                    <option value="">Select category…</option>
                                    {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Account</label>
                                <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} style={inputStyle}>
                                    <option value="">Select account…</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Description</label>
                                <input type="text" value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} placeholder="e.g. Weekly groceries" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2 rounded-lg text-sm"
                                    style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                                    style={{ background: 'var(--ff-accent)', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
