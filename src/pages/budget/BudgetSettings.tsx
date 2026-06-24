import { useState } from 'react';
import { Plus, Trash2, Pencil, X, CreditCard, Tag, Check } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useBudgetAccounts } from '../../hooks/budget/useBudgetAccounts';
import { useBudgetCategories } from '../../hooks/budget/useBudgetCategories';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import type { BudgetAccountType, BudgetCategoryType } from '../../types';

const ACCOUNT_TYPES: { value: BudgetAccountType; label: string }[] = [
    { value: 'bank', label: 'Bank' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'cash', label: 'Cash' },
    { value: 'savings', label: 'Savings' },
];

const ACCOUNT_COLORS = [
    '#2563eb', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
    '#10b981', '#22c55e', '#84cc16', '#f59e0b', '#f97316',
    '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#6b7280',
];

const CATEGORY_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
    '#0d9488', '#6b7280',
];

type AccountForm = { name: string; type: BudgetAccountType; color: string; notes: string };
type CategoryForm = { name: string; type: BudgetCategoryType; color: string };

const emptyAccountForm = (): AccountForm => ({ name: '', type: 'bank', color: '#2563eb', notes: '' });
const emptyCategoryForm = (): CategoryForm => ({ name: '', type: 'expense', color: '#ef4444' });

