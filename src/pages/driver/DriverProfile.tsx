import { useState, useRef } from 'react';
import { Pencil, Upload, Eye, Loader2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDriver } from '../../contexts/DriverContext';
import { useDriverDocuments } from '../../hooks/useDriverDocuments';
import type { DriverDocument, DriverDocumentType, DriverDocumentStatus } from '../../types';

const DOC_TYPES: { key: DriverDocumentType; label: string }[] = [
    { key: 'license', label: 'Driving Licence' },
    { key: 'nrc', label: 'NRC' },
    { key: 'photo', label: 'Passport Photo' },
    { key: 'police_clearance', label: 'Police Clearance' },
];

const STATUS_META: Record<DriverDocumentStatus, { label: string; color: string }> = {
    pending: { label: 'Pending review', color: '#f59e0b' },
    verified: { label: 'Verified', color: '#22c55e' },
    rejected: { label: 'Rejected', color: '#ef4444' },
};

const INPUT_STYLE = {
    background: 'var(--ff-bg)',
    color: 'var(--ff-text-primary)',
    border: '1px solid var(--ff-border)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
};

export function DriverProfile() {
    const { driver, refetch } = useDriver();
    const docs = useDriverDocuments(driver);

    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ name: '', license_number: '', nrc_number: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startEdit = () => {
        if (!driver) return;
        setForm({
            name: driver.name ?? '',
            license_number: driver.license_number ?? '',
            nrc_number: driver.nrc_number ?? '',
        });
        setError(null);
        setEditing(true);
    };

    const save = async () => {
        if (!form.name.trim()) { setError('Name is required.'); return; }
        setSaving(true);
        setError(null);
        const { error: err } = await supabase.rpc('driver_update_profile', {
            p_name: form.name.trim(),
            p_license_number: form.license_number.trim() || null,
            p_nrc_number: form.nrc_number.trim() || null,
        });
        setSaving(false);
        if (err) { setError(err.message); return; }
        await refetch();
        setEditing(false);
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>Profile</h1>
                {!editing && (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
                        style={{ color: 'var(--ff-accent)', border: '1px solid var(--ff-border)' }}>
                        <Pencil size={14} /> Edit
                    </button>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>{error}</div>
            )}

            {/* Personal details */}
            {editing ? (
                <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                    {([
                        ['Name', 'name'],
                        ['Licence No.', 'license_number'],
                        ['NRC No.', 'nrc_number'],
                    ] as [string, keyof typeof form][]).map(([label, key]) => (
                        <div key={key}>
                            <label className="block text-xs mb-1" style={{ color: 'var(--ff-text-muted)' }}>{label}</label>
                            <input style={INPUT_STYLE} value={form[key]}
                                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                        </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-lg text-sm"
                            style={{ border: '1px solid var(--ff-border)', color: 'var(--ff-text-muted)' }}>Cancel</button>
                        <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                            style={{ background: saving ? '#334155' : 'var(--ff-accent)' }}>
                            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl divide-y" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderColor: 'var(--ff-border)' }}>
                    {([
                        ['Name', driver?.name],
                        ['Phone', driver?.phone],
                        ['Licence No.', driver?.license_number],
                        ['NRC No.', driver?.nrc_number],
                    ] as [string, string | null | undefined][]).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between px-4 py-3">
                            <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{label}</span>
                            <span className="text-sm" style={{ color: 'var(--ff-text-primary)' }}>{value || '—'}</span>
                        </div>
                    ))}
                </div>
            )}
            {!editing && (
                <p className="text-xs -mt-3 px-1" style={{ color: 'var(--ff-text-muted)' }}>
                    Your phone is your sign-in number — ask your manager to change it.
                </p>
            )}

            {/* Documents */}
            <div>
                <p className="text-xs uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--ff-text-muted)' }}>Documents</p>
                <div className="rounded-xl divide-y" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderColor: 'var(--ff-border)' }}>
                    {DOC_TYPES.map(({ key, label }) => (
                        <DocRow key={key} label={label}
                            doc={docs.current(key)}
                            onUpload={file => docs.upload(key, file)}
                            onView={docs.viewUrl} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function DocRow({ label, doc, onUpload, onView }: {
    label: string;
    doc: DriverDocument | undefined;
    onUpload: (file: File) => Promise<void>;
    onView: (doc: DriverDocument) => Promise<string | null>;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file
        if (!file) return;
        setBusy(true); setErr(null);
        try { await onUpload(file); }
        catch (ex: any) { setErr(ex.message || 'Upload failed.'); }
        finally { setBusy(false); }
    };

    const view = async () => {
        if (!doc) return;
        const url = await onView(doc);
        if (url) window.open(url, '_blank', 'noopener');
    };

    const status = doc ? STATUS_META[doc.status] : null;

    return (
        <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} style={{ color: 'var(--ff-text-muted)', flexShrink: 0 }} />
                    <span className="text-sm truncate" style={{ color: 'var(--ff-text-primary)' }}>{label}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {status ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${status.color}20`, color: status.color }}>
                            {status.label}
                        </span>
                    ) : (
                        <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>Not uploaded</span>
                    )}
                    {doc && (
                        <button onClick={view} title="View" style={{ color: 'var(--ff-text-muted)', padding: 4 }}>
                            <Eye size={16} />
                        </button>
                    )}
                    <button onClick={() => inputRef.current?.click()} disabled={busy}
                        title={doc ? 'Replace' : 'Upload'} style={{ color: 'var(--ff-accent)', padding: 4 }}>
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    </button>
                    <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={handleFile} />
                </div>
            </div>
            {err && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{err}</p>}
        </div>
    );
}
