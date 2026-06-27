import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface UseDriverReviewFlagsReturn {
    /** driver_ids that have a pending document or an unreviewed profile edit. */
    flagged: Set<string>;
    refetch: () => void;
}

// Admin-side: which drivers in the active workspace have something needing
// attention — a pending (unverified) document or an unreviewed profile edit.
export function useDriverReviewFlags(): UseDriverReviewFlagsReturn {
    const { activeWorkspaceId } = useWorkspace();
    const [flagged, setFlagged] = useState<Set<string>>(new Set());

    const fetchFlags = useCallback(async () => {
        if (!activeWorkspaceId) { setFlagged(new Set()); return; }

        const [docsRes, editsRes] = await Promise.all([
            supabase
                .from('driver_documents')
                .select('driver_id')
                .eq('workspace_id', activeWorkspaceId)
                .eq('status', 'pending')
                .eq('superseded', false),
            supabase
                .from('driver_profile_edits')
                .select('driver_id')
                .eq('workspace_id', activeWorkspaceId)
                .eq('reviewed', false)
                .eq('reverted', false),
        ]);

        const ids = new Set<string>();
        (docsRes.data ?? []).forEach((r: { driver_id: string }) => ids.add(r.driver_id));
        (editsRes.data ?? []).forEach((r: { driver_id: string }) => ids.add(r.driver_id));
        setFlagged(ids);
    }, [activeWorkspaceId]);

    useEffect(() => { fetchFlags(); }, [fetchFlags]);

    return { flagged, refetch: fetchFlags };
}
