import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X, ArrowLeftRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ExpectedCashing } from '../types';

interface SwapWeeksModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    vehicleId: string;
    vehiclePlate: string;
}

const INPUT_STYLE = {
    background: 'var(--ff-surface)',
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

export function SwapWeeksModal({ open, onClose, onSuccess, vehicleId, vehiclePlate }: SwapWeeksModalProps) {
    const [cashings, setCashings] = useState<ExpectedCashing[]>([]);
    const [loading, setLoading] = useState(true);
    const [id1, setId1] = useState('');
    const [id2, setId2] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !vehicleId) return;
        
        let isMounted = true;
        setLoading(true);
        setError(null);
        setId1('');
        setId2('');

        const fetchUpcoming = async () => {
            // Fetch upcoming cashings (limit to 12 weeks/cycle weeks)
            const { data, error: err } = await supabase
                .from('expected_cashings')
                .select('*')
                .eq('vehicle_id', vehicleId)
                .order('expected_date', { ascending: true })
                .limit(12);

            if (isMounted) {
                setLoading(false);
                if (err) {
                    setError(err.message);
                } else if (data) {
                    setCashings(data as ExpectedCashing[]);
                    
                    // Pre-select the current salary week as first, and another week as second
                    const salaryWk = data.find(c => c.is_salary_week);
                    const nonSalaryWk = data.find(c => !c.is_salary_week && c.status === 'pending');
                    if (salaryWk) setId1(salaryWk.id);
                    if (nonSalaryWk) setId2(nonSalaryWk.id);
                }
            }
        };

        fetchUpcoming();
        return () => { isMounted = false; };
    }, [open, vehicleId]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!open) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!id1 || !id2) {
            setError('Please select two weeks to swap.');
            return;
        }

        if (id1 === id2) {
            setError('Cannot swap a week with itself. Please select two different weeks.');
            return;
        }

        const wk1 = cashings.find(c => c.id === id1);
        const wk2 = cashings.find(c => c.id === id2);

        if (wk1 && wk2 && wk1.is_salary_week === wk2.is_salary_week) {
            setError('At least one of the selected weeks must be a Salary Week, and the other must be a Cashing Week to perform a swap.');
            return;
        }

        setSubmitting(true);

        const { error: rpcErr } = await supabase.rpc('swap_cashing_weeks', {
            p_cashing_id_1: id1,
            p_cashing_id_2: id2,
        });

        setSubmitting(false);

        if (rpcErr) {
            setError(rpcErr.message);
            return;
        }

        onSuccess();
        onClose();
    };

    const fmt = (c: ExpectedCashing) => {
        const dateStr = new Date(c.expected_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        return `Week ${c.week_number} (${dateStr}) — ${c.is_salary_week ? '💼 Salary Week' : '🪙 Cashing Week'} [${c.status}]`;
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
                borderRadius: 16, width: '100%', maxWidth: 'min(440px, 95vw)', padding: '24px 20px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        Swap Salary & Cashing Weeks
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: 16 }} className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl">
                    <p style={{ fontSize: 13, color: 'var(--ff-text-muted)', marginBottom: 2 }}>Vehicle</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ff-text-primary)' }}>{vehiclePlate}</p>
                </div>

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--ff-accent)' }} />
                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Loading schedule weeks…</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={LABEL_STYLE}>Select First Week</label>
                            <select style={INPUT_STYLE} value={id1} onChange={e => setId1(e.target.value)}>
                                <option value="">— Select week —</option>
                                {cashings.map(c => (
                                    <option key={c.id} value={c.id}>{fmt(c)}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-center my-1 text-slate-400">
                            <ArrowLeftRight size={18} />
                        </div>

                        <div>
                            <label style={LABEL_STYLE}>Select Second Week</label>
                            <select style={INPUT_STYLE} value={id2} onChange={e => setId2(e.target.value)}>
                                <option value="">— Select week —</option>
                                {cashings.map(c => (
                                    <option key={c.id} value={c.id}>{fmt(c)}</option>
                                ))}
                            </select>
                        </div>

                        <p className="text-xs" style={{ color: 'var(--ff-text-muted)', lineHeight: '1.4' }}>
                            Swapping will trade the salary payouts and weekly cashing responsibilities between the two selected dates. Ensure at least one is currently designated as a Salary Week.
                        </p>

                        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                            <button type="button" onClick={onClose} style={{
                                flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                                background: 'var(--ff-surface)', color: 'var(--ff-text-muted)',
                                border: '1px solid var(--ff-border)',
                            }}>Cancel</button>
                            <button type="submit" disabled={submitting} style={{
                                flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                                fontWeight: 600, background: submitting ? '#334155' : 'var(--ff-accent)',
                                color: 'white', border: 'none',
                            }}>{submitting ? 'Swapping…' : 'Swap Weeks'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
