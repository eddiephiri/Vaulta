import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ExpectedCashing } from '../types';

interface ResolveCashingModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    cashing: ExpectedCashing;
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

export function ResolveCashingModal({ open, onClose, onSuccess, cashing }: ResolveCashingModalProps) {
    const [status, setStatus] = useState<ExpectedCashing['status']>('recorded');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [linkedTx, setLinkedTx] = useState<{ amount_zmw: number; date: string; reference?: string } | null>(null);
    const [loadingTx, setLoadingTx] = useState(false);

    useEffect(() => {
        if (!open || !cashing) return;
        setStatus(cashing.status === 'pending' ? 'recorded' : cashing.status);
        setNotes(cashing.notes || '');
        setError(null);

        if (cashing.transaction_id) {
            setLoadingTx(true);
            supabase
                .from('transactions')
                .select('amount_zmw, date, metadata')
                .eq('id', cashing.transaction_id)
                .single()
                .then(({ data }) => {
                    if (data) {
                        setLinkedTx({
                            amount_zmw: data.amount_zmw,
                            date: data.date,
                            reference: (data.metadata as any)?.reference || undefined,
                        });
                    }
                    setLoadingTx(false);
                });
        } else {
            setLinkedTx(null);
        }
    }, [open, cashing]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!open || !cashing) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        const updatePayload: { status: ExpectedCashing['status']; notes: string | null; transaction_id?: string | null } = {
            status,
            notes: notes.trim() || null,
        };

        if (status === 'pending') {
            updatePayload.transaction_id = null;
        }

        const { error: supaErr } = await supabase
            .from('expected_cashings')
            .update(updatePayload)
            .eq('id', cashing.id);

        setSubmitting(false);

        if (supaErr) {
            setError(supaErr.message);
            return;
        }

        onSuccess();
        onClose();
    };

    const isPending = cashing.status === 'pending';

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        {isPending ? 'Resolve Cashing Reminder' : 'Update Cashing Record'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4, cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: 'var(--ff-bg)', border: '1px solid var(--ff-border)' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ff-text-primary)', marginBottom: 2 }}>
                        {cashing.vehicle?.plate} — {cashing.vehicle?.make} {cashing.vehicle?.model}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--ff-text-muted)' }}>
                        Expected {cashing.expected_date} · Week {cashing.week_number}
                        {cashing.is_salary_week && ' (Salary Week)'}
                    </p>
                    {loadingTx && <p style={{ fontSize: 11, color: 'var(--ff-text-muted)', marginTop: 4 }}>Loading transaction details…</p>}
                    {linkedTx && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--ff-border)', fontSize: 12 }}>
                            <p style={{ color: '#22c55e', fontWeight: 600 }}>
                                Recorded: ZMW {linkedTx.amount_zmw.toLocaleString('en-ZM', { minimumFractionDigits: 2 })} on {linkedTx.date}
                            </p>
                            {linkedTx.reference && (
                                <p style={{ color: 'var(--ff-text-muted)', fontSize: 11, marginTop: 2 }}>
                                    Ref: <span style={{ fontFamily: 'monospace' }}>{linkedTx.reference}</span>
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={LABEL_STYLE}>Schedule Status</label>
                        <select
                            style={INPUT_STYLE}
                            value={status}
                            onChange={(e) => setStatus(e.target.value as ExpectedCashing['status'])}
                        >
                            <option value="recorded">Collected / Recorded (On Time)</option>
                            <option value="late_driver">Collected (Late by Driver)</option>
                            <option value="late_admin">Collected (Late by Admin)</option>
                            <option value="deferred_to_salary">Deferred to Salary Week</option>
                            <option value="pending">Pending (Uncollected)</option>
                        </select>
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Notes</label>
                        <textarea
                            rows={3}
                            style={{ ...INPUT_STYLE, resize: 'vertical' } as React.CSSProperties}
                            placeholder="Add notes about this cashing..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-surface)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)',
                            cursor: 'pointer',
                        }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            fontWeight: 600, background: submitting ? '#334155' : 'var(--ff-accent)',
                            color: 'white', border: 'none',
                            cursor: 'pointer',
                        }}>{submitting ? 'Saving…' : isPending ? 'Resolve' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
