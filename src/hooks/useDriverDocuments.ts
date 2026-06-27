import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Driver, DriverDocument, DriverDocumentType } from '../types';

const BUCKET = 'driver-documents';

interface UseDriverDocumentsReturn {
    documents: DriverDocument[];
    loading: boolean;
    error: string | null;
    /** Current (non-superseded) document for a type, if any. */
    current: (type: DriverDocumentType) => DriverDocument | undefined;
    upload: (type: DriverDocumentType, file: File) => Promise<void>;
    viewUrl: (doc: DriverDocument) => Promise<string | null>;
    refetch: () => void;
}

const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export function useDriverDocuments(driver: Driver | null): UseDriverDocumentsReturn {
    const [documents, setDocuments] = useState<DriverDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDocs = useCallback(async () => {
        if (!driver) { setDocuments([]); setLoading(false); return; }
        setLoading(true);
        setError(null);
        // RLS restricts this to the driver's own documents.
        const { data, error: err } = await supabase
            .from('driver_documents')
            .select('*')
            .eq('driver_id', driver.id)
            .order('created_at', { ascending: false });
        if (err) setError(err.message);
        else setDocuments((data ?? []) as DriverDocument[]);
        setLoading(false);
    }, [driver]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const current = useCallback(
        (type: DriverDocumentType) => documents.find(d => d.doc_type === type && !d.superseded),
        [documents]
    );

    const upload = useCallback(async (type: DriverDocumentType, file: File) => {
        if (!driver) throw new Error('No driver profile.');
        // Path must be '<workspace_id>/<driver_id>/...' for the storage RLS to match.
        const path = `${driver.workspace_id}/${driver.id}/${type}/${Date.now()}_${sanitize(file.name)}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);

        const { data: userData } = await supabase.auth.getUser();
        const { error: insErr } = await supabase.from('driver_documents').insert({
            driver_id: driver.id,
            workspace_id: driver.workspace_id,
            doc_type: type,
            storage_path: path,
            uploaded_by: userData.user?.id ?? null,
        });
        if (insErr) throw new Error(insErr.message);

        await fetchDocs();
    }, [driver, fetchDocs]);

    const viewUrl = useCallback(async (doc: DriverDocument) => {
        const { data, error: err } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(doc.storage_path, 60);
        if (err) { setError(err.message); return null; }
        return data.signedUrl;
    }, []);

    return { documents, loading, error, current, upload, viewUrl, refetch: fetchDocs };
}
