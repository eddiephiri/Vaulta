import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

export function ResetPassword() {
    const { updatePassword } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

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

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        const { error: updateErr } = await updatePassword(password);
        setLoading(false);

        if (updateErr) {
            setError(updateErr.message || 'Failed to update password.');
        } else {
            setSuccess(true);
            setTimeout(() => {
                navigate('/');
            }, 2000);
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
                        Enter your new password
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
                            Password updated successfully. Redirecting to login...
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--ff-text-muted)', marginBottom: 6 }}>
                                New Password
                            </label>
                            <input
                                type="password"
                                autoFocus
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
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--ff-text-muted)', marginBottom: 6 }}>
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
                            disabled={loading || success}
                            style={{
                                width: '100%',
                                padding: '11px 0',
                                borderRadius: 8,
                                background: (loading || success) ? '#334155' : 'var(--ff-accent)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 15,
                                border: 'none',
                                cursor: (loading || success) ? 'not-allowed' : 'pointer',
                                marginTop: 4,
                                transition: 'background 0.15s',
                            }}
                        >
                            {loading ? 'Updating…' : 'Update Password'}
                        </button>
                    </form>

                    {!success && (
                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <Link to="/" style={{ color: 'var(--ff-text-muted)', fontSize: 14, textDecoration: 'none' }}>
                                Cancel
                            </Link>
                        </div>
                    )}
                </div>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--ff-text-muted)' }}>
                    Vaulta · Admin Access Only
                </p>
            </div>
        </div>
    );
}
