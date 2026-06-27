import { useState, useEffect, useCallback } from 'react';
import { X, Eye, Check, Ban, Undo2, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Driver, DriverDocument, DriverDocumentStatus, DriverProfileEdit } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
    onChange: () => void; // refresh the parent's review flags
    driver: Driver | null;
}

const BUCKET = 'driver-documents';
const DOC_LABELS: Record<string, string> = {
    license: 'Driving Licence', nrc: 'NRC', photo: 'Passport Photo', police_clearance: 'Police Clearance',
};
const FIELD_LABELS: Record<string, string> = {
    name: 'Name', phone: 'Phone', license_number: 'Licence No.', nrc_number: 'NRC No.',
};
const EDITABLE_FIELDS = new Set(['name', 'phone', 'license_number', 'nrc_number']);
const STATUS_META: Record<DriverDocumentStatus, { label: string; color: string }> = {
    pending: { label: 'Pending', color: '#f59e0b' },
    verified: { label: 'Verified', color: '#22c55e' },
    rejected: { label: 'Rejected', color: '#ef4444' },
};

const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function DriverReviewModal({ open, onClose, onChange, driver }: Props) {
    const [docs, setDocs] = useState<DriverDocument[]>([]);
    const [edits, setEdits] = useState<DriverProfileEdit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!driver) return;
        setLoading(true);
        setError(null);
        const [docsRes, editsRes] = await Promise.all([
            supabase.from('driver_documents').select('*').eq('driver_id', driver.id).eq('superseded', false).order('created_at', { ascending: false }),
            supabase.from('driver_profile_edits').select('*').eq('driver_id', driver.id).order('created_at', { ascending: false }),
        ]);
        if (docsRes.error) setError(docsRes.error.message);
        else setDocs(docsRes.data as DriverDocument[]);
        if (editsRes.error) setError(editsRes.error.message);
        else setEdits(editsRes.data as DriverProfileEdit[]);
        setLoading(false);
    }, [driver]);

    useEffect(() => { if (open && driver) load(); }, [open, driver, load]);

    if (!open || !driver) return null;

    const uid = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

    const run = async (id: string, fn: () => Promise<void>) => {
        setBusyId(id); setError(null);
        try { await fn(); await load(); onChange(); }
        catch (e: any) { setError(e.message || 'Action failed.'); }
        finally { setBusyId(null); }
    };

    const setDocStatus = (doc: DriverDocument, status: DriverDocumentStatus) => run(doc.id, async () => {
        const { error: err } = await supabase.from('driver_documents')
            .update({ status, verified_by: await uid(), verified_at: new Date().toISOString() })
            .eq('id', doc.id);
        if (err) throw new Error(err.message);
    });

    const viewDoc = async (doc: DriverDocument) => {
        const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
        if (err) { setError(err.message); return; }
        window.open(data.signedUrl, '_blank', 'noopener');
    };

    const markReviewed = (edit: DriverProfileEdit) => run(edit.id, async () => {
        const { error: err } = await supabase.from('driver_profile_edits')
            .update({ reviewed: true, reviewed_by: await uid(), reviewed_at: new Date().toISOString() })
            .eq('id', edit.id);
        if (err) throw new Error(err.message);
    });

    const revertEdit = (edit: DriverProfileEdit) => run(edit.id, async () => {
        if (!EDITABLE_FIELDS.has(edit.field)) throw new Error('This field cannot be reverted.');
        // Restore the previous value on the driver record…
        const { error: dErr } = await supabase.from('drivers')
            .update({ [edit.field]: edit.old_value }).eq('id', driver.id);
        if (dErr) throw new Error(dErr.message);
        // …and mark the edit reverted + reviewed.
        const { error: eErr } = await supabase.from('driver_profile_edits')
            .update({ reverted: true, reviewed: true, reviewed_by: await uid(), reviewed_at: new Date().toISOString() })
            .eq('id', edit.id);
        if (eErr) throw new Error(eErr.message);
    });

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 16, width: '100%', maxWidth: 'min(520px, 95vw)', padding: '24px 20px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>Review · {driver.name}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4 }}><X size={20} /></button>
                </div>

                {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>{error}</div>}

                {loading ? (
                    <p className="py-8 text-center text-sm" style={{ color: 'var(--ff-text-muted)' }}>Loading…</p>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* Documents */}
                        <section>
                            <h3 className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--ff-text-muted)' }}>Documents</h3>
                            {docs.length === 0 ? (
                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No documents uploaded.</p>
                            ) : (
                                <div className="rounded-xl divide-y" style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)', borderColor: 'var(--ff-border)' }}>
                                    {docs.map(doc => {
                                        const meta = STATUS_META[doc.status];
                                        const busy = busyId === doc.id;
                                        return (
                                            <div key={doc.id} className="px-3 py-3 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText size={15} style={{ color: 'var(--ff-text-muted)', flexShrink: 0 }} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm truncate" style={{ color: 'var(--ff-text-primary)' }}>{DOC_LABELS[doc.doc_type] ?? doc.doc_type}</p>
                                                        <span className="text-xs" style={{ color: meta.color }}>{meta.label}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button onClick={() => viewDoc(doc)} title="View" style={{ color: 'var(--ff-text-muted)', padding: 5 }}><Eye size={16} /></button>
                                                    <button onClick={() => setDocStatus(doc, 'verified')} disabled={busy || doc.status === 'verified'} title="Verify" style={{ color: '#22c55e', padding: 5, opacity: doc.status === 'verified' ? 0.4 : 1 }}>
                                                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                    <button onClick={() => setDocStatus(doc, 'rejected')} disabled={busy || doc.status === 'rejected'} title="Reject" style={{ color: '#ef4444', padding: 5, opacity: doc.status === 'rejected' ? 0.4 : 1 }}>
                                                        <Ban size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Edit history */}
                        <section>
                            <h3 className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--ff-text-muted)' }}>Profile edit history</h3>
                            {edits.length === 0 ? (
                                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>No profile edits.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {edits.map(edit => {
                                        const unreviewed = !edit.reviewed && !edit.reverted;
                                        const busy = busyId === edit.id;
                                        return (
                                            <div key={edit.id} className="rounded-xl p-3"
                                                style={{ background: 'var(--ff-bg)', border: `1px solid ${unreviewed ? '#f59e0b55' : 'var(--ff-border)'}` }}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm" style={{ color: 'var(--ff-text-primary)' }}>
                                                            {FIELD_LABELS[edit.field] ?? edit.field}
                                                            {edit.reverted && <span className="ml-2 text-xs" style={{ color: 'var(--ff-text-muted)' }}>(reverted)</span>}
                                                            {unreviewed && <span className="ml-2 text-xs" style={{ color: '#f59e0b' }}>● new</span>}
                                                        </p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>
                                                            <span style={{ textDecoration: 'line-through' }}>{edit.old_value || '—'}</span>
                                                            {' → '}
                                                            <span style={{ color: 'var(--ff-text-primary)' }}>{edit.new_value || '—'}</span>
                                                        </p>
                                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--ff-text-muted)' }}>{fmt(edit.created_at)}</p>
                                                    </div>
                                                    {!edit.reverted && (
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {unreviewed && (
                                                                <button onClick={() => markReviewed(edit)} disabled={busy} title="Mark reviewed" style={{ color: 'var(--ff-text-muted)', padding: 5 }}>
                                                                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                                                </button>
                                                            )}
                                                            <button onClick={() => revertEdit(edit)} disabled={busy} title="Revert to previous value" style={{ color: 'var(--ff-accent)', padding: 5 }}>
                                                                <Undo2 size={15} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
