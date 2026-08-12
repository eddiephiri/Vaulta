import { useState, useRef } from 'react';
import { Gauge, CheckCircle2, ChevronDown, ChevronUp, Camera, X, AlertTriangle } from 'lucide-react';
import type { Driver, OdometerReading } from '../types';
import { useDriverOdometer } from '../hooks/useDriverOdometer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtKm = (km: number) => km.toLocaleString('en-ZA', { minimumFractionDigits: 0 });

const fmtDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// ─── History entry ────────────────────────────────────────────────────────────

function HistoryRow({ reading, prevReading }: { reading: OdometerReading; prevReading?: OdometerReading }) {
    const delta = prevReading ? reading.reading_km - prevReading.reading_km : null;

    return (
        <div
            className="flex items-center justify-between py-2.5 px-3 rounded-lg"
            style={{ background: 'var(--ff-bg)', border: '1px solid var(--ff-border)' }}
        >
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                    {fmtKm(reading.reading_km)} km
                </span>
                <span className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                    {fmtDate(reading.submitted_at)} · Week {reading.iso_week}
                </span>
                {reading.notes && (
                    <span className="text-[11px] italic" style={{ color: 'var(--ff-text-muted)' }}>
                        "{reading.notes}"
                    </span>
                )}
            </div>
            <div className="flex flex-col items-end gap-1">
                {delta !== null && (
                    <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                            background: delta >= 0 ? '#22c55e18' : '#ef444418',
                            color: delta >= 0 ? '#22c55e' : '#ef4444',
                        }}
                    >
                        +{fmtKm(delta)} km
                    </span>
                )}
                {reading.photo_url && (
                    <a
                        href={reading.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-medium"
                        style={{ color: 'var(--ff-accent)' }}
                    >
                        View photo
                    </a>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface OdometerReminderCardProps {
    driver: Driver;
}

export function OdometerReminderCard({ driver }: OdometerReminderCardProps) {
    const {
        readings,
        submittedThisWeek,
        loading,
        submitting,
        submitError,
        submit,
        uploadPhoto,
    } = useDriverOdometer(driver?.id);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [readingInput, setReadingInput] = useState('');
    const [notes, setNotes] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // History accordion
    const [showHistory, setShowHistory] = useState(false);

    const currentOdometer = (driver.vehicle as any)?.odometer_km as number | undefined;

    // ─── Photo selection ──────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setFormError('Please select an image file.');
            return;
        }
        setPhotoFile(file);
        setFormError(null);
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const removePhoto = () => {
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        setFormError(null);
        const km = Number(readingInput);

        if (!readingInput || isNaN(km) || km < 0) {
            setFormError('Please enter a valid odometer reading.');
            return;
        }

        if (currentOdometer !== undefined && km < currentOdometer) {
            setFormError(
                `Reading (${fmtKm(km)} km) is lower than the vehicle's current odometer (${fmtKm(currentOdometer)} km). Please check and try again.`
            );
            return;
        }

        let photoUrl: string | null = null;
        if (photoFile && driver.workspace_id && driver.id) {
            setUploading(true);
            photoUrl = await uploadPhoto(photoFile, driver.workspace_id, driver.id);
            setUploading(false);
            if (!photoUrl && submitError) return; // upload failed; error already set
        }

        const ok = await submit(km, photoUrl, notes.trim() || null);
        if (ok) {
            setShowForm(false);
            setReadingInput('');
            setNotes('');
            removePhoto();
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setReadingInput('');
        setNotes('');
        setFormError(null);
        removePhoto();
    };

    // ─── Done state (submitted this week) ─────────────────────────────────────
    if (submittedThisWeek && !loading) {
        const thisWeek = readings[0];
        return (
            <div>
                {/* Reminder card — done */}
                <div
                    className="flex items-center gap-3 p-3.5 rounded-xl border"
                    style={{ background: '#22c55e0d', borderColor: '#22c55e30' }}
                >
                    <CheckCircle2 size={20} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
                            Odometer Updated
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                            {thisWeek ? `${fmtKm(thisWeek.reading_km)} km · submitted ${fmtDate(thisWeek.submitted_at)}` : 'Submitted this week'}
                        </p>
                    </div>
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: '#22c55e20', color: '#22c55e' }}
                    >
                        DONE
                    </span>
                </div>

                {/* History accordion */}
                {readings.length > 0 && (
                    <OdometerHistoryAccordion
                        readings={readings}
                        showHistory={showHistory}
                        setShowHistory={setShowHistory}
                    />
                )}
            </div>
        );
    }

    // ─── Pending state ────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-3">
            {/* Reminder card */}
            <div
                className="rounded-xl border overflow-hidden transition-all"
                style={{
                    background: 'var(--ff-surface)',
                    borderColor: showForm ? 'var(--ff-accent)' : 'var(--ff-border)',
                    boxShadow: showForm ? '0 0 0 2px var(--ff-accent)22' : 'none',
                }}
            >
                {/* Header row */}
                <div className="flex items-center gap-3 p-3.5">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--ff-accent)18' }}
                    >
                        <Gauge size={18} style={{ color: 'var(--ff-accent)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--ff-text-primary)' }}>
                            Update Odometer Reading
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--ff-text-muted)' }}>
                            Due every Friday · Current: {currentOdometer !== undefined ? `${fmtKm(currentOdometer)} km` : '—'}
                        </p>
                    </div>
                    {!showForm && (
                        <button
                            id="odometer-update-btn"
                            onClick={() => setShowForm(true)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                            style={{ background: 'var(--ff-accent)', color: 'white' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ff-accent-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ff-accent)')}
                        >
                            Update Now
                        </button>
                    )}
                </div>

                {/* Inline form */}
                {showForm && (
                    <div
                        className="px-4 pb-4 pt-1 flex flex-col gap-3"
                        style={{ borderTop: '1px solid var(--ff-border)' }}
                    >
                        {/* km input */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold" style={{ color: 'var(--ff-text-muted)' }}>
                                New Reading (km) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                id="odometer-reading-input"
                                type="number"
                                min={currentOdometer ?? 0}
                                step="1"
                                placeholder={currentOdometer !== undefined ? `Min ${fmtKm(currentOdometer)}` : 'e.g. 125400'}
                                value={readingInput}
                                onChange={e => { setReadingInput(e.target.value); setFormError(null); }}
                                className="w-full px-3 py-2 rounded-lg text-sm border transition-colors outline-none"
                                style={{
                                    background: 'var(--ff-bg)',
                                    border: '1px solid var(--ff-border)',
                                    color: 'var(--ff-text-primary)',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--ff-accent)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--ff-border)')}
                            />
                        </div>

                        {/* Photo upload */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold" style={{ color: 'var(--ff-text-muted)' }}>
                                Photo of Odometer <span style={{ color: 'var(--ff-text-muted)', fontWeight: 400 }}>(optional)</span>
                            </label>
                            {photoPreview ? (
                                <div className="relative w-full h-32 rounded-lg overflow-hidden">
                                    <img
                                        src={photoPreview}
                                        alt="Odometer preview"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={removePhoto}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                                        style={{ background: '#000000aa' }}
                                    >
                                        <X size={12} style={{ color: 'white' }} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    id="odometer-photo-upload-btn"
                                    onClick={() => fileRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed text-xs transition-colors"
                                    style={{
                                        background: 'var(--ff-bg)',
                                        borderColor: 'var(--ff-border)',
                                        color: 'var(--ff-text-muted)',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'var(--ff-accent)';
                                        e.currentTarget.style.color = 'var(--ff-accent)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'var(--ff-border)';
                                        e.currentTarget.style.color = 'var(--ff-text-muted)';
                                    }}
                                >
                                    <Camera size={14} />
                                    Tap to attach odometer photo
                                </button>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>

                        {/* Notes */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold" style={{ color: 'var(--ff-text-muted)' }}>
                                Notes <span style={{ color: 'var(--ff-text-muted)', fontWeight: 400 }}>(optional)</span>
                            </label>
                            <textarea
                                id="odometer-notes-input"
                                rows={2}
                                placeholder="Any remarks about the vehicle's condition…"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm border transition-colors outline-none resize-none"
                                style={{
                                    background: 'var(--ff-bg)',
                                    border: '1px solid var(--ff-border)',
                                    color: 'var(--ff-text-primary)',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--ff-accent)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--ff-border)')}
                            />
                        </div>

                        {/* Errors */}
                        {(formError || submitError) && (
                            <div
                                className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                                style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}
                            >
                                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                                {formError ?? submitError}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <button
                                id="odometer-submit-btn"
                                onClick={handleSubmit}
                                disabled={submitting || uploading}
                                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-opacity"
                                style={{ background: 'var(--ff-accent)', color: 'white', opacity: (submitting || uploading) ? 0.6 : 1 }}
                            >
                                {uploading ? 'Uploading photo…' : submitting ? 'Saving…' : 'Submit Reading'}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={submitting || uploading}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                style={{
                                    background: 'var(--ff-bg)',
                                    color: 'var(--ff-text-muted)',
                                    border: '1px solid var(--ff-border)',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* History accordion */}
            {readings.length > 0 && (
                <OdometerHistoryAccordion
                    readings={readings}
                    showHistory={showHistory}
                    setShowHistory={setShowHistory}
                />
            )}
        </div>
    );
}

// ─── History Accordion (shared by both states) ────────────────────────────────

function OdometerHistoryAccordion({
    readings,
    showHistory,
    setShowHistory,
}: {
    readings: OdometerReading[];
    showHistory: boolean;
    setShowHistory: (v: boolean) => void;
}) {
    return (
        <div
            className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}
        >
            <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
                style={{ color: 'var(--ff-text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
                <span>Odometer History</span>
                {showHistory ? (
                    <ChevronUp size={16} style={{ color: 'var(--ff-text-muted)' }} />
                ) : (
                    <ChevronDown size={16} style={{ color: 'var(--ff-text-muted)' }} />
                )}
            </button>
            {showHistory && (
                <div className="px-3 pb-3 flex flex-col gap-2">
                    {readings.map((r, i) => (
                        <HistoryRow key={r.id} reading={r} prevReading={readings[i + 1]} />
                    ))}
                </div>
            )}
        </div>
    );
}
