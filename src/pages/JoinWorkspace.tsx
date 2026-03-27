import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';

export function JoinWorkspace() {
    const navigate = useNavigate();
    const { refreshWorkspaces, switchWorkspace } = useWorkspace();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Call the RPC to join via code
            const { data, error: rpcError } = await supabase.rpc('join_workspace_via_code', {
                p_code: code.trim().toUpperCase()
            });

            if (rpcError) throw rpcError;
            if (!data) throw new Error('Invalid or expired access code.');

            // Success! 
            setSuccess(true);
            
            // 2. Refresh workspaces to see the new one
            await refreshWorkspaces();

            // 3. Switch to the new workspace
            await switchWorkspace(data, false);

            // 4. Redirect to launcher/dashboard after a brief delay
            setTimeout(() => {
                navigate('/');
            }, 1500);

        } catch (err: any) {
            console.error('Join error:', err);
            setError(err.message || 'Failed to join workspace. Please check your code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--ff-bg)' }}>
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg" 
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                        <ShieldCheck size={32} color="white" />
                    </div>
                    <h1 className="text-3xl font-bold text-center" style={{ color: 'var(--ff-text-primary)' }}>
                        Redeem Guest Pass
                    </h1>
                    <p className="mt-2 text-center" style={{ color: 'var(--ff-text-muted)' }}>
                        Enter your 8-digit access code to join a workspace
                    </p>
                </div>

                <div className="rounded-2xl p-8 border shadow-xl" 
                    style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                    
                    {success ? (
                        <div className="flex flex-col items-center py-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-4">
                                <ShieldCheck size={24} />
                            </div>
                            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ff-text-primary)' }}>Welcome!</h2>
                            <p style={{ color: 'var(--ff-text-muted)' }}>You have successfully joined the workspace. Redirecting...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleJoin} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ff-text-muted)' }}>
                                    Access Code
                                </label>
                                <input
                                    type="text"
                                    placeholder="VLT-XXXX"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full text-2xl font-mono text-center tracking-widest uppercase py-4 rounded-xl border focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                    style={{ 
                                        background: 'var(--ff-surface)', 
                                        color: 'var(--ff-text-primary)', 
                                        borderColor: 'var(--ff-border)' 
                                    }}
                                    maxLength={15}
                                    required
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-500 text-sm">
                                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                    <p>{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !code.trim()}
                                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:translate-y-[-2px] hover:shadow-lg active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
                                style={{ background: 'var(--ff-accent)', color: 'white' }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Verifying Code...
                                    </>
                                ) : (
                                    <>
                                        Join Workspace <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {!success && (
                    <p className="mt-8 text-center text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        Don't have a code? Ask your administrator for an invite.
                    </p>
                )}
            </div>
        </div>
    );
}
