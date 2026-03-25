import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    LogOut,
    Zap,
    Settings as SettingsIcon,
    Menu,
    X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMediaQuery, MOBILE } from '../hooks/useMediaQuery';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { MobileBottomNav } from './MobileBottomNav';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { getAppByPath } from '../lib/apps';

export function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { isGuest, authorizedApps } = useWorkspace();
    const isMobile = useMediaQuery(MOBILE);

    const app = getAppByPath(location.pathname);
    const navItems = app?.navItems || [];

    // Safety: If guest and not in authorized app, redirect to launcher
    useEffect(() => {
        if (isGuest && app && authorizedApps && !authorizedApps.includes(app.id)) {
            navigate('/');
        }
    }, [isGuest, app, authorizedApps, navigate]);

    // Close drawer on route change
    useEffect(() => {
        setDrawerOpen(false);
    }, [location.pathname]);

    const currentPage = navItems.find(item =>
        location.pathname === item.to || location.pathname.startsWith(item.to + '/')
    );

    /* ── Sidebar content (shared between desktop sidebar and mobile drawer) ── */
    const sidebarContent = (
        <>
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
                {(!collapsed || isMobile) && (
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
                        title={collapsed && !isMobile ? label : undefined}
                        className={({ isActive }) =>
                            `flex items-center gap-3 mx-2 mb-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                                ? 'text-white'
                                : 'hover:text-blue-600 dark:hover:text-white'
                            }`
                        }
                        style={({ isActive }) =>
                            isActive
                                ? { background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' }
                                : { background: 'transparent', color: 'var(--ff-text-muted)' }
                        }
                    >
                        <Icon size={18} className="flex-shrink-0" />
                        {(!collapsed || isMobile) && <span>{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Profile actions + Sign out */}
            <div className="border-t pt-3 pb-3" style={{ borderColor: 'var(--ff-border)' }}>
                {!isGuest && (
                    <NavLink
                        to={`/${app?.id || 'transport'}/settings`}
                        title={collapsed && !isMobile ? 'Settings' : undefined}
                        className={({ isActive }) =>
                            `flex items-center gap-3 mx-2 mb-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                                ? 'text-white'
                                : 'hover:text-blue-600 dark:hover:text-white'
                            }`
                        }
                        style={({ isActive }) =>
                            isActive
                                ? { background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' }
                                : { background: 'transparent', color: 'var(--ff-text-muted)' }
                        }
                    >
                        <SettingsIcon size={18} className="flex-shrink-0" />
                        {(!collapsed || isMobile) && <span>Settings</span>}
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
                    {(!collapsed || isMobile) && <span>Sign Out</span>}
                </button>
            </div>

            {/* Collapse toggle (desktop only) */}
            {!isMobile && (
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="flex items-center justify-center mb-4 mx-auto rounded-full transition-colors border"
                    style={{
                        width: 28,
                        height: 28,
                        background: 'var(--ff-bg)',
                        borderColor: 'var(--ff-border)',
                        color: 'var(--ff-text-muted)',
                    }}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            )}
        </>
    );

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ff-bg)' }}>
            {/* ── Desktop / Tablet Sidebar ── */}
            {!isMobile && (
                <aside
                    className="flex flex-col transition-all duration-300 ease-in-out flex-shrink-0"
                    style={{
                        width: collapsed ? '64px' : '220px',
                        background: 'var(--ff-surface-raised)',
                        borderRight: '1px solid var(--ff-border)',
                    }}
                >
                    {sidebarContent}
                </aside>
            )}

            {/* ── Mobile Drawer Overlay ── */}
            {isMobile && drawerOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="drawer-backdrop"
                        onClick={() => setDrawerOpen(false)}
                    />
                    {/* Drawer */}
                    <aside
                        className="fixed inset-y-0 left-0 z-50 flex flex-col"
                        style={{
                            width: '280px',
                            background: 'var(--ff-surface-raised)',
                            boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
                        }}
                    >
                        {/* Close button inside drawer */}
                        <button
                            onClick={() => setDrawerOpen(false)}
                            className="absolute top-4 right-3 p-2 rounded-lg transition-colors"
                            style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                        >
                            <X size={20} />
                        </button>
                        {sidebarContent}
                    </aside>
                </>
            )}

            {/* ── Main content ── */}
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Top bar */}
                <header
                    className={`flex items-center justify-between border-b flex-shrink-0 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}
                    style={{ borderColor: 'var(--ff-border)', background: 'var(--ff-surface)' }}
                >
                    <div className="flex items-center gap-3">
                        {/* Hamburger (mobile only) */}
                        {isMobile && (
                            <button
                                onClick={() => setDrawerOpen(true)}
                                className="p-2 -ml-2 rounded-lg transition-colors"
                                style={{ color: 'var(--ff-text-primary)', background: 'none', border: 'none' }}
                                title="Open menu"
                            >
                                <Menu size={22} />
                            </button>
                        )}
                        <h1 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`} style={{ color: 'var(--ff-text-primary)' }}>
                            {currentPage?.label ?? app?.name ?? 'Vaulta'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <WorkspaceSwitcher />
                        {!isMobile && (
                            <div className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                                ZMW · Zambia
                            </div>
                        )}
                    </div>
                </header>

                {/* Page content — extra bottom padding on mobile for bottom nav */}
                <main className={`flex-1 overflow-y-auto ${isMobile ? 'p-4 pb-20' : 'p-6'}`}>
                    <Outlet />
                </main>
            </div>

            {/* ── Mobile Bottom Nav ── */}
            {isMobile && (
                <MobileBottomNav onMoreTap={() => setDrawerOpen(true)} />
            )}
        </div>
    );
}
