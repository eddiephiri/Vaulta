import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

export function ForgotPassword() {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!email.trim()) {
            setError('Email is required.');
            return;
        }

        setLoading(true);
        const { error: resetErr } = await resetPassword(email.trim());
        setLoading(false);

        if (resetErr) {
            setError(resetErr.message || 'Failed to send reset link.');
        } else {
            setSuccess(true);
        }
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
                        Reset your password
                    </p>
                </div>

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
                            Check your email for a password reset link.
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
                            {loading ? 'Sending link…' : 'Send Reset Link'}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                        <Link to="/" style={{ color: 'var(--ff-text-muted)', fontSize: 14, textDecoration: 'none' }}>
                            &larr; Back to login
                        </Link>
                    </div>
                </div>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--ff-text-muted)' }}>
                    Vaulta · Admin Access Only
                </p>
            </div>
        </div>
    );
}
