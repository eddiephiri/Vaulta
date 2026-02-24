import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, IncomeSource, Driver, IncomeRecord } from '../types';

interface AddIncomeModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    drivers?: Driver[];
    /** Pre-fill from an overdue expected_cashing row */
    prefill?: {
        vehicle_id: string;
        expected_cashing_id: string;
        expected_date: string;
        is_salary_week: boolean;
    };
    initialData?: IncomeRecord;
}

const SOURCES: { value: IncomeSource; label: string }[] = [
    { value: 'yango', label: 'Yango' },
    { value: 'public_transport', label: 'Bus / Public Transport' },
    { value: 'rental', label: 'Rental' },
    { value: 'other', label: 'Other' },
];

type LateReason = 'none' | 'late_driver' | 'late_admin';

const INPUT_STYLE = {
    background: 'var(--ff-navy)',
    color: 'var(--ff-text-primary)',
    border: '1px solid var(--ff-border)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
} as const;

const LABEL_STYLE = {
    display: 'block',
    fontSize: 12,
    color: 'var(--ff-text-muted)',
    marginBottom: 4,
} as const;

export function AddIncomeModal({ open, onClose, onSuccess, vehicles, drivers = [], prefill, initialData }: AddIncomeModalProps) {
    const isEdit = !!initialData;
    const today = new Date().toISOString().slice(0, 10);

    const [form, setForm] = useState({
        vehicle_id: '',
        date: today,
        amount_zmw: '',
        source: 'yango' as IncomeSource,
        period_start: '',
        period_end: '',
        driver_id: '',
        reference: '',
        notes: '',
    });
    const [lateReason, setLateReason] = useState<LateReason>('none');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (initialData) {
            setForm({
                vehicle_id: initialData.vehicle_id,
                date: initialData.date,
                amount_zmw: String(initialData.amount_zmw),
                source: initialData.source,
                period_start: initialData.period_start ?? '',
                period_end: initialData.period_end ?? '',
                driver_id: initialData.driver_id ?? '',
                reference: initialData.reference ?? '',
                notes: initialData.notes ?? '',
            });
        } else {
            setForm({
                vehicle_id: prefill?.vehicle_id ?? vehicles[0]?.id ?? '',
                date: today,
                amount_zmw: '',
                source: 'yango',
                period_start: '',
                period_end: '',
                driver_id: '',
                reference: '',
                notes: '',
            });
        }
        setLateReason('none');
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, vehicles, prefill, initialData]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!open) return null;

    const set = (field: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(prev => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.vehicle_id) { setError('Please select a vehicle.'); return; }
        if (!form.amount_zmw || isNaN(Number(form.amount_zmw)) || Number(form.amount_zmw) <= 0) {
            setError('Please enter a valid amount.'); return;
        }

        setSubmitting(true);

        const payload = {
            vehicle_id: form.vehicle_id,
            date: form.date,
            amount_zmw: Number(form.amount_zmw),
            source: form.source,
            period_start: form.period_start || null,
            period_end: form.period_end || null,
            driver_id: form.driver_id || null,
            reference: form.reference.trim() || null,
            notes: form.notes.trim() || null,
        };

        if (isEdit) {
            const { error: supaErr } = await supabase.from('income').update(payload).eq('id', initialData!.id);
            setSubmitting(false);
            if (supaErr) { setError(supaErr.message); return; }
            onSuccess();
            onClose();
            return;
        }

        // Create mode — honour cashing schedule link
        const cashingStatus =
            lateReason === 'late_driver' ? 'late_driver'
                : lateReason === 'late_admin' ? 'late_admin'
                    : 'recorded';

        const { data: incomeData, error: supaErr } = await supabase
            .from('income')
            .insert({
                ...payload,
                expected_cashing_id: prefill?.expected_cashing_id ?? null,
            })
            .select('id')
            .single();

        if (supaErr) {
            setError(supaErr.message);
            setSubmitting(false);
            return;
        }

        if (prefill?.expected_cashing_id && incomeData?.id) {
            await supabase
                .from('expected_cashings')
                .update({ status: cashingStatus, income_record_id: incomeData.id })
                .eq('id', prefill.expected_cashing_id);
        }

        setSubmitting(false);
        onSuccess();
        onClose();
    };

    const isSalaryWeek = prefill?.is_salary_week ?? false;
    const isFromReminder = !!prefill?.expected_cashing_id;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--ff-surface)',
                border: '1px solid var(--ff-border)',
                borderRadius: 16, width: '100%', maxWidth: 480, padding: 28,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        {isEdit ? 'Edit Income Record' : 'Add Income Record'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                {isSalaryWeek && !isEdit && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#a855f715', border: '1px solid #a855f740', fontSize: 13, color: '#a855f7', display: 'flex', gap: 8 }}>
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                        This is the salary week — remember to log driver salary and any service costs as separate expenses.
                    </div>
                )}

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={LABEL_STYLE}>Vehicle *</label>
                        <select style={INPUT_STYLE} value={form.vehicle_id} onChange={set('vehicle_id')}>
                            {vehicles.length === 0
                                ? <option value="">No vehicles registered yet</option>
                                : vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Cashing Date *</label>
                            <input type="date" style={INPUT_STYLE} value={form.date} onChange={set('date')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Source *</label>
                            <select style={INPUT_STYLE} value={form.source} onChange={set('source')}>
                                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Period From</label>
                            <input type="date" style={INPUT_STYLE} value={form.period_start} onChange={set('period_start')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Period To</label>
                            <input type="date" style={INPUT_STYLE} value={form.period_end} onChange={set('period_end')} />
                        </div>
                    </div>
                    <p style={{ marginTop: -8, fontSize: 11, color: 'var(--ff-text-muted)' }}>
                        The week this cashing covers (gross amount before deductions).
                    </p>

                    <div>
                        <label style={LABEL_STYLE}>Gross Amount (ZMW) *</label>
                        <input type="number" min="0.01" step="0.01" style={INPUT_STYLE} placeholder="0.00"
                            value={form.amount_zmw} onChange={set('amount_zmw')} autoFocus />
                    </div>

                    {drivers.length > 0 && (
                        <div>
                            <label style={LABEL_STYLE}>Driver (optional)</label>
                            <select style={INPUT_STYLE} value={form.driver_id} onChange={set('driver_id')}>
                                <option value="">— Select driver —</option>
                                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label style={LABEL_STYLE}>Reference / Trip ID</label>
                        <input style={INPUT_STYLE} placeholder="e.g. Yango payout ref, invoice #"
                            value={form.reference} onChange={set('reference')} />
                    </div>

                    {isFromReminder && !isEdit && (
                        <div>
                            <label style={LABEL_STYLE}>Was the cashing late?</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {([
                                    { val: 'none', label: 'No — cashing was on time' },
                                    { val: 'late_driver', label: 'Yes — driver was late' },
                                    { val: 'late_admin', label: 'No — I forgot to log it' },
                                ] as { val: LateReason; label: string }[]).map(opt => (
                                    <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--ff-text-primary)' }}>
                                        <input type="radio" name="lateReason" value={opt.val}
                                            checked={lateReason === opt.val}
                                            onChange={() => setLateReason(opt.val)}
                                            style={{ accentColor: 'var(--ff-accent)' }}
                                        />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={LABEL_STYLE}>Notes</label>
                        <textarea rows={2} style={{ ...INPUT_STYLE, resize: 'vertical' } as React.CSSProperties}
                            placeholder="Any additional notes…" value={form.notes} onChange={set('notes')} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-navy)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)',
                        }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            fontWeight: 600, background: submitting ? '#334155' : '#22c55e',
                            color: 'white', border: 'none',
                        }}>{submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Income'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
