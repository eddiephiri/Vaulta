import { useState, useMemo, useRef, useEffect } from 'react';
import {
    ClipboardList, Plus, Pencil, Trash2, X, Check,
    ChevronRight, Lock, LockOpen, AlertCircle, Loader2,
    Tag, StickyNote, TrendingDown, TrendingUp, ShoppingCart,
    MoreVertical, CheckCircle2, Circle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useBudgetSheets } from '../../hooks/budget/useBudgetSheets';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import type {
    BudgetSheetWithTotals,
    BudgetSheetItem,
    BudgetSheetStatus,
} from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthLabel = (ym?: string | null) => {
    if (!ym) return null;
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-ZM', { month: 'long', year: 'numeric' });
};

const CATEGORY_COLORS: Record<string, string> = {
    Groceries: '#f97316', Food: '#f97316', Clothing: '#ec4899',
    Electronics: '#3b82f6', Appliances: '#6366f1', Furniture: '#8b5cf6',
    Transport: '#f59e0b', Healthcare: '#10b981', Education: '#06b6d4',
    Entertainment: '#a855f7', Home: '#14b8a6', Other: '#6b7280',
};
const categoryColor = (c?: string | null) => {
    if (!c) return '#6b7280';
    const match = Object.keys(CATEGORY_COLORS).find(k => c.toLowerCase().includes(k.toLowerCase()));
    return match ? CATEGORY_COLORS[match] : '#6b7280';
};

function currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PRESET_CATEGORIES = [
    'Groceries', 'Clothing', 'Electronics', 'Appliances', 'Furniture',
    'Transport', 'Healthcare', 'Education', 'Entertainment', 'Home Improvement',
    'Dining Out', 'Personal Care', 'Gifts', 'Savings Goal', 'Other',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProgressRingProps { pct: number; size?: number; stroke?: number; color?: string; }
function ProgressRing({ pct, size = 44, stroke = 4, color = '#10b981' }: ProgressRingProps) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ff-border)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        </svg>
    );
}

// ─── Inline actual-price editor ───────────────────────────────────────────────

interface ActualPriceEditorProps {
    item: BudgetSheetItem;
    onSave: (val: number | null) => Promise<boolean | void>;
    readOnly: boolean;
}
function ActualPriceEditor({ item, onSave, readOnly }: ActualPriceEditorProps) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(item.actual_zmw != null ? String(item.actual_zmw) : '');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    const commit = async () => {
        setSaving(true);
        const num = val.trim() === '' ? null : parseFloat(val);
        await onSave(num);
        setSaving(false);
        setEditing(false);
    };

    if (readOnly) {
        return (
            <span className="text-sm font-semibold" style={{ color: item.actual_zmw != null ? '#10b981' : 'var(--ff-text-muted)' }}>
                {item.actual_zmw != null ? `ZMW ${fmt(Number(item.actual_zmw))}` : '—'}
            </span>
        );
    }

    if (!editing) {
        return (
            <button
                onClick={() => { setVal(item.actual_zmw != null ? String(item.actual_zmw) : ''); setEditing(true); }}
                className="flex items-center gap-1 group"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Set actual price paid"
            >
                <span className="text-sm font-semibold" style={{ color: item.actual_zmw != null ? '#10b981' : 'var(--ff-text-muted)' }}>
                    {item.actual_zmw != null ? `ZMW ${fmt(Number(item.actual_zmw))}` : '—'}
                </span>
                <Pencil size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: '#10b981' }} />
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <input
                ref={inputRef}
                type="number" step="0.01" min="0"
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                style={{
                    width: 80, padding: '2px 6px', fontSize: 12, borderRadius: 6,
                    border: '1px solid #10b981', outline: 'none',
                    background: 'var(--ff-bg)', color: 'var(--ff-text-primary)',
                }}
            />
            <button onClick={commit} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: 2 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-muted)', padding: 2 }}>
                <X size={13} />
            </button>
        </div>
    );
}

