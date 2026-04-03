import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Gift, Plus, Pencil, Trash2, Archive, X, Search,
    ShoppingBag, CheckCircle2, AlertCircle, ChevronDown,
    SortAsc, Calendar, DollarSign, Tag, Loader2,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useWishlists } from '../hooks/useWishlists';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { WishlistItem, WishlistPriority, WishlistStatus } from '../types';
import { WISHLIST_CATEGORIES } from '../types';

// ─── Config ────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<WishlistPriority, { label: string; color: string; bg: string; dot: string }> = {
    high:   { label: 'High',   color: '#ef4444', bg: '#ef444415', dot: '#ef4444' },
    medium: { label: 'Medium', color: '#f59e0b', bg: '#f59e0b15', dot: '#f59e0b' },
    low:    { label: 'Low',    color: '#10b981', bg: '#10b98115', dot: '#10b981' },
};

const STATUS_TABS: { value: WishlistStatus | 'all'; label: string }[] = [
    { value: 'all',       label: 'All Active' },
    { value: 'purchased', label: 'Purchased' },
    { value: 'archived',  label: 'Archived' },
];

type SortKey = 'created_at' | 'priority' | 'estimated_price_zmw' | 'target_date';
const PRIORITY_ORDER: Record<WishlistPriority, number> = { high: 0, medium: 1, low: 2 };

// ─── Blank form ────────────────────────────────────────────────────────────────

interface FormState {
    name: string;
    description: string;
    estimated_price_zmw: string;
    priority: WishlistPriority;
    category: string;
    customCategory: string;
    target_date: string;
    notes: string;
}

const blankForm = (): FormState => ({
    name: '',
    description: '',
    estimated_price_zmw: '',
    priority: 'medium',
    category: '',
    customCategory: '',
    target_date: '',
    notes: '',
});

// ─── Purchase dialog state ─────────────────────────────────────────────────────

interface PurchaseDialogState {
    item: WishlistItem;
    actualPrice: string;
    logExpense: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' });
};

