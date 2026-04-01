import { useState } from 'react';
import { Plus, Receipt, Trash2, Pencil, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { usePersonalExpenses } from '../../hooks/personal/usePersonalExpenses';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePagination } from '../../hooks/usePagination';
import { Pagination } from '../../components/Pagination';
import { SearchInput } from '../../components/SearchInput';
import { MobileFilterSheet } from '../../components/MobileFilterSheet';
import type { PersonalExpenseCategory, PersonalPaymentMethod, PersonalExpenseRecord } from '../../types';

const CATEGORIES: { value: PersonalExpenseCategory; label: string; color: string }[] = [
    { value: 'fuel', label: 'Fuel & Gas', color: '#f59e0b' },
    { value: 'food', label: 'Food & Drinks', color: '#ef4444' },
    { value: 'clothing', label: 'Clothing', color: '#ec4899' },
    { value: 'transport', label: 'Transport & Travel', color: '#3b82f6' },
    { value: 'entertainment', label: 'Entertainment', color: '#8b5cf6' },
    { value: 'health', label: 'Health & Wellness', color: '#10b981' },
    { value: 'education', label: 'Education', color: '#6366f1' },
    { value: 'gifts', label: 'Gifts & Donations', color: '#f97316' },
    { value: 'subscriptions', label: 'Subscriptions', color: '#06b6d4' },
    { value: 'other', label: 'Other', color: '#6b7280' },
];

const PAYMENT_METHODS: { value: PersonalPaymentMethod; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
];

const getCategoryMeta = (cat: string) =>
    CATEGORIES.find(c => c.value === cat) ?? { value: 'other', label: 'Other', color: '#6b7280' };
const getPaymentLabel = (pm: string | null | undefined) =>
    PAYMENT_METHODS.find(p => p.value === pm)?.label ?? '';

type FormState = {
    amount_zmw: string;
    date: string;
    category: PersonalExpenseCategory;
    payment_method: string;
    description: string;
    notes: string;
};

const emptyForm = (): FormState => ({
    amount_zmw: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'food',
    payment_method: '',
    description: '',
    notes: '',
});

