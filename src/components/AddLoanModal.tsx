import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { Driver } from '../types';

interface AddLoanModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    drivers: Driver[];
    initialDriverId?: string;
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

export function AddLoanModal({ open, onClose, onSuccess, drivers, initialDriverId }: AddLoanModalProps) {
    const { activeWorkspaceId } = useWorkspace();
    const today = new Date().toISOString().slice(0, 10);

    const [form, setForm] = useState({
        driver_id: '',
        amount_zmw: '',
        repayment_type: 'salary_deduction',
        deduction_per_week_zmw: '',
        notes: '',
        issued_date: today,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setForm({
            driver_id: initialDriverId ?? drivers[0]?.id ?? '',
            amount_zmw: '',
            repayment_type: 'salary_deduction',
            deduction_per_week_zmw: '',
            notes: '',
            issued_date: today,
        });
        setError(null);
    }, [open, drivers, initialDriverId, today]);

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

        if (!form.driver_id) { setError('Please select a driver.'); return; }
        
        const amount = Number(form.amount_zmw);
        if (!form.amount_zmw || isNaN(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(form.amount_zmw)) {
            setError('Enter a valid loan amount (greater than 0, max 2 decimal places).');
            return;
        }

        const deduction = Number(form.deduction_per_week_zmw);
        if (form.repayment_type === 'salary_deduction' && (!form.deduction_per_week_zmw || isNaN(deduction) || deduction <= 0 || !/^\d+(\.\d{1,2})?$/.test(form.deduction_per_week_zmw))) {
            setError('Enter a valid weekly deduction amount (greater than 0, max 2 decimal places).');
            return;
        }

        setSubmitting(true);

        const { error: supaErr } = await supabase
            .from('driver_advances')
            .insert({
                workspace_id: activeWorkspaceId,
                driver_id: form.driver_id,
                amount_zmw: amount,
                issued_date: form.issued_date,
                repayment_type: form.repayment_type,
                deduction_per_week_zmw: form.repayment_type === 'salary_deduction' ? deduction : 0,
                remaining_balance_zmw: amount,
                notes: form.notes.trim() || null,
                status: 'active',
            });

        setSubmitting(false);

        if (supaErr) {
            setError(supaErr.message);
            return;
        }

        onSuccess();
        onClose();
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
                        Issue Loan / Salary Advance
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
                        <label style={LABEL_STYLE}>Driver *</label>
                        <select style={INPUT_STYLE} value={form.driver_id} onChange={set('driver_id')}>
                            <option value="">— Select driver —</option>
                            {drivers.map(d => (
                                <option key={d.id} value={d.id}>{d.name} {d.phone ? `(${d.phone})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={LABEL_STYLE}>Loan Amount (ZMW) *</label>
                            <input type="number" min="0.01" step="0.01" style={INPUT_STYLE} placeholder="0.00"
                                value={form.amount_zmw} onChange={set('amount_zmw')} autoFocus />
                        </div>
                        <div>
                            <label style={LABEL_STYLE}>Date Issued *</label>
                            <input type="date" style={INPUT_STYLE} value={form.issued_date} onChange={set('issued_date')} />
                        </div>
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Repayment Type</label>
                        <select style={INPUT_STYLE} value={form.repayment_type} onChange={set('repayment_type')}>
                            <option value="salary_deduction">Auto-deduct from Salary Week</option>
                            <option value="cash">Cash Payouts / Hand Delivery</option>
                            <option value="other">Other / Custom Agreements</option>
                        </select>
                    </div>

                    {form.repayment_type === 'salary_deduction' && (
                        <div>
                            <label style={LABEL_STYLE}>Weekly Deduction Amount (ZMW) *</label>
                            <input type="number" min="0.01" step="0.01" style={INPUT_STYLE} placeholder="0.00"
                                value={form.deduction_per_week_zmw} onChange={set('deduction_per_week_zmw')} />
                            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--ff-text-muted)' }}>
                                This amount will be subtracted from the driver's payout on each salary week until repaid.
                            </p>
                        </div>
                    )}

                    <div>
                        <label style={LABEL_STYLE}>Notes / Agreements</label>
                        <textarea rows={2} style={{ ...INPUT_STYLE, resize: 'vertical' } as React.CSSProperties}
                            placeholder="Repayment details, driver signatures notes, etc..."
                            value={form.notes} onChange={set('notes')} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-surface)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)',
                        }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            fontWeight: 600, background: submitting ? '#334155' : 'var(--ff-accent)',
                            color: 'white', border: 'none',
                        }}>{submitting ? 'Saving…' : 'Issue Advance'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
