import { Outlet, NavLink } from 'react-router-dom';
import { Home, User, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDriver } from '../contexts/DriverContext';

const NAV = [
    { to: '/driver', label: 'Home', icon: Home, end: true },
    { to: '/driver/profile', label: 'Profile', icon: User, end: false },
];

export function DriverLayout() {
    const { signOut } = useAuth();
    const { driver } = useDriver();

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--ff-bg)' }}>
            {/* Top bar */}
            <header className="flex items-center justify-between px-4 h-14 border-b sticky top-0 z-10"
                style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold" style={{ color: 'var(--ff-text-primary)' }}>Vaulta</span>
                    {driver?.name && (
                        <span className="text-sm truncate" style={{ color: 'var(--ff-text-muted)' }}>
                            · {driver.name}
                        </span>
                    )}
                </div>
                <button onClick={signOut} title="Sign out"
                    className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg"
                    style={{ color: 'var(--ff-text-muted)' }}>
                    <LogOut size={16} /> Sign out
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 px-4 py-5 pb-24 max-w-md w-full mx-auto">
                <Outlet />
            </main>

            {/* Bottom nav */}
            <nav className="fixed bottom-0 inset-x-0 border-t flex"
                style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
                <div className="max-w-md w-full mx-auto flex">
                    {NAV.map(({ to, label, icon: Icon, end }) => (
                        <NavLink key={to} to={to} end={end}
                            className="flex-1 flex flex-col items-center justify-center gap-1 py-3"
                            style={({ isActive }) => ({
                                color: isActive ? 'var(--ff-accent)' : 'var(--ff-text-muted)',
                            })}>
                            <Icon size={20} />
                            <span className="text-[11px] font-medium">{label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
