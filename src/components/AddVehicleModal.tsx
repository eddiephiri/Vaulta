import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { VehicleStatus } from '../types';

interface AddVehicleModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// ─── Dropdown data ───────────────────────────────────────────────────────────

const MAKES = [
    'Toyota', 'Nissan', 'Mazda', 'Mitsubishi', 'Honda', 'Isuzu',
    'Ford', 'Volkswagen', 'Hyundai', 'Kia', 'Suzuki',
    'Mercedes-Benz', 'BMW', 'Land Rover', 'Jeep', 'Subaru',
    'Chevrolet', 'Peugeot', 'Renault', 'Fiat', 'Other',
];

const COLORS = [
    'White', 'Silver', 'Grey', 'Black', 'Blue', 'Navy Blue',
    'Red', 'Maroon', 'Green', 'Brown', 'Beige', 'Gold',
    'Orange', 'Yellow', 'Purple', 'Other',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear - i); // 2026 → 1990 desc

// ─── Styles ──────────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

export function AddVehicleModal({ open, onClose, onSuccess }: AddVehicleModalProps) {
    const [form, setForm] = useState({
        plate: '',
        make: 'Toyota',
        makeOther: '',
        model: '',
        year: String(currentYear),
        color: 'White',
        colorOther: '',
        status: 'active' as VehicleStatus,
        odometer_km: '0',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm({
                plate: '',
                make: 'Toyota',
                makeOther: '',
                model: '',
                year: String(currentYear),
                color: 'White',
                colorOther: '',
                status: 'active',
                odometer_km: '0',
            });
            setError(null);
        }
    }, [open]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!open) return null;

    const set = (field: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm(prev => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const resolvedMake = form.make === 'Other' ? form.makeOther.trim() : form.make;
        const resolvedColor = form.color === 'Other' ? form.colorOther.trim() : form.color;

        if (!form.plate.trim()) { setError('Plate number is required.'); return; }
        if (!resolvedMake) { setError('Please specify a vehicle make.'); return; }
        if (!form.model.trim()) { setError('Model is required.'); return; }

        setSubmitting(true);
        const { error: supaErr } = await supabase.from('vehicles').insert({
            plate: form.plate.trim().toUpperCase(),
            make: resolvedMake,
            model: form.model.trim(),
            year: Number(form.year),
            color: resolvedColor || 'Unknown',
            status: form.status,
            odometer_km: parseInt(form.odometer_km, 10) || 0,
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
                borderRadius: 16,
                width: '100%',
                maxWidth: 480,
                padding: 28,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh',
                overflowY: 'auto',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>Add Vehicle</h2>
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

                    {/* Plate */}
                    <div>
                        <label style={LABEL_STYLE}>Plate Number *</label>
                        <input
                            style={INPUT_STYLE}
                            placeholder="e.g. ALH 1234 ZM"
                            value={form.plate}
                            onChange={set('plate')}
                            autoFocus
                        />
                    </div>

                    {/* Make */}
                    <div>
                        <label style={LABEL_STYLE}>Make *</label>
                        <select style={INPUT_STYLE} value={form.make} onChange={set('make')}>
                            {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        {form.make === 'Other' && (
                            <input
                                style={{ ...INPUT_STYLE, marginTop: 8 }}
                                placeholder="Enter make"
                                value={form.makeOther}
                                onChange={set('makeOther')}
                                autoFocus
                            />
                        )}
                    </div>

                    {/* Model */}
                    <div>
                        <label style={LABEL_STYLE}>Model *</label>
                        <input
                            style={INPUT_STYLE}
                            placeholder="e.g. Corolla, Hilux, D22"
                            value={form.model}
                            onChange={set('model')}
                        />
                    </div>

                    {/* Year / Color */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Year</label>
                            <select style={INPUT_STYLE} value={form.year} onChange={set('year')}>
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Color</label>
                            <select style={INPUT_STYLE} value={form.color} onChange={set('color')}>
                                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    {form.color === 'Other' && (
                        <div>
                            <label style={LABEL_STYLE}>Specify Color</label>
                            <input
                                style={INPUT_STYLE}
                                placeholder="Enter color"
                                value={form.colorOther}
                                onChange={set('colorOther')}
                            />
                        </div>
                    )}

                    {/* Status / Odometer */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Status</label>
                            <select style={INPUT_STYLE} value={form.status} onChange={set('status')}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="maintenance">Maintenance</option>
                            </select>
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Odometer (km)</label>
                            <input
                                type="number" min="0"
                                style={INPUT_STYLE}
                                placeholder="0"
                                value={form.odometer_km}
                                onChange={set('odometer_km')}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-navy)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)', cursor: 'pointer',
                        }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            fontWeight: 600, background: submitting ? '#334155' : 'var(--ff-accent)',
                            color: 'white', border: 'none',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                        }}>
                            {submitting ? 'Saving…' : 'Add Vehicle'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
