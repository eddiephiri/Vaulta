import { useWorkspace } from '../contexts/WorkspaceContext';
import { Check, ChevronDown, Layout, Loader2 } from 'lucide-react';
import { NavigationPopover } from './NavigationPopover';

export function WorkspaceSwitcher() {
    const { activeWorkspaceId, workspaces, loading, switchWorkspace, isSwitching } = useWorkspace();
    const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId);
    return <NavigationPopover key={activeWorkspaceId} label={`Switch workspace: ${activeWorkspace?.name ?? 'Select workspace'}`} align="right"
        trigger={<>
            {loading || isSwitching ? <Loader2 size={16} className="animate-spin shrink-0" /> : <Layout size={16} className="shrink-0" />}
            <span className="block min-w-0 max-w-20 sm:max-w-40">
                <span className="block text-[10px] uppercase tracking-wide" style={{ color: 'var(--ff-text-muted)' }}>Workspace</span>
                <span className="block text-sm font-semibold truncate">{activeWorkspace?.name ?? 'Select workspace'}</span>
            </span>
            <ChevronDown size={14} className="shrink-0" />
        </>}>
        {close => <>
            <p className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--ff-text-muted)' }}>Switch workspace</p>
            <div className="max-h-64 overflow-y-auto">
                {workspaces.map(workspace => <button key={workspace.id} type="button"
                    disabled={isSwitching || workspace.id === activeWorkspaceId}
                    onClick={() => { close(); switchWorkspace(workspace.id); }}
                    className="flex items-center gap-3 w-full text-left rounded-lg p-3 text-sm hover:bg-blue-500/10 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-500"
                    style={{ color: 'var(--ff-text-primary)' }}>
                    <span className="flex-1 truncate">{workspace.name}</span>
                    {workspace.id === activeWorkspaceId && <Check size={16} aria-label="Current workspace" />}
                </button>)}
                {!loading && workspaces.length === 0 && <p className="p-3 text-sm">No workspaces available.</p>}
            </div>
        </>}
    </NavigationPopover>;
}
