import { useState } from 'react';
import { Plus, Trash2, Pencil, X, CalendarClock, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useSubscriptions } from '../../hooks/personal/useSubscriptions';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import type { Subscription, SubscriptionCycle, SubscriptionStatus } from '../../types';

const CYCLES: { value: SubscriptionCycle; label: string }[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
];

type FormState = {
    provider: string;
    amount_zmw: string;
    billing_cycle: SubscriptionCycle;
    next_billing_date: string;
    status: SubscriptionStatus;
    notes: string;
};

const emptyForm = (): FormState => ({
    provider: '',
    amount_zmw: '',
    billing_cycle: 'monthly',
    next_billing_date: new Date().toISOString().slice(0, 10),
    status: 'active',
    notes: '',
});

export function PersonalSubscriptions() {
    const { activeWorkspaceId, canEditApp } = useWorkspace();
    const [showModal, setShowModal] = useState(false);
    const [editingSub, setEditingSub] = useState<Subscription | null>(null);
    const [filterStatus, setFilterStatus] = useState<SubscriptionStatus>('active');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());

    const { subscriptions, loading, error, refetch } = useSubscriptions();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = subscriptions.filter(s => s.status === filterStatus);

    // Derived stats
    let totalMonthlyCost = 0;
    let upcomingDueCount = 0;

    subscriptions.forEach(sub => {
        if (sub.status === 'active') {
            // Normalize cost to monthly
            if (sub.billing_cycle === 'weekly') totalMonthlyCost += Number(sub.amount_zmw) * 4.33;
            else if (sub.billing_cycle === 'monthly') totalMonthlyCost += Number(sub.amount_zmw);
            else if (sub.billing_cycle === 'yearly') totalMonthlyCost += Number(sub.amount_zmw) / 12;

            const subDate = new Date(sub.next_billing_date);
            subDate.setHours(0, 0, 0, 0);
            const diffTime = subDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 0 && diffDays <= 7) {
                upcomingDueCount++;
            }
        }
    });

    const fmt = (n: number) => n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getDaysUntil = (dateStr: string) => {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
        if (diffDays === 0) return `Due Today`;
        if (diffDays === 1) return `Due Tomorrow`;
        return `Due in ${diffDays} days`;
    };

    const isUpcomingHelper = (dateStr: string) => {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
    };

    const openAddModal = () => {
        setEditingSub(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEditModal = (sub: Subscription) => {
        setEditingSub(sub);
        setForm({
            provider: sub.provider,
            amount_zmw: String(sub.amount_zmw),
            billing_cycle: sub.billing_cycle,
            next_billing_date: sub.next_billing_date,
            status: sub.status,
            notes: sub.notes ?? '',
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeWorkspaceId) return;
        setSaving(true);

        const payload = {
            workspace_id: activeWorkspaceId,
            app_id: 'personal',
            provider: form.provider,
            amount_zmw: parseFloat(form.amount_zmw),
            billing_cycle: form.billing_cycle,
            next_billing_date: form.next_billing_date,
            status: form.status,
            notes: form.notes || null,
        };

        const { error: supaErr } = editingSub
            ? await supabase.from('subscriptions').update(payload).eq('id', editingSub.id)
            : await supabase.from('subscriptions').insert(payload);

        setSaving(false);
        if (!supaErr) {
            setShowModal(false);
            refetch();
        } else {
            console.error(supaErr);
            alert("Error saving subscription");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this subscription permanently?')) return;
        setDeleting(id);
        await supabase.from('subscriptions').delete().eq('id', id);
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
                title="Subscriptions"
                subtitle="Track your recurring personal payments"
                action={canEditApp('personal') && (
                    <button onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: '#06b6d4', color: 'white' }}>
                        <Plus size={16} /> New Subscription
                    </button>
                )}
            />

            {error && (
                <div className="mb-4 p-4 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                    {error}
                </div>
            )}

            {/* Summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { id: 'monthly_cost', label: 'Total Monthly Cost', value: `ZMW ${fmt(totalMonthlyCost)}`, color: '#06b6d4' },
                    { id: 'active_count', label: 'Active Subs', value: subscriptions.filter(s => s.status === 'active').length, color: 'var(--ff-text-primary)' },
                    { id: 'upcoming', label: 'Due in 7 Days', value: upcomingDueCount, color: upcomingDueCount > 0 ? '#f59e0b' : 'var(--ff-text-primary)' },
                ].map(s => (
                    <div key={s.id} className="rounded-xl p-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>{s.label}</p>
                        <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b mb-4" style={{ borderColor: 'var(--ff-border)' }}>
                {(['active', 'canceled'] as const).map(tab => (
                    <button key={tab} onClick={() => setFilterStatus(tab)}
                        className={`pb-2 text-sm font-medium capitalize transition-colors ${filterStatus === tab ? '' : 'opacity-60'}`}
                        style={{
                            color: filterStatus === tab ? '#06b6d4' : 'var(--ff-text-primary)',
                            borderBottom: filterStatus === tab ? '2px solid #06b6d4' : '2px solid transparent',
                        }}>
                        {tab} Subscriptions
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-36">
                    <p style={{ color: 'var(--ff-text-muted)' }}>Loading subscriptions…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 rounded-xl"
                    style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    <CalendarClock size={36} style={{ color: 'var(--ff-border)' }} className="mb-3" />
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No {filterStatus} subscriptions found.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(sub => {
                        const isUpcoming = filterStatus === 'active' && isUpcomingHelper(sub.next_billing_date);
                        return (
                            <div key={sub.id} className="flex items-center justify-between rounded-xl px-5 py-4"
                                style={{
                                    background: 'var(--ff-surface)',
                                    border: isUpcoming ? '1px solid #f59e0b50' : '1px solid var(--ff-border)',
                                    opacity: deleting === sub.id ? 0.5 : 1
                                }}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-base font-semibold truncate" style={{ color: 'var(--ff-text-primary)' }}>
                                            {sub.provider}
                                        </p>
                                        {isUpcoming && (
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded"
                                                style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                                                <AlertCircle size={10} />
                                                Upcoming
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                            {sub.status === 'active' ? getDaysUntil(sub.next_billing_date) : `Next Due: ${sub.next_billing_date}`}
                                        </p>
                                        <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)' }}>
                                            {sub.billing_cycle}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                                    <div className="text-right">
                                        <p className="font-bold text-base" style={{ color: '#06b6d4' }}>
                                            ZMW {fmt(Number(sub.amount_zmw))}
                                        </p>
                                    </div>
                                    {canEditApp('personal') && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEditModal(sub)} title="Edit"
                                                className="p-1.5 rounded-lg transition-colors"
                                                style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#06b6d4')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(sub.id)} title="Delete"
                                                className="p-1.5 rounded-lg transition-colors"
                                                style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
                    onClick={() => { setShowModal(false); setEditingSub(null); }}>
                    <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                                {editingSub ? 'Edit Subscription' : 'New Subscription'}
                            </h2>
                            <button onClick={() => { setShowModal(false); setEditingSub(null); }}
                                style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Provider / Service *</label>
                                <input type="text" required value={form.provider}
                                    onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} style={inputStyle} placeholder="e.g. Netflix, Gym, Spotify" autoFocus />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Amount (ZMW) *</label>
                                    <input type="number" step="0.01" min="0" required value={form.amount_zmw}
                                        onChange={e => setForm(f => ({ ...f, amount_zmw: e.target.value }))} style={inputStyle} placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Billing Cycle *</label>
                                    <select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value as SubscriptionCycle }))} style={inputStyle}>
                                        {CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Next Due Date *</label>
                                    <input type="date" required value={form.next_billing_date}
                                        onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} style={inputStyle} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Status *</label>
                                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SubscriptionStatus }))} style={inputStyle}>
                                        <option value="active">Active</option>
                                        <option value="canceled">Canceled</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--ff-text-muted)' }}>Notes</label>
                                <textarea rows={2} value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties}
                                    placeholder="Any additional notes…" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowModal(false); setEditingSub(null); }}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                                    style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)', background: 'transparent' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all hover:opacity-90"
                                    style={{ background: '#06b6d4', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Saving…' : editingSub ? 'Save Changes' : 'Create Subscription'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
