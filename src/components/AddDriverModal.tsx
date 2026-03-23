import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, Driver } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    initialData?: Driver;
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

export function AddDriverModal({ open, onClose, onSuccess, vehicles, initialData }: Props) {
    const isEdit = !!initialData;

    const [form, setForm] = useState(INITIAL);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (initialData) {
            setForm({
                name: initialData.name,
                phone: initialData.phone ?? '',
                license_number: initialData.license_number ?? '',
                vehicle_id: initialData.vehicle_id ?? '',
                salary_zmw: String(initialData.salary_zmw ?? ''),
                hire_date: initialData.hire_date ?? '',
                notes: initialData.notes ?? '',
                active: initialData.active ?? true,
            });
        } else {
            setForm(INITIAL);
        }
        setError(null);
    }, [open, initialData]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

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

        const { error: supaErr } = isEdit
            ? await supabase.from('drivers').update(payload).eq('id', initialData!.id)
            : await supabase.from('drivers').insert(payload);

        if (supaErr) {
            setError(supaErr.message);
        } else {
            if (!isEdit) setForm(INITIAL);
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
            <div className="w-full max-w-[min(448px,95vw)] rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>

                <button onClick={onClose} className="absolute top-4 right-4"
                    style={{ color: 'var(--ff-text-muted)' }}>
                    <X size={18} />
                </button>

                <h2 className="text-lg font-bold mb-5">{isEdit ? 'Edit Driver' : 'Add Driver'}</h2>

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm"
                        style={{ background: '#ef444420', color: '#ef4444' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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

                    <div>
                        <label style={labelStyle}>Phone Number</label>
                        <input
                            style={inputStyle}
                            value={form.phone}
                            onChange={e => set('phone', e.target.value)}
                            placeholder="e.g. +260 977 000 000"
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Driving Licence Number</label>
                        <input
                            style={inputStyle}
                            value={form.license_number}
                            onChange={e => set('license_number', e.target.value)}
                            placeholder="e.g. ZM123456"
                        />
                    </div>

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

                    <div>
                        <label style={labelStyle}>Hire Date</label>
                        <input
                            type="date"
                            style={inputStyle}
                            value={form.hire_date}
                            onChange={e => set('hire_date', e.target.value)}
                        />
                    </div>

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

                    {isEdit && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--ff-text-primary)' }}>
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={e => set('active', e.target.checked)}
                                style={{ accentColor: 'var(--ff-accent)', width: 16, height: 16 }}
                            />
                            Active driver
                        </label>
                    )}

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
                            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Driver'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
