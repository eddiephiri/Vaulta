import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
}

const INITIAL = {
    name: '',
    phone: '',
    license_number: '',
    vehicle_id: '',
    salary_zmw: '',
    hire_date: '',
    notes: '',
    active: true,
};

export function AddDriverModal({ open, onClose, onSuccess, vehicles }: Props) {
    const [form, setForm] = useState(INITIAL);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    const set = (k: keyof typeof INITIAL, v: string | boolean) =>
        setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('Driver name is required'); return; }

        setSaving(true);
        setError(null);

        const payload = {
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            license_number: form.license_number.trim() || null,
            vehicle_id: form.vehicle_id || null,
            salary_zmw: parseFloat(form.salary_zmw) || 0,
            hire_date: form.hire_date || null,
            notes: form.notes.trim() || null,
            active: form.active,
        };

        const { error: supaErr } = await supabase.from('drivers').insert(payload);

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setForm(INITIAL);
            onSuccess();
            onClose();
        }
        setSaving(false);
    };

    const inputStyle = {
        background: 'var(--ff-navy)',
        border: '1px solid var(--ff-border)',
        color: 'var(--ff-text-primary)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '14px',
        width: '100%',
    } as React.CSSProperties;

    const labelStyle = {
        fontSize: '12px',
        color: 'var(--ff-text-muted)',
        marginBottom: '4px',
        display: 'block',
    } as React.CSSProperties;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-md rounded-2xl p-6 relative"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>

                <button onClick={onClose} className="absolute top-4 right-4"
                    style={{ color: 'var(--ff-text-muted)' }}>
                    <X size={18} />
                </button>

                <h2 className="text-lg font-bold mb-5">Add Driver</h2>

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm"
                        style={{ background: '#ef444420', color: '#ef4444' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <label style={labelStyle}>Full Name *</label>
                        <input
                            style={inputStyle}
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="e.g. John Banda"
                            required
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label style={labelStyle}>Phone Number</label>
                        <input
                            style={inputStyle}
                            value={form.phone}
                            onChange={e => set('phone', e.target.value)}
                            placeholder="e.g. +260 977 000 000"
                        />
                    </div>

                    {/* License */}
                    <div>
                        <label style={labelStyle}>Driving Licence Number</label>
                        <input
                            style={inputStyle}
                            value={form.license_number}
                            onChange={e => set('license_number', e.target.value)}
                            placeholder="e.g. ZM123456"
                        />
                    </div>

                    {/* Vehicle */}
                    <div>
                        <label style={labelStyle}>Assigned Vehicle</label>
                        <select
                            style={inputStyle}
                            value={form.vehicle_id}
                            onChange={e => set('vehicle_id', e.target.value)}
                        >
                            <option value="">— No vehicle assigned —</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.plate} — {v.make} {v.model}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Salary */}
                    <div>
                        <label style={labelStyle}>Monthly Salary (ZMW)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            style={inputStyle}
                            value={form.salary_zmw}
                            onChange={e => set('salary_zmw', e.target.value)}
                            placeholder="0.00"
                        />
                    </div>

                    {/* Hire Date */}
                    <div>
                        <label style={labelStyle}>Hire Date</label>
                        <input
                            type="date"
                            style={inputStyle}
                            value={form.hire_date}
                            onChange={e => set('hire_date', e.target.value)}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={labelStyle}>Notes</label>
                        <textarea
                            rows={2}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="Any additional notes…"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-lg text-sm font-medium"
                            style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2 rounded-lg text-sm font-medium"
                            style={{ background: 'var(--ff-accent)', color: 'white', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? 'Saving…' : 'Add Driver'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
