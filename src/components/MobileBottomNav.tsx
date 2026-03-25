import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { getAppByPath } from '../lib/apps';
import type { NavItem } from '../lib/apps';

interface MobileBottomNavProps {
    onMoreTap: () => void;
}

/** Maximum tabs shown in the bottom bar (including "More"). */
const MAX_TABS = 5;

export function MobileBottomNav({ onMoreTap }: MobileBottomNavProps) {
    const location = useLocation();
    const app = getAppByPath(location.pathname);
    if (!app) return null;

    const allItems = app.navItems;

    // If there are more items than fit, show (MAX_TABS - 1) + "More"
    const needsMore = allItems.length > MAX_TABS;
    const visibleItems: NavItem[] = needsMore
        ? allItems.slice(0, MAX_TABS - 1)
        : allItems.slice(0, MAX_TABS);

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t"
            style={{
                height: 64,
                background: 'var(--ff-surface)',
                borderColor: 'var(--ff-border)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            {visibleItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                    key={to}
                    to={to}
                    className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors"
                    style={({ isActive }) => ({
                        color: isActive ? 'var(--ff-accent)' : 'var(--ff-text-muted)',
                    })}
                >
                    <Icon size={20} />
                    <span className="truncate max-w-[64px]">{label}</span>
                </NavLink>
            ))}

            {needsMore && (
                <button
                    onClick={onMoreTap}
                    className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors"
                    style={{ color: 'var(--ff-text-muted)', background: 'none', border: 'none' }}
                >
                    <MoreHorizontal size={20} />
                    <span>More</span>
                </button>
            )}
        </nav>
    );
}
