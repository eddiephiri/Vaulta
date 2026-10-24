import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    LogOut,
    Settings as SettingsIcon,
    Menu,
    X,
} from 'lucide-react';
import { Fragment, useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMediaQuery, MOBILE } from '../hooks/useMediaQuery';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ModuleSwitcher } from './ModuleSwitcher';
import { MobileBottomNav } from './MobileBottomNav';

import { useWorkspace } from '../contexts/WorkspaceContext';
import { getAppByPath } from '../lib/apps';

export function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawer = useRef<HTMLElement>(null);
    const menuButton = useRef<HTMLButtonElement>(null);
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

    useEffect(() => {
        if (!drawerOpen || !isMobile) return;
        const panel = drawer.current;
        const opener = menuButton.current;
        const previousFocus = document.activeElement as HTMLElement | null;
        const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), [tabindex="0"]') ?? []);
        focusable()[0]?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setDrawerOpen(false);
            } else if (event.key === 'Tab') {
                const items = focusable();
                const first = items[0];
                const last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault(); last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first?.focus();
                }
            }
        };
        panel?.addEventListener('keydown', onKey);
        return () => {
            panel?.removeEventListener('keydown', onKey);
            (previousFocus?.isConnected ? previousFocus : opener)?.focus();
        };
    }, [drawerOpen, isMobile]);

    const currentPage = navItems.find(item =>
        location.pathname === item.to || location.pathname.startsWith(item.to + '/')
    );

    /* ── Sidebar content (shared between desktop sidebar and mobile drawer) ── */
    const sidebarContent = (
        <>
            {/* Logo / Brand */}
            <div
                className={`px-2 py-4 border-b ${isMobile ? 'pr-12' : ''}`}
                style={{ borderColor: 'var(--ff-border)' }}
            >
                <ModuleSwitcher collapsed={collapsed && !isMobile} />
            </div>

            {/* Nav Links */}
            <nav aria-label={`${app?.name ?? 'Module'} pages`} className="flex-1 py-4 overflow-y-auto">
                {navItems.map(({ to, icon: Icon, label, group }, index) => (
                    <Fragment key={to}>
                    {group && group !== navItems[index - 1]?.group && (
                        (!collapsed || isMobile)
                            ? <p className="px-5 pt-3 pb-2 text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--ff-text-muted)' }}>{group}</p>
                            : index > 0 && <hr className="mx-3 my-2" style={{ borderColor: 'var(--ff-border)' }} />
                    )}
                    <NavLink
                        key={to}
                        to={to}
                        aria-label={label}
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
                    </Fragment>
                ))}
            </nav>

            {/* Profile actions + Sign out */}
            <div className="border-t pt-3 pb-3" style={{ borderColor: 'var(--ff-border)' }}>
                {!isGuest && (
                    <NavLink
                        to={app?.id === 'budget' ? '/budget/settings' : `/settings?from=${app?.id || 'transport'}`}
                        aria-label="Settings"
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
                        ref={drawer}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Navigation"
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
                            aria-label="Close navigation"
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
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Hamburger (mobile only) */}
                        {isMobile && (
                            <button
                                ref={menuButton}
                                aria-expanded={drawerOpen}
                                aria-label="Open navigation"
                                onClick={() => setDrawerOpen(true)}
                                className="p-2 -ml-2 rounded-lg transition-colors"
                                style={{ color: 'var(--ff-text-primary)', background: 'none', border: 'none' }}
                                title="Open menu"
                            >
                                <Menu size={22} />
                            </button>
                        )}
                        <div className="min-w-0">
                        <p className="text-xs truncate" style={{ color: 'var(--ff-text-muted)' }}>{app?.name}</p>
                        <h1 className={`font-semibold truncate ${isMobile ? 'text-base' : 'text-lg'}`} style={{ color: 'var(--ff-text-primary)' }}>
                            {currentPage?.label ?? app?.name ?? 'Vaulta'}
                        </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">

                        <WorkspaceSwitcher />
                        {!isMobile && (
                            <div className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                                ZMW · Zambia
                            </div>
                        )}
                    </div>
                </header>

                {/* Page content — extra bottom padding on mobile for bottom nav */}
                <main className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}
                    style={isMobile ? { paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' } : undefined}>
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
