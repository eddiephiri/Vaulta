import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Layout, ArrowRight, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { APPS } from '../lib/apps';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';

export function AppLauncher() {
    const navigate = useNavigate();
    const { activeWorkspaceId, workspaces, isGuest, authorizedApps, loading, switchWorkspace } = useWorkspace();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(activeWorkspaceId);

    if (loading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6" style={{ background: 'var(--ff-navy)' }}>
                <Loader2 className="animate-spin mb-4" size={32} style={{ color: 'var(--ff-accent)' }} />
                <p style={{ color: 'var(--ff-text-muted)', fontSize: 14 }}>Loading Workspaces...</p>
            </div>
        );
    }

    // Step 1: Select Workspace
    if (!selectedWorkspaceId || (!activeWorkspaceId && workspaces.length > 0)) {
        return (
            <div className="flex flex-col min-h-screen overflow-hidden" style={{ background: 'var(--ff-navy)' }}>
                <header className="flex flex-col items-center justify-center pt-16 pb-8 border-b"
                    style={{ borderColor: 'var(--ff-border)', background: 'var(--ff-surface)' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                        <span className="text-white font-bold text-2xl">V</span>
                    </div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>Select Workspace</h1>
                    <p className="mt-2 text-lg" style={{ color: 'var(--ff-text-muted)' }}>Choose a workspace to continue</p>
                </header>

                <main className="flex-1 overflow-y-auto p-8 flex justify-center items-start">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
                        {workspaces.map((ws) => (
                            <button
                                key={ws.id}
                                onClick={() => {
                                    setSelectedWorkspaceId(ws.id);
                                    if (activeWorkspaceId !== ws.id) {
                                        switchWorkspace(ws.id, false);
                                    }
                                }}
                                className="flex flex-col items-start p-6 rounded-xl border transition-all duration-200 text-left hover:-translate-y-1 hover:shadow-lg group"
                                style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}
                            >
                                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                                    style={{ backgroundColor: 'var(--ff-accent)20', color: 'var(--ff-accent)' }}>
                                    <Layout size={24} />
                                </div>
                                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ff-text-primary)' }}>{ws.name}</h2>
                                <p className="text-sm line-clamp-2 mb-4 flex-1" style={{ color: 'var(--ff-text-muted)' }}>{ws.description || 'No description'}</p>
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ff-accent)' }}>
                                    Launch <ArrowRight size={14} />
                                </div>
                            </button>
                        ))}

                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all duration-200 hover:border-blue-500/50 hover:bg-blue-500/5 group"
                            style={{ borderColor: 'var(--ff-border)', minHeight: 180 }}
                        >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-white/5 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors">
                                <Plus size={24} />
                            </div>
                            <span className="font-semibold" style={{ color: 'var(--ff-text-primary)' }}>Create New Workspace</span>
                        </button>

                        <button
                            onClick={() => navigate('/join')}
                            className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all duration-200 hover:border-blue-500/50 hover:bg-blue-500/5 group"
                            style={{ borderColor: 'var(--ff-border)', minHeight: 180 }}
                        >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-white/5 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors">
                                <ShieldCheck size={24} />
                            </div>
                            <span className="font-semibold" style={{ color: 'var(--ff-text-primary)' }}>Redeem Access Code</span>
                        </button>
                    </div>
                </main>

                <CreateWorkspaceModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
            </div>
        );
    }

    // Step 2: Select App (within workspace)
    const activeWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);

    return (
        <div className="flex flex-col min-h-screen overflow-hidden" style={{ background: 'var(--ff-navy)' }}>
            <header className="flex flex-col items-center justify-center pt-16 pb-8 border-b"
                style={{ borderColor: 'var(--ff-border)', background: 'var(--ff-surface)' }}>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                    {activeWorkspace?.name || 'Welcome to Vaulta'}
                </h1>
                <p className="mt-2 text-lg" style={{ color: 'var(--ff-text-muted)' }}>Select an application to launch</p>
                <div className="mt-4 flex gap-3">
                    <button 
                        onClick={() => setSelectedWorkspaceId(null)}
                        className="text-xs font-bold uppercase tracking-wider hover:text-white transition-colors flex items-center gap-1.5"
                        style={{ color: 'var(--ff-text-muted)' }}
                    >
                        <Layout size={14} /> {isGuest ? 'Workspaces' : 'Switch Workspace'}
                    </button>
                    {!isGuest && (
                        <>
                            <div className="w-px h-3 bg-slate-700 self-center" />
                            <button 
                                onClick={() => navigate('/transport/settings')}
                                className="text-xs font-bold uppercase tracking-wider hover:text-white transition-colors flex items-center gap-1.5"
                                style={{ color: 'var(--ff-text-muted)' }}
                            >
                                <SettingsIcon size={14} /> Settings
                            </button>
                        </>
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8 flex justify-center items-start">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
                    {Object.values(APPS)
                        .filter(app => !isGuest || authorizedApps?.includes(app.id))
                        .map((app) => (
                            <button
                                key={app.id}
                                onClick={() => navigate(`/${app.id}/dashboard`)}
                                className="flex flex-col items-start p-6 rounded-xl border transition-all duration-200 text-left hover:-translate-y-1 hover:shadow-lg group"
                                style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}
                            >
                                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                                    style={{ backgroundColor: `${app.color}20`, color: app.color }}>
                                    <app.icon size={24} />
                                </div>
                                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ff-text-primary)' }}>{app.name}</h2>
                                <p className="text-sm line-clamp-2" style={{ color: 'var(--ff-text-muted)' }}>{app.description}</p>
                            </button>
                        ))}
                </div>
            </main>
        </div>
    );
}