export function BudgetSettings() {
    const { canEditApp } = useWorkspace();
    const { accounts, addAccount, updateAccount, deleteAccount } = useBudgetAccounts();
    const { incomeCategories, expenseCategories, addCategory, updateCategory, deleteCategory } = useBudgetCategories();
    const canEdit = canEditApp('budget');

    // Account modal
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm());
    const [accountSaving, setAccountSaving] = useState(false);

    // Category modal
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm());
    const [categorySaving, setCategorySaving] = useState(false);

    const [activeTab, setActiveTab] = useState<'accounts' | 'categories'>('accounts');

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

    /* ── Account handlers ── */
    const openAddAccount = () => {
        setEditingAccountId(null);
        setAccountForm(emptyAccountForm());
        setShowAccountModal(true);
    };

    const openEditAccount = (acct: typeof accounts[0]) => {
        setEditingAccountId(acct.id);
        setAccountForm({ name: acct.name, type: acct.type, color: acct.color, notes: acct.notes ?? '' });
        setShowAccountModal(true);
    };

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setAccountSaving(true);
        try {
            if (editingAccountId) {
                await updateAccount(editingAccountId, { name: accountForm.name, type: accountForm.type, color: accountForm.color, notes: accountForm.notes || undefined });
            } else {
                await addAccount({ name: accountForm.name, type: accountForm.type, currency: 'ZMW', color: accountForm.color, notes: accountForm.notes || undefined });
            }
            setShowAccountModal(false);
        } catch {
            // error already surfaced by hook
        }
        setAccountSaving(false);
    };

    const handleDeleteAccount = async (id: string) => {
        if (!window.confirm('Remove this account? Existing transactions will keep their account reference.')) return;
        try { await deleteAccount(id); } catch { /* */ }
    };

    /* ── Category handlers ── */
    const openAddCategory = (type: BudgetCategoryType) => {
        setEditingCategoryId(null);
        setCategoryForm({ ...emptyCategoryForm(), type });
        setShowCategoryModal(true);
    };

    const openEditCategory = (cat: typeof incomeCategories[0]) => {
        setEditingCategoryId(cat.id);
        setCategoryForm({ name: cat.name, type: cat.type, color: cat.color });
        setShowCategoryModal(true);
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        setCategorySaving(true);
        try {
            if (editingCategoryId) {
                await updateCategory(editingCategoryId, { name: categoryForm.name, color: categoryForm.color });
            } else {
                await addCategory({ name: categoryForm.name, type: categoryForm.type, color: categoryForm.color });
            }
            setShowCategoryModal(false);
        } catch {
            // error already surfaced by hook
        }
        setCategorySaving(false);
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm('Remove this category? Existing transactions will keep their category reference.')) return;
        try { await deleteCategory(id); } catch { /* */ }
    };

    /* ── Account type icon label ── */
    const typeLabel = (t: BudgetAccountType) =>
        ACCOUNT_TYPES.find(at => at.value === t)?.label ?? t;

    return (
        <div>
            <PageHeader
                title="Settings"
                subtitle="Manage your accounts, categories, and preferences"
            />

            {/* Tabs */}
            <div className="flex gap-1 mb-6 rounded-xl p-1" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', width: 'fit-content' }}>
                {([
                    { key: 'accounts' as const, label: 'Payment Accounts', icon: CreditCard },
                    { key: 'categories' as const, label: 'Categories', icon: Tag },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                        style={{
                            background: activeTab === tab.key ? 'var(--ff-accent)' : 'transparent',
                            color: activeTab === tab.key ? 'white' : 'var(--ff-text-muted)',
                            border: 'none',
                        }}
                    >
                        <tab.icon size={15} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════ ACCOUNTS TAB ═══════════════════ */}
            {activeTab === 'accounts' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-semibold" style={{ color: 'var(--ff-text-primary)' }}>Payment Accounts</h2>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                Banks, mobile money wallets, and cash accounts used to track where money flows.
                            </p>
                        </div>
                        {canEdit && (
                            <button onClick={openAddAccount}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                                style={{ background: 'var(--ff-accent)', color: 'white' }}>
                                <Plus size={16} /> Add Account
                            </button>
                        )}
                    </div>

                    {accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                            <CreditCard size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No accounts yet. Add your first payment account.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {accounts.map(acct => (
                                <div key={acct.id} className="rounded-xl p-4 flex items-start gap-3 group"
                                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ background: `${acct.color}20` }}>
                                        <CreditCard size={18} style={{ color: acct.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ff-text-primary)' }}>{acct.name}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>{typeLabel(acct.type)}</p>
                                        {acct.notes && (
                                            <p className="text-xs mt-1 truncate" style={{ color: 'var(--ff-text-muted)' }}>{acct.notes}</p>
                                        )}
                                    </div>
                                    {canEdit && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button onClick={() => openEditAccount(acct)} title="Edit"
                                                className="p-1.5 rounded-lg" style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => handleDeleteAccount(acct.id)} title="Remove"
                                                className="p-1.5 rounded-lg" style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════ CATEGORIES TAB ═══════════════════ */}
            {activeTab === 'categories' && (
                <div className="space-y-8">
                    {/* Expense categories */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold" style={{ color: 'var(--ff-text-primary)' }}>Expense Categories</h2>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                    Organize your spending into categories like Rent, Groceries, Property Payments, etc.
                                </p>
                            </div>
                            {canEdit && (
                                <button onClick={() => openAddCategory('expense')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                                    style={{ background: '#ef4444', color: 'white' }}>
                                    <Plus size={16} /> Add Category
                                </button>
                            )}
                        </div>

                        {expenseCategories.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-24 rounded-xl"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No expense categories yet.</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {expenseCategories.map(cat => (
                                    <div key={cat.id}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg group"
                                        style={{ background: `${cat.color}12`, border: `1px solid ${cat.color}30` }}>
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                        <span className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>{cat.name}</span>
                                        {canEdit && (
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                                <button onClick={() => openEditCategory(cat)} title="Edit"
                                                    className="p-0.5 rounded" style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                    <Pencil size={12} />
                                                </button>
                                                <button onClick={() => handleDeleteCategory(cat.id)} title="Remove"
                                                    className="p-0.5 rounded" style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Income categories */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold" style={{ color: 'var(--ff-text-primary)' }}>Income Categories</h2>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                    Categorize your income sources like Salary, Freelance work, etc.
                                </p>
                            </div>
                            {canEdit && (
                                <button onClick={() => openAddCategory('income')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                                    style={{ background: '#22c55e', color: 'white' }}>
                                    <Plus size={16} /> Add Category
                                </button>
                            )}
                        </div>

                        {incomeCategories.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-24 rounded-xl"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No income categories yet.</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {incomeCategories.map(cat => (
                                    <div key={cat.id}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg group"
                                        style={{ background: `${cat.color}12`, border: `1px solid ${cat.color}30` }}>
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                        <span className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>{cat.name}</span>
                                        {canEdit && (
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                                <button onClick={() => openEditCategory(cat)} title="Edit"
                                                    className="p-0.5 rounded" style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                    <Pencil size={12} />
                                                </button>
                                                <button onClick={() => handleDeleteCategory(cat.id)} title="Remove"
                                                    className="p-0.5 rounded" style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════ ACCOUNT MODAL ═══════════════════ */}
            {showAccountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
                    onClick={() => setShowAccountModal(false)}>
                    <div className="w-full max-w-md rounded-2xl p-6"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                {editingAccountId ? 'Edit Account' : 'Add Account'}
                            </h2>
                            <button onClick={() => setShowAccountModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAccount} className="space-y-4">
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Account Name *</label>
                                <input type="text" required value={accountForm.name}
                                    onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                                    style={inputStyle} placeholder="e.g. Zanaco, FNB, Stanbic, MTN Money" autoFocus />
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Account Type *</label>
                                <select value={accountForm.type}
                                    onChange={e => setAccountForm(f => ({ ...f, type: e.target.value as BudgetAccountType }))}
                                    style={inputStyle}>
                                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs mb-1.5" style={{ color: 'var(--ff-text-muted)' }}>Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {ACCOUNT_COLORS.map(c => (
                                        <button key={c} type="button"
                                            onClick={() => setAccountForm(f => ({ ...f, color: c }))}
                                            className="w-7 h-7 rounded-full flex items-center justify-center transition-transform"
                                            style={{
                                                background: c,
                                                border: accountForm.color === c ? '2px solid var(--ff-text-primary)' : '2px solid transparent',
                                                transform: accountForm.color === c ? 'scale(1.2)' : 'scale(1)',
                                            }}>
                                            {accountForm.color === c && <Check size={14} color="white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Notes</label>
                                <input type="text" value={accountForm.notes}
                                    onChange={e => setAccountForm(f => ({ ...f, notes: e.target.value }))}
                                    style={inputStyle} placeholder="Optional — account number, branch, etc." />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAccountModal(false)}
                                    className="flex-1 py-2.5 rounded-lg text-sm"
                                    style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={accountSaving}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white"
                                    style={{ background: 'var(--ff-accent)', opacity: accountSaving ? 0.7 : 1 }}>
                                    {accountSaving ? 'Saving…' : editingAccountId ? 'Save Changes' : 'Add Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════ CATEGORY MODAL ═══════════════════ */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
                    onClick={() => setShowCategoryModal(false)}>
                    <div className="w-full max-w-md rounded-2xl p-6"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                {editingCategoryId ? 'Edit Category' : `Add ${categoryForm.type === 'income' ? 'Income' : 'Expense'} Category`}
                            </h2>
                            <button onClick={() => setShowCategoryModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory} className="space-y-4">
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>Category Name *</label>
                                <input type="text" required value={categoryForm.name}
                                    onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                                    style={inputStyle} placeholder="e.g. Property Payments, Insurance, Tithe" autoFocus />
                            </div>

                            <div>
                                <label className="block text-xs mb-1.5" style={{ color: 'var(--ff-text-muted)' }}>Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORY_COLORS.map(c => (
                                        <button key={c} type="button"
                                            onClick={() => setCategoryForm(f => ({ ...f, color: c }))}
                                            className="w-7 h-7 rounded-full flex items-center justify-center transition-transform"
                                            style={{
                                                background: c,
                                                border: categoryForm.color === c ? '2px solid var(--ff-text-primary)' : '2px solid transparent',
                                                transform: categoryForm.color === c ? 'scale(1.2)' : 'scale(1)',
                                            }}>
                                            {categoryForm.color === c && <Check size={14} color="white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCategoryModal(false)}
                                    className="flex-1 py-2.5 rounded-lg text-sm"
                                    style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={categorySaving}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white"
                                    style={{
                                        background: categoryForm.type === 'income' ? '#22c55e' : '#ef4444',
                                        opacity: categorySaving ? 0.7 : 1,
                                    }}>
                                    {categorySaving ? 'Saving…' : editingCategoryId ? 'Save Changes' : 'Add Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