export function PersonalExpenses() {
    const { activeWorkspaceId, canEditApp } = useWorkspace();
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<PersonalExpenseRecord | null>(null);
    const [monthFilter, setMonthFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm());

    const { records, loading, error, totalThisMonth, refetch } = usePersonalExpenses();

    const filtered = records.filter(r => {
        if (monthFilter && !r.date.startsWith(monthFilter)) return false;
        if (categoryFilter && r.metadata?.category !== categoryFilter) return false;
        if (paymentFilter && r.metadata?.payment_method !== paymentFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                (r.description ?? '').toLowerCase().includes(q) ||
                getCategoryMeta(r.metadata?.category).label.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const { currentPage, totalPages, setCurrentPage, paginatedItems } = usePagination(filtered, 15);
    const isFiltered = Boolean(monthFilter || categoryFilter || paymentFilter || searchQuery);
    const filteredTotal = filtered.reduce((acc, r) => acc + Number(r.amount_zmw), 0);
    const activeFilterCount = [categoryFilter, paymentFilter, monthFilter, searchQuery].filter(Boolean).length;
    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const openAddModal = () => {
        setEditingRecord(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEditModal = (record: PersonalExpenseRecord) => {
        setEditingRecord(record);
        setForm({
            amount_zmw: String(record.amount_zmw),
            date: record.date,
            category: record.metadata?.category ?? 'other',
            payment_method: record.metadata?.payment_method ?? '',
            description: record.description ?? '',
            notes: record.metadata?.notes ?? '',
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeWorkspaceId) return;
        setSaving(true);

        const catMeta = getCategoryMeta(form.category);
        const payload = {
            workspace_id: activeWorkspaceId,
            app_id: 'personal',
            type: 'expense' as const,
            amount_zmw: parseFloat(form.amount_zmw),
            date: form.date,
            description: form.description || catMeta.label,
            metadata: {
                category: form.category,
                payment_method: form.payment_method || null,
                notes: form.notes || null,
            },
        };

        const { error: supaErr } = editingRecord
            ? await supabase.from('transactions').update(payload).eq('id', editingRecord.id)
            : await supabase.from('transactions').insert(payload);

        setSaving(false);
        if (!supaErr) {
            setShowModal(false);
            setEditingRecord(null);
            setForm(emptyForm());
            refetch();
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this expense? This action cannot be undone.')) return;
        setDeleting(id);
        await supabase.from('transactions').delete().eq('id', id);
        setDeleting(null);
        refetch();
    };

    const inputStyle = {
        background: 'var(--ff-surface)',
        color: 'var(--ff-text-primary)',
        border: '1px solid var(--ff-border)',
        borderRadius: 8,
        padding: '8px 12px',
        width: '100%',
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box' as const,
    };

    return (
        <div>
            <PageHeader
                title="Expenses"
                subtitle="Track your personal spending"
                action={canEditApp('personal') && (
                    <button onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: '#8b5cf6', color: 'white' }}>
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
                    { id: 'month', label: isFiltered ? 'Filtered Total' : 'This Month', value: isFiltered ? filteredTotal : totalThisMonth, color: '#8b5cf6' },
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
            <MobileFilterSheet open={filtersOpen} onToggle={() => setFiltersOpen(f => !f)} filterCount={activeFilterCount}>
                <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, width: 'auto' }} className="w-full md:w-auto">
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, width: 'auto' }} className="w-full md:w-auto">
                    <option value="">All Payment Methods</option>
                    {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <input type="month" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, width: 'auto' }} className="w-full md:w-auto" />
                <div className="flex-1 min-w-[200px]">
                    <SearchInput value={searchQuery} onChange={v => { setSearchQuery(v); setCurrentPage(1); }} placeholder="Search description or category…" />
                </div>
            </MobileFilterSheet>

            {/* Records list */}
            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading expenses…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <Receipt size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No expense records yet. Add your first entry above.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedItems.map(r => {
                        const catMeta = getCategoryMeta(r.metadata?.category);
                        const paymentLabel = getPaymentLabel(r.metadata?.payment_method);
                        return (
                            <div key={r.id} className="flex items-center justify-between rounded-xl px-5 py-4"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', opacity: deleting === r.id ? 0.5 : 1 }}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{ background: `${catMeta.color}20`, color: catMeta.color }}>
                                            {catMeta.label}
                                        </span>
                                        {paymentLabel && (
                                            <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{paymentLabel}</span>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ff-text-primary)' }}>
                                        {r.description || catMeta.label}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                        {r.date}
                                        {r.metadata?.notes ? ` · ${r.metadata.notes}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                    <p className="font-bold text-base" style={{ color: catMeta.color }}>
                                        ZMW {fmt(Number(r.amount_zmw))}
                                    </p>
                                    {canEditApp('personal') && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEditModal(r)} title="Edit"
                                                className="p-1.5 rounded-lg transition-colors"
                                                style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#8b5cf6')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(r.id)} title="Delete"
                                                className="p-1.5 rounded-lg transition-colors"
                                                style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}

            {/* Add/Edit Expense Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
                    onClick={() => { setShowModal(false); setEditingRecord(null); }}>
                    <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                {editingRecord ? 'Edit Expense' : 'Add Expense'}
                            </h2>
                            <button onClick={() => { setShowModal(false); setEditingRecord(null); }}
                                style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Amount (ZMW) *</label>
                                    <input type="number" step="0.01" min="0.01" required value={form.amount_zmw}
                                        onChange={e => setForm(f => ({ ...f, amount_zmw: e.target.value }))} style={inputStyle} placeholder="0.00" autoFocus />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Date *</label>
                                    <input type="date" required value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Category *</label>
                                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as PersonalExpenseCategory }))} style={inputStyle}>
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Payment Method</label>
                                <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={inputStyle}>
                                    <option value="">— Select —</option>
                                    {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Description</label>
                                <input type="text" value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle}
                                    placeholder="e.g. Lunch at Hungry Lion" />
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Notes</label>
                                <textarea rows={2} value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties}
                                    placeholder="Any additional notes…" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowModal(false); setEditingRecord(null); }}
                                    className="flex-1 py-2.5 rounded-lg text-sm"
                                    style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white"
                                    style={{ background: '#8b5cf6', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Saving…' : editingRecord ? 'Save Changes' : 'Add Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
