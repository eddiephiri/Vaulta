import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X, Copy, Check, KeyRound, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Driver } from '../types';

interface ProvisionDriverModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    driver: Driver | null;
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

interface Credentials {
    phone: string;
    temp_password: string;
}

export function ProvisionDriverModal({ open, onClose, onSuccess, driver }: ProvisionDriverModalProps) {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<Credentials | null>(null);
    const [copied, setCopied] = useState<'phone' | 'password' | null>(null);

    useEffect(() => {
        if (open) {
            setPhone(driver?.phone ?? '');
            setError(null);
            setResult(null);
            setCopied(null);
        }
    }, [open, driver]);

    if (!open || !driver) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!phone.trim()) { setError('A phone number is required.'); return; }
        setError(null);
        setLoading(true);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('provision-driver', {
                body: { driver_id: driver.id, phone: phone.trim() },
            });
            if (fnError) throw fnError;
            if (data?.error) throw new Error(data.error);

            setResult({ phone: data.phone, temp_password: data.temp_password });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to set up the driver login.');
        } finally {
            setLoading(false);
        }
    };

    const copy = (field: 'phone' | 'password', value: string) => {
        navigator.clipboard.writeText(value);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--ff-surface)', border: '1px solid var(--ff-border)',
                borderRadius: 16, width: '100%', maxWidth: 'min(440px, 95vw)', padding: '24px 20px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        {result ? 'Login Created' : `Set Up App Access`}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                {result ? (
                    <div className="flex flex-col">
                        <div className="self-center w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: '#22c55e15', color: '#22c55e' }}>
                            <KeyRound size={28} />
                        </div>
                        <p className="text-sm text-center mb-4" style={{ color: 'var(--ff-text-muted)' }}>
                            Share these credentials with <strong>{driver.name}</strong>. They sign in with their
                            phone number and will be asked to change the password.
                        </p>

                        {([
                            { label: 'Phone', field: 'phone' as const, value: result.phone, mono: false },
                            { label: 'Temporary Password', field: 'password' as const, value: result.temp_password, mono: true },
                        ]).map(row => (
                            <div key={row.field} style={{ marginBottom: 12 }}>
                                <label style={LABEL_STYLE}>{row.label}</label>
                                <div className="flex items-center gap-2 p-3 rounded-xl border"
                                    style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                                    <span className={`flex-1 text-base ${row.mono ? 'font-mono tracking-wide' : ''}`}
                                        style={{ color: 'var(--ff-text-primary)', wordBreak: 'break-all' }}>
                                        {row.value}
                                    </span>
                                    <button onClick={() => copy(row.field, row.value)} className="p-2 rounded-lg"
                                        style={{ color: copied === row.field ? '#22c55e' : 'var(--ff-text-muted)' }}>
                                        {copied === row.field ? <Check size={18} /> : <Copy size={18} />}
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="flex items-start gap-2 p-3 rounded-lg mt-2" style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}>
                            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                            <p className="text-xs" style={{ color: '#f59e0b' }}>
                                The password is shown only once. Copy it now — it can't be retrieved later.
                            </p>
                        </div>

                        <button onClick={onClose} className="w-full mt-6 py-3 rounded-xl font-bold text-white"
                            style={{ background: 'var(--ff-accent)' }}>
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                            Create a phone-based login for <strong>{driver.name}</strong> so they can view their
                            cashing schedule and manage their profile.
                        </p>

                        {error && (
                            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: 13 }}>
                                {error}
                            </div>
                        )}

                        <div>
                            <label style={LABEL_STYLE}>Phone Number *</label>
                            <input style={INPUT_STYLE} placeholder="+260 977 000 000" value={phone}
                                onChange={e => setPhone(e.target.value)} autoFocus />
                            <p style={{ marginTop: 6, fontSize: 11, color: 'var(--ff-text-muted)' }}>
                                Local numbers (e.g. 0977…) are accepted and converted to +260 automatically.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                            <button type="button" onClick={onClose} style={{
                                flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                                background: 'var(--ff-surface)', color: 'var(--ff-text-muted)', border: '1px solid var(--ff-border)',
                            }}>Cancel</button>
                            <button type="submit" disabled={loading} style={{
                                flex: 1.5, padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
                                background: loading ? '#334155' : 'var(--ff-accent)', color: 'white', border: 'none',
                            }}>
                                {loading ? 'Creating…' : 'Create Login'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
