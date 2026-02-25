import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, IncomeSource, Driver } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    drivers: Driver[];  // all drivers (active or inactive) for hire-date lookup
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SOURCES: { value: IncomeSource; label: string }[] = [
    { value: 'yango', label: 'Yango' },
    { value: 'public_transport', label: 'Bus / Public Transport' },
    { value: 'rental', label: 'Vehicle Rental' },
    { value: 'other', label: 'Other' },
];

const INITIAL = {
    vehicle_id: '',
    income_source: 'yango' as IncomeSource,
    cashing_day_of_week: '' as string, // '' = no fixed day
    cycle_weeks: '4',
    salary_week: '4',
    anchor_date: '',   // populated automatically from driver hire_date
    notes: '',
};

export function AddCashingScheduleModal({ open, onClose, onSuccess, vehicles, drivers }: Props) {
    const [form, setForm] = useState(INITIAL);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-fill anchor_date when vehicle changes — use assigned driver's hire_date
    useEffect(() => {
        if (!form.vehicle_id) {
            setForm(f => ({ ...f, anchor_date: '' }));
            return;
        }
        const assignedDriver = drivers.find(d => d.vehicle_id === form.vehicle_id);
        const hireDate = assignedDriver?.hire_date ?? '';
        setForm(f => ({ ...f, anchor_date: f.anchor_date || hireDate }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.vehicle_id]);

    if (!open) return null;

    const set = <K extends keyof typeof INITIAL>(k: K, v: string) =>
        setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.vehicle_id) { setError('Please select a vehicle'); return; }

        const cycleWeeks = parseInt(form.cycle_weeks);
        const salaryWeek = parseInt(form.salary_week);
        if (salaryWeek > cycleWeeks) {
            setError('Salary week cannot be greater than cycle length');
            return;
        }
        if (!form.anchor_date) {
            setError('Please set the cycle start / driver hire date');
            return;
        }

        setSaving(true);
        setError(null);

        const payload = {
            vehicle_id: form.vehicle_id,
            income_source: form.income_source,
            cashing_day_of_week: form.cashing_day_of_week !== '' ? parseInt(form.cashing_day_of_week) : null,
            cycle_weeks: cycleWeeks,
            salary_week: salaryWeek,
            anchor_date: form.anchor_date,
            notes: form.notes.trim() || null,
        };

        const { data, error: supaErr } = await supabase
            .from('cashing_schedules')
            .insert(payload)
            .select('id')
            .single();

        if (supaErr) {
            setError(supaErr.message);
            setSaving(false);
            return;
        }

        // Generate expected cashings for the next 12 weeks anchored to hire_date
        if (data?.id) {
            await supabase.rpc('generate_expected_cashings', {
                p_schedule_id: data.id,
                p_weeks: 12,
            });
        }

        setForm(INITIAL);
        onSuccess();
        onClose();
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
            <div className="w-full max-w-md rounded-2xl p-6 relative overflow-y-auto max-h-[90vh]"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>

                <button onClick={onClose} className="absolute top-4 right-4"
                    style={{ color: 'var(--ff-text-muted)' }}>
                    <X size={18} />
                </button>

                <h2 className="text-lg font-bold mb-1">Add Cashing Schedule</h2>
                <p className="text-xs mb-5" style={{ color: 'var(--ff-text-muted)' }}>
                    Sets up the expected cashing rhythm for a vehicle. Weeks are counted
                    from the driver's hire date so the cycle never drifts.
                </p>

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm"
                        style={{ background: '#ef444420', color: '#ef4444' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Vehicle */}
                    <div>
                        <label style={labelStyle}>Vehicle *</label>
                        <select style={inputStyle} value={form.vehicle_id}
                            onChange={e => set('vehicle_id', e.target.value)} required>
                            <option value="">— Select vehicle —</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.plate} — {v.make} {v.model}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Income Source */}
                    <div>
                        <label style={labelStyle}>Income Source *</label>
                        <select style={inputStyle} value={form.income_source}
                            onChange={e => set('income_source', e.target.value)}>
                            {SOURCES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Anchor Date */}
                    <div>
                        <label style={labelStyle}>Cycle Start Date (Driver Hire Date) *</label>
                        <input type="date" style={inputStyle}
                            value={form.anchor_date}
                            onChange={e => set('anchor_date', e.target.value)}
                            required
                        />
                        <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                            Week 1 of the cycle begins on this date. Auto-filled from the
                            assigned driver's hire date when you select a vehicle.
                        </p>
                    </div>

                    {/* Cashing Day */}
                    <div>
                        <label style={labelStyle}>Fixed Cashing Day</label>
                        <select style={inputStyle} value={form.cashing_day_of_week}
                            onChange={e => set('cashing_day_of_week', e.target.value)}>
                            <option value="">— No fixed day (e.g. bus) —</option>
                            {DAYS.map((d, i) => (
                                <option key={i} value={String(i)}>{d}</option>
                            ))}
                        </select>
                        {form.cashing_day_of_week === '' && (
                            <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                                No fixed day — reminders will be based on weekly intervals only.
                            </p>
                        )}
                    </div>

                    {/* Cycle Weeks */}
                    <div>
                        <label style={labelStyle}>Cycle Length (weeks)</label>
                        <select style={inputStyle} value={form.cycle_weeks}
                            onChange={e => set('cycle_weeks', e.target.value)}>
                            {[2, 3, 4, 5].map(n => (
                                <option key={n} value={String(n)}>{n} weeks</option>
                            ))}
                        </select>
                        <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                            How many weeks before the cycle repeats (default: 4).
                        </p>
                    </div>

                    {/* Salary Week */}
                    <div>
                        <label style={labelStyle}>Salary / Deduction Week</label>
                        <select style={inputStyle} value={form.salary_week}
                            onChange={e => set('salary_week', e.target.value)}>
                            {Array.from({ length: parseInt(form.cycle_weeks) }, (_, i) => i + 1).map(n => (
                                <option key={n} value={String(n)}>Week {n}</option>
                            ))}
                        </select>
                        <p className="text-xs mt-1" style={{ color: 'var(--ff-text-muted)' }}>
                            Which week in the cycle the driver gets paid.
                        </p>
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={labelStyle}>Notes</label>
                        <textarea rows={2}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="e.g. Driver cashes every Wednesday at 5pm"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 rounded-lg text-sm font-medium"
                            style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2 rounded-lg text-sm font-medium"
                            style={{ background: 'var(--ff-accent)', color: 'white', opacity: saving ? 0.7 : 1 }}>
                            {saving ? 'Saving…' : 'Create Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
