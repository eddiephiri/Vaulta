import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, LicenseType, LicenseRecord } from '../types';

interface AddLicenseModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    initialData?: LicenseRecord;
}

const LICENSE_TYPES: { value: LicenseType; label: string }[] = [
    { value: 'road_tax', label: 'Road Tax' },
    { value: 'fitness_certificate', label: 'Fitness Certificate' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'council_permit', label: 'Council Permit' },
    { value: 'other', label: 'Other' },
];

const REMINDER_DAYS = [
    { value: '7', label: '7 days before' },
    { value: '14', label: '14 days before' },
    { value: '30', label: '30 days before' },
    { value: '60', label: '60 days before' },
    { value: '90', label: '90 days before' },
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

export function AddLicenseModal({ open, onClose, onSuccess, vehicles, initialData }: AddLicenseModalProps) {
    const isEdit = !!initialData;
    const today = new Date().toISOString().slice(0, 10);

    const [form, setForm] = useState({
        vehicle_id: '',
        license_type: 'road_tax' as LicenseType,
        issued_date: today,
        expiry_date: '',
        cost_zmw: '',
        reminder_days_before: '30',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (initialData) {
            setForm({
                vehicle_id: initialData.vehicle_id,
                license_type: initialData.license_type,
                issued_date: initialData.issued_date,
                expiry_date: initialData.expiry_date,
                cost_zmw: String(initialData.cost_zmw),
                reminder_days_before: String(initialData.reminder_days_before ?? 30),
                notes: initialData.notes ?? '',
            });
        } else {
            setForm({
                vehicle_id: vehicles[0]?.id ?? '',
                license_type: 'road_tax',
                issued_date: today,
                expiry_date: '',
                cost_zmw: '',
                reminder_days_before: '30',
                notes: '',
            });
        }
        setError(null);
    }, [open, initialData, vehicles]);

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
        if (!form.expiry_date) { setError('Expiry date is required.'); return; }
        if (form.expiry_date <= form.issued_date) { setError('Expiry date must be after issue date.'); return; }
        if (!form.cost_zmw || isNaN(Number(form.cost_zmw)) || Number(form.cost_zmw) < 0) {
            setError('Please enter a valid cost.'); return;
        }

        setSubmitting(true);
        const payload = {
            vehicle_id: form.vehicle_id,
            license_type: form.license_type,
            issued_date: form.issued_date,
            expiry_date: form.expiry_date,
            cost_zmw: Number(form.cost_zmw),
            reminder_days_before: Number(form.reminder_days_before),
            notes: form.notes.trim() || null,
        };

        const { error: supaErr } = isEdit
            ? await supabase.from('licensing').update(payload).eq('id', initialData!.id)
            : await supabase.from('licensing').insert(payload);
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
                borderRadius: 16, width: '100%', maxWidth: 480, padding: 28,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        {isEdit ? 'Edit License Record' : 'Add License Record'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

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

                    <div>
                        <label style={LABEL_STYLE}>License Type *</label>
                        <select style={INPUT_STYLE} value={form.license_type} onChange={set('license_type')}>
                            {LICENSE_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Issue Date *</label>
                            <input type="date" style={INPUT_STYLE} value={form.issued_date} onChange={set('issued_date')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Expiry Date *</label>
                            <input type="date" style={INPUT_STYLE} value={form.expiry_date} onChange={set('expiry_date')} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Cost (ZMW) *</label>
                            <input type="number" min="0" step="0.01" style={INPUT_STYLE} placeholder="0.00" value={form.cost_zmw} onChange={set('cost_zmw')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Reminder</label>
                            <select style={INPUT_STYLE} value={form.reminder_days_before} onChange={set('reminder_days_before')}>
                                {REMINDER_DAYS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Notes</label>
                        <textarea rows={2} style={{ ...INPUT_STYLE, resize: 'vertical' } as React.CSSProperties}
                            placeholder="e.g. Certificate number, issuing authority…" value={form.notes} onChange={set('notes')} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-navy)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)',
                        }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            fontWeight: 600, background: submitting ? '#334155' : 'var(--ff-accent)',
                            color: 'white', border: 'none',
                        }}>{submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add License'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
