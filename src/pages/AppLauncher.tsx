import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { APPS } from '../lib/apps';
import { useWorkspace } from '../contexts/WorkspaceContext';

export function AppLauncher() {
    const navigate = useNavigate();
    const { activeWorkspaceId } = useWorkspace();

    if (!activeWorkspaceId) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6" style={{ background: 'var(--ff-navy)' }}>
                <Loader2 className="animate-spin mb-4" size={32} style={{ color: 'var(--ff-accent)' }} />
                <p style={{ color: 'var(--ff-text-muted)', fontSize: 14 }}>Loading Workspace...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--ff-navy)' }}>
            <header
                className="flex flex-col items-center justify-center pt-16 pb-8 border-b"
                style={{ borderColor: 'var(--ff-border)', background: 'var(--ff-surface)' }}
            >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                    <span className="text-white font-bold text-2xl">V</span>
                </div>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                    Welcome to Vaulta
                </h1>
                <p className="mt-2 text-lg" style={{ color: 'var(--ff-text-muted)' }}>
                    Select an application to launch
                </p>
            </header>

            <main className="flex-1 overflow-y-auto p-8 flex justify-center items-start">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
                    {Object.values(APPS).map((app) => (
                        <button
                            key={app.id}
                            onClick={() => navigate(`/${app.id}/dashboard`)}
                            className="flex flex-col items-start p-6 rounded-xl border transition-all duration-200 text-left hover:-translate-y-1 hover:shadow-lg group"
                            style={{ 
                                background: 'var(--ff-surface)',
                                borderColor: 'var(--ff-border)'
                            }}
                        >
                            <div 
                                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                                style={{ backgroundColor: `${app.color}20`, color: app.color }}
                            >
                                <app.icon size={24} />
                            </div>
                            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ff-text-primary)' }}>
                                {app.name}
                            </h2>
                            <p className="text-sm line-clamp-2" style={{ color: 'var(--ff-text-muted)' }}>
                                {app.description}
                            </p>
                        </button>
                    ))}
                </div>
            </main>
        </div>
    );
}
