import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password) {
            setError('Email and password are required.');
            return;
        }

        setLoading(true);
        const { error: authErr } = await signIn(email.trim(), password);
        setLoading(false);

        if (authErr) {
            setError(authErr.message || 'Invalid email or password.');
        }
        // On success, App.tsx will detect the new session and redirect automatically.
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--ff-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
        }}>
            <div style={{
                width: '100%',
                maxWidth: 400,
            }}>
                {/* Logo / Brand */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width: 56, height: 56,
                        background: 'var(--ff-accent)',
                        borderRadius: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        fontSize: 28,
                    }}>
                        🚛
                    </div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ff-text-primary)', margin: 0 }}>
                        Vaulta
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--ff-text-muted)', marginTop: 6 }}>
                        Sign in to manage your fleet
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--ff-surface)',
                    border: '1px solid var(--ff-border)',
                    borderRadius: 16,
                    padding: 32,
                }}>
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

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--ff-text-muted)', marginBottom: 6 }}>
                                Email
                            </label>
                            <input
                                type="email"
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="admin@example.com"
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
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--ff-text-muted)', marginBottom: 6 }}>
                                Password
                            </label>
                            <input
                                type="password"
                                autoComplete="current-password"
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

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '11px 0',
                                borderRadius: 8,
                                background: loading ? '#334155' : 'var(--ff-accent)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 15,
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                marginTop: 4,
                                transition: 'background 0.15s',
                            }}
                        >
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--ff-text-muted)' }}>
                    Vaulta · Admin Access Only
                </p>
            </div>
        </div>
    );
}
