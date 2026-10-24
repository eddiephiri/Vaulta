import { Link, useLocation } from 'react-router-dom';
import { Check, ChevronDown, Grid2X2 } from 'lucide-react';
import { APPS, getAppByPath } from '../lib/apps';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { NavigationPopover } from './NavigationPopover';

export function ModuleSwitcher({ collapsed = false }: { collapsed?: boolean }) {
    const { pathname } = useLocation();
    const app = getAppByPath(pathname);
    const { isGuest, authorizedApps, loading } = useWorkspace();
    const available = Object.values(APPS).filter(candidate =>
        !loading && (!isGuest || authorizedApps?.includes(candidate.id)));
    const Icon = app?.icon ?? Grid2X2;
    return <NavigationPopover key={pathname} label={`Switch module: ${app?.name ?? 'All modules'}`}
        trigger={<>
            <Icon size={22} className="shrink-0" style={{ color: app?.color }} />
            {!collapsed && <span className="flex-1 min-w-0">
                <span className="block text-[10px] uppercase tracking-wide" style={{ color: 'var(--ff-text-muted)' }}>Switch module</span>
                <span className="block text-sm font-semibold">{app?.name ?? 'All modules'}</span>
            </span>}
            {!collapsed && <ChevronDown size={14} className="shrink-0" />}
        </>}>
        {close => <>
            {loading && <p className="p-3 text-sm">Loading modules…</p>}
            {available.map(candidate => <Link key={candidate.id} to={`/${candidate.id}/dashboard`}
                onClick={close} aria-current={app?.id === candidate.id ? 'true' : undefined}
                className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--ff-text-primary)' }}>
                <candidate.icon size={18} style={{ color: candidate.color }} />
                <span className="flex-1">{candidate.name}</span>
                {app?.id === candidate.id && <Check size={16} aria-label="Current module" />}
            </Link>)}
            <Link to="/" onClick={close} className="flex items-center gap-3 p-3 border-t text-sm rounded-lg hover:bg-blue-500/10"
                style={{ borderColor: 'var(--ff-border)', color: 'var(--ff-text-primary)' }}>
                <Grid2X2 size={18} /> All modules
            </Link>
        </>}
    </NavigationPopover>;
}