// ─── Sheet form ───────────────────────────────────────────────────────────────

interface SheetFormState { name: string; description: string; month: string; notes: string; }
const blankSheetForm = (): SheetFormState => ({ name: '', description: '', month: currentMonth(), notes: '' });

// ─── Item form ────────────────────────────────────────────────────────────────

interface ItemFormState { name: string; category: string; customCategory: string; estimated_zmw: string; notes: string; }
const blankItemForm = (): ItemFormState => ({ name: '', category: '', customCategory: '', estimated_zmw: '', notes: '' });

// ─── Main Component ───────────────────────────────────────────────────────────

export function BudgetSheets() {
    const { canEditApp } = useWorkspace();
    const canEdit = canEditApp('budget');

    const {
        sheets, loading, error,
        addSheet, updateSheet, deleteSheet,
        addItem, updateItem, deleteItem,
        togglePurchased, setActualPrice,
    } = useBudgetSheets();

    // ── UI state ─────────────────────────────────────────────────────────────
    const [selectedId, setSelectedId]         = useState<string | null>(null);
    const [statusFilter, setStatusFilter]     = useState<BudgetSheetStatus | 'all'>('all');
    const [showSheetModal, setShowSheetModal] = useState(false);
    const [editingSheet, setEditingSheet]     = useState<BudgetSheetWithTotals | null>(null);
    const [sheetForm, setSheetForm]           = useState<SheetFormState>(blankSheetForm());
    const [savingSheet, setSavingSheet]       = useState(false);
    const [deletingSheet, setDeletingSheet]   = useState<string | null>(null);

    const [showItemForm, setShowItemForm]     = useState(false);
    const [itemForm, setItemForm]             = useState<ItemFormState>(blankItemForm());
    const [savingItem, setSavingItem]         = useState(false);
    const [deletingItem, setDeletingItem]     = useState<string | null>(null);
    const [editingItem, setEditingItem]       = useState<BudgetSheetItem | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [sheetMenuOpen, setSheetMenuOpen]   = useState<string | null>(null);

    const isCustomCategory = itemForm.category === '__custom__';
    const effectiveCategory = isCustomCategory ? itemForm.customCategory : itemForm.category;

    // ── Filtered sheet list ───────────────────────────────────────────────────
    const displaySheets = useMemo(() => {
        let list = [...sheets];
        if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
        return list;
    }, [sheets, statusFilter]);

    const selectedSheet = useMemo(() => sheets.find(s => s.id === selectedId) ?? null, [sheets, selectedId]);

    // Auto-select first sheet when list loads
    useEffect(() => {
        if (!selectedId && displaySheets.length > 0) setSelectedId(displaySheets[0].id);
    }, [displaySheets, selectedId]);

    // ── Category grouping for selected sheet ─────────────────────────────────
    const groupedItems = useMemo(() => {
        if (!selectedSheet) return [];
        const map = new Map<string, BudgetSheetItem[]>();
        for (const item of selectedSheet.items) {
            const cat = item.category || 'Uncategorised';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(item);
        }
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [selectedSheet]);

    // ── Sheet modal helpers ───────────────────────────────────────────────────
    const openAddSheet = () => {
        setEditingSheet(null);
        setSheetForm(blankSheetForm());
        setShowSheetModal(true);
    };
    const openEditSheet = (s: BudgetSheetWithTotals) => {
        setEditingSheet(s);
        setSheetForm({ name: s.name, description: s.description ?? '', month: s.month ?? '', notes: s.notes ?? '' });
        setShowSheetModal(true);
        setSheetMenuOpen(null);
    };
    const handleSaveSheet = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingSheet(true);
        const payload = {
            name: sheetForm.name,
            description: sheetForm.description || null,
            month: sheetForm.month || null,
            notes: sheetForm.notes || null,
        };
        if (editingSheet) {
            await updateSheet(editingSheet.id, payload);
        } else {
            const created = await addSheet(payload);
            if (created) setSelectedId(created.id);
        }
        setSavingSheet(false);
        setShowSheetModal(false);
    };
    const handleDeleteSheet = async (id: string) => {
        if (!window.confirm('Delete this budget sheet and all its items?')) return;
        setDeletingSheet(id);
        await deleteSheet(id);
        setDeletingSheet(null);
        if (selectedId === id) setSelectedId(null);
        setSheetMenuOpen(null);
    };
    const handleToggleClose = async (s: BudgetSheetWithTotals) => {
        await updateSheet(s.id, { status: s.status === 'open' ? 'closed' : 'open' });
        setSheetMenuOpen(null);
    };

    // ── Item helpers ─────────────────────────────────────────────────────────
    const openEditItem = (item: BudgetSheetItem) => {
        const isPreset = PRESET_CATEGORIES.includes(item.category ?? '');
        setEditingItem(item);
        setItemForm({
            name: item.name,
            category: isPreset ? (item.category ?? '') : (item.category ? '__custom__' : ''),
            customCategory: isPreset ? '' : (item.category ?? ''),
            estimated_zmw: String(item.estimated_zmw),
            notes: item.notes ?? '',
        });
        setShowItemForm(true);
    };
    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedId) return;
        setSavingItem(true);
        const payload = {
            name: itemForm.name,
            category: effectiveCategory || null,
            estimated_zmw: parseFloat(itemForm.estimated_zmw) || 0,
            notes: itemForm.notes || null,
        };
        if (editingItem) {
            await updateItem(editingItem.id, payload);
        } else {
            await addItem(selectedId, payload);
        }
        setSavingItem(false);
        setShowItemForm(false);
        setEditingItem(null);
        setItemForm(blankItemForm());
    };
    const handleDeleteItem = async (id: string) => {
        setDeletingItem(id);
        await deleteItem(id);
        setDeletingItem(null);
    };
    const toggleCategory = (cat: string) => {
        setCollapsedCategories(prev => {
            const n = new Set(prev);
            n.has(cat) ? n.delete(cat) : n.add(cat);
            return n;
        });
    };

    // ── Styles ────────────────────────────────────────────────────────────────
    const inputStyle: React.CSSProperties = {
        background: 'var(--ff-bg)', color: 'var(--ff-text-primary)',
        border: '1px solid var(--ff-border)', borderRadius: 8,
        padding: '8px 12px', width: '100%', fontSize: 14,
        outline: 'none', boxSizing: 'border-box',
    };

    const sheetColors = { accent: '#10b981', accentBg: '#10b98115', accentLight: '#10b98130' };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div>
            <PageHeader
                title="Budget Sheets"
                subtitle="Plan, estimate, and track your spending item by item"
                action={canEdit && (
                    <button
                        id="budget-sheets-new-btn"
                        onClick={openAddSheet}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', boxShadow: '0 2px 8px #10b98140' }}
                    >
                        <Plus size={16} /> New Sheet
                    </button>
                )}
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm flex items-center gap-2"
                    style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* ── Status filter ── */}
            <div className="flex items-center gap-1 p-1 rounded-lg mb-5 self-start w-fit"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                {(['all', 'open', 'closed'] as const).map(f => (
                    <button key={f}
                        onClick={() => setStatusFilter(f)}
                        className="px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all"
                        style={statusFilter === f
                            ? { background: sheetColors.accent, color: 'white' }
                            : { background: 'transparent', color: 'var(--ff-text-muted)' }}>
                        {f === 'all' ? 'All Sheets' : f === 'open' ? '🟢 Open' : '🔒 Closed'}
                    </button>
                ))}
            </div>

            {/* ── Two-panel layout ── */}
            <div className="flex gap-5" style={{ minHeight: 480 }}>

                {/* ── Left: Sheet list ── */}
                <div style={{ width: 280, flexShrink: 0 }}>
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="animate-spin mr-2" size={20} style={{ color: sheetColors.accent }} />
                            <p style={{ color: 'var(--ff-text-muted)', fontSize: 14 }}>Loading…</p>
                        </div>
                    ) : displaySheets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 rounded-2xl"
                            style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)' }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                                style={{ background: sheetColors.accentBg, color: sheetColors.accent }}>
                                <ClipboardList size={22} />
                            </div>
                            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ff-text-primary)' }}>No sheets yet</p>
                            <p className="text-xs mb-4 text-center px-4" style={{ color: 'var(--ff-text-muted)' }}>
                                Create your first budget sheet to start planning purchases.
                            </p>
                            {canEdit && (
                                <button onClick={openAddSheet}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    style={{ background: sheetColors.accent, color: 'white' }}>
                                    <Plus size={13} /> New Sheet
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {displaySheets.map(sheet => {
                                const pct = sheet.totalItems === 0 ? 0 : Math.round((sheet.purchasedCount / sheet.totalItems) * 100);
                                const isSelected = sheet.id === selectedId;
                                const isClosed = sheet.status === 'closed';
                                return (
                                    <div key={sheet.id}
                                        id={`sheet-card-${sheet.id}`}
                                        onClick={() => setSelectedId(sheet.id)}
                                        className="rounded-xl p-4 cursor-pointer transition-all relative"
                                        style={{
                                            background: isSelected ? sheetColors.accentBg : 'var(--ff-surface)',
                                            border: `1px solid ${isSelected ? sheetColors.accent : 'var(--ff-border)'}`,
                                            borderLeft: `4px solid ${isSelected ? sheetColors.accent : 'var(--ff-border)'}`,
                                            opacity: isClosed ? 0.7 : 1,
                                        }}
                                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = `${sheetColors.accent}60`; }}
                                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--ff-border)'; }}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    {isClosed && <Lock size={11} style={{ color: 'var(--ff-text-muted)', flexShrink: 0 }} />}
                                                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--ff-text-primary)' }}>
                                                        {sheet.name}
                                                    </p>
                                                </div>
                                                {sheet.month && (
                                                    <p className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                                                        {monthLabel(sheet.month)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    id={`sheet-menu-${sheet.id}`}
                                                    onClick={() => setSheetMenuOpen(v => v === sheet.id ? null : sheet.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-muted)', padding: 2 }}>
                                                    <MoreVertical size={14} />
                                                </button>
                                                {sheetMenuOpen === sheet.id && (
                                                    <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-30 py-1 min-w-[150px]"
                                                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                                        {canEdit && (
                                                            <>
                                                                <button onClick={() => openEditSheet(sheet)}
                                                                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors"
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-primary)' }}
                                                                    onMouseEnter={e => (e.currentTarget.style.color = '#10b981')}
                                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-primary)')}>
                                                                    <Pencil size={13} /> Edit
                                                                </button>
                                                                <button onClick={() => handleToggleClose(sheet)}
                                                                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors"
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-primary)' }}
                                                                    onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
                                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-primary)')}>
                                                                    {isClosed ? <LockOpen size={13} /> : <Lock size={13} />}
                                                                    {isClosed ? 'Reopen' : 'Close Sheet'}
                                                                </button>
                                                                <div style={{ borderTop: '1px solid var(--ff-border)', margin: '4px 0' }} />
                                                                <button onClick={() => handleDeleteSheet(sheet.id)}
                                                                    disabled={deletingSheet === sheet.id}
                                                                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors"
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                                                    <Trash2 size={13} /> Delete
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ff-border)' }}>
                                                <div className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%`, background: pct === 100 ? sheetColors.accent : '#10b98180' }} />
                                            </div>
                                            <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: sheetColors.accent }}>
                                                {sheet.purchasedCount}/{sheet.totalItems}
                                            </span>
                                        </div>

                                        <div className="flex justify-between text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                                            <span>Est. ZMW {fmt(sheet.totalEstimated)}</span>
                                            {sheet.totalPaid > 0 && (
                                                <span style={{ color: sheetColors.accent }}>Paid ZMW {fmt(sheet.totalPaid)}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Right: Sheet detail ── */}
                <div className="flex-1 min-w-0">
                    {!selectedSheet ? (
                        <div className="flex flex-col items-center justify-center h-full rounded-2xl"
                            style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)', minHeight: 320 }}>
                            <ChevronRight size={28} style={{ color: 'var(--ff-border)', marginBottom: 8 }} />
                            <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>Select a sheet to view items</p>
                        </div>
                    ) : (
                        <div>
                            {/* Sheet header */}
                            <div className="rounded-xl p-5 mb-4"
                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex-shrink-0">
                                            <ProgressRing
                                                pct={selectedSheet.totalItems === 0 ? 0 : Math.round((selectedSheet.purchasedCount / selectedSheet.totalItems) * 100)}
                                                size={52} stroke={5} color={sheetColors.accent}
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                                                style={{ color: sheetColors.accent }}>
                                                {selectedSheet.totalItems === 0 ? '0%' : `${Math.round((selectedSheet.purchasedCount / selectedSheet.totalItems) * 100)}%`}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <h2 className="text-lg font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                                                    {selectedSheet.name}
                                                </h2>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                    style={selectedSheet.status === 'open'
                                                        ? { background: sheetColors.accentBg, color: sheetColors.accent }
                                                        : { background: 'var(--ff-bg)', color: 'var(--ff-text-muted)' }}>
                                                    {selectedSheet.status === 'open' ? '🟢 Open' : '🔒 Closed'}
                                                </span>
                                                {selectedSheet.month && (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                        style={{ background: '#3b82f615', color: '#3b82f6' }}>
                                                        {monthLabel(selectedSheet.month)}
                                                    </span>
                                                )}
                                            </div>
                                            {selectedSheet.description && (
                                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>{selectedSheet.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    {canEdit && selectedSheet.status === 'open' && (
                                        <button
                                            id="add-item-btn"
                                            onClick={() => { setEditingItem(null); setItemForm(blankItemForm()); setShowItemForm(true); }}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                                            style={{ background: sheetColors.accent, color: 'white', boxShadow: `0 2px 8px ${sheetColors.accentLight}` }}>
                                            <Plus size={14} /> Add Item
                                        </button>
                                    )}
                                </div>

                                {/* Summary strip */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4"
                                    style={{ borderTop: '1px solid var(--ff-border)' }}>
                                    {[
                                        {
                                            label: 'Total Estimated', value: `ZMW ${fmt(selectedSheet.totalEstimated)}`,
                                            color: '#3b82f6', icon: <ShoppingCart size={14} />,
                                        },
                                        {
                                            label: 'Total Actual', value: `ZMW ${fmt(selectedSheet.totalActual)}`,
                                            color: selectedSheet.totalActual > selectedSheet.totalEstimated ? '#ef4444' : sheetColors.accent,
                                            icon: selectedSheet.totalActual > selectedSheet.totalEstimated
                                                ? <TrendingUp size={14} />
                                                : <TrendingDown size={14} />,
                                        },
                                        {
                                            label: 'Amount Paid', value: `ZMW ${fmt(selectedSheet.totalPaid)}`,
                                            color: sheetColors.accent, icon: <CheckCircle2 size={14} />,
                                        },
                                        {
                                            label: 'Items Bought',
                                            value: `${selectedSheet.purchasedCount} of ${selectedSheet.totalItems}`,
                                            color: 'var(--ff-text-primary)', icon: <ClipboardList size={14} />,
                                        },
                                    ].map(s => (
                                        <div key={s.label} className="rounded-lg p-3" style={{ background: 'var(--ff-bg)' }}>
                                            <div className="flex items-center gap-1.5 mb-1" style={{ color: s.color }}>
                                                {s.icon}
                                                <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--ff-text-muted)' }}>
                                                    {s.label}
                                                </p>
                                            </div>
                                            <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Inline add/edit item form ── */}
                            {showItemForm && canEdit && selectedSheet.status === 'open' && (
                                <div className="rounded-xl p-4 mb-4"
                                    style={{ background: sheetColors.accentBg, border: `1px solid ${sheetColors.accentLight}` }}>
                                    <p className="text-sm font-bold mb-3" style={{ color: sheetColors.accent }}>
                                        {editingItem ? 'Edit Item' : 'Add New Item'}
                                    </p>
                                    <form onSubmit={handleSaveItem}>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                            {/* Name */}
                                            <div>
                                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                                    Item Name *
                                                </label>
                                                <input id="item-name" type="text" required autoFocus
                                                    value={itemForm.name}
                                                    onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                                                    style={inputStyle} placeholder="e.g. Washing Powder, HDMI Cable…" />
                                            </div>

                                            {/* Estimated price */}
                                            <div>
                                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                                    Estimated Price (ZMW) *
                                                </label>
                                                <input id="item-estimated" type="number" step="0.01" min="0" required
                                                    value={itemForm.estimated_zmw}
                                                    onChange={e => setItemForm(f => ({ ...f, estimated_zmw: e.target.value }))}
                                                    style={inputStyle} placeholder="0.00" />
                                            </div>

                                            {/* Category */}
                                            <div>
                                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Category</label>
                                                <select id="item-category"
                                                    value={itemForm.category}
                                                    onChange={e => setItemForm(f => ({ ...f, category: e.target.value, customCategory: '' }))}
                                                    style={inputStyle}>
                                                    <option value="">— Select category —</option>
                                                    {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                    <option value="__custom__">✏️ Enter custom…</option>
                                                </select>
                                                {isCustomCategory && (
                                                    <input type="text" placeholder="Type your category…"
                                                        value={itemForm.customCategory}
                                                        onChange={e => setItemForm(f => ({ ...f, customCategory: e.target.value }))}
                                                        style={{ ...inputStyle, marginTop: 6 }} />
                                                )}
                                            </div>

                                            {/* Notes */}
                                            <div>
                                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Notes</label>
                                                <input type="text"
                                                    value={itemForm.notes}
                                                    onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                                                    style={inputStyle} placeholder="Brand, size, store, link…" />
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button type="button"
                                                onClick={() => { setShowItemForm(false); setEditingItem(null); setItemForm(blankItemForm()); }}
                                                className="px-4 py-2 rounded-lg text-xs font-semibold"
                                                style={{ background: 'transparent', border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', cursor: 'pointer' }}>
                                                Cancel
                                            </button>
                                            <button type="submit" disabled={savingItem}
                                                className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                                                style={{ background: sheetColors.accent, opacity: savingItem ? 0.7 : 1, cursor: savingItem ? 'default' : 'pointer' }}>
                                                {savingItem ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Item'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* ── Item list (grouped by category) ── */}
                            {selectedSheet.items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-14 rounded-2xl"
                                    style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)' }}>
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                                        style={{ background: sheetColors.accentBg, color: sheetColors.accent }}>
                                        <ShoppingCart size={22} />
                                    </div>
                                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ff-text-primary)' }}>
                                        No items in this sheet yet
                                    </p>
                                    <p className="text-xs mb-4" style={{ color: 'var(--ff-text-muted)' }}>
                                        Add items to start building your budget plan.
                                    </p>
                                    {canEdit && selectedSheet.status === 'open' && (
                                        <button onClick={() => { setEditingItem(null); setItemForm(blankItemForm()); setShowItemForm(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                            style={{ background: sheetColors.accent, color: 'white' }}>
                                            <Plus size={13} /> Add First Item
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {groupedItems.map(([cat, items]) => {
                                        const catColor = categoryColor(cat);
                                        const collapsed = collapsedCategories.has(cat);
                                        const catTotal = items.reduce((s, i) => s + Number(i.estimated_zmw), 0);
                                        const catPurchased = items.filter(i => i.is_purchased).length;

                                        return (
                                            <div key={cat} className="rounded-xl overflow-hidden"
                                                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                                                {/* Category header */}
                                                <button
                                                    onClick={() => toggleCategory(cat)}
                                                    className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ff-bg)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor }} />
                                                        <div className="flex items-center gap-1.5">
                                                            <Tag size={12} style={{ color: catColor }} />
                                                            <span className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>{cat}</span>
                                                        </div>
                                                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                                                            style={{ background: `${catColor}15`, color: catColor }}>
                                                            {catPurchased}/{items.length}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-semibold" style={{ color: 'var(--ff-text-muted)' }}>
                                                            ZMW {fmt(catTotal)}
                                                        </span>
                                                        {collapsed ? <ChevronDown size={14} style={{ color: 'var(--ff-text-muted)' }} /> : <ChevronUp size={14} style={{ color: 'var(--ff-text-muted)' }} />}
                                                    </div>
                                                </button>

                                                {/* Items */}
                                                {!collapsed && (
                                                    <div style={{ borderTop: '1px solid var(--ff-border)' }}>
                                                        {/* Table header */}
                                                        <div className="grid px-4 py-2 text-[10px] uppercase tracking-wider font-bold"
                                                            style={{ color: 'var(--ff-text-muted)', gridTemplateColumns: '24px 1fr 110px 120px 60px 80px' }}>
                                                            <span />
                                                            <span>Item</span>
                                                            <span className="text-right">Estimated</span>
                                                            <span className="text-right">Actual Paid</span>
                                                            <span className="text-center">Var.</span>
                                                            <span />
                                                        </div>

                                                        {items.map((item, idx) => {
                                                            const isBusy = deletingItem === item.id;
                                                            const hasActual = item.actual_zmw != null;
                                                            const variance = hasActual
                                                                ? Number(item.actual_zmw) - Number(item.estimated_zmw)
                                                                : null;
                                                            const isOver = variance != null && variance > 0;
                                                            const isUnder = variance != null && variance < 0;
                                                            const isClosed = selectedSheet.status === 'closed';

                                                            return (
                                                                <div key={item.id}
                                                                    className="grid items-center px-4 py-3 transition-all"
                                                                    style={{
                                                                        gridTemplateColumns: '24px 1fr 110px 120px 60px 80px',
                                                                        borderTop: idx === 0 ? 'none' : '1px solid var(--ff-border)',
                                                                        opacity: isBusy ? 0.4 : 1,
                                                                        background: item.is_purchased ? `${sheetColors.accent}08` : 'transparent',
                                                                    }}>

                                                                    {/* Checkbox */}
                                                                    <button
                                                                        id={`item-check-${item.id}`}
                                                                        onClick={() => !isClosed && canEdit && togglePurchased(item)}
                                                                        disabled={isClosed || !canEdit}
                                                                        style={{ background: 'none', border: 'none', cursor: isClosed || !canEdit ? 'default' : 'pointer', padding: 0, color: item.is_purchased ? sheetColors.accent : 'var(--ff-border)' }}
                                                                        title={item.is_purchased ? 'Mark as not purchased' : 'Mark as purchased'}
                                                                    >
                                                                        {item.is_purchased
                                                                            ? <CheckCircle2 size={18} />
                                                                            : <Circle size={18} />}
                                                                    </button>

                                                                    {/* Name + notes */}
                                                                    <div className="min-w-0 pr-2">
                                                                        <p className="text-sm font-medium truncate"
                                                                            style={{
                                                                                color: item.is_purchased ? 'var(--ff-text-muted)' : 'var(--ff-text-primary)',
                                                                                textDecoration: item.is_purchased ? 'line-through' : 'none',
                                                                                textDecorationColor: 'var(--ff-text-muted)',
                                                                            }}>
                                                                            {item.name}
                                                                        </p>
                                                                        {item.notes && (
                                                                            <p className="text-[11px] truncate flex items-center gap-1 mt-0.5"
                                                                                style={{ color: 'var(--ff-text-muted)' }}>
                                                                                <StickyNote size={9} /> {item.notes}
                                                                            </p>
                                                                        )}
                                                                        {item.is_purchased && item.purchased_at && (
                                                                            <p className="text-[10px] mt-0.5" style={{ color: sheetColors.accent }}>
                                                                                ✓ {new Date(item.purchased_at).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short' })}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {/* Estimated */}
                                                                    <p className="text-sm font-semibold text-right" style={{ color: '#3b82f6' }}>
                                                                        ZMW {fmt(Number(item.estimated_zmw))}
                                                                    </p>

                                                                    {/* Actual (inline editor) */}
                                                                    <div className="flex justify-end">
                                                                        <ActualPriceEditor
                                                                            item={item}
                                                                            readOnly={isClosed || !canEdit}
                                                                            onSave={val => setActualPrice(item.id, val)}
                                                                        />
                                                                    </div>

                                                                    {/* Variance badge */}
                                                                    <div className="flex justify-center">
                                                                        {variance === null ? (
                                                                            <span style={{ color: 'var(--ff-border)', fontSize: 11 }}>—</span>
                                                                        ) : isOver ? (
                                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                                                style={{ background: '#ef444415', color: '#ef4444' }}>
                                                                                +{fmt(variance)}
                                                                            </span>
                                                                        ) : isUnder ? (
                                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                                                style={{ background: sheetColors.accentBg, color: sheetColors.accent }}>
                                                                                -{fmt(Math.abs(variance))}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                                                style={{ background: '#64748b15', color: '#64748b' }}>
                                                                                ={fmt(0)}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Actions */}
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        {canEdit && !isClosed && (
                                                                            <>
                                                                                <button title="Edit item"
                                                                                    onClick={() => openEditItem(item)}
                                                                                    className="p-1.5 rounded-lg transition-colors"
                                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-muted)' }}
                                                                                    onMouseEnter={e => (e.currentTarget.style.color = sheetColors.accent)}
                                                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                                                    <Pencil size={13} />
                                                                                </button>
                                                                                <button title="Delete item"
                                                                                    onClick={() => handleDeleteItem(item.id)}
                                                                                    disabled={isBusy}
                                                                                    className="p-1.5 rounded-lg transition-colors"
                                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-muted)' }}
                                                                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                                                    {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Add / Edit Sheet Modal ── */}
            {showSheetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.65)' }}
                    onClick={() => setShowSheetModal(false)}>
                    <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                                {editingSheet ? 'Edit Budget Sheet' : 'New Budget Sheet'}
                            </h2>
                            <button onClick={() => setShowSheetModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4, cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSheet} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Sheet Name *
                                </label>
                                <input id="sheet-name" type="text" required autoFocus
                                    value={sheetForm.name}
                                    onChange={e => setSheetForm(f => ({ ...f, name: e.target.value }))}
                                    style={inputStyle} placeholder="e.g. April Groceries, Holiday Shopping…" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Description
                                </label>
                                <textarea rows={2}
                                    value={sheetForm.description}
                                    onChange={e => setSheetForm(f => ({ ...f, description: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties}
                                    placeholder="What is this budget sheet for?" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                                    Month <span style={{ fontWeight: 400 }}>(optional)</span>
                                </label>
                                <input id="sheet-month" type="month"
                                    value={sheetForm.month}
                                    onChange={e => setSheetForm(f => ({ ...f, month: e.target.value }))}
                                    style={inputStyle} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Notes</label>
                                <textarea rows={2}
                                    value={sheetForm.notes}
                                    onChange={e => setSheetForm(f => ({ ...f, notes: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties}
                                    placeholder="Any extra context…" />
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowSheetModal(false)}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                                    style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={savingSheet}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', opacity: savingSheet ? 0.7 : 1, cursor: savingSheet ? 'default' : 'pointer' }}>
                                    {savingSheet ? 'Saving…' : editingSheet ? 'Save Changes' : 'Create Sheet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Click-outside to close sheet menu */}
            {sheetMenuOpen && (
                <div className="fixed inset-0 z-20" onClick={() => setSheetMenuOpen(null)} />
            )}
        </div>
    );
}
