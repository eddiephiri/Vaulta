import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, ServiceRecord } from '../types';

interface AddServiceModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    initialData?: ServiceRecord;
}

const SERVICE_TYPES = [
    'Engine oil change', 'Oil filter replacement', 'Air filter replacement',
    'Fuel filter replacement', 'Cabin filter replacement',
    'Brake pads replacement', 'Brake disc resurfacing', 'Brake fluid flush',
    'Tyre rotation', 'Wheel alignment', 'Wheel balancing',
    'Coolant flush', 'Transmission service', 'Spark plug replacement',
    'Battery replacement', 'Timing belt replacement', 'General service',
    'Electrical repair', 'Suspension repair', 'Body work / panel beating', 'Other',
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

export function AddServiceModal({ open, onClose, onSuccess, vehicles, initialData }: AddServiceModalProps) {
    const isEdit = !!initialData;

    const [form, setForm] = useState({
        vehicle_id: '',
        date: new Date().toISOString().slice(0, 10),
        description: 'Engine oil change',
        descriptionOther: '',
        service_provider: '',
        cost_zmw: '',
        odometer_km: '',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (initialData) {
            const knownDesc = SERVICE_TYPES.includes(initialData.description) ? initialData.description : 'Other';
            setForm({
                vehicle_id: initialData.vehicle_id,
                date: initialData.date,
                description: knownDesc,
                descriptionOther: knownDesc === 'Other' ? initialData.description : '',
                service_provider: initialData.service_provider ?? '',
                cost_zmw: String(initialData.cost_zmw),
                odometer_km: initialData.odometer_km != null ? String(initialData.odometer_km) : '',
                notes: initialData.notes ?? '',
            });
        } else {
            setForm({
                vehicle_id: vehicles[0]?.id ?? '',
                date: new Date().toISOString().slice(0, 10),
                description: 'Engine oil change',
                descriptionOther: '',
                service_provider: '',
                cost_zmw: '',
                odometer_km: '',
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

        const resolvedDesc = form.description === 'Other' ? form.descriptionOther.trim() : form.description;

        if (!form.vehicle_id) { setError('Please select a vehicle.'); return; }
        if (!resolvedDesc) { setError('Please specify a service description.'); return; }
        if (!form.cost_zmw || isNaN(Number(form.cost_zmw)) || Number(form.cost_zmw) < 0) {
            setError('Please enter a valid cost.'); return;
        }

        setSubmitting(true);
        const payload = {
            vehicle_id: form.vehicle_id,
            date: form.date,
            description: resolvedDesc,
            service_provider: form.service_provider.trim() || null,
            cost_zmw: Number(form.cost_zmw),
            odometer_km: form.odometer_km ? Number(form.odometer_km) : null,
            notes: form.notes.trim() || null,
        };

        const { error: supaErr } = isEdit
            ? await supabase.from('service_history').update(payload).eq('id', initialData!.id)
            : await supabase.from('service_history').insert(payload);
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
                borderRadius: 16, width: '100%', maxWidth: 500, padding: 28,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        {isEdit ? 'Edit Service Record' : 'Log Service Event'}
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
                        <label style={LABEL_STYLE}>Service Date *</label>
                        <input type="date" style={INPUT_STYLE} value={form.date} onChange={set('date')} />
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Service Type *</label>
                        <select style={INPUT_STYLE} value={form.description} onChange={set('description')}>
                            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {form.description === 'Other' && (
                            <input style={{ ...INPUT_STYLE, marginTop: 8 }} placeholder="Describe the service"
                                value={form.descriptionOther} onChange={set('descriptionOther')} autoFocus />
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Service Provider</label>
                            <input style={INPUT_STYLE} placeholder="e.g. ABC Garage" value={form.service_provider} onChange={set('service_provider')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Cost (ZMW) *</label>
                            <input type="number" min="0" step="0.01" style={INPUT_STYLE} placeholder="0.00" value={form.cost_zmw} onChange={set('cost_zmw')} />
                        </div>
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Odometer at Service (km)</label>
                        <input type="number" min="0" style={INPUT_STYLE} placeholder="e.g. 45000" value={form.odometer_km} onChange={set('odometer_km')} />
                    </div>

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
                            fontWeight: 600, background: submitting ? '#334155' : 'var(--ff-accent)',
                            color: 'white', border: 'none',
                        }}>{submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Service'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
