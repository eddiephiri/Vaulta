import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, TyrePosition, TyreChange } from '../types';

interface AddTyreModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    initialData?: TyreChange;
}

const TYRE_BRANDS = [
    'Bridgestone', 'Michelin', 'Goodyear', 'Pirelli', 'Continental',
    'Dunlop', 'Yokohama', 'Hankook', 'Kumho', 'Falken', 'Toyo',
    'BF Goodrich', 'Firestone', 'General', 'Uniroyal', 'Other',
];

const POSITIONS: { value: TyrePosition; label: string }[] = [
    { value: 'front_left', label: 'Front Left' },
    { value: 'front_right', label: 'Front Right' },
    { value: 'rear_left', label: 'Rear Left' },
    { value: 'rear_right', label: 'Rear Right' },
    { value: 'spare', label: 'Spare' },
];

const TYRE_SIZES = [
    '155/65R13', '165/70R13', '175/65R14', '185/65R14', '185/70R14',
    '195/65R15', '205/55R16', '205/65R15', '215/60R16', '215/65R16',
    '225/65R17', '235/60R18', '245/65R17', '265/65R17', '265/70R16',
    '31×10.5R15', '33×12.5R15', 'Other',
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

export function AddTyreModal({ open, onClose, onSuccess, vehicles, initialData }: AddTyreModalProps) {
    const isEdit = !!initialData;

    const [form, setForm] = useState({
        vehicle_id: '',
        date: new Date().toISOString().slice(0, 10),
        position: 'front_left' as TyrePosition,
        brand: 'Bridgestone',
        brandOther: '',
        tyre_size: '195/65R15',
        tyreSizeOther: '',
        cost_zmw: '',
        odometer_km: '',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (initialData) {
            const knownBrand = TYRE_BRANDS.includes(initialData.brand ?? '') ? (initialData.brand ?? 'Bridgestone') : 'Other';
            const knownSize = TYRE_SIZES.includes(initialData.tyre_size ?? '') ? (initialData.tyre_size ?? '195/65R15') : 'Other';
            setForm({
                vehicle_id: initialData.vehicle_id,
                date: initialData.date,
                position: initialData.position,
                brand: knownBrand,
                brandOther: knownBrand === 'Other' ? (initialData.brand ?? '') : '',
                tyre_size: knownSize,
                tyreSizeOther: knownSize === 'Other' ? (initialData.tyre_size ?? '') : '',
                cost_zmw: String(initialData.cost_zmw),
                odometer_km: initialData.odometer_km != null ? String(initialData.odometer_km) : '',
                notes: initialData.notes ?? '',
            });
        } else {
            setForm({
                vehicle_id: vehicles[0]?.id ?? '',
                date: new Date().toISOString().slice(0, 10),
                position: 'front_left',
                brand: 'Bridgestone',
                brandOther: '',
                tyre_size: '195/65R15',
                tyreSizeOther: '',
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

        const resolvedBrand = form.brand === 'Other' ? form.brandOther.trim() : form.brand;
        const resolvedSize = form.tyre_size === 'Other' ? form.tyreSizeOther.trim() : form.tyre_size;

        if (!form.vehicle_id) { setError('Please select a vehicle.'); return; }
        if (!form.cost_zmw || isNaN(Number(form.cost_zmw)) || Number(form.cost_zmw) < 0) {
            setError('Please enter a valid cost.'); return;
        }

        setSubmitting(true);
        const payload = {
            vehicle_id: form.vehicle_id,
            date: form.date,
            position: form.position,
            brand: resolvedBrand || null,
            tyre_size: resolvedSize || null,
            cost_zmw: Number(form.cost_zmw),
            odometer_km: form.odometer_km ? Number(form.odometer_km) : null,
            notes: form.notes.trim() || null,
        };

        const { error: supaErr } = isEdit
            ? await supabase.from('tyre_changes').update(payload).eq('id', initialData!.id)
            : await supabase.from('tyre_changes').insert(payload);
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
                borderRadius: 16, width: '100%', maxWidth: 'min(500px, 95vw)', padding: '24px 20px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        {isEdit ? 'Edit Tyre Change' : 'Record Tyre Change'}
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Date *</label>
                            <input type="date" style={INPUT_STYLE} value={form.date} onChange={set('date')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Position *</label>
                            <select style={INPUT_STYLE} value={form.position} onChange={set('position')}>
                                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Brand</label>
                        <select style={INPUT_STYLE} value={form.brand} onChange={set('brand')}>
                            {TYRE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {form.brand === 'Other' && (
                            <input style={{ ...INPUT_STYLE, marginTop: 8 }} placeholder="Enter brand name"
                                value={form.brandOther} onChange={set('brandOther')} />
                        )}
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Tyre Size</label>
                        <select style={INPUT_STYLE} value={form.tyre_size} onChange={set('tyre_size')}>
                            {TYRE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {form.tyre_size === 'Other' && (
                            <input style={{ ...INPUT_STYLE, marginTop: 8 }} placeholder="e.g. 205/75R15"
                                value={form.tyreSizeOther} onChange={set('tyreSizeOther')} />
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Cost (ZMW) *</label>
                            <input type="number" min="0" step="0.01" style={INPUT_STYLE} placeholder="0.00" value={form.cost_zmw} onChange={set('cost_zmw')} />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Odometer (km)</label>
                            <input type="number" min="0" style={INPUT_STYLE} placeholder="e.g. 45000" value={form.odometer_km} onChange={set('odometer_km')} />
                        </div>
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
                        }}>{submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Tyre Change'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
