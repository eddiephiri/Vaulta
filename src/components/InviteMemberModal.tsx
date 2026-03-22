import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X, Copy, Check, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { APPS } from '../lib/apps';

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
    const [role, setRole] = useState<'member' | 'guest'>('guest');
    const [accessDuration, setAccessDuration] = useState('24'); // hours
    const [selectedApps, setSelectedApps] = useState<string[]>(['budget']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open) {
            setRole('guest');
            setAccessDuration('24');
            setSelectedApps(['budget']);
            setError(null);
            setGeneratedCode(null);
            setCopied(false);
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data, error: rpcError } = await supabase.rpc('create_workspace_access_code', {
                p_workspace_id: activeWorkspaceId,
                p_role: role,
                p_authorized_apps: role === 'guest' ? selectedApps : null,
                p_expires_in_hours: accessDuration === 'Permanent' ? null : parseInt(accessDuration)
            });

            if (rpcError) throw rpcError;
            
            setGeneratedCode(data);
            onSuccess(); // Refresh the list in parent
        } catch (err: any) {
            setError(err.message || 'Failed to generate access code.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (generatedCode) {
            navigator.clipboard.writeText(generatedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const toggleApp = (appId: string) => {
        setSelectedApps(prev => 
            prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
        );
    };

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--ff-surface)', border: '1px solid var(--ff-border)',
                borderRadius: 16, width: '100%', maxWidth: 440, padding: 28,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ff-text-primary)' }}>
                        {generatedCode ? 'Guest Pass Generated' : 'Invite to Workspace'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {generatedCode ? (
                    <div className="flex flex-col items-center py-4">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6">
                            <ShieldCheck size={32} />
                        </div>
                        <p className="text-sm text-center mb-2" style={{ color: 'var(--ff-text-muted)' }}>
                            Share this code with your guest to join:
                        </p>
                        <div className="flex items-center gap-3 w-full p-4 rounded-xl border mb-6" 
                            style={{ background: 'var(--ff-navy)', borderColor: 'var(--ff-border)' }}>
                            <span className="flex-1 text-3xl font-mono font-bold tracking-widest text-center" 
                                style={{ color: 'var(--ff-accent)' }}>
                                {generatedCode}
                            </span>
                            <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                                style={{ color: copied ? '#22c55e' : 'var(--ff-text-muted)' }}>
                                {copied ? <Check size={20} /> : <Copy size={20} />}
                            </button>
                        </div>
                        <p className="text-xs text-center" style={{ color: 'var(--ff-text-muted)' }}>
                            {accessDuration === 'Permanent' ? 'This code does not expire.' : `This code expires in ${accessDuration} hours.`}
                        </p>
                        <button onClick={onClose} className="w-full mt-8 py-3 rounded-xl font-bold text-white"
                            style={{ background: 'var(--ff-accent)' }}>
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {error && (
                            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', fontSize: 13 }}>
                                {error}
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ff-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Account Role
                            </label>
                            <div className="flex gap-2">
                                {(['member', 'guest'] as const).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className="flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-all"
                                        style={{ 
                                            background: role === r ? 'var(--ff-accent)15' : 'transparent',
                                            borderColor: role === r ? 'var(--ff-accent)' : 'var(--ff-border)',
                                            color: role === r ? 'var(--ff-accent)' : 'var(--ff-text-muted)'
                                        }}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {role === 'guest' && (
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ff-text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Authorized Applications
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.values(APPS).map(app => (
                                        <button
                                            key={app.id}
                                            type="button"
                                            onClick={() => toggleApp(app.id)}
                                            className="flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
                                            style={{ 
                                                background: selectedApps.includes(app.id) ? 'var(--ff-navy)' : 'transparent',
                                                borderColor: selectedApps.includes(app.id) ? 'var(--ff-accent)' : 'var(--ff-border)'
                                            }}
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
                                                style={{ background: `${app.color}20`, color: app.color }}>
                                                <app.icon size={16} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium" style={{ color: 'var(--ff-text-primary)' }}>{app.name}</p>
                                                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{app.description}</p>
                                            </div>
                                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                                                style={{ 
                                                    borderColor: selectedApps.includes(app.id) ? 'var(--ff-accent)' : 'var(--ff-border)',
                                                    background: selectedApps.includes(app.id) ? 'var(--ff-accent)' : 'transparent'
                                                }}>
                                                {selectedApps.includes(app.id) && <Check size={12} color="white" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ff-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Pass Validity
                            </label>
                            <select style={INPUT_STYLE} value={accessDuration} onChange={e => setAccessDuration(e.target.value)}>
                                <option value="24">24 Hours</option>
                                <option value="168">7 Days</option>
                                <option value="720">30 Days</option>
                                <option value="Permanent">Permanent</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                            <button type="button" onClick={onClose} style={{
                                flex: 1, padding: '12px 0', borderRadius: 12, background: 'transparent', color: 'var(--ff-text-muted)', border: '1px solid var(--ff-border)', fontWeight: 600
                            }}>Cancel</button>
                            <button type="submit" disabled={loading || (role === 'guest' && selectedApps.length === 0)} style={{
                                flex: 1.5, padding: '12px 0', borderRadius: 12, background: loading ? '#334155' : 'var(--ff-accent)', color: 'white', border: 'none', fontWeight: 700, 
                                opacity: (role === 'guest' && selectedApps.length === 0) ? 0.5 : 1
                            }}>
                                {loading ? 'Generating...' : 'Generate Guest Pass'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
