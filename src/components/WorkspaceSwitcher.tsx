import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';

interface Workspace {
    id: string;
    name: string;
}

export function WorkspaceSwitcher() {
    const { activeWorkspaceId, switchWorkspace, isSwitching } = useWorkspace();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch workspaces the current user belongs to
        async function fetchWorkspaces() {
            const { data, error } = await supabase
                .from('workspaces')
                .select('id, name');
            
            if (!error && data) {
                setWorkspaces(data);
                
                // If there's no active workspace yet (e.g., first login), auto-select the first one
                if (!activeWorkspaceId && data.length > 0) {
                    switchWorkspace(data[0].id);
                }
            }
            setLoading(false);
        }

        fetchWorkspaces();
    }, [activeWorkspaceId]);

    const handleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newWorkspaceId = e.target.value;
        if (newWorkspaceId && newWorkspaceId !== activeWorkspaceId) {
             switchWorkspace(newWorkspaceId);
        }
    };

    if (loading) return <span style={{ color: 'var(--ff-text-muted)', fontSize: '14px' }}>Loading Hubs...</span>;

    if (workspaces.length === 0) {
        return <span style={{ color: 'var(--ff-text-muted)', fontSize: '14px' }}>No Hubs Found</span>;
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="workspace-select" style={{ fontSize: '14px', color: 'var(--ff-text)' }}>
                Active Hub:
            </label>
            <select 
                id="workspace-select"
                value={activeWorkspaceId || ''} 
                onChange={handleSwitch}
                disabled={isSwitching}
                style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--ff-border)',
                    backgroundColor: 'var(--ff-surface)',
                    color: 'var(--ff-text)',
                    fontSize: '14px',
                    cursor: isSwitching ? 'not-allowed' : 'pointer',
                    opacity: isSwitching ? 0.7 : 1
                }}
            >
                {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                        {ws.name}
                    </option>
                ))}
            </select>
            {isSwitching && <span style={{ fontSize: '12px', color: 'var(--ff-primary)' }}>Switching...</span>}
        </div>
    );
}
