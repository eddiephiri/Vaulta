import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface WorkspaceContextType {
    activeWorkspaceId: string | null;
    isSwitching: boolean;
    switchWorkspace: (workspaceId: string, shouldNavigate?: boolean) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { session, user } = useAuth();
    const navigate = useNavigate();
    
    // Initialize synchronously from session to prevent initial render with null ID
    const initialWorkspaceId = (session?.user?.app_metadata?.workspace_id as string) || 
                               (session?.user?.user_metadata?.workspace_id as string) || 
                               null;

    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(initialWorkspaceId);
    const [isSwitching, setIsSwitching] = useState(false);

    // Keep it in sync if session updates externally, or fallback to DB if JWT lacks it
    useEffect(() => {
        let isMounted = true;

        const ensureWorkspace = async () => {
            const currentSessionId = (session?.user?.app_metadata?.workspace_id as string) || 
                                     (session?.user?.user_metadata?.workspace_id as string) || 
                                     null;
            
            if (currentSessionId) {
                if (currentSessionId !== activeWorkspaceId && isMounted) {
                    setActiveWorkspaceId(currentSessionId);
                }
                return;
            }

            // Fallback: the token doesn't have it, let's query the DB.
            if (!user || activeWorkspaceId) return;

            try {
                const { data } = await supabase
                    .from('workspace_users')
                    .select('workspace_id')
                    .eq('user_id', user.id)
                    .order('last_active_workspace', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data?.workspace_id && isMounted) {
                    await switchWorkspace(data.workspace_id, false);
                }
            } catch (err) {
                console.error("Failed to fallback fetch workspace:", err);
            }
        };

        ensureWorkspace();
        return () => { isMounted = false; };
    }, [session, activeWorkspaceId, user]);

    const switchWorkspace = async (workspaceId: string, shouldNavigate = true) => {
        if (!user) return;
        setIsSwitching(true);

        try {
            // 1. Update the last_active_workspace flag in Supabase
            // This triggers the DB function to update the user's JWT metadata
            const { error: updateError } = await supabase
                .from('workspace_users')
                .update({ last_active_workspace: true })
                .eq('workspace_id', workspaceId)
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            // 2. Force Supabase to issue a new JWT containing the updated workspace_id claim
            const { error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError) {
                // Notifying user of security context failure
                alert("Security Context could not be updated. Please try logging in again.");
                throw refreshError;
            }

            // 3. Update local state so UI re-renders with new module data
            setActiveWorkspaceId(workspaceId);

            // 4. Redirect to the App Launcher or the newly selected dashboard
            if (shouldNavigate) {
                navigate('/');
            }
            
        } catch (error) {
            console.error("Failed to switch workspace:", error);
            // Optionally add toast notification here
        } finally {
            setIsSwitching(false);
        }
    };

    return (
        <WorkspaceContext.Provider value={{ activeWorkspaceId, isSwitching, switchWorkspace }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

// Hook for consuming the context
export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
