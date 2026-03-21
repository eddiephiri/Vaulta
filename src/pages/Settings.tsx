import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { UserPlus, Users } from 'lucide-react';

export function Settings() {
    const { updatePassword } = useAuth();
    const { activeWorkspaceId } = useWorkspace();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [members, setMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [membersError, setMembersError] = useState<string | null>(null);

    const fetchMembers = async () => {
        if (!activeWorkspaceId) return;
        setLoadingMembers(true);
        const { data, error: err } = await supabase.rpc('get_workspace_members', { p_workspace_id: activeWorkspaceId });
        if (err) setMembersError(err.message);
        else setMembers(data || []);
        setLoadingMembers(false);
    };

    useEffect(() => {
        fetchMembers();
    }, [activeWorkspaceId]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!password || !confirmPassword) {
            setError('Please fill in both fields.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
            setError('Password must include uppercase, lowercase, a number, and a special character.');
            return;
        }

        setLoading(true);
        const { error: updateErr } = await updatePassword(password);
        setLoading(false);

        if (updateErr) {
            setError(updateErr.message || 'Failed to update password.');
        } else {
            setSuccess(true);
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => setSuccess(false), 5000);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--ff-text-primary)' }}>
                Account Settings
            </h2>

            <div style={{
                background: 'var(--ff-surface)',
                border: '1px solid var(--ff-border)',
                borderRadius: 12,
                padding: 24,
            }}>
                <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--ff-text-primary)' }}>
                    Change Password
                </h3>

                {error && (
                    <div style={{
                        marginBottom: 18,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: '#ef444420',
                        color: '#ef4444',
                        border: '1px solid #ef444440',
                        fontSize: 13,
                    }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        marginBottom: 18,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: '#22c55e20',
                        color: '#22c55e',
                        border: '1px solid #22c55e40',
                        fontSize: 13,
                    }}>
                        Password updated successfully.
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--ff-text-muted)', marginBottom: 6 }}>
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 8,
                                background: 'var(--ff-navy)',
                                border: '1px solid var(--ff-border)',
                                color: 'var(--ff-text-primary)',
                                fontSize: 14,
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 13, color: 'var(--ff-text-muted)', marginBottom: 6 }}>
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 8,
                                background: 'var(--ff-navy)',
                                border: '1px solid var(--ff-border)',
                                color: 'var(--ff-text-primary)',
                                fontSize: 14,
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: 'fit-content',
                            padding: '10px 24px',
                            borderRadius: 8,
                            background: loading ? '#334155' : 'var(--ff-accent)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: 14,
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginTop: 8,
                            transition: 'background 0.15s',
                        }}
                    >
                        {loading ? 'Updating…' : 'Update Password'}
                    </button>
                </form>
            </div>

            <div style={{
                background: 'var(--ff-surface)',
                border: '1px solid var(--ff-border)',
                borderRadius: 12,
                padding: 24,
                marginTop: 24,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 className="text-lg font-medium" style={{ color: 'var(--ff-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={20} />
                        Workspace Members
                    </h3>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 8,
                            background: 'var(--ff-accent)', color: 'white',
                            fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer'
                        }}
                    >
                        <UserPlus size={16} />
                        Invite Guest
                    </button>
                </div>

                {membersError && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#ef444420', color: '#ef4444', fontSize: 13 }}>
                        {membersError}
                    </div>
                )}

                {loadingMembers ? (
                    <p style={{ color: 'var(--ff-text-muted)', fontSize: 13, padding: '12px 0' }}>Loading members...</p>
                ) : (
                    <div style={{ border: '1px solid var(--ff-border)', borderRadius: 8, overflow: 'hidden' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: 'var(--ff-navy)', borderBottom: '1px solid var(--ff-border)' }}>
                                    <th style={{ padding: '10px 14px', color: 'var(--ff-text-muted)', fontWeight: 500 }}>Email Address</th>
                                    <th style={{ padding: '10px 14px', color: 'var(--ff-text-muted)', fontWeight: 500 }}>Role</th>
                                    <th style={{ padding: '10px 14px', color: 'var(--ff-text-muted)', fontWeight: 500 }}>Access Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ padding: '16px 14px', color: 'var(--ff-text-muted)', textAlign: 'center' }}>
                                            No members found.
                                        </td>
                                    </tr>
                                ) : (
                                    members.map((m, i) => (
                                        <tr key={i} style={{ borderBottom: i === members.length - 1 ? 'none' : '1px solid var(--ff-border)' }}>
                                            <td style={{ padding: '12px 14px', color: 'var(--ff-text-primary)' }}>{m.email}</td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <span style={{ 
                                                    padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                                                    background: m.role === 'owner' ? '#ef444420' : m.role === 'admin' ? '#f59e0b20' : '#3b82f620',
                                                    color: m.role === 'owner' ? '#ef4444' : m.role === 'admin' ? '#f59e0b' : '#3b82f6'
                                                }}>
                                                    {m.role?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', color: 'var(--ff-text-muted)' }}>{m.access_duration ?? 'Permanent'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <InviteMemberModal 
                open={showInviteModal} 
                onClose={() => setShowInviteModal(false)}
                onSuccess={() => { fetchMembers(); }}
            />
        </div>
    );
}
