import { useState } from 'react';
import type { FormEvent } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { phoneToDriverEmail } from '../../lib/driverAuth';

export function DriverLogin() {
    const { signIn } = useAuth();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!phone.trim() || !password) {
            setError('Enter your phone number and password.');
            return;
        }

        let email: string;
        try {
            email = phoneToDriverEmail(phone.trim());
        } catch (err: any) {
            setError(err.message);
            return;
        }

        setLoading(true);
        const { error: authErr } = await signIn(email, password);
        setLoading(false);
        if (authErr) setError('Incorrect phone number or password.');
    };

    return (
        <div className="min-h-screen flex flex-col justify-center px-6 py-10"
            style={{ background: 'var(--ff-bg)' }}>
            <div className="w-full max-w-sm mx-auto">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                        <Truck size={32} color="white" />
                    </div>
                    <h1 className="text-2xl font-bold text-center" style={{ color: 'var(--ff-text-primary)' }}>
                        Driver Sign In
                    </h1>
                    <p className="mt-2 text-center text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        Use the phone number and password your manager gave you.
                    </p>
                </div>

                <div className="rounded-2xl p-6 border"
                    style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                    {error && (
                        <div className="mb-5 p-3 rounded-lg text-sm"
                            style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                                style={{ color: 'var(--ff-text-muted)' }}>
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                inputMode="tel"
                                autoFocus
                                autoComplete="username"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="0977 000 000"
                                className="w-full h-12 rounded-xl px-4 text-base outline-none"
                                style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                                style={{ color: 'var(--ff-text-muted)' }}>
                                Password
                            </label>
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full h-12 rounded-xl px-4 text-base outline-none"
                                style={{ background: 'var(--ff-bg)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
                            style={{ background: 'var(--ff-accent)' }}
                        >
                            {loading ? <><Loader2 className="animate-spin" size={18} /> Signing in…</> : 'Sign In'}
                        </button>
                    </form>
                </div>

                <p className="mt-6 text-center text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                    Trouble signing in? Contact your manager.
                </p>
            </div>
        </div>
    );
}
