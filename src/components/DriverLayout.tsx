import { Outlet, NavLink } from 'react-router-dom';
import { Home, User, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDriver } from '../contexts/DriverContext';
import { useTheme } from '../contexts/ThemeContext';

const NAV = [
    { to: '/driver', label: 'Home', icon: Home, end: true },
    { to: '/driver/profile', label: 'Profile', icon: User, end: false },
];

export function DriverLayout() {
    const { signOut } = useAuth();
    const { driver } = useDriver();
    const { theme, toggleTheme } = useTheme();

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
                <div className="flex items-center gap-2">
                    <button onClick={toggleTheme} title="Toggle theme"
                        className="p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                        style={{ color: 'var(--ff-text-muted)', border: 'none', background: 'none' }}>
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button onClick={signOut} title="Sign out"
                        className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        style={{ color: 'var(--ff-text-muted)', border: 'none', background: 'none' }}>
                        <LogOut size={16} /> Sign out
                    </button>
                </div>
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
