import { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface InviteMemberModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
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

export function InviteMemberModal({ open, onClose, onSuccess }: InviteMemberModalProps) {
    const { activeWorkspaceId } = useWorkspace();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('guest');
    const [accessDuration, setAccessDuration] = useState('Permanent');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setEmail('');
            setRole('guest');
            setAccessDuration('Permanent');
            setError(null);
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: invokeErr } = await supabase.functions.invoke('invite-guest', {
                body: {
                    email,
                    role,
                    workspace_id: activeWorkspaceId,
                    access_duration: accessDuration === 'Permanent' ? null : accessDuration
                }
            });

            if (invokeErr) throw invokeErr;
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to send invite.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--ff-surface)', border: '1px solid var(--ff-border)',
                borderRadius: 16, width: '100%', maxWidth: 400, padding: 24
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>Invite Member</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--ff-text-muted)', marginBottom: 4 }}>Email Address *</label>
                        <input type="email" style={INPUT_STYLE} value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="colleague@example.com" />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--ff-text-muted)', marginBottom: 4 }}>Role *</label>
                        <select style={INPUT_STYLE} value={role} onChange={e => setRole(e.target.value)}>
                            <option value="guest">Guest (Limited access)</option>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--ff-text-muted)', marginBottom: 4 }}>Access Duration</label>
                        <select style={INPUT_STYLE} value={accessDuration} onChange={e => setAccessDuration(e.target.value)}>
                            <option value="Permanent">Permanent</option>
                            <option value="1 Day">1 Day</option>
                            <option value="1 Week">1 Week</option>
                            <option value="1 Month">1 Month</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, background: 'var(--ff-navy)', color: 'var(--ff-text-muted)', border: '1px solid var(--ff-border)'
                        }}>Cancel</button>
                        <button type="submit" disabled={loading} style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, background: loading ? '#334155' : 'var(--ff-accent)', color: 'white', border: 'none', fontWeight: 600
                        }}>{loading ? 'Sending...' : 'Send Invite'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
