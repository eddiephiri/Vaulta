import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { UserPlus, Users, Save, CheckCircle2, AlertCircle, X } from 'lucide-react';

export function Settings() {
    const { updatePassword } = useAuth();
    const { activeWorkspaceId } = useWorkspace();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [members, setMembers] = useState<any[]>([]);
    const [accessCodes, setAccessCodes] = useState<any[]>([]);
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

    const fetchAccessCodes = async () => {
        if (!activeWorkspaceId) return;
        const { data, error: err } = await supabase.rpc('get_workspace_access_codes', { p_workspace_id: activeWorkspaceId });
        if (!err) setAccessCodes(data || []);
    };

    const handleDeleteCode = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this guest pass?')) return;
        const { error: err } = await supabase.from('workspace_access_codes').delete().eq('id', id);
        if (!err) fetchAccessCodes();
    };

    useEffect(() => {
        fetchMembers();
        fetchAccessCodes();
    }, [activeWorkspaceId]);

    const getTimeRemaining = (expiry: string | null) => {
        if (!expiry) return 'Permanent';
        const now = new Date();
        const exp = new Date(expiry);
        const diff = exp.getTime() - now.getTime();
        if (diff <= 0) return 'Expired';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h remaining`;
        return `${hours}h remaining`;
    };

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
        <div className="max-w-3xl mx-auto pb-12">
            <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--ff-text-primary)' }}>
                Settings
            </h2>

            {/* Account Settings */}
            <div className="mb-8 p-6 rounded-2xl border" style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'var(--ff-text-primary)' }}>
                    Account Security
                </h3>

                {error && (
                    <div className="flex items-center gap-3 p-4 mb-6 rounded-xl text-sm" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                {success && (
                    <div className="flex items-center gap-3 p-4 mb-6 rounded-xl text-sm" style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}>
                        <CheckCircle2 size={18} /> Password updated successfully.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--ff-text-muted)' }}>
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:ring-2 focus:ring-blue-500/50 outline-none"
                            style={{ background: 'var(--ff-navy)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--ff-text-muted)' }}>
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:ring-2 focus:ring-blue-500/50 outline-none"
                            style={{ background: 'var(--ff-navy)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            style={{ background: 'var(--ff-accent)' }}
                        >
                            {loading ? 'Updating…' : <><Save size={18} /> Update Password</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* Workspace Settings */}
            <div className="p-6 rounded-2xl border mb-8" style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--ff-text-primary)' }}>
                    Workspace Settings
                </h3>

                <WorkspaceRenameForm />
            </div>

            {/* Team Management */}
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--ff-accent)15' }}>
                            <Users size={18} style={{ color: 'var(--ff-accent)' }} />
                        </div>
                        <h4 className="font-semibold" style={{ color: 'var(--ff-text-primary)' }}>Team & Guests</h4>
                    </div>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                        style={{ background: 'var(--ff-accent)' }}
                    >
                        <UserPlus size={16} /> Invite Member
                    </button>
                </div>

                {membersError && (
                    <div className="p-4 mb-6 rounded-xl text-sm" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
                        {membersError}
                    </div>
                )}

                {/* Active Members */}
                <div className="mb-10">
                    <h5 className="text-xs font-bold uppercase tracking-widest mb-4 opacity-50" style={{ color: 'var(--ff-text-muted)' }}>
                        Active Members
                    </h5>
                    {loadingMembers ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : members.length === 0 ? (
                        <div className="p-8 text-center border rounded-xl opacity-50" style={{ borderColor: 'var(--ff-border)', color: 'var(--ff-text-muted)' }}>
                            No members yet.
                        </div>
                    ) : (
                        <div>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-hidden border rounded-xl" style={{ borderColor: 'var(--ff-border)' }}>
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead>
                                        <tr style={{ background: 'var(--ff-navy)', borderBottom: '1px solid var(--ff-border)' }}>
                                            <th className="px-5 py-3 font-semibold opacity-50" style={{ color: 'var(--ff-text-muted)' }}>Member</th>
                                            <th className="px-5 py-3 font-semibold opacity-50" style={{ color: 'var(--ff-text-muted)' }}>Role</th>
                                            <th className="px-5 py-3 font-semibold opacity-50" style={{ color: 'var(--ff-text-muted)' }}>Access</th>
                                            <th className="px-5 py-3 font-semibold opacity-50" style={{ color: 'var(--ff-text-muted)' }}>Expiry</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y" style={{ borderColor: 'var(--ff-border)' }}>
                                        {members.map((m) => (
                                            <tr key={m.user_id}>
                                                <td className="px-5 py-4 font-medium" style={{ color: 'var(--ff-text-primary)' }}>{m.email}</td>
                                                <td className="px-5 py-4">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                                                        style={{ 
                                                            background: m.role === 'owner' ? '#ef444415' : m.role === 'admin' ? '#f59e0b15' : m.role === 'guest' ? '#8b5cf615' : '#3b82f615',
                                                            color: m.role === 'owner' ? '#ef4444' : m.role === 'admin' ? '#f59e0b' : m.role === 'guest' ? '#8b5cf6' : '#3b82f6',
                                                            borderColor: 'currentColor'
                                                        }}>
                                                        {m.role}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-xs" style={{ color: 'var(--ff-text-primary)' }}>
                                                    {m.role === 'guest' ? (
                                                        <div className="flex gap-1">
                                                            {(m.authorized_apps || []).map((app: string) => (
                                                                <span key={app} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 uppercase font-mono text-[9px]">
                                                                    {app}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="opacity-50 text-xs">Full Access</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-semibold" 
                                                        style={{ color: getTimeRemaining(m.expires_at) === 'Expired' ? '#ef4444' : 'var(--ff-text-muted)' }}>
                                                        {getTimeRemaining(m.expires_at)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                                {members.map((m) => (
                                    <div key={m.user_id} className="p-4 rounded-xl border flex flex-col gap-3" 
                                        style={{ background: 'var(--ff-navy)', borderColor: 'var(--ff-border)' }}>
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-sm truncate" style={{ color: 'var(--ff-text-primary)' }}>{m.email}</p>
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border"
                                                style={{ 
                                                    background: m.role === 'owner' ? '#ef444415' : m.role === 'admin' ? '#f59e0b15' : m.role === 'guest' ? '#8b5cf615' : '#3b82f615',
                                                    color: m.role === 'owner' ? '#ef4444' : m.role === 'admin' ? '#f59e0b' : m.role === 'guest' ? '#8b5cf6' : '#3b82f6',
                                                    borderColor: 'currentColor'
                                                }}>
                                                {m.role}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                            <span>{m.role === 'guest' ? 'Limited Apps' : 'Full Access'}</span>
                                            <span style={{ color: getTimeRemaining(m.expires_at) === 'Expired' ? '#ef4444' : 'inherit' }}>
                                                {getTimeRemaining(m.expires_at)}
                                            </span>
                                        </div>
                                        {m.role === 'guest' && m.authorized_apps?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {m.authorized_apps.map((app: string) => (
                                                    <span key={app} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 uppercase font-mono text-[9px]">
                                                        {app}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pending Guest Passes */}
                {accessCodes.length > 0 && (
                    <div>
                        <h5 className="text-xs font-bold uppercase tracking-widest mb-4 opacity-50" style={{ color: 'var(--ff-text-muted)' }}>
                            Active Guest Passes (Unredeemed)
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                            {accessCodes.map(ac => (
                                <div key={ac.id} className="flex items-center justify-between p-4 rounded-xl border" 
                                    style={{ background: 'var(--ff-navy)', borderColor: 'var(--ff-border)' }}>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-mono font-bold text-lg tracking-wider" style={{ color: 'var(--ff-accent)' }}>{ac.code}</span>
                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10" style={{ color: 'var(--ff-text-muted)' }}>
                                                {ac.role}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs opacity-50" style={{ color: 'var(--ff-text-muted)' }}>
                                            <span>Expiry: {getTimeRemaining(ac.expires_at)}</span>
                                            <span>•</span>
                                            <span>Apps: {(ac.authorized_apps || []).join(', ')}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteCode(ac.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500/50 hover:text-red-500 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <InviteMemberModal 
                open={showInviteModal} 
                onClose={() => setShowInviteModal(false)}
                onSuccess={() => { fetchMembers(); fetchAccessCodes(); }}
            />
        </div>
    );
}

function WorkspaceRenameForm() {
    const { activeWorkspaceId, workspaces, refreshWorkspaces } = useWorkspace();
    const workspace = workspaces.find(w => w.id === activeWorkspaceId);
    const [name, setName] = useState(workspace?.name || '');
    const [description, setDescription] = useState(workspace?.description || '');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (workspace) {
            setName(workspace.name);
            setDescription(workspace.description || '');
        }
    }, [workspace]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeWorkspaceId || !name.trim()) return;
        
        setLoading(true);
        setError(null);
        setSuccess(false);

        const { error: err } = await supabase
            .from('workspaces')
            .update({ name: name.trim(), description: description.trim() })
            .eq('id', activeWorkspaceId);

        if (err) {
            setError(err.message);
        } else {
            await refreshWorkspaces();
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        }
        setLoading(false);
    };

    if (!workspace) return null;

    return (
        <form onSubmit={handleSave} className="space-y-6">
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
                    <AlertCircle size={18} /> {error}
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--ff-text-muted)' }}>
                        Workspace Name
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 transition-all outline-none"
                        style={{ background: 'var(--ff-navy)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--ff-text-muted)' }}>
                        Description
                    </label>
                    <input
                        type="text"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Project or company name..."
                        className="w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 transition-all outline-none"
                        style={{ background: 'var(--ff-navy)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    type="submit"
                    disabled={loading || (name === workspace.name && description === (workspace.description || ''))}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    style={{ background: 'var(--ff-accent)' }}
                >
                    {loading ? 'Saving…' : <><Save size={18} /> Save Workspace Changes</>}
                </button>
                {success && (
                    <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#10b981' }}>
                        <CheckCircle2 size={16} /> Saved!
                    </div>
                )}
            </div>
        </form>
    );
}
