import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    LogOut,
    Zap,
    Settings as SettingsIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { getAppByPath } from '../lib/apps';

export function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const { signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { isGuest, authorizedApps } = useWorkspace();

    const app = getAppByPath(location.pathname);
    const navItems = app?.navItems || [];

    // Safety: If guest and not in authorized app, redirect to launcher
    useEffect(() => {
        if (isGuest && app && authorizedApps && !authorizedApps.includes(app.id)) {
            navigate('/');
        }
    }, [isGuest, app, authorizedApps, navigate]);

    const currentPage = navItems.find(item =>
        location.pathname === item.to || location.pathname.startsWith(item.to + '/')
    );

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ff-navy)' }}>
            {/* Sidebar */}
            <aside
                className="flex flex-col transition-all duration-300 ease-in-out flex-shrink-0"
                style={{
                    width: collapsed ? '64px' : '220px',
                    background: 'var(--ff-navy-light)',
                    borderRight: '1px solid var(--ff-border)',
                }}
            >
                {/* Logo / Brand */}
                <div
                    className="flex items-center gap-3 px-4 py-5 border-b"
                    style={{ borderColor: 'var(--ff-border)' }}
                >
                    <div
                        className="flex items-center justify-center rounded-lg flex-shrink-0 cursor-pointer"
                        onClick={() => navigate('/')}
                        title="Back to Apps"
                        style={{
                            width: 36,
                            height: 36,
                            background: app ? `${app.color}20` : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        }}
                    >
                        {app ? <app.icon size={18} color={app.color} /> : <Zap size={18} color="white" />}
                    </div>
                    {!collapsed && (
                        <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--ff-text-primary)' }}>
                            {app?.name || 'Vaulta'}
                        </span>
                    )}
                </div>

                {/* Nav Links */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            title={collapsed ? label : undefined}
                            className={({ isActive }) =>
                                `flex items-center gap-3 mx-2 mb-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                                    ? 'text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`
                            }
                            style={({ isActive }) =>
                                isActive
                                    ? { background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' }
                                    : { background: 'transparent' }
                            }
                        >
                            <Icon size={18} className="flex-shrink-0" />
                            {!collapsed && <span>{label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Profile actions + Sign out */}
                <div className="border-t pt-3 pb-3" style={{ borderColor: 'var(--ff-border)' }}>
                    {!isGuest && (
                        <NavLink
                            to={`/${app?.id || 'transport'}/settings`}
                            title={collapsed ? 'Settings' : undefined}
                            className={({ isActive }) =>
                                `flex items-center gap-3 mx-2 mb-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                                    ? 'text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`
                            }
                            style={({ isActive }) =>
                                isActive
                                    ? { background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' }
                                    : { background: 'transparent' }
                            }
                        >
                            <SettingsIcon size={18} className="flex-shrink-0" />
                            {!collapsed && <span>Settings</span>}
                        </NavLink>
                    )}
                    <button
                        onClick={signOut}
                        title="Sign out"
                        className="flex items-center gap-3 w-full mx-2 mt-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                        style={{ color: 'var(--ff-text-muted)', width: 'calc(100% - 16px)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ff-text-muted)')}
                    >
                        <LogOut size={18} className="flex-shrink-0" />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </div>
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="flex items-center justify-center mb-4 mx-auto rounded-full transition-colors"
                    style={{
                        width: 28,
                        height: 28,
                        background: 'var(--ff-border)',
                        color: 'var(--ff-text-muted)',
                    }}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </aside>

            {/* Main content */}
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Top bar */}
                <header
                    className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                    style={{ borderColor: 'var(--ff-border)', background: 'var(--ff-surface)' }}
                >
                    <h1 className="text-lg font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                        {currentPage?.label ?? app?.name ?? 'Vaulta'}
                    </h1>
                    <div className="flex items-center gap-6">
                        <WorkspaceSwitcher />
                        <div className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                            ZMW · Zambia
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
