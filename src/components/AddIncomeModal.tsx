import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, IncomeSource } from '../types';

interface AddIncomeModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
}

const SOURCES: { value: IncomeSource; label: string }[] = [
    { value: 'yango', label: 'Yango' },
    { value: 'rental', label: 'Rental' },
    { value: 'other', label: 'Other' },
];

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

export function AddIncomeModal({ open, onClose, onSuccess, vehicles }: AddIncomeModalProps) {
    const [form, setForm] = useState({
        vehicle_id: '',
        date: new Date().toISOString().slice(0, 10),
        amount_zmw: '',
        source: 'yango' as IncomeSource,
        reference: '',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm({
                vehicle_id: vehicles[0]?.id ?? '',
                date: new Date().toISOString().slice(0, 10),
                amount_zmw: '',
                source: 'yango',
                reference: '',
                notes: '',
            });
            setError(null);
        }
    }, [open, vehicles]);

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
        const { error: supaErr } = await supabase.from('income').insert({
            vehicle_id: form.vehicle_id,
            date: form.date,
            amount_zmw: Number(form.amount_zmw),
            source: form.source,
            reference: form.reference.trim() || null,
            notes: form.notes.trim() || null,
        });
        setSubmitting(false);

        if (supaErr) { setError(supaErr.message); }
        else { onSuccess(); onClose(); }
    };

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
                borderRadius: 16, width: '100%', maxWidth: 460, padding: 28,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>Add Income Record</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-muted)', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Vehicle */}
                    <div>
                        <label style={LABEL_STYLE}>Vehicle *</label>
                        <select style={INPUT_STYLE} value={form.vehicle_id} onChange={set('vehicle_id')}>
                            {vehicles.length === 0
                                ? <option value="">No vehicles registered yet</option>
                                : vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                        </select>
                    </div>

                    {/* Date / Source */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Date *</label>
                            <input type="date" style={INPUT_STYLE} value={form.date} onChange={set('date')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Source *</label>
                            <select style={INPUT_STYLE} value={form.source} onChange={set('source')}>
                                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label style={LABEL_STYLE}>Amount (ZMW) *</label>
                        <input type="number" min="0.01" step="0.01" style={INPUT_STYLE} placeholder="0.00"
                            value={form.amount_zmw} onChange={set('amount_zmw')} autoFocus />
                    </div>

                    {/* Reference */}
                    <div>
                        <label style={LABEL_STYLE}>Reference / Trip ID</label>
                        <input style={INPUT_STYLE} placeholder="e.g. Yango payout ref, invoice #"
                            value={form.reference} onChange={set('reference')} />
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={LABEL_STYLE}>Notes</label>
                        <textarea rows={2} style={{ ...INPUT_STYLE, resize: 'vertical' } as React.CSSProperties}
                            placeholder="Any additional notes…" value={form.notes} onChange={set('notes')} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-navy)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)', cursor: 'pointer',
                        }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            fontWeight: 600, background: submitting ? '#334155' : '#22c55e',
                            color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                        }}>{submitting ? 'Saving…' : 'Add Income'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
