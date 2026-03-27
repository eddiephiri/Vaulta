import { useState } from 'react';
import { X, Plus, Layout } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface CreateWorkspaceModalProps {
    open: boolean;
    onClose: () => void;
}

export function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
    const { createWorkspace } = useWorkspace();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        const wsId = await createWorkspace(name.trim(), description.trim());
        setLoading(false);

        if (wsId) {
            onClose();
            setName('');
            setDescription('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-[min(448px,95vw)] rounded-2xl p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto" 
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--ff-accent)20' }}>
                            <Layout size={20} style={{ color: 'var(--ff-accent)' }} />
                        </div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>New Workspace</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors">
                        <X size={20} style={{ color: 'var(--ff-text-muted)' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ff-text-muted)' }}>
                            Workspace Name
                        </label>
                        <input
                            autoFocus
                            type="text"
                            required
                            placeholder="e.g. Personal Travels, Fleet Business"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500/50"
                            style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ff-text-muted)' }}>
                            Description (Optional)
                        </label>
                        <textarea
                            placeholder="Short summary of what this workspace manages..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                            style={{ background: 'var(--ff-surface)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                            style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <><Plus size={16} /> Create Workspace</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
