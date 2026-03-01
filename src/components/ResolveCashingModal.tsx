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

export function ResolveCashingModal({ open, onClose, onSuccess, cashing }: ResolveCashingModalProps) {
    const [status, setStatus] = useState<'recorded' | 'late_driver' | 'late_admin'>('recorded');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setStatus('recorded');
        setNotes('');
        setError(null);
    }, [open]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!open) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        const { error: supaErr } = await supabase
            .from('expected_cashings')
            .update({ status, notes: notes.trim() || null })
            .eq('id', cashing.id);

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
                borderRadius: 16, width: '100%', maxWidth: 400, padding: 28,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        Resolve Overdue Cashing
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: 'var(--ff-text-primary)', marginBottom: 4 }}>
                        <strong>{cashing.vehicle?.plate}</strong> — {cashing.vehicle?.make} {cashing.vehicle?.model}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--ff-text-muted)' }}>
                        Expected {cashing.expected_date} · Week {cashing.week_number}
                    </p>
                </div>

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={LABEL_STYLE}>Resolution Status</label>
                        <select
                            style={INPUT_STYLE}
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'recorded' | 'late_driver' | 'late_admin')}
                        >
                            <option value="recorded">Income already recorded (on time)</option>
                            <option value="late_admin">Income already recorded (I forgot to log it on time)</option>
                            <option value="late_driver">Resolved (driver was late/excused)</option>
                        </select>
                    </div>

                    <div>
                        <label style={LABEL_STYLE}>Notes</label>
                        <textarea
                            rows={3}
                            style={{ ...INPUT_STYLE, resize: 'vertical' } as React.CSSProperties}
                            placeholder="Why is it being resolved manually?"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-navy)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)',
                        }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                            fontWeight: 600, background: submitting ? '#334155' : 'var(--ff-accent)',
                            color: 'white', border: 'none',
                        }}>{submitting ? 'Resolving…' : 'Resolve'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
