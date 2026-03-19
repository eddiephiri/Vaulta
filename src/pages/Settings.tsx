import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Settings() {
    const { updatePassword } = useAuth();
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
        </div>
    );
}