const daysBetween = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function Wishlist() {
    useParams(); // consumed by parent layout; we derive appId from pathname
    // The appId comes from the parent route segment (/transport, /budget, /personal)
    const pathAppId = window.location.pathname.split('/')[1] ?? 'personal';

    const { canEditApp } = useWorkspace();
    const canEdit = canEditApp(pathAppId);

    const {
        items, loading, error,
        activeCount, purchasedCount, totalEstimatedValue,
        addItem, updateItem, deleteItem, archiveItem, markPurchased,
    } = useWishlists(pathAppId);

    // ── UI state ────────────────────────────────────────────────────────────────
    const [statusTab, setStatusTab]         = useState<WishlistStatus | 'all'>('all');
    const [priorityFilter, setPriorityFilter] = useState<WishlistPriority | 'all'>('all');
    const [sortKey, setSortKey]             = useState<SortKey>('created_at');
    const [search, setSearch]               = useState('');
    const [showModal, setShowModal]         = useState(false);
    const [editingItem, setEditingItem]     = useState<WishlistItem | null>(null);
    const [form, setForm]                   = useState<FormState>(blankForm());
    const [saving, setSaving]               = useState(false);
    const [deleting, setDeleting]           = useState<string | null>(null);
    const [purchasing, setPurchasing]       = useState<string | null>(null);
    const [purchaseDialog, setPurchaseDialog] = useState<PurchaseDialogState | null>(null);
    const [showSortMenu, setShowSortMenu]   = useState(false);

    const appCategories = WISHLIST_CATEGORIES[pathAppId] ?? ['Other'];
    const isCustomCategory = form.category === '__custom__';
    const effectiveCategory = isCustomCategory ? form.customCategory : form.category;

    // ── Filtered & sorted list ──────────────────────────────────────────────────
    const displayItems = useMemo(() => {
        let list = [...items];

        // Status filter
        if (statusTab === 'all') {
            list = list.filter(i => i.status === 'active');
        } else {
            list = list.filter(i => i.status === statusTab);
        }

        // Priority filter
        if (priorityFilter !== 'all') {
            list = list.filter(i => i.priority === priorityFilter);
        }

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.name.toLowerCase().includes(q) ||
                (i.description ?? '').toLowerCase().includes(q) ||
                (i.category ?? '').toLowerCase().includes(q)
            );
        }

        // Sort
        list.sort((a, b) => {
            if (sortKey === 'priority') {
                return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            }
            if (sortKey === 'estimated_price_zmw') {
                return Number(b.estimated_price_zmw) - Number(a.estimated_price_zmw);
            }
            if (sortKey === 'target_date') {
                if (!a.target_date) return 1;
                if (!b.target_date) return -1;
                return a.target_date.localeCompare(b.target_date);
            }
            // Default: newest first
            return b.created_at.localeCompare(a.created_at);
        });

        return list;
    }, [items, statusTab, priorityFilter, search, sortKey]);

    // ── Modal helpers ───────────────────────────────────────────────────────────
    const openAdd = () => {
        setEditingItem(null);
        setForm(blankForm());
        setShowModal(true);
    };

    const openEdit = (item: WishlistItem) => {
        const isPreset = appCategories.includes(item.category ?? '');
        setEditingItem(item);
        setForm({
            name: item.name,
            description: item.description ?? '',
            estimated_price_zmw: String(item.estimated_price_zmw),
            priority: item.priority,
            category: isPreset ? (item.category ?? '') : (item.category ? '__custom__' : ''),
            customCategory: isPreset ? '' : (item.category ?? ''),
            target_date: item.target_date ?? '',
            notes: item.notes ?? '',
        });
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditingItem(null); };

    // ── Save ────────────────────────────────────────────────────────────────────
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const payload = {
            name: form.name,
            description: form.description || null,
            estimated_price_zmw: parseFloat(form.estimated_price_zmw) || 0,
            priority: form.priority,
            category: effectiveCategory || null,
            target_date: form.target_date || null,
            notes: form.notes || null,
        };

        const ok = editingItem
            ? await updateItem(editingItem.id, payload)
            : await addItem(pathAppId, payload);

        setSaving(false);
        if (ok) closeModal();
    };

    // ── Delete ──────────────────────────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        if (!window.confirm('Permanently delete this wishlist item?')) return;
        setDeleting(id);
        await deleteItem(id);
        setDeleting(null);
    };

    // ── Purchase dialog ─────────────────────────────────────────────────────────
    const openPurchaseDialog = (item: WishlistItem) => {
        setPurchaseDialog({ item, actualPrice: String(item.estimated_price_zmw), logExpense: true });
    };

    const handleConfirmPurchase = async () => {
        if (!purchaseDialog) return;
        setPurchasing(purchaseDialog.item.id);
        await markPurchased(purchaseDialog.item, {
            actual_price_zmw: parseFloat(purchaseDialog.actualPrice) || null,
            log_expense: purchaseDialog.logExpense,
        });
        setPurchasing(null);
        setPurchaseDialog(null);
    };

    // ── Styles ──────────────────────────────────────────────────────────────────
    const inputStyle: React.CSSProperties = {
        background: 'var(--ff-bg)',
        color: 'var(--ff-text-primary)',
        border: '1px solid var(--ff-border)',
        borderRadius: 8,
        padding: '8px 12px',
        width: '100%',
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
    };

    const appLabel = pathAppId.charAt(0).toUpperCase() + pathAppId.slice(1);

    // ──────────────────────────────────────────────────────────────────────────
    return (
        <div>
            <PageHeader
                title="Wishlist"
                subtitle={`Manage and review desired items for ${appLabel}`}
                action={canEdit && (
                    <button
                        id="wishlist-add-btn"
                        onClick={openAdd}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', boxShadow: '0 2px 8px #8b5cf640' }}
                    >
                        <Plus size={16} /> Add to Wishlist
                    </button>
                )}
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm flex items-center gap-2"
                    style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* ── Summary Strip ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    {
                        id: 'total-value',
                        label: 'Active Wishlist Value',
                        value: `ZMW ${fmt(totalEstimatedValue)}`,
                        icon: <DollarSign size={18} />,
                        color: '#8b5cf6',
                        bg: '#8b5cf615',
                    },
                    {
                        id: 'active-count',
                        label: 'Active Items',
                        value: activeCount,
                        icon: <Gift size={18} />,
                        color: 'var(--ff-text-primary)',
                        bg: 'var(--ff-bg)',
                    },
                    {
                        id: 'purchased-count',
                        label: 'Purchased',
                        value: purchasedCount,
                        icon: <CheckCircle2 size={18} />,
                        color: '#10b981',
                        bg: '#10b98115',
                    },
                ].map(s => (
                    <div key={s.id} className="rounded-xl p-4 flex items-center gap-3"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: s.bg, color: s.color }}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Controls Bar ── */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-[180px] px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <Search size={15} style={{ color: 'var(--ff-text-muted)', flexShrink: 0 }} />
                    <input
                        id="wishlist-search"
                        type="text"
                        placeholder="Search wishlist…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--ff-text-primary)', fontSize: 14, width: '100%' }}
                    />
                </div>

                {/* Priority filter pills */}
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    {(['all', 'high', 'medium', 'low'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPriorityFilter(p)}
                            className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                            style={
                                priorityFilter === p
                                    ? { background: p === 'all' ? '#8b5cf6' : PRIORITY_CONFIG[p as WishlistPriority].dot, color: 'white' }
                                    : { background: 'transparent', color: 'var(--ff-text-muted)' }
                            }
                        >
                            {p === 'all' ? 'All' : PRIORITY_CONFIG[p as WishlistPriority].label}
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className="relative">
                    <button
                        onClick={() => setShowSortMenu(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)' }}>
                        <SortAsc size={14} /> Sort <ChevronDown size={12} />
                    </button>
                    {showSortMenu && (
                        <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-20 min-w-[170px] py-1"
                            style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                            {([
                                { key: 'created_at',            label: 'Newest First' },
                                { key: 'priority',              label: 'By Priority' },
                                { key: 'estimated_price_zmw',   label: 'Most Expensive' },
                                { key: 'target_date',           label: 'Soonest Target' },
                            ] as { key: SortKey; label: string }[]).map(o => (
                                <button key={o.key}
                                    onClick={() => { setSortKey(o.key); setShowSortMenu(false); }}
                                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                                    style={{
                                        color: sortKey === o.key ? '#8b5cf6' : 'var(--ff-text-primary)',
                                        fontWeight: sortKey === o.key ? 600 : 400,
                                        background: 'transparent',
                                        border: 'none',
                                    }}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Status Tabs ── */}
            <div className="flex gap-1 border-b mb-5" style={{ borderColor: 'var(--ff-border)' }}>
                {STATUS_TABS.map(tab => (
                    <button key={tab.value}
                        onClick={() => setStatusTab(tab.value)}
                        className="pb-2.5 px-1 text-sm font-medium transition-colors mr-4"
                        style={{
                            color: statusTab === tab.value ? '#8b5cf6' : 'var(--ff-text-muted)',
                            borderBottom: statusTab === tab.value ? '2px solid #8b5cf6' : '2px solid transparent',
                            background: 'none',
                            border: statusTab === tab.value ? '2px solid #8b5cf6' : '2px solid transparent',
                            paddingBottom: 10,
                        } as React.CSSProperties}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Item List ── */}
            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="animate-spin mr-2" size={22} style={{ color: '#8b5cf6' }} />
                    <p style={{ color: 'var(--ff-text-muted)', fontSize: 14 }}>Loading wishlist…</p>
                </div>
            ) : displayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
                    style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                        style={{ background: '#8b5cf615', color: '#8b5cf6' }}>
                        <Gift size={28} />
                    </div>
                    <p className="font-semibold mb-1" style={{ color: 'var(--ff-text-primary)' }}>
                        {search ? 'No items match your search' : 'Your wishlist is empty'}
                    </p>
                    <p className="text-sm mb-5" style={{ color: 'var(--ff-text-muted)' }}>
                        {search ? 'Try a different keyword or clear the search.' : 'Add the first item you\'d like to save up for.'}
                    </p>
                    {canEdit && !search && (
                        <button onClick={openAdd}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white' }}>
                            <Plus size={15} /> Add First Item
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {displayItems.map(item => {
                        const pCfg = PRIORITY_CONFIG[item.priority];
                        const daysLeft = daysBetween(item.target_date);
                        const isOverdue = daysLeft !== null && daysLeft < 0;
                        const isSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
                        const isBusy = deleting === item.id || purchasing === item.id;

                        return (
                            <div key={item.id}
                                className="rounded-xl px-5 py-4 flex items-start gap-4 transition-all"
                                style={{
                                    background: 'var(--ff-surface)',
                                    border: `1px solid ${isSoon ? '#f59e0b40' : 'var(--ff-border)'}`,
                                    borderLeft: `4px solid ${pCfg.dot}`,
                                    opacity: isBusy ? 0.6 : 1,
                                }}>
                                {/* Priority dot */}
                                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                                    style={{ background: pCfg.dot }} />

                                {/* Main content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <p className="font-semibold text-base truncate" style={{ color: 'var(--ff-text-primary)' }}>
                                            {item.name}
                                        </p>
                                        {/* Priority badge */}
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                                            style={{ background: pCfg.bg, color: pCfg.color }}>
                                            {pCfg.label}
                                        </span>
                                        {/* Status badge for purchased/archived */}
                                        {item.status === 'purchased' && (
                                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                                                style={{ background: '#10b98115', color: '#10b981' }}>
                                                ✓ Purchased
                                            </span>
                                        )}
                                        {item.status === 'archived' && (
                                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                                                style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-muted)' }}>
                                                Archived
                                            </span>
                                        )}
                                    </div>

                                    {item.description && (
                                        <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--ff-text-muted)' }}>
                                            {item.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 flex-wrap">
                                        {item.category && (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md"
                                                style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-muted)', border: '1px solid var(--ff-border)' }}>
                                                <Tag size={10} /> {item.category}
                                            </span>
                                        )}
                                        {item.target_date && (
                                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md`}
                                                style={{
                                                    background: isOverdue ? '#ef444415' : isSoon ? '#f59e0b15' : 'var(--ff-bg)',
                                                    color: isOverdue ? '#ef4444' : isSoon ? '#f59e0b' : 'var(--ff-text-muted)',
                                                    border: `1px solid ${isOverdue ? '#ef444430' : isSoon ? '#f59e0b30' : 'var(--ff-border)'}`,
                                                }}>
                                                <Calendar size={10} />
                                                {isOverdue
                                                    ? `Overdue by ${Math.abs(daysLeft!)} day${Math.abs(daysLeft!) !== 1 ? 's' : ''}`
                                                    : daysLeft === 0
                                                    ? 'Due Today'
                                                    : daysLeft === 1
                                                    ? 'Due Tomorrow'
                                                    : `Target: ${formatDate(item.target_date)}`}
                                            </span>
                                        )}
                                        {item.status === 'purchased' && item.purchase_date && (
                                            <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                                Bought {formatDate(item.purchase_date)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Price & Actions */}
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    <div className="text-right">
                                        <p className="font-bold text-base" style={{ color: '#8b5cf6' }}>
                                            ZMW {fmt(Number(item.status === 'purchased' && item.actual_price_zmw != null
                                                ? item.actual_price_zmw
                                                : item.estimated_price_zmw))}
                                        </p>
                                        {item.status === 'purchased' && item.actual_price_zmw != null
                                            && Number(item.actual_price_zmw) !== Number(item.estimated_price_zmw) && (
                                            <p className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                                                est. ZMW {fmt(Number(item.estimated_price_zmw))}
                                            </p>
                                        )}
                                    </div>

                                    {canEdit && (
                                        <div className="flex items-center gap-1">
                                            {item.status === 'active' && (
                                                <>
                                                    {/* Mark purchased */}
                                                    <button title="Mark as Purchased"
                                                        onClick={() => openPurchaseDialog(item)}
                                                        className="p-1.5 rounded-lg transition-colors"
                                                        style={{ color: '#10b981', background: '#10b98115', border: 'none' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = '#10b98130')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = '#10b98115')}>
                                                        <ShoppingBag size={15} />
                                                    </button>
                                                    {/* Archive */}
                                                    <button title="Archive"
                                                        onClick={() => archiveItem(item.id)}
                                                        className="p-1.5 rounded-lg transition-colors"
                                                        style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                        <Archive size={15} />
                                                    </button>
                                                    {/* Edit */}
                                                    <button title="Edit"
                                                        onClick={() => openEdit(item)}
                                                        className="p-1.5 rounded-lg transition-colors"
                                                        style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#8b5cf6')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                        <Pencil size={15} />
                                                    </button>
                                                </>
                                            )}
                                            {/* Delete (all statuses) */}
                                            <button title="Delete"
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 rounded-lg transition-colors"
                                                style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Add / Edit Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.65)' }}
                    onClick={closeModal}>
                    <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', maxHeight: '92vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                                {editingItem ? 'Edit Wishlist Item' : 'Add to Wishlist'}
                            </h2>
                            <button onClick={closeModal}
                                style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4, cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Item Name *
                                </label>
                                <input id="wishlist-name" type="text" required autoFocus
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="e.g. New Laptop, Spare Tyres, Running Shoes" />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Description
                                </label>
                                <textarea rows={2}
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties}
                                    placeholder="Brief description or model/spec details…" />
                            </div>

                            {/* Estimated Price + Priority */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                        Estimated Price (ZMW) *
                                    </label>
                                    <input id="wishlist-price" type="number" step="0.01" min="0" required
                                        value={form.estimated_price_zmw}
                                        onChange={e => setForm(f => ({ ...f, estimated_price_zmw: e.target.value }))}
                                        style={inputStyle}
                                        placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                        Priority *
                                    </label>
                                    <select id="wishlist-priority"
                                        value={form.priority}
                                        onChange={e => setForm(f => ({ ...f, priority: e.target.value as WishlistPriority }))}
                                        style={inputStyle}>
                                        <option value="high">🔴 High</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="low">🟢 Low</option>
                                    </select>
                                </div>
                            </div>

                            {/* Category — preset + custom */}
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Category
                                </label>
                                <select id="wishlist-category"
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value, customCategory: '' }))}
                                    style={inputStyle}>
                                    <option value="">— Select category —</option>
                                    {appCategories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    <option value="__custom__">✏️ Enter custom…</option>
                                </select>
                                {isCustomCategory && (
                                    <input
                                        id="wishlist-custom-category"
                                        type="text"
                                        placeholder="Type your category…"
                                        value={form.customCategory}
                                        onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                                        style={{ ...inputStyle, marginTop: 8 }} />
                                )}
                            </div>

                            {/* Target Date */}
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Target Date <span style={{ fontWeight: 400 }}>(optional — "I want this by…")</span>
                                </label>
                                <input id="wishlist-target-date" type="date"
                                    value={form.target_date}
                                    onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                                    style={inputStyle} />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Notes
                                </label>
                                <textarea rows={2}
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties}
                                    placeholder="Where to buy, colour, size, priority justification…" />
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={closeModal}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                                    style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}>
                                    {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add to Wishlist'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Mark as Purchased Dialog ── */}
            {purchaseDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.65)' }}
                    onClick={() => setPurchaseDialog(null)}>
                    <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: '#10b98115', color: '#10b981' }}>
                                <ShoppingBag size={20} />
                            </div>
                            <div>
                                <h2 className="font-bold" style={{ color: 'var(--ff-text-primary)' }}>Mark as Purchased</h2>
                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>{purchaseDialog.item.name}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Actual Price Paid (ZMW)
                                </label>
                                <input
                                    id="purchase-actual-price"
                                    type="number" step="0.01" min="0"
                                    value={purchaseDialog.actualPrice}
                                    onChange={e => setPurchaseDialog(d => d ? { ...d, actualPrice: e.target.value } : d)}
                                    style={inputStyle}
                                    placeholder={`Estimated: ZMW ${fmt(Number(purchaseDialog.item.estimated_price_zmw))}`} />
                            </div>

                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl"
                                style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)' }}>
                                <input
                                    id="purchase-log-expense"
                                    type="checkbox"
                                    checked={purchaseDialog.logExpense}
                                    onChange={e => setPurchaseDialog(d => d ? { ...d, logExpense: e.target.checked } : d)}
                                    style={{ width: 16, height: 16, marginTop: 2, accentColor: '#10b981', flexShrink: 0 }} />
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                                        Log as an expense
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                        Creates a matching expense record in your {appLabel} app
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setPurchaseDialog(null)}
                                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                                style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmPurchase}
                                disabled={!!purchasing}
                                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', opacity: purchasing ? 0.7 : 1, cursor: purchasing ? 'default' : 'pointer' }}>
                                {purchasing ? 'Saving…' : 'Confirm Purchase'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
