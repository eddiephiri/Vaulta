import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Lock, Building2 } from 'lucide-react';

const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

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
            setError('Invalid email or password.');
        }
    };

    return (
        <div style={{ fontFamily: '"Manrope", "Inter", sans-serif' }} className="flex min-h-screen w-full bg-white text-slate-900 overflow-hidden">
            {/* Left Column: Branded Narrative */}
            <div 
                className="hidden md:flex flex-col w-1/2 p-12 lg:p-16 relative"
                style={{ background: 'radial-gradient(circle at top left, #3b82f6, #2563eb)' }}
            >
                {/* Vaulta Logo */}
                <div className="text-white font-bold text-2xl tracking-tight z-10">
                    Vaulta
                </div>

                {/* Main Narrative Content */}
                <div className="flex-1 flex flex-col justify-center max-w-[520px] z-10">
                    <div 
                        className="w-20 h-20 rounded-[24px] bg-white/10 flex items-center justify-center mb-10"
                        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                        <Lock className="w-8 h-8 text-white" strokeWidth={2.5} />
                    </div>
                    
                    <h1 className="text-[48px] lg:text-[64px] font-bold leading-[1.1] tracking-[-0.05em] text-white mb-6">
                        Securely manage your fleet and finances in one vault.
                    </h1>
                    
                    <p className="text-blue-100 text-[16px] lg:text-[17px] leading-[1.6] opacity-90 font-light max-w-[460px]">
                        The Pristine Curator for high-stakes fleet operations. Experience the next generation of asset management with precision-engineered security.
                    </p>
                </div>

                {/* Footer Left */}
                <div className="z-10 mt-auto pt-8">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-[2px] bg-white/30"></div>
                        <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-white/80">Enterprise Fleet Standard</span>
                    </div>
                    <p className="text-[10px] text-white/50 tracking-wider">
                        © 2024 VAULTA FLEET SYSTEMS. ALL RIGHTS RESERVED.
                    </p>
                </div>

                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>
            </div>

            {/* Right Column: Authentication Form */}
            <div className="flex flex-col w-full md:w-1/2 relative bg-white min-h-screen">
                <div className="flex-1 flex flex-col justify-center items-center px-8 sm:px-12 lg:px-20 w-full">
                    <div className="w-full max-w-[420px]">
                        
                        {/* Mobile Logo (visible only on small screens) */}
                        <div className="md:hidden text-[#2563eb] font-bold text-2xl tracking-tight mb-12">
                            Vaulta
                        </div>

                        <div className="mb-12 mt-8 lg:mt-16">
                            <h2 className="text-[32px] sm:text-[36px] font-semibold text-slate-900 leading-[1.2] tracking-[-0.025em] mb-2">
                                Welcome back
                            </h2>
                            <p className="text-slate-500 text-[14px] sm:text-[15px]">
                                Please enter your details to access your dashboard.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2 relative">
                                <label className="text-[12px] font-bold uppercase tracking-[0.05em] text-slate-500">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="alex@vaulta.io"
                                    className="h-12 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 text-[15px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-[#2563eb]"
                                    style={{ '--tw-ring-color': 'rgba(37,99,235,0.1)' } as React.CSSProperties}
                                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.1)'}
                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                />
                            </div>

                            <div className="flex flex-col gap-2 relative">
                                <div className="flex justify-between items-center">
                                    <label className="text-[12px] font-bold uppercase tracking-[0.05em] text-slate-500">
                                        Password
                                    </label>
                                    <Link tabIndex={-1} to="/forgot-password" className="text-[13px] font-medium text-[#2563eb] hover:text-blue-700 transition-colors">
                                        Forgot Password?
                                    </Link>
                                </div>
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-12 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 text-[15px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-[#2563eb]"
                                    style={{ '--tw-ring-color': 'rgba(37,99,235,0.1)' } as React.CSSProperties}
                                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.1)'}
                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 rounded-xl bg-[#2563eb] text-white font-bold text-[15px] transition-all hover:bg-blue-700 hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:bg-blue-600 disabled:hover:-translate-y-0 mt-2 flex items-center justify-center custom-button-hover"
                            >
                                {loading ? 'Signing In...' : 'Sign In'}
                            </button>
                        </form>

                        <div className="mt-8 mb-8 flex items-center justify-center gap-4">
                            <div className="h-px bg-[#e2e8f0] flex-1"></div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em] whitespace-nowrap">
                                Or continue with
                            </span>
                            <div className="h-px bg-[#e2e8f0] flex-1"></div>
                        </div>

                        <div className="flex gap-4">
                            <button type="button" className="flex-1 h-12 rounded-xl bg-white border border-[#e2e8f0] hover:bg-slate-50 flex items-center justify-center gap-3 transition-colors group">
                                <GoogleIcon />
                                <span className="text-[14px] font-semibold text-slate-700 group-hover:text-slate-900">Google</span>
                            </button>
                            <button type="button" className="flex-1 h-12 rounded-xl bg-white border border-[#e2e8f0] hover:bg-slate-50 flex items-center justify-center gap-3 transition-colors group">
                                <Building2 className="w-[18px] h-[18px] text-slate-700 group-hover:text-slate-900" />
                                <span className="text-[14px] font-semibold text-slate-700 group-hover:text-slate-900">SSO</span>
                            </button>
                        </div>
                        
                        <div className="mt-8 text-center border-t border-slate-100 pt-8">
                            <span className="text-[14px] text-slate-500">Don't have an account? </span>
                            <Link to="#" className="text-[14px] font-semibold text-[#2563eb] hover:text-blue-700 transition-colors">
                                Request Access
                            </Link>
                        </div>

                    </div>
                </div>

                {/* Footer Right */}
                <div className="py-6 px-12 md:px-20 flex flex-col sm:flex-row justify-center md:justify-end gap-x-8 gap-y-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mt-auto">
                    <Link to="#" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
                    <Link to="#" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
                    <Link to="#" className="hover:text-slate-600 transition-colors">Enterprise SSO Support</Link>
                </div>
            </div>
            {/* Adding Google Font to doc for Manrope */}
            <style dangerouslySetInnerHTML={{__html: `
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
                
                input:focus {
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1) !important;
                }
                .custom-button-hover:hover {
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                }
            `}} />
        </div>
    );
}
