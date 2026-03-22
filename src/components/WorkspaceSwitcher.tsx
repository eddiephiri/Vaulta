import { useWorkspace } from '../contexts/WorkspaceContext';
import { Loader2, Layout, ChevronDown } from 'lucide-react';

export function WorkspaceSwitcher() {
    const { activeWorkspaceId, workspaces, loading, switchWorkspace, isSwitching } = useWorkspace();

    if (loading && workspaces.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--ff-border)', background: 'var(--ff-surface)' }}>
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--ff-text-muted)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--ff-text-muted)' }}>Hubs...</span>
            </div>
        );
    }

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

    return (
        <div className="relative group">
            <div 
                className="flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md"
                style={{ 
                    borderColor: 'var(--ff-border)', 
                    background: 'var(--ff-surface)',
                    minWidth: '160px'
                }}
            >
                <div className="p-1.5 rounded-lg" style={{ background: 'var(--ff-accent)15' }}>
                    <Layout size={14} style={{ color: 'var(--ff-accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold opacity-50 mb-0.5" style={{ color: 'var(--ff-text-muted)' }}>Active Hub</p>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--ff-text-primary)' }}>
                        {activeWorkspace?.name || 'Select Hub'}
                    </p>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--ff-text-muted)' }} className="group-hover:translate-y-0.5 transition-transform" />
            </div>

            {/* Dropdown Menu */}
            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-2xl invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 p-2 overflow-hidden"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <div className="px-3 py-2 mb-1 border-b" style={{ borderColor: 'var(--ff-border)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--ff-text-muted)' }}>Switch Workspace</p>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {workspaces.map((ws) => (
                        <button
                            key={ws.id}
                            disabled={isSwitching || ws.id === activeWorkspaceId}
                            onClick={() => switchWorkspace(ws.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 mb-1 last:mb-0 ${
                                ws.id === activeWorkspaceId 
                                ? 'bg-blue-500/10 text-blue-500 cursor-default font-bold' 
                                : 'hover:bg-white/5 text-slate-400 hover:text-white'
                            }`}
                        >
                            <div className={`p-1.5 rounded-lg ${ws.id === activeWorkspaceId ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                                <Layout size={14} />
                            </div>
                            <span className="flex-1 text-left truncate">{ws.name}</span>
                            {ws.id === activeWorkspaceId && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
