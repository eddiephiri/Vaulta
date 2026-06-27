import { useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
    /** Called after the password is changed and the must-change flag is cleared. */
    onDone: () => void;
}

export function DriverChangePassword({ onDone }: Props) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) { setError('Use at least 8 characters.'); return; }
        if (password !== confirm) { setError('The passwords do not match.'); return; }

        setLoading(true);
        // Set the new password AND clear the must_change_password flag in one call.
        const { error: err } = await supabase.auth.updateUser({
            password,
            data: { must_change_password: false },
        });
        setLoading(false);

        if (err) { setError(err.message); return; }
        onDone();
    };

    return (
        <div className="min-h-screen flex flex-col justify-center px-6 py-10" style={{ background: 'var(--ff-bg)' }}>
            <div className="w-full max-w-sm mx-auto">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: '#22c55e15', color: '#22c55e' }}>
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-center" style={{ color: 'var(--ff-text-primary)' }}>
                        Set Your Password
                    </h1>
                    <p className="mt-2 text-center text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        Choose a new password to finish setting up your account.
                    </p>
                </div>

                <div className="rounded-2xl p-6 border" style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                    {error && (
                        <div className="mb-5 p-3 rounded-lg text-sm"
                            style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ff-text-muted)' }}>
                                New Password
                            </label>
                            <input type="password" autoComplete="new-password" autoFocus value={password}
                                onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                                className="w-full h-12 rounded-xl px-4 text-base outline-none"
                                style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ff-text-muted)' }}>
                                Confirm Password
                            </label>
                            <input type="password" autoComplete="new-password" value={confirm}
                                onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
                                className="w-full h-12 rounded-xl px-4 text-base outline-none"
                                style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }} />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
                            style={{ background: 'var(--ff-accent)' }}>
                            {loading ? <><Loader2 className="animate-spin" size={18} /> Saving…</> : 'Save & Continue'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
